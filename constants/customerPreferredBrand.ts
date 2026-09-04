export const CUSTOMER_PREFERRED_BRANDS = ['Ishinomoto', 'Others'] as const;

export type CustomerPreferredBrand = (typeof CUSTOMER_PREFERRED_BRANDS)[number];

export const normalizePreferredBrand = (value: unknown): CustomerPreferredBrand | '' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ishinomoto') return 'Ishinomoto';
  if (normalized === 'others' || normalized === 'other') return 'Others';
  return '';
};

export const formatPreferredBrand = (value: unknown): string => {
  const brand = normalizePreferredBrand(value);
  return brand || '—';
};
