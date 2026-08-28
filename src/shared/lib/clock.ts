const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Timezone primitive (PRD 03). Uses `Intl.DateTimeFormat` offset resolution only — no date
 * library. All instants are UTC `Date`s; the IANA zone is only ever an input.
 */
class Clock {
  private formatters = new Map<string, Intl.DateTimeFormat>();

  now(): Date {
    return new Date();
  }

  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MS_PER_DAY);
  }

  /** Convert "HH:mm" wall-clock in an IANA zone, on the calendar day `date` falls on in that zone, to a UTC Date. */
  zonedTimeToUtc(date: Date, timeOfDay: string, timeZone: string): Date {
    const parts = this.partsInZone(date, timeZone);
    const [hour, minute] = timeOfDay.split(':').map(Number);
    return this.resolve(parts.year, parts.month, parts.day, hour, minute, timeZone);
  }

  /**
   * Re-anchor a *civil* datetime — one carrying no zone of its own — into `timeZone`.
   *
   * The argument is a carrier, not an instant: its UTC fields hold the year/month/day/hour/minute
   * a human wrote down, and the returned Date is the instant at which those same numbers are the
   * wall clock in `timeZone`. Feed it 13:00 UTC with `Asia/Tbilisi` and you get 09:00 UTC, because
   * that is when a Tbilisi clock reads 13:00.
   *
   * This exists because `<input type="datetime-local">` submits `"2026-08-22T13:00"` with no zone
   * at all, and `new Date(...)` resolves that against **the server process's** zone. On Vercel that
   * is UTC, so a Tbilisi clinic typing 13:00 stored 13:00Z and every patient-facing surface printed
   * 17:00 — four hours late, and invisible in the builder, which sliced the same UTC string back
   * out and redisplayed the 13:00 that had been typed. The parse is pinned to UTC upstream (see
   * `DateSchema`) so the carrier is deterministic whatever `TZ` the process happens to run under,
   * and the real zone is applied here, where the clinic is known.
   */
  zonedCivilToUtc(civil: Date, timeZone: string): Date {
    return this.resolve(
      civil.getUTCFullYear(),
      civil.getUTCMonth() + 1,
      civil.getUTCDate(),
      civil.getUTCHours(),
      civil.getUTCMinutes(),
      timeZone
    );
  }

  /**
   * The inverse of `zonedCivilToUtc`, rendered as `YYYY-MM-DDTHH:mm` — exactly what a
   * `datetime-local` input expects.
   *
   * The round trip has to close: the builder shows a stored appointment by converting the instant
   * back to the clinic's wall clock, and saving an untouched form must not move it. Slicing the
   * ISO string instead (`iso.slice(0, 16)`) shows the UTC wall clock, so every save would re-anchor
   * a number that was never local and walk the appointment by the clinic's offset each time.
   */
  civilInZone(date: Date, timeZone: string): string {
    const parts = this.partsInZone(date, timeZone);
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    const hour = String(parts.hour).padStart(2, '0');
    const minute = String(parts.minute).padStart(2, '0');
    return `${parts.year}-${month}-${day}T${hour}:${minute}`;
  }

  /**
   * The zone-local calendar date as `YYYY-MM-DD`.
   *
   * Used as a once-per-day key: "has this patient already had today's email" is a question about
   * their clinic's calendar day, not about a rolling 24 hours, so it must not be derived from UTC.
   */
  dateKeyInZone(date: Date, timeZone: string): string {
    const parts = this.partsInZone(date, timeZone);
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    return `${parts.year}-${month}-${day}`;
  }

  /** Hour 0-23 as seen in the zone, for deciding whether a clinic's morning has arrived. */
  hourInZone(date: Date, timeZone: string): number {
    return this.partsInZone(date, timeZone).hour;
  }

  /** Whole zone-local days from one date to another; negative when `to` is in the past. */
  daysBetweenInZone(from: Date, to: Date, timeZone: string): number {
    const start = this.partsInZone(from, timeZone);
    const end = this.partsInZone(to, timeZone);
    const startCivil = Date.UTC(start.year, start.month - 1, start.day);
    const endCivil = Date.UTC(end.year, end.month - 1, end.day);
    return Math.round((endCivil - startCivil) / MS_PER_DAY);
  }

  /** Weekday 0-6 (Sunday = 0) for a Date as seen in the given zone. */
  weekdayInZone(date: Date, timeZone: string): number {
    const parts = this.partsInZone(date, timeZone);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  }

  /**
   * Inclusive list of calendar dates between two dates as seen in the zone.
   * Each entry is the UTC instant of local midnight for that zone-local day, so feeding an entry
   * back into `zonedTimeToUtc` always resolves against the intended calendar date.
   */
  /**
   * Reinterpret a date the user picked, stored at UTC midnight, as that same calendar date in
   * `timeZone`.
   *
   * `startsOn` and `endsOn` are civil dates, not instants: a clinic picked "29 August" in a date
   * input and the value went to the database as `2026-08-29T00:00:00.000Z`. Reading that instant
   * back in the plan's zone only returns the 29th for zones east of UTC. West of it the same
   * instant is the evening of the 28th, so a window walked from it starts a day early and — the
   * half that gets reported — stops a day short, losing the final day of the plan with no error
   * anywhere.
   *
   * The civil parts are therefore read in UTC, which is the calendar the value was written in, and
   * resolved to local midnight on that date.
   *
   * Only for stored dates. A real instant — `dueAt`, `scheduledAt`, `now` — must keep going
   * through `eachDayInZone`, which asks what local day an instant actually fell on.
   */
  civilDateInZone(date: Date, timeZone: string): Date {
    return this.resolve(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      0,
      0,
      timeZone
    );
  }

  eachDayInZone(from: Date, to: Date, timeZone: string): Date[] {
    const start = this.partsInZone(from, timeZone);
    const end = this.partsInZone(to, timeZone);
    // Civil-date arithmetic in the UTC "calendar space" — exact, because UTC has no DST.
    const startCivil = Date.UTC(start.year, start.month - 1, start.day);
    const endCivil = Date.UTC(end.year, end.month - 1, end.day);
    const days: Date[] = [];
    for (let civil = startCivil; civil <= endCivil; civil += MS_PER_DAY) {
      const cursor = new Date(civil);
      days.push(
        this.resolve(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          cursor.getUTCDate(),
          0,
          0,
          timeZone
        )
      );
    }
    return days;
  }

  /**
   * Resolve a zone-local civil datetime to its UTC instant.
   * Two passes: guess with a zero offset, measure the zone's real offset at that guess, correct,
   * then re-measure so a DST transition between guess and result is picked up.
   */
  private resolve(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone: string
  ): Date {
    const civil = Date.UTC(year, month - 1, day, hour, minute, 0);
    const firstPass = civil - this.offsetMs(new Date(civil), timeZone);
    const secondPass = civil - this.offsetMs(new Date(firstPass), timeZone);
    return new Date(secondPass);
  }

  /** Milliseconds the zone is ahead of UTC at the given instant. */
  private offsetMs(date: Date, timeZone: string): number {
    const parts = this.partsInZone(date, timeZone);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    // Formatted parts carry no milliseconds, so compare against a whole-second instant.
    return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
  }

  private partsInZone(date: Date, timeZone: string): ZonedParts {
    const parsed = this.formatter(timeZone).formatToParts(date);
    const values = new Map(parsed.map(part => [part.type, part.value]));
    return {
      year: Number(values.get('year')),
      month: Number(values.get('month')),
      day: Number(values.get('day')),
      hour: Number(values.get('hour')),
      minute: Number(values.get('minute')),
      second: Number(values.get('second')),
    };
  }

  private formatter(timeZone: string): Intl.DateTimeFormat {
    const cached = this.formatters.get(timeZone);
    if (cached) return cached;
    const created = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    this.formatters.set(timeZone, created);
    return created;
  }
}

export const clock = new Clock();
export { Clock };
