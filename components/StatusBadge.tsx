import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  label?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  confirmed: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  finalized: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  cancelled: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  converted_to_order: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  converted_to_document: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  sent: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200',
};

const formatStatus = (status: string) =>
  status
    .split('_')
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', label }) => {
  const normalized = status?.toLowerCase?.() || 'draft';
  const colors = STATUS_COLORS[normalized] || STATUS_COLORS.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors} ${className}`}>
      {label || formatStatus(normalized)}
    </span>
  );
};

export default StatusBadge;
