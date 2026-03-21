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
} as const;

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
 * Resolves any raw price-group value (legacy DB or internal) to its internal key.
 * e.g. 'aaa' → 'regular', 'vip1' → 'silver', 'vip2' → 'gold',
 *      'regular' → 'regular', 'gold' → 'gold', unknown → fallback to 'regular'.
 */
export function normalizePriceGroupToInternalKey(raw: string | undefined | null): string {
  if (!raw) return 'regular';
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return 'regular';

  if (normalized in DB_TO_INTERNAL_MAP) {
    return DB_TO_INTERNAL_MAP[normalized as keyof typeof DB_TO_INTERNAL_MAP];
  }

  if (normalized in PRICING_GROUP_INTERNAL) {
    return normalized;
  }

  return 'regular';
}

/**
 * Returns true when the raw value maps to a known DB, internal, or legacy group.
 */
export function isKnownPriceGroup(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized in DB_TO_INTERNAL_MAP ||
    normalized in INTERNAL_TO_DISPLAY_LABEL ||
    normalized in LEGACY_DB_DISPLAY_LABELS
  );
}

export function normalizePriceGroup(raw: string): string {
  const cleaned = raw.trim();

  if (!cleaned) {
    return '';
  }

  const normalized = cleaned.toLowerCase();

  if (normalized in DB_TO_INTERNAL_MAP) {
    return INTERNAL_TO_DISPLAY_LABEL[DB_TO_INTERNAL_MAP[normalized as keyof typeof DB_TO_INTERNAL_MAP]];
  }

  if (normalized in INTERNAL_TO_DISPLAY_LABEL) {
    return INTERNAL_TO_DISPLAY_LABEL[normalized as keyof typeof INTERNAL_TO_DISPLAY_LABEL];
  }

  if (normalized in LEGACY_DB_DISPLAY_LABELS) {
    return LEGACY_DB_DISPLAY_LABELS[normalized];
  }

  return cleaned;
}
