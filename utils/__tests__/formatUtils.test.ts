import { describe, expect, it } from 'vitest';
import { formatDate } from '../formatUtils';

describe('formatDate', () => {
  it('keeps migrated date-only values on their business calendar day', () => {
    expect(formatDate('2026-09-12')).toBe('SEP‑12‑26');
  });

  it('formats UTC timestamps in Philippine time', () => {
    expect(formatDate('2026-09-12T16:00:00Z')).toBe('SEP‑13‑26');
  });
});
