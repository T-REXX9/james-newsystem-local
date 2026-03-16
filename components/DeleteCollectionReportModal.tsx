import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteCollectionReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    refNo: string;
    itemCount: number;
}

const DeleteCollectionReportModal: React.FC<DeleteCollectionReportModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    refNo,
    itemCount,
}) => {
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } catch {
            // Keep modal open on failure so user can retry or cancel
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Danger Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-red-600 dark:bg-red-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <Trash2 className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Delete Collection Report</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white/80" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Reference Number */}
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">DCR Reference No.</p>
                        <p className="text-lg font-bold font-mono text-slate-800 dark:text-white">{refNo}</p>
                    </div>

                    {/* What will be deleted */}
                    <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            The following will be permanently deleted:
                        </p>
                        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                                The entire collection report and its header
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                                All payment entries ({itemCount} {itemCount === 1 ? 'record' : 'records'})
                            </li>
                        </ul>
                    </div>

                    {/* Irreversibility Warning */}
                    <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 dark:text-red-300">
                            <span className="font-semibold">This action is irreversible.</span> Once deleted, the report and all associated data cannot be recovered.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteCollectionReportModal;
