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
