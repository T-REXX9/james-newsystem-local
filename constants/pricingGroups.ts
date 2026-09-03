// DB values remain unchanged for MySQL compatibility, including legacy-only groups.
export const PRICING_GROUP_DB_VALUES = ['aaa', 'vip1', 'vip2', 'bbb', 'ccc', 'ddd'] as const;

// Internal values are the new application vocabulary; platinum is application-level only.
export const PRICING_GROUP_INTERNAL = {
  regular: 'regular',
  silver: 'silver',
  gold: 'gold',
  platinum: 'platinum',
} as const;

export const DB_TO_INTERNAL_MAP = {
  aaa: 'regular',
  vip1: 'silver',
  vip2: 'gold',
  vip3: 'gold',
} as const;

/**
 * Legacy customer price group labels for UI display.
 * These are NOT the monthly VIP discount tiers (One-Time / Unlimited VIP).
 */
export const LEGACY_PRICE_GROUP_DISPLAY: Record<string, string> = {
  aaa: 'Regular',
  vip1: 'VIP 1',
  vip2: 'VIP 2',
  vip3: 'VIP 3',
  bbb: 'BBB',
  ccc: 'CCC',
  ddd: 'DDD',
  regular: 'Regular',
  silver: 'VIP 1',
  gold: 'VIP 2',
  platinum: 'Platinum',
};

export const INTERNAL_TO_DISPLAY_LABEL = {
  regular: 'Regular',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
} as const;

export const LEGACY_DB_DISPLAY_LABELS: Record<string, string> = {
  bbb: 'BBB',
  ccc: 'CCC',
  ddd: 'DDD',
} as const;

// Legacy-only DB groups stay readable but are excluded from active new-system options.
export const ACTIVE_PRICING_GROUP_OPTIONS = Object.values(PRICING_GROUP_INTERNAL).map((value) => ({
  value,
  label: INTERNAL_TO_DISPLAY_LABEL[value],
}));

// Writable options exclude computed tiers (e.g. platinum) that are derived by the API.
export const WRITABLE_PRICING_GROUP_OPTIONS = ACTIVE_PRICING_GROUP_OPTIONS.filter(
  (option) => option.value !== PRICING_GROUP_INTERNAL.platinum,
);

/**
 * Collapses legacy spacing variants such as "VIP 1" and "VIP1" into "vip1".
 */
export const canonicalizePriceGroupLookupKey = (raw: string | undefined | null): string => {
  if (!raw) return '';
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
};

const resolveCanonicalPriceGroupKey = (raw: string | undefined | null): string | null => {
  const canonical = canonicalizePriceGroupLookupKey(raw);
  if (!canonical) return null;

  if (canonical in DB_TO_INTERNAL_MAP) {
    return DB_TO_INTERNAL_MAP[canonical as keyof typeof DB_TO_INTERNAL_MAP];
  }

  if (canonical in PRICING_GROUP_INTERNAL) {
    return canonical;
  }

  if (canonical in LEGACY_DB_DISPLAY_LABELS) {
    return canonical;
  }

  return null;
};

/**
 * Resolves any raw price-group value (legacy DB or internal) to its internal key.
 * Internal keys map to product price columns for lookups only — not discount tiers.
 */
export function normalizePriceGroupToInternalKey(raw: string | undefined | null): string {
  return resolveCanonicalPriceGroupKey(raw) ?? 'regular';
}

/**
 * Returns the legacy price group label for customer-facing UI (VIP 1, VIP 2, Regular, etc.).
 */
export function formatLegacyPriceGroupLabel(raw: string | undefined | null): string {
  const canonical = canonicalizePriceGroupLookupKey(raw);
  if (canonical && canonical in LEGACY_PRICE_GROUP_DISPLAY) {
    return LEGACY_PRICE_GROUP_DISPLAY[canonical];
  }

  const trimmed = String(raw || '').trim();
  return trimmed || '—';
}

/**
 * Returns true when the raw value maps to a known DB, internal, or legacy group.
 */
export function isKnownPriceGroup(raw: string | undefined | null): boolean {
  return resolveCanonicalPriceGroupKey(raw) !== null;
}

export function normalizePriceGroup(raw: string): string {
  const cleaned = raw.trim();

  if (!cleaned) {
    return '';
  }

  const resolved = resolveCanonicalPriceGroupKey(cleaned);
  if (resolved && resolved in INTERNAL_TO_DISPLAY_LABEL) {
    return INTERNAL_TO_DISPLAY_LABEL[resolved as keyof typeof INTERNAL_TO_DISPLAY_LABEL];
  }

  if (resolved && resolved in LEGACY_DB_DISPLAY_LABELS) {
    return LEGACY_DB_DISPLAY_LABELS[resolved];
  }

  return cleaned;
}
