import { describe, expect, it } from 'vitest';

import {
  canonicalizePriceGroupLookupKey,
  formatLegacyPriceGroupLabel,
  isKnownPriceGroup,
  normalizePriceGroupToInternalKey,
} from '../pricingGroups';

describe('pricingGroups', () => {
  it('treats spaced legacy VIP values as the same tier keys', () => {
    expect(canonicalizePriceGroupLookupKey('VIP 1')).toBe('vip1');
    expect(canonicalizePriceGroupLookupKey('VIP1')).toBe('vip1');
    expect(canonicalizePriceGroupLookupKey('VIP 2')).toBe('vip2');
  });

  it('keeps price group labels separate from discount tier vocabulary', () => {
    expect(formatLegacyPriceGroupLabel('VIP 1')).toBe('VIP 1');
    expect(formatLegacyPriceGroupLabel('VIP2')).toBe('VIP 2');
    expect(formatLegacyPriceGroupLabel('aaa')).toBe('Regular');
    expect(isKnownPriceGroup('VIP 1')).toBe(true);
    expect(normalizePriceGroupToInternalKey('VIP 1')).toBe('silver');
  });
});
