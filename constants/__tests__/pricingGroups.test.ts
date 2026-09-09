import { describe, expect, it } from 'vitest';

import {
  WRITABLE_PRICING_GROUP_OPTIONS,
  ACTIVE_PRICING_GROUP_OPTIONS,
  canonicalizePriceGroupLookupKey,
  formatLegacyPriceGroupLabel,
  isKnownPriceGroup,
  normalizePriceCode,
  normalizePriceGroup,
  normalizePriceGroupToInternalKey,
  normalizeToWritablePriceCode,
} from '../pricingGroups';

describe('pricingGroups — vip1 / vip2 / vip3 only', () => {
  it('exposes only vip 1 / vip 2 / vip 3 as writable options', () => {
    expect(WRITABLE_PRICING_GROUP_OPTIONS.map((o) => o.value)).toEqual(['vip 1', 'vip 2', 'vip 3']);
    expect(ACTIVE_PRICING_GROUP_OPTIONS).toEqual(WRITABLE_PRICING_GROUP_OPTIONS);
    expect(WRITABLE_PRICING_GROUP_OPTIONS.some((o) => /silver|gold|platinum|regular/i.test(o.value))).toBe(false);
  });

  it('collapses spacing and case for VIP keys', () => {
    expect(canonicalizePriceGroupLookupKey('VIP 1')).toBe('vip1');
    expect(canonicalizePriceGroupLookupKey('VIP1')).toBe('vip1');
    expect(canonicalizePriceGroupLookupKey('vip-2')).toBe('vip2');
    expect(canonicalizePriceGroupLookupKey('VIP_3')).toBe('vip3');
  });

  it.each([
    ['VIP 1', 'vip1'],
    ['vip1', 'vip1'],
    ['silver', 'vip1'],
    ['VIP2', 'vip2'],
    ['vip 2', 'vip2'],
    ['gold', 'vip2'],
    ['VIP 3', 'vip3'],
    ['platinum', 'vip3'],
    ['aaa', 'vip3'],
    ['aa', 'vip3'],
    ['regular', 'vip3'],
    ['', 'vip3'],
    [null, 'vip3'],
    ['unknown-tier', 'vip3'],
  ] as const)('normalizePriceCode(%j) → %s', (raw, expected) => {
    expect(normalizePriceCode(raw)).toBe(expected);
  });

  it.each([
    ['VIP1', 'vip 1'],
    ['silver', 'vip 1'],
    ['gold', 'vip 2'],
    ['aaa', 'vip 3'],
    ['regular', 'vip 3'],
  ] as const)('normalizeToWritablePriceCode(%j) → %s', (raw, expected) => {
    expect(normalizeToWritablePriceCode(raw)).toBe(expected);
    expect(WRITABLE_PRICING_GROUP_OPTIONS.some((o) => o.value === expected)).toBe(true);
  });

  it('formats display labels as VIP 1 / VIP 2 / VIP 3', () => {
    expect(formatLegacyPriceGroupLabel('vip1')).toBe('VIP 1');
    expect(formatLegacyPriceGroupLabel('VIP2')).toBe('VIP 2');
    expect(formatLegacyPriceGroupLabel('aaa')).toBe('VIP 3');
    expect(formatLegacyPriceGroupLabel('')).toBe('—');
    expect(normalizePriceGroup('vip 2')).toBe('VIP 2');
  });

  it('keeps deprecated internal-key helper aligned with vip codes', () => {
    expect(normalizePriceGroupToInternalKey('VIP 1')).toBe('vip1');
    expect(normalizePriceGroupToInternalKey('gold')).toBe('vip2');
    expect(isKnownPriceGroup('VIP 1')).toBe(true);
    expect(isKnownPriceGroup('not-a-group')).toBe(false);
  });
});
