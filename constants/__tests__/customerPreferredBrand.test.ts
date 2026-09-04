import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_PREFERRED_BRANDS,
  formatPreferredBrand,
  normalizePreferredBrand,
} from '../customerPreferredBrand';

describe('customerPreferredBrand', () => {
  it('exposes only Ishinomoto and Others', () => {
    expect(CUSTOMER_PREFERRED_BRANDS).toEqual(['Ishinomoto', 'Others']);
  });

  it.each([
    ['ishinomoto', 'Ishinomoto'],
    ['ISHINOMOTO', 'Ishinomoto'],
    [' Ishinomoto ', 'Ishinomoto'],
    ['others', 'Others'],
    ['OTHERS', 'Others'],
    ['other', 'Others'],
    ['Others', 'Others'],
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['Motul', ''],
    ['unknown', ''],
  ])('normalizePreferredBrand(%j) => %j', (input, expected) => {
    expect(normalizePreferredBrand(input)).toBe(expected);
  });

  it('formatPreferredBrand shows dash for empty values', () => {
    expect(formatPreferredBrand('')).toBe('—');
    expect(formatPreferredBrand(null)).toBe('—');
    expect(formatPreferredBrand('Ishinomoto')).toBe('Ishinomoto');
    expect(formatPreferredBrand('others')).toBe('Others');
  });
});
