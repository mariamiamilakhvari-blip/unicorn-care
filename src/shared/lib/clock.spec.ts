import { describe, it, expect } from 'vitest';

import { clock, Clock } from '@/shared/lib/clock';

const LONDON = 'Europe/London';
const TBILISI = 'Asia/Tbilisi';
const NEW_YORK = 'America/New_York';

describe('clock.now', () => {
  it('returns a Date close to the current instant', () => {
    const before = Date.now();
    const now = clock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('clock.addDays', () => {
  it('adds whole days as 24h increments', () => {
    const result = clock.addDays(new Date('2025-01-01T10:00:00Z'), 3);
    expect(result.toISOString()).toBe('2025-01-04T10:00:00.000Z');
  });

  it('supports negative days', () => {
    const result = clock.addDays(new Date('2025-01-01T10:00:00Z'), -1);
    expect(result.toISOString()).toBe('2024-12-31T10:00:00.000Z');
  });
});

describe('clock.zonedTimeToUtc — DST boundary (Europe/London)', () => {
  // BST 2025 begins Sunday 30 March at 01:00 GMT. Before it London is UTC+0, after it UTC+1.
  it('resolves 09:00 local to 09:00Z before the spring-forward', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-03-29T12:00:00Z'), '09:00', LONDON);
    expect(result.toISOString()).toBe('2025-03-29T09:00:00.000Z');
  });

  it('resolves the same 09:00 local to 08:00Z after the spring-forward', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-03-31T12:00:00Z'), '09:00', LONDON);
    expect(result.toISOString()).toBe('2025-03-31T08:00:00.000Z');
  });

  it('shifts the UTC instant by exactly one hour across the boundary', () => {
    const before = clock.zonedTimeToUtc(new Date('2025-03-29T12:00:00Z'), '09:00', LONDON);
    const after = clock.zonedTimeToUtc(new Date('2025-03-31T12:00:00Z'), '09:00', LONDON);
    const twoCivilDays = 2 * 24 * 60 * 60 * 1000;
    expect(after.getTime() - before.getTime()).toBe(twoCivilDays - 60 * 60 * 1000);
  });

  it('resolves the autumn fall-back correctly', () => {
    // BST 2025 ends Sunday 26 October at 02:00 BST.
    const stillBst = clock.zonedTimeToUtc(new Date('2025-10-25T12:00:00Z'), '09:00', LONDON);
    const backToGmt = clock.zonedTimeToUtc(new Date('2025-10-27T12:00:00Z'), '09:00', LONDON);
    expect(stillBst.toISOString()).toBe('2025-10-25T08:00:00.000Z');
    expect(backToGmt.toISOString()).toBe('2025-10-27T09:00:00.000Z');
  });
});

describe('clock.zonedTimeToUtc — fixed-offset zone (Asia/Tbilisi)', () => {
  // Georgia is permanently UTC+4 with no DST — the clinic default timezone.
  it('resolves 08:00 local to 04:00Z in March', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-03-29T12:00:00Z'), '08:00', TBILISI);
    expect(result.toISOString()).toBe('2025-03-29T04:00:00.000Z');
  });

  it('resolves 08:00 local to 04:00Z after the European DST switch too', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-03-31T12:00:00Z'), '08:00', TBILISI);
    expect(result.toISOString()).toBe('2025-03-31T04:00:00.000Z');
  });

  it('resolves 20:00 local to 16:00Z in midwinter', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-01-15T00:30:00Z'), '20:00', TBILISI);
    expect(result.toISOString()).toBe('2025-01-15T16:00:00.000Z');
  });

  it('uses the calendar day as seen in the zone, not the UTC day', () => {
    // 2025-01-14T22:00Z is already 2025-01-15 02:00 in Tbilisi.
    const result = clock.zonedTimeToUtc(new Date('2025-01-14T22:00:00Z'), '08:00', TBILISI);
    expect(result.toISOString()).toBe('2025-01-15T04:00:00.000Z');
  });
});

describe('clock.zonedTimeToUtc — negative offset zone', () => {
  it('resolves 08:00 New York local to 13:00Z in winter (UTC-5)', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-01-15T18:00:00Z'), '08:00', NEW_YORK);
    expect(result.toISOString()).toBe('2025-01-15T13:00:00.000Z');
  });

  it('resolves 08:00 New York local to 12:00Z in summer (UTC-4)', () => {
    const result = clock.zonedTimeToUtc(new Date('2025-07-15T18:00:00Z'), '08:00', NEW_YORK);
    expect(result.toISOString()).toBe('2025-07-15T12:00:00.000Z');
  });
});

describe('clock.weekdayInZone', () => {
  it('returns 0 for Sunday', () => {
    expect(clock.weekdayInZone(new Date('2025-03-30T12:00:00Z'), LONDON)).toBe(0);
  });

  it('returns 1 for Monday', () => {
    expect(clock.weekdayInZone(new Date('2025-03-31T12:00:00Z'), LONDON)).toBe(1);
  });

  it('uses the zone-local day, not the UTC day', () => {
    // 2025-03-30T22:00Z is Monday 31 March 02:00 in Tbilisi but still Sunday in London.
    expect(clock.weekdayInZone(new Date('2025-03-30T22:00:00Z'), TBILISI)).toBe(1);
    expect(clock.weekdayInZone(new Date('2025-03-30T22:00:00Z'), LONDON)).toBe(0);
  });
});

describe('clock.eachDayInZone', () => {
  it('is inclusive of both endpoints', () => {
    const days = clock.eachDayInZone(
      new Date('2025-01-01T10:00:00Z'),
      new Date('2025-01-05T10:00:00Z'),
      TBILISI
    );
    expect(days).toHaveLength(5);
    expect(days[0].toISOString()).toBe('2024-12-31T20:00:00.000Z');
    expect(days[4].toISOString()).toBe('2025-01-04T20:00:00.000Z');
  });

  it('returns a single day when from and to are the same local date', () => {
    const days = clock.eachDayInZone(
      // 09:00 and 19:00 local on the same Tbilisi calendar day.
      new Date('2025-01-01T05:00:00Z'),
      new Date('2025-01-01T15:00:00Z'),
      TBILISI
    );
    expect(days).toHaveLength(1);
    expect(days[0].toISOString()).toBe('2024-12-31T20:00:00.000Z');
  });

  it('returns an empty list when to is before from', () => {
    const days = clock.eachDayInZone(
      new Date('2025-01-05T10:00:00Z'),
      new Date('2025-01-01T10:00:00Z'),
      TBILISI
    );
    expect(days).toEqual([]);
  });

  it('produces correct local midnights across a DST spring-forward', () => {
    const days = clock.eachDayInZone(
      new Date('2025-03-28T12:00:00Z'),
      new Date('2025-03-31T12:00:00Z'),
      LONDON
    );
    expect(days.map(d => d.toISOString())).toEqual([
      '2025-03-28T00:00:00.000Z',
      '2025-03-29T00:00:00.000Z',
      '2025-03-30T00:00:00.000Z',
      // Local midnight on 31 March is 23:00Z on 30 March, because London is now UTC+1.
      '2025-03-30T23:00:00.000Z',
    ]);
  });

  it('each returned day round-trips through zonedTimeToUtc onto the intended local date', () => {
    const days = clock.eachDayInZone(
      new Date('2025-03-28T12:00:00Z'),
      new Date('2025-03-31T12:00:00Z'),
      LONDON
    );
    const nineAm = days.map(day => clock.zonedTimeToUtc(day, '09:00', LONDON).toISOString());
    expect(nineAm).toEqual([
      '2025-03-28T09:00:00.000Z',
      '2025-03-29T09:00:00.000Z',
      '2025-03-30T08:00:00.000Z',
      '2025-03-31T08:00:00.000Z',
    ]);
  });
});

describe('Clock class', () => {
  it('is instantiable independently of the singleton', () => {
    const instance = new Clock();
    expect(instance.zonedTimeToUtc(new Date('2025-01-15T00:00:00Z'), '12:00', TBILISI).toISOString()).toBe(
      '2025-01-15T08:00:00.000Z'
    );
  });

  it('reuses the cached formatter for repeated calls in the same zone', () => {
    const instance = new Clock();
    const first = instance.weekdayInZone(new Date('2025-01-15T00:00:00Z'), TBILISI);
    const second = instance.weekdayInZone(new Date('2025-01-15T00:00:00Z'), TBILISI);
    expect(first).toBe(second);
  });
});
