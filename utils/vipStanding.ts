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

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const formatMoney = (value: number) => peso.format(Math.max(0, value || 0));

export const getVipStandingSummary = (
  tierLabel: string,
  monthlyOrder: number,
  config: VipTierConfig = DEFAULT_VIP_TIER_CONFIG
): VipStandingSummary => {
  const normalizedConfig = normalizeVipTierConfig(config);
  const normalizedTier = String(tierLabel || 'Regular').trim() || 'Regular';
  const currentSpend = Number(monthlyOrder || 0);

  if (normalizedTier === 'Gold') {
    return {
      tierLabel: 'Gold VIP',
      currentMonthSpendLabel: `Current month spend: ${formatMoney(currentSpend)}.`,
      progressionLabel: currentSpend >= normalizedConfig.gold_entry_threshold
        ? 'Tier status: Gold VIP is the highest active dealer tier and the current month already meets its qualification threshold.'
        : `Tier status: ${formatMoney(normalizedConfig.gold_entry_threshold - currentSpend)} additional monthly spend is needed to recover the Gold qualification threshold.`,
      retentionLabel: currentSpend >= normalizedConfig.gold_maintenance_threshold
        ? `Retention target: Gold VIP maintenance guidance is at least ${formatMoney(normalizedConfig.gold_maintenance_threshold)} in monthly spend, and the account is currently above that level.`
        : `Retention target: ${formatMoney(normalizedConfig.gold_maintenance_threshold - currentSpend)} more this month is needed to meet the Gold VIP maintenance guidance of ${formatMoney(normalizedConfig.gold_maintenance_threshold)}.`,
      badgeVisible: true,
      tone: 'gold',
    };
  }

  if (normalizedTier === 'Silver') {
    return {
      tierLabel: 'Silver VIP',
      currentMonthSpendLabel: `Current month spend: ${formatMoney(currentSpend)}.`,
      progressionLabel: currentSpend >= normalizedConfig.gold_entry_threshold
        ? 'Upgrade opportunity: Current monthly spend already meets the Gold VIP qualification threshold.'
        : `Upgrade opportunity: ${formatMoney(normalizedConfig.gold_entry_threshold - currentSpend)} additional monthly spend is needed to reach Gold VIP.`,
      retentionLabel: currentSpend >= normalizedConfig.silver_maintenance_threshold
        ? `Retention target: Silver VIP maintenance guidance is at least ${formatMoney(normalizedConfig.silver_maintenance_threshold)} in monthly spend, and the account is currently above that level.`
        : `Retention target: ${formatMoney(normalizedConfig.silver_maintenance_threshold - currentSpend)} more this month is needed to meet the Silver VIP maintenance guidance of ${formatMoney(normalizedConfig.silver_maintenance_threshold)}.`,
      badgeVisible: true,
      tone: 'silver',
    };
  }

  if (normalizedTier === 'Platinum') {
    return {
      tierLabel: 'Platinum VIP',
      currentMonthSpendLabel: `Current month spend: ${formatMoney(currentSpend)}.`,
      progressionLabel: 'Tier status: Platinum is a computed internal tier above Gold for staff reference.',
      retentionLabel: `Retention target: Gold VIP maintenance guidance remains at least ${formatMoney(normalizedConfig.gold_maintenance_threshold)} in monthly spend unless a separate Platinum policy is defined.`,
      badgeVisible: true,
      tone: 'platinum',
    };
  }

  return {
    tierLabel: 'Regular Pricing',
    currentMonthSpendLabel: `Current month spend: ${formatMoney(currentSpend)}.`,
    progressionLabel: currentSpend >= normalizedConfig.silver_entry_threshold
      ? 'Upgrade opportunity: Current monthly spend already meets the Silver VIP qualification threshold.'
      : `Upgrade opportunity: ${formatMoney(normalizedConfig.silver_entry_threshold - currentSpend)} additional monthly spend is needed to qualify for Silver VIP.`,
    retentionLabel: `Qualification reference: Silver VIP begins at ${formatMoney(normalizedConfig.silver_entry_threshold)} in monthly spend, while Silver VIP maintenance guidance starts at ${formatMoney(normalizedConfig.silver_maintenance_threshold)}.`,
    badgeVisible: false,
    tone: 'regular',
  };
};
