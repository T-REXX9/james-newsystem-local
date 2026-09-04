import { describe, expect, it } from 'vitest';
import { formatLocalDateInput, localDateDaysAgo } from '../localDateInput';

describe('localDateInput', () => {
  it('uses local calendar fields instead of UTC ISO date', () => {
    // 2026-09-04 17:00 UTC is already 2026-09-05 in UTC+08 (PH business hours).
    const utcEvening = new Date('2026-09-04T17:00:00.000Z');
    const local = formatLocalDateInput(utcEvening);
    const utcIsoDay = utcEvening.toISOString().slice(0, 10);

    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(local).toBe(
      [
        utcEvening.getFullYear(),
        String(utcEvening.getMonth() + 1).padStart(2, '0'),
        String(utcEvening.getDate()).padStart(2, '0'),
      ].join('-')
    );

    // In east-of-UTC zones this is the exact Incident Items Report empty-list bug.
    if (utcEvening.getTimezoneOffset() < 0) {
      expect(local).toBe('2026-09-05');
      expect(utcIsoDay).toBe('2026-09-04');
      expect(local).not.toBe(utcIsoDay);
    }
  });

  it('computes days-ago on the local calendar without UTC drift', () => {
    const localNoon = new Date(2026, 8, 5, 12, 0, 0); // Sep 5 local
    expect(formatLocalDateInput(localNoon)).toBe('2026-09-05');
    expect(localDateDaysAgo(30, localNoon)).toBe('2026-08-06');
  });
});
