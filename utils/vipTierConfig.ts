import { VipTierConfig } from '../types';

export const DEFAULT_VIP_TIER_CONFIG: VipTierConfig = {
  one_time_discount_threshold: 50000,
  unlimited_discount_threshold: 100000,
  discount_percentage: 10,
};

const toAmount = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

export const normalizeVipTierConfig = (raw: Partial<VipTierConfig> | null | undefined): VipTierConfig => {
  const oneTimeDiscountThreshold = toAmount(
    raw?.one_time_discount_threshold ?? (raw as any)?.silver_entry_threshold,
    DEFAULT_VIP_TIER_CONFIG.one_time_discount_threshold
  );
  const unlimitedDiscountThreshold = Math.max(
    oneTimeDiscountThreshold,
    toAmount(
      raw?.unlimited_discount_threshold ?? (raw as any)?.gold_entry_threshold,
      DEFAULT_VIP_TIER_CONFIG.unlimited_discount_threshold
    )
  );
  const discountPercentage = Math.min(100, toAmount(
    raw?.discount_percentage,
    DEFAULT_VIP_TIER_CONFIG.discount_percentage
  ));

  return {
    one_time_discount_threshold: oneTimeDiscountThreshold,
    unlimited_discount_threshold: unlimitedDiscountThreshold,
    discount_percentage: discountPercentage,
  };
};
