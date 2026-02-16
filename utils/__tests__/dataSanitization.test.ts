import { describe, expect, it } from 'vitest';
import { sanitizeArray, sanitizeDate, sanitizeNumber, sanitizeObject, sanitizeString } from '../dataSanitization';

describe('dataSanitization', () => {
  it('sanitizes strings and numbers', () => {
    expect(sanitizeString('')).toBe('n/a');
    expect(sanitizeString('  ok  ')).toBe('ok');
    expect(sanitizeNumber(undefined)).toBe(0);
    expect(sanitizeNumber('12.5')).toBe(12.5);
  });

  it('sanitizes dates', () => {
    expect(sanitizeDate('')).toBeNull();
    expect(sanitizeDate('2026-01-30')).toBe('2026-01-30');
  });

  it('sanitizes arrays', () => {
    const result = sanitizeArray([1, 2], (value) => Number(value) * 2);
    expect(result).toEqual([2, 4]);
  });

  it('sanitizes objects with required fields', () => {
    expect(() =>
      sanitizeObject(
        { name: '' },
        { name: { type: 'string', required: true } }
      )
    ).toThrow();

    const sanitized = sanitizeObject(
      { name: 'Alice', note: '' },
      { name: { type: 'string', required: true }, note: { type: 'string', placeholder: 'n/a' } }
    );
    expect(sanitized.note).toBe('n/a');
  });

  it('sanitizes only provided fields for partial updates', () => {
    const sanitized = sanitizeObject(
      { note: '' },
      { name: { type: 'string', required: true }, note: { type: 'string', placeholder: 'n/a' } },
      { enforceRequired: false, onlyProvided: true }
    );
    expect(sanitized.note).toBe('n/a');
    expect((sanitized as { name?: string }).name).toBeUndefined();
  });
});
