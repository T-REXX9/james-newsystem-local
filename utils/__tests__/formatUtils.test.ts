import { describe, expect, it } from 'vitest';
import { formatDate, matchesSearch } from '../formatUtils';

describe('formatDate', () => {
  it('keeps migrated date-only values on their business calendar day', () => {
    expect(formatDate('2026-09-12')).toBe('SEP‑12‑26');
  });

  it('formats UTC timestamps in Philippine time', () => {
    expect(formatDate('2026-09-12T16:00:00Z')).toBe('SEP‑13‑26');
  });
});

describe('matchesSearch', () => {
  it('finds a customer or prospect by assigned sales agent', () => {
    expect(matchesSearch({ company: 'Northside Diesel', salesman: 'Irene Santos' }, 'irene')).toBe(true);
    expect(matchesSearch({ company: 'Northside Diesel', salesman: 'Irene Santos' }, 'other agent')).toBe(false);
  });
});
