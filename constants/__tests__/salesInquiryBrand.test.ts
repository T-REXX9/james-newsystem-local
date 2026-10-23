import { describe, expect, it } from 'vitest';
import { formatSalesInquiryBrand } from '../salesInquiryBrand';

describe('salesInquiryBrand', () => {
  it.each([
    ['ishinomoto', 'ishinomoto'],
    ['ISHINOMOTO', 'ISHINOMOTO'],
    [' Ishinomoto ', 'Ishinomoto'],
    ['ITALY A', 'ITALY A'],
    ['Italy B', 'Italy B'],
    ['Delphi', 'Delphi'],
    ['OTHERS', 'OTHERS'],
    ['others', 'others'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('formatSalesInquiryBrand(%j) => %j', (input, expected) => {
    expect(formatSalesInquiryBrand(input)).toBe(expected);
  });
});
