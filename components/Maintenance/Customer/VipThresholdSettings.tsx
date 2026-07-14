import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Save, Settings2, ShieldAlert } from 'lucide-react';
import { UserProfile, VipTierConfig } from '../../../types';
import { useToast } from '../../ToastProvider';
import { DEFAULT_VIP_TIER_CONFIG, normalizeVipTierConfig } from '../../../utils/vipTierConfig';
import { getVipTierConfig, setVipTierConfig } from '../../../services/vipTierSettingsService';
import { getLocalAuthSession } from '../../../services/localAuthService';

interface VipThresholdSettingsProps {
  currentUser: UserProfile | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const VipThresholdSettings: React.FC<VipThresholdSettingsProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [config, setConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const accountStatusRole = String(
    currentUser?.user_type || getLocalAuthSession()?.context?.user_type || ''
  );
  const canEdit = accountStatusRole === '1';

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const configData = await getVipTierConfig();
      setConfig(normalizeVipTierConfig(configData));
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading VIP thresholds:', error);
      addToast({
        type: 'error',
        title: 'Unable to load VIP thresholds',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while loading VIP thresholds.',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateConfig = (key: keyof VipTierConfig, value: string) => {
    setConfig((previous) =>
      normalizeVipTierConfig({
        ...previous,
        [key]: value === '' ? 0 : Number(value),
      })
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!canEdit) {
      addToast({
        type: 'error',
        title: 'Editing restricted',
        description: 'Only an owner-level user can update VIP discount settings.',
      });
      return;
    }

    setSaving(true);
    try {
      const savedConfig = await setVipTierConfig(config);
      if (!savedConfig) {
        throw new Error('The VIP threshold settings could not be saved.');
      }

      setConfig(normalizeVipTierConfig(savedConfig));
      setHasChanges(false);
      addToast({
        type: 'success',
        title: 'VIP thresholds updated',
        description: 'The VIP discount settings have been saved successfully.',
      });
    } catch (error) {
      console.error('Error saving VIP thresholds:', error);
      addToast({
        type: 'error',
        title: 'Unable to save VIP thresholds',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while saving VIP thresholds.',
      });
    } finally {
      setSaving(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      { id: 'one-time', label: 'One-Time Discount Threshold', value: config.one_time_discount_threshold, tone: 'border-slate-200 bg-slate-50 text-slate-700' },
      { id: 'unlimited', label: 'Unlimited Discount Threshold', value: config.unlimited_discount_threshold, tone: 'border-amber-200 bg-amber-50 text-amber-700' },
      { id: 'discount', label: 'Discount Rate', value: config.discount_percentage, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', percentage: true },
    ],
    [config]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 text-white shadow-lg shadow-amber-500/20">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">VIP Thresholds</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Set the previous-month purchase thresholds that unlock this month’s VIP discount benefits.
              </p>
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div key={card.id} className={`rounded-2xl border p-5 ${card.tone}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
              <p className="mt-2 text-2xl font-bold">{card.percentage ? `${card.value}%` : formatCurrency(card.value)}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Threshold Configuration</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Each customer’s previous calendar month spend determines the benefit available during the current month.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">One-Time Discount Threshold</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.one_time_discount_threshold}
                  onChange={(event) => updateConfig('one_time_discount_threshold', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Unlimited Discount Threshold</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.unlimited_discount_threshold}
                  onChange={(event) => updateConfig('unlimited_discount_threshold', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Discount Percentage</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  max={100}
                  value={config.discount_percentage}
                  onChange={(event) => updateConfig('discount_percentage', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              The unlimited threshold is automatically kept at or above the one-time threshold. Benefits reset at the start of each month.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Usage Notes</h2>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Spending more than the one-time threshold last month gives one discount this month. Spending more than the unlimited threshold gives unlimited discounts this month.
              </p>
              <p>
                Customer detail shows last month’s spend and the active benefit so staff can apply the correct discount at checkout.
              </p>
              <p>
                {canEdit
                  ? 'Changes take effect immediately after saving and will update VIP guidance throughout the daily call monitoring views.'
                  : 'You can review the current settings here, but only an owner-level user can update them.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VipThresholdSettings;
