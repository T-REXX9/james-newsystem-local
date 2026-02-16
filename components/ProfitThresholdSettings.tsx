import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Save, AlertTriangle, TrendingUp, Settings,
    Percent, CheckCircle2, XCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { UserProfile, ProfitThresholdConfig } from '../types';
import * as profitProtectionService from '../services/profitProtectionService';
import { useToast } from './ToastProvider';

interface ProfitThresholdSettingsProps {
    currentUser: UserProfile | null;
}

const ProfitThresholdSettings: React.FC<ProfitThresholdSettingsProps> = ({ currentUser }) => {
    const [config, setConfig] = useState<ProfitThresholdConfig>({
        percentage: 50,
        enforce_approval: true,
        allow_override: true,
    });
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { addToast } = useToast();

    const loadData = useCallback(async () => {
        try {
            const [configData, statsData] = await Promise.all([
                profitProtectionService.getProfitThreshold(),
                profitProtectionService.getProfitOverrideStats(),
            ]);
            setConfig(configData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading profit settings:', error);
            addToast('Failed to load profit settings', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        if (!currentUser) {
            addToast('User not authenticated', 'error');
            return;
        }

        setSaving(true);
        try {
            const success = await profitProtectionService.setProfitThreshold(config);
            if (success) {
                addToast('Profit threshold settings saved', 'success');
                setHasChanges(false);
            } else {
                addToast('Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Error saving profit settings:', error);
            addToast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (updates: Partial<ProfitThresholdConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
        setHasChanges(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Profit Protection</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure minimum profit thresholds</p>
                    </div>
                </div>
                {hasChanges && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        <span className="font-medium">{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                )}
            </div>

            {/* Main Settings Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Threshold Configuration
                </h2>

                <div className="space-y-6">
                    {/* Profit Percentage Threshold */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Minimum Gross Profit Percentage
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min={10}
                                max={90}
                                value={config.percentage}
                                onChange={(e) => updateConfig({ percentage: parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                            />
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl min-w-[100px] justify-center">
                                <Percent className="w-4 h-4 text-slate-500" />
                                <span className="text-xl font-bold text-slate-800 dark:text-white">{config.percentage}</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                            Items sold below this profit margin will trigger a warning.
                        </p>

                        {/* Visual indicator */}
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>10%</span>
                            <div className="flex items-center gap-2">
                                <span className="text-red-500">Low Margin</span>
                                <span>|</span>
                                <span className="text-amber-500">Moderate</span>
                                <span>|</span>
                                <span className="text-emerald-500">High Margin</span>
                            </div>
                            <span>90%</span>
                        </div>
                    </div>

                    {/* Enforce Approval Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.enforce_approval ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <AlertTriangle className={`w-5 h-5 ${config.enforce_approval ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
                            </div>
                            <div>
                                <p className="font-medium text-slate-800 dark:text-white">Require Approval</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Block low-profit sales without manager approval
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateConfig({ enforce_approval: !config.enforce_approval })}
                            className="p-1"
                        >
                            {config.enforce_approval ? (
                                <ToggleRight className="w-10 h-10 text-amber-500" />
                            ) : (
                                <ToggleLeft className="w-10 h-10 text-slate-400" />
                            )}
                        </button>
                    </div>

                    {/* Allow Override Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.allow_override ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <CheckCircle2 className={`w-5 h-5 ${config.allow_override ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`} />
                            </div>
                            <div>
                                <p className="font-medium text-slate-800 dark:text-white">Allow Override</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Allow managers to override low-profit restrictions
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateConfig({ allow_override: !config.allow_override })}
                            className="p-1"
                        >
                            {config.allow_override ? (
                                <ToggleRight className="w-10 h-10 text-blue-500" />
                            ) : (
                                <ToggleLeft className="w-10 h-10 text-slate-400" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Override Statistics */}
            {stats && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Override Statistics
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.total_overrides}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Overrides</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-red-500">{stats.average_original_profit_pct}%</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Avg Original Profit</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-500">{stats.average_override_profit_pct}%</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Avg Override Profit</p>
                        </div>
                    </div>

                    {/* Top Override Reasons */}
                    {stats.top_override_reasons?.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Top Override Reasons</h3>
                            <div className="space-y-2">
                                {stats.top_override_reasons.map((item: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{item.reason}</span>
                                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{item.count}x</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Example Calculation */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Example Calculation</h2>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Cost</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">₱100</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Min. Selling Price</p>
                            <p className="text-lg font-bold text-emerald-600">
                                ₱{(100 / (1 - config.percentage / 100)).toFixed(0)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Min. Profit</p>
                            <p className="text-lg font-bold text-blue-600">
                                ₱{((100 / (1 - config.percentage / 100)) - 100).toFixed(0)}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
                        To achieve {config.percentage}% gross profit on an item costing ₱100, sell at minimum ₱{(100 / (1 - config.percentage / 100)).toFixed(0)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProfitThresholdSettings;
