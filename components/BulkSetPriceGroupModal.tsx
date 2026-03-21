import React, { useEffect, useState } from 'react';
import { Tag, Save, X } from 'lucide-react';
import { WRITABLE_PRICING_GROUP_OPTIONS } from '../constants/pricingGroups';

interface BulkSetPriceGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (priceGroup: string) => void;
    selectedCount: number;
}

const BulkSetPriceGroupModal: React.FC<BulkSetPriceGroupModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedCount
}) => {
    const [selectedPriceGroup, setSelectedPriceGroup] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setSelectedPriceGroup('');
        }
    }, [isOpen]);

    const handleAssign = () => {
        if (!selectedPriceGroup) return;
        onSubmit(selectedPriceGroup);
    };

    const handleCancel = () => {
        setSelectedPriceGroup('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
                            <Tag className="w-5 h-5 text-brand-blue" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                Set Price Group
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedCount} customer{selectedCount !== 1 ? 's' : ''} selected
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                                Select Active Tier
                            </label>
                            <select
                                value={selectedPriceGroup}
                                onChange={(e) => setSelectedPriceGroup(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                            >
                                <option value="">-- Select a Price Group --</option>
                                {WRITABLE_PRICING_GROUP_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Apply one of the active pricing tiers: {WRITABLE_PRICING_GROUP_OPTIONS.map((option) => option.label).join(', ')}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-bold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedPriceGroup}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        Set Price Group
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkSetPriceGroupModal;
