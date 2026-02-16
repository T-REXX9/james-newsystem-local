import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, CheckCircle, Info, AlertCircle } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

const variantStyles: Record<ConfirmVariant, { bg: string; icon: React.ElementType; iconColor: string; buttonBg: string }> = {
    danger: {
        bg: 'bg-rose-100 dark:bg-rose-900/30',
        icon: AlertTriangle,
        iconColor: 'text-rose-600 dark:text-rose-400',
        buttonBg: 'bg-rose-600 hover:bg-rose-700',
    },
    warning: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        icon: AlertCircle,
        iconColor: 'text-amber-600 dark:text-amber-400',
        buttonBg: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        icon: Info,
        iconColor: 'text-blue-600 dark:text-blue-400',
        buttonBg: 'bg-blue-600 hover:bg-blue-700',
    },
    success: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        icon: CheckCircle,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        buttonBg: 'bg-emerald-600 hover:bg-emerald-700',
    },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const styles = variantStyles[variant];
    const IconComponent = styles.icon;

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 ${styles.bg} rounded-full flex items-center justify-center`}>
                            <IconComponent className={`w-6 h-6 ${styles.iconColor}`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{message}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 ${styles.buttonBg} text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
