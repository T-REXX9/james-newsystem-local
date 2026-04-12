import { VipTierConfig } from '../types';

export const DEFAULT_VIP_TIER_CONFIG: VipTierConfig = {
  silver_entry_threshold: 10000,
  gold_entry_threshold: 30000,
  silver_maintenance_threshold: 5000,
  gold_maintenance_threshold: 10000,
};

const toAmount = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};

export const normalizeVipTierConfig = (raw: Partial<VipTierConfig> | null | undefined): VipTierConfig => {
  const silverEntryThreshold = toAmount(
    raw?.silver_entry_threshold,
    DEFAULT_VIP_TIER_CONFIG.silver_entry_threshold
  );
  const goldEntryThreshold = Math.max(
    silverEntryThreshold,
    toAmount(raw?.gold_entry_threshold, DEFAULT_VIP_TIER_CONFIG.gold_entry_threshold)
  );
  const silverMaintenanceThreshold = toAmount(
    raw?.silver_maintenance_threshold,
    DEFAULT_VIP_TIER_CONFIG.silver_maintenance_threshold
  );
  const goldMaintenanceThreshold = Math.max(
    silverMaintenanceThreshold,
    toAmount(raw?.gold_maintenance_threshold, DEFAULT_VIP_TIER_CONFIG.gold_maintenance_threshold)
  );

  return {
    silver_entry_threshold: silverEntryThreshold,
    gold_entry_threshold: goldEntryThreshold,
    silver_maintenance_threshold: silverMaintenanceThreshold,
    gold_maintenance_threshold: goldMaintenanceThreshold,
  };
};
