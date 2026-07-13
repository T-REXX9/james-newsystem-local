import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

type Tone = 'default' | 'info' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  default: 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200',
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, eyebrow, icon, actions, meta }) => (
  <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>}
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
        {icon}
        <span className="truncate">{title}</span>
      </h1>
      {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      {meta && <div className="mt-3">{meta}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export const ModuleCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
    {children}
  </section>
);

export const LoadingState: React.FC<{ label?: string; compact?: boolean }> = ({ label = 'Loading records', compact = false }) => (
  <div className={`flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 ${compact ? 'py-4' : 'min-h-[220px] py-10'}`} role="status" aria-live="polite">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>{label}</span>
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({
  title = 'No records found',
  description = 'Try adjusting your filters or create a new record.',
  action,
  icon = <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-600" />,
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">{icon}</div>
    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{ title?: string; description?: string; action?: React.ReactNode }> = ({
  title = 'Unable to load data',
  description = 'Please refresh the page or try again.',
  action,
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
      <AlertCircle className="h-8 w-8 text-rose-500" />
    </div>
    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export interface TrustDetail {
  label: string;
  value?: React.ReactNode;
}

export const RecordTrustStrip: React.FC<{ items: TrustDetail[]; className?: string }> = ({ items, className = '' }) => (
  <dl className={`grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
    {items.map((item) => (
      <div key={item.label} className="min-w-0">
        <dt className="font-semibold uppercase tracking-wide text-slate-400">{item.label}</dt>
        <dd className="mt-1 truncate font-bold text-slate-800 dark:text-slate-100">{item.value || '-'}</dd>
      </div>
    ))}
  </dl>
);

export const WorkflowGuidance: React.FC<{ title: string; description: string; tone?: Tone; action?: React.ReactNode }> = ({
  title,
  description,
  tone = 'info',
  action,
}) => (
  <div className={`flex flex-col gap-3 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between ${toneClasses[tone]}`}>
    <div>
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-xs opacity-90">{description}</p>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
