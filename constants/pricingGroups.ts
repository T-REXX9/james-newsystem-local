/**
 * Customer / product price codes.
 *
 * Canonical codes are only: vip1, vip2, vip3.
 * Monthly VIP Silver / VIP Gold discount standing is a separate concept.
 *
 * Database price groups used for lookup:
 *   vip1 → "VIP 1" (price_vip1), fallback AAA (price_aa)
 *   vip2 → "VIP2" (price_vip2), fallback AAA (price_aa)
 *   vip3 → "VIP3" (price_vip3); empty until set — does not read legacy AAA
 */

export const PRICE_CODES = ['vip1', 'vip2', 'vip3'] as const;
export type PriceCode = (typeof PRICE_CODES)[number];

/** Writable UI values (spaced for display in selects). */
export const WRITABLE_PRICING_GROUP_OPTIONS = [
  { value: 'vip 1', label: 'vip 1' },
  { value: 'vip 2', label: 'vip 2' },
  { value: 'vip 3', label: 'vip 3' },
] as const;

/** @deprecated Use WRITABLE_PRICING_GROUP_OPTIONS — kept as an alias for callers. */
export const ACTIVE_PRICING_GROUP_OPTIONS = WRITABLE_PRICING_GROUP_OPTIONS;

/**
 * Collapses spacing/case variants such as "VIP 1" and "VIP1" into "vip1".
 */
export const canonicalizePriceGroupLookupKey = (raw: string | undefined | null): string => {
  if (!raw) return '';
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
};

/**
 * Maps any stored/legacy price-group string to vip1 | vip2 | vip3.
 * Silent aliases (silver/gold/aaa/regular/…) are accepted on read only.
 */
export function normalizePriceCode(raw: string | undefined | null): PriceCode {
  const key = canonicalizePriceGroupLookupKey(raw);

  if (key === 'vip1' || key === 'silver') return 'vip1';
  if (key === 'vip2' || key === 'gold') return 'vip2';
  if (key === 'vip3' || key === 'platinum') return 'vip3';
  // Legacy AA/AAA/regular codes map to the vip3 *customer* tier, but vip3 pricing
  // does not read those legacy product price rows (see getProductPrice).
  if (key === 'aaa' || key === 'aa' || key === 'regular') return 'vip3';

  return 'vip3';
}

/**
 * Writable select value: "vip 1" | "vip 2" | "vip 3".
 */
export function normalizeToWritablePriceCode(raw: string | undefined | null): string {
  const code = normalizePriceCode(raw);
  if (code === 'vip1') return 'vip 1';
  if (code === 'vip2') return 'vip 2';
  return 'vip 3';
}

/**
 * @deprecated Prefer normalizePriceCode. Returns vip1|vip2|vip3 (no silver/gold).
 */
export function normalizePriceGroupToInternalKey(raw: string | undefined | null): string {
  return normalizePriceCode(raw);
}

/**
 * Customer-facing price code label.
 */
export function formatLegacyPriceGroupLabel(raw: string | undefined | null): string {
  if (!String(raw || '').trim()) return '—';
  const code = normalizePriceCode(raw);
  if (code === 'vip1') return 'VIP 1';
  if (code === 'vip2') return 'VIP 2';
  return 'VIP 3';
}

export function isKnownPriceGroup(raw: string | undefined | null): boolean {
  const key = canonicalizePriceGroupLookupKey(raw);
  if (!key) return false;
  return (
    key === 'vip1' ||
    key === 'vip2' ||
    key === 'vip3' ||
    key === 'silver' ||
    key === 'gold' ||
    key === 'platinum' ||
    key === 'aaa' ||
    key === 'aa' ||
    key === 'regular'
  );
}

/**
 * Display string for a price code (VIP 1 / VIP 2 / VIP 3).
 */
export function normalizePriceGroup(raw: string): string {
  if (!raw.trim()) return '';
  return formatLegacyPriceGroupLabel(raw);
}
