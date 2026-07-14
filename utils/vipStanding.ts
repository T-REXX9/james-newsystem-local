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

export const getVipStandingSummary = (_tierLabel: string, lastMonthSpend: number, config: VipTierConfig = DEFAULT_VIP_TIER_CONFIG): VipStandingSummary => {
  const normalized = normalizeVipTierConfig(config);
  const spend = Number(lastMonthSpend || 0);
  const discount = `${normalized.discount_percentage}%`;
  if (spend > normalized.unlimited_discount_threshold) return { tierLabel: 'Unlimited VIP', currentMonthSpendLabel: `Last month spend: ${formatMoney(spend)}.`, progressionLabel: `Benefit this month: unlimited ${discount} discount on eligible purchases.`, retentionLabel: `Unlimited ${discount} discount is active for this entire month because last month’s spend exceeded ${formatMoney(normalized.unlimited_discount_threshold)}.`, badgeVisible: true, tone: 'gold' };
  if (spend > normalized.one_time_discount_threshold) return { tierLabel: 'One-Time VIP', currentMonthSpendLabel: `Last month spend: ${formatMoney(spend)}.`, progressionLabel: `Benefit this month: one ${discount} discount to use on an eligible purchase.`, retentionLabel: `One ${discount} discount is active for this month because last month’s spend exceeded ${formatMoney(normalized.one_time_discount_threshold)}.`, badgeVisible: true, tone: 'silver' };
  return { tierLabel: 'Regular Pricing', currentMonthSpendLabel: `Last month spend: ${formatMoney(spend)}.`, progressionLabel: `No VIP discount is active. ${formatMoney(normalized.one_time_discount_threshold - spend)} more last-month spend would have qualified for one ${discount} discount this month.`, retentionLabel: 'VIP benefits are calculated from the previous calendar month and reset at the start of each month.', badgeVisible: false, tone: 'regular' };
};
