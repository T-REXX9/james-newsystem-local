import React, { useState } from 'react';
import {
    ShieldCheck, X, AlertTriangle, Lock, Unlock,
    FileText, User, Calendar, Clock
} from 'lucide-react';

interface AdminOverrideConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;
    description: string;
    warningMessage?: string;
    entityType: string;
    entityId: string;
    originalValue?: string;
    newValue?: string;
    confirmButtonText?: string;
    isDestructive?: boolean;
}

const AdminOverrideConfirmModal: React.FC<AdminOverrideConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    warningMessage,
    entityType,
    entityId,
    originalValue,
    newValue,
    confirmButtonText = 'Confirm Override',
    isDestructive = false,
}) => {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!reason.trim()) return;
        setSubmitting(true);
        try {
            await onConfirm(reason);
            setReason('');
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 ${isDestructive ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isDestructive ? 'bg-red-500' : 'bg-amber-500'}`}>
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                {title}
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Admin Override Required
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Description */}
                    <p className="text-slate-600 dark:text-slate-400">{description}</p>

                    {/* Warning Message */}
                    {warningMessage && (
                        <div className={`flex gap-3 p-4 border rounded-xl ${isDestructive ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50'}`}>
                            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDestructive ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                            <p className={`text-sm ${isDestructive ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                {warningMessage}
                            </p>
                        </div>
                    )}

                    {/* Entity Information */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">Entity Type:</span>
                            <span className="font-medium text-slate-800 dark:text-white">{entityType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Lock className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">Entity ID:</span>
                            <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{entityId}</span>
                        </div>
                        {originalValue && (
                            <div className="flex items-start gap-2 text-sm">
                                <span className="text-slate-500">From:</span>
                                <span className="text-slate-700 dark:text-slate-300">{originalValue}</span>
                            </div>
                        )}
                        {newValue && (
                            <div className="flex items-start gap-2 text-sm">
                                <Unlock className="w-4 h-4 text-emerald-500" />
                                <span className="text-slate-500">To:</span>
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">{newValue}</span>
                            </div>
                        )}
                    </div>

                    {/* Reason Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Override Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Please provide a detailed reason for this override..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none resize-none"
                            rows={3}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            This action will be logged for audit purposes.
                        </p>
                    </div>

                    {/* Audit Info */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Logged with your user ID</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Timestamped</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!reason.trim() || submitting}
                        className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {submitting ? 'Processing...' : confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminOverrideConfirmModal;
