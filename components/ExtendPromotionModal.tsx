import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { Promotion } from '../types';
import * as promotionService from '../services/promotionService';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface Props {
    promotion: Promotion;
    onClose: () => void;
    onExtended: () => void;
}

const ExtendPromotionModal: React.FC<Props> = ({ promotion, onClose, onExtended }) => {
    const { addToast } = useToast();
    // Calculate default new end date (+7 days from current end)
    const currentEnd = new Date(promotion.end_date);
    const defaultNewEnd = new Date(currentEnd);
    defaultNewEnd.setDate(defaultNewEnd.getDate() + 7);

    const [newEndDate, setNewEndDate] = useState(defaultNewEnd.toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!newEndDate) {
            alert('Please select a new end date');
            return;
        }

        const newEnd = new Date(newEndDate);
        if (newEnd <= currentEnd) {
            alert('New end date must be after current end date');
            return;
        }

        setSaving(true);
        try {
            await promotionService.extendPromotion(promotion.id, newEndDate);
            addToast({
                type: 'success',
                title: 'Promotion extended',
                description: 'Promotion has been extended successfully.',
                durationMs: 4000,
            });
            onExtended();
        } catch (error) {
            console.error('Error extending promotion:', error);
            addToast({
                type: 'error',
                title: 'Unable to extend promotion',
                description: parseSupabaseError(error, 'promotion'),
                durationMs: 6000,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Extend Promotion</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <h3 className="font-medium text-slate-900 dark:text-white mb-1">
                            {promotion.campaign_title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Current end date: {new Date(promotion.end_date).toLocaleDateString()}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            New End Date
                        </label>
                        <input
                            type="date"
                            value={newEndDate}
                            onChange={(e) => setNewEndDate(e.target.value)}
                            min={new Date(promotion.end_date).toISOString().split('T')[0]}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Extending the promotion will update the end date and keep the status as Active.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Extending...' : 'Extend Promotion'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExtendPromotionModal;
