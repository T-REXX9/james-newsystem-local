import { describe, expect, it } from 'vitest';
import { formatCustomerSince } from '../formatUtils';

describe('formatCustomerSince', () => {
  it('uses the system-wide non-wrapping date format', () => {
    expect(formatCustomerSince('2026-09-09')).toBe('SEP‑09‑26');
  });

  it('keeps empty Customer Since empty', () => {
    expect(formatCustomerSince('')).toBe('');
    expect(formatCustomerSince(null)).toBe('');
  });
});
