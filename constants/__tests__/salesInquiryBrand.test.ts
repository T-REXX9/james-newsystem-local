import { describe, expect, it } from 'vitest';
import {
  formatSalesInquiryBrand,
  SALES_INQUIRY_BRAND_ISHINOMOTO,
  SALES_INQUIRY_BRAND_OTHERS,
} from '../salesInquiryBrand';

describe('salesInquiryBrand', () => {
  it.each([
    ['ishinomoto', SALES_INQUIRY_BRAND_ISHINOMOTO],
    ['ISHINOMOTO', SALES_INQUIRY_BRAND_ISHINOMOTO],
    [' Ishinomoto ', SALES_INQUIRY_BRAND_ISHINOMOTO],
    ['ITALY A', SALES_INQUIRY_BRAND_OTHERS],
    ['Italy B', SALES_INQUIRY_BRAND_OTHERS],
    ['Delphi', SALES_INQUIRY_BRAND_OTHERS],
    ['OTHERS', SALES_INQUIRY_BRAND_OTHERS],
    ['others', SALES_INQUIRY_BRAND_OTHERS],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('formatSalesInquiryBrand(%j) => %j', (input, expected) => {
    expect(formatSalesInquiryBrand(input)).toBe(expected);
  });
});
