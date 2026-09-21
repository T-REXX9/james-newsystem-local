/** Sales Inquiry Brand column display/print only: Ishinomoto or OTHERS (do not persist; Product DB brands stay unchanged). */
export const SALES_INQUIRY_BRAND_ISHINOMOTO = 'ISHINOMOTO';
export const SALES_INQUIRY_BRAND_OTHERS = 'OTHERS';

export type SalesInquiryBrandLabel =
  | typeof SALES_INQUIRY_BRAND_ISHINOMOTO
  | typeof SALES_INQUIRY_BRAND_OTHERS
  | '';

export const formatSalesInquiryBrand = (value: unknown): SalesInquiryBrandLabel => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'ishinomoto') return SALES_INQUIRY_BRAND_ISHINOMOTO;
  return SALES_INQUIRY_BRAND_OTHERS;
};
