import { describe, expect, it } from 'vitest';
import { formatCustomerSince } from '../formatUtils';

describe('formatCustomerSince', () => {
  it('shows an abbreviated month, day without a leading zero, and year', () => {
    expect(formatCustomerSince('2026-09-09')).toBe('Sep 9 2026');
  });

  it('keeps empty Customer Since empty', () => {
    expect(formatCustomerSince('')).toBe('');
    expect(formatCustomerSince(null)).toBe('');
  });
});
