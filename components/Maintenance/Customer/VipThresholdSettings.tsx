import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Save, Settings2, ShieldAlert } from 'lucide-react';
import { UserProfile, VipTierConfig } from '../../../types';
import { useToast } from '../../ToastProvider';
import { DEFAULT_VIP_TIER_CONFIG, normalizeVipTierConfig } from '../../../utils/vipTierConfig';
import { getVipTierConfig, setVipTierConfig } from '../../../services/vipTierSettingsService';

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

  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase();
  const canEdit = normalizedRole === 'owner' || normalizedRole === 'master' || normalizedRole === 'master user';

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const configData = await getVipTierConfig();
      setConfig(configData);
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
        description: 'Only Master User or Owner can update VIP thresholds.',
      });
      return;
    }

    setSaving(true);
    try {
      const savedConfig = await setVipTierConfig(config);
      if (!savedConfig) {
        throw new Error('The VIP threshold settings could not be saved.');
      }

      setConfig(savedConfig);
      setHasChanges(false);
      addToast({
        type: 'success',
        title: 'VIP thresholds updated',
        description: 'The VIP qualification and maintenance thresholds have been saved successfully.',
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
      { id: 'silver-qualification', label: 'Silver Qualification', value: config.silver_entry_threshold, tone: 'border-slate-200 bg-slate-50 text-slate-700' },
      { id: 'gold-qualification', label: 'Gold Qualification', value: config.gold_entry_threshold, tone: 'border-amber-200 bg-amber-50 text-amber-700' },
      { id: 'silver-maintenance', label: 'Silver Maintenance', value: config.silver_maintenance_threshold, tone: 'border-violet-200 bg-violet-50 text-violet-700' },
      { id: 'gold-maintenance', label: 'Gold Maintenance', value: config.gold_maintenance_threshold, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
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
                Manage the qualification and maintenance thresholds used for Silver and Gold VIP guidance across the daily call monitoring workflow.
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.id} className={`rounded-2xl border p-5 ${card.tone}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(card.value)}</p>
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
              These values drive the staff-only VIP standing guidance shown on customer detail records.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Silver Qualification Threshold</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.silver_entry_threshold}
                  onChange={(event) => updateConfig('silver_entry_threshold', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gold Qualification Threshold</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.gold_entry_threshold}
                  onChange={(event) => updateConfig('gold_entry_threshold', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Silver Maintenance Threshold</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.silver_maintenance_threshold}
                  onChange={(event) => updateConfig('silver_maintenance_threshold', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gold Maintenance Threshold</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config.gold_maintenance_threshold}
                  onChange={(event) => updateConfig('gold_maintenance_threshold', event.target.value)}
                  disabled={!canEdit}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              Gold qualification and maintenance thresholds are automatically kept at or above the corresponding Silver thresholds.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Usage Notes</h2>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <p>
                These thresholds are internal-only and are used by company staff and owners when reviewing customer standing.
              </p>
              <p>
                The customer detail modal still shows VIP standing, but threshold edits are managed here under Maintenance to keep policy updates centralized.
              </p>
              <p>
                {canEdit
                  ? 'Changes take effect immediately after saving and will update VIP guidance throughout the daily call monitoring views.'
                  : 'You can review the current thresholds here, but only Master User or Owner can update them.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VipThresholdSettings;
