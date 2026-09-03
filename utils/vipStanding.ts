import { VipTierConfig } from '../types';
import { DEFAULT_VIP_TIER_CONFIG, normalizeVipTierConfig } from './vipTierConfig';

export interface VipStandingSummary {
  tierLabel: string;
  currentMonthSpendLabel: string;
  progressionLabel: string;
  retentionLabel: string;
  badgeVisible: boolean;
  tone: 'regular' | 'silver' | 'gold' | 'platinum';
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const formatMoney = (value: number) => peso.format(Math.max(0, value || 0));

export const resolveVipDiscountLevel = (
  lastMonthSpend: number,
  config: VipTierConfig = DEFAULT_VIP_TIER_CONFIG
): 'regular' | 'silver' | 'gold' => {
  const normalized = normalizeVipTierConfig(config);
  const spend = Math.max(0, Number(lastMonthSpend || 0));
  if (spend >= normalized.unlimited_discount_threshold) return 'gold';
  if (spend >= normalized.one_time_discount_threshold) return 'silver';
  return 'regular';
};

export const getVipStandingSummary = (_tierLabel: string, lastMonthSpend: number, config: VipTierConfig = DEFAULT_VIP_TIER_CONFIG): VipStandingSummary => {
  const normalized = normalizeVipTierConfig(config);
  const spend = Number(lastMonthSpend || 0);
  const discount = `${normalized.discount_percentage}%`;
  const level = resolveVipDiscountLevel(spend, normalized);

  let result: VipStandingSummary;
  if (level === 'gold') {
    result = {
      tierLabel: 'VIP Gold',
      currentMonthSpendLabel: `Last month spend: ${formatMoney(spend)}.`,
      progressionLabel: `Benefit this month: unlimited ${discount} discount on eligible purchases.`,
      retentionLabel: `Unlimited ${discount} discount is active for this entire month because last month’s spend reached ${formatMoney(normalized.unlimited_discount_threshold)} or more.`,
      badgeVisible: true,
      tone: 'gold',
    };
  } else if (level === 'silver') {
    result = {
      tierLabel: 'VIP Silver',
      currentMonthSpendLabel: `Last month spend: ${formatMoney(spend)}.`,
      progressionLabel: `Benefit this month: one ${discount} discount to use on an eligible purchase.`,
      retentionLabel: `One ${discount} discount is active for this month because last month’s spend reached ${formatMoney(normalized.one_time_discount_threshold)} or more.`,
      badgeVisible: true,
      tone: 'silver',
    };
  } else {
    result = {
      tierLabel: 'Regular',
      currentMonthSpendLabel: `Last month spend: ${formatMoney(spend)}.`,
      progressionLabel: `No VIP discount is active. ${formatMoney(Math.max(0, normalized.one_time_discount_threshold - spend))} more last-month spend would qualify for VIP Silver this month.`,
      retentionLabel: 'VIP benefits are calculated from the previous calendar month and reset at the start of each month.',
      badgeVisible: false,
      tone: 'regular',
    };
  }

  return result;
};
