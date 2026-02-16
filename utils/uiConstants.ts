import { CustomerStatus } from '../types';

export const BUTTON_BASE = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800';

export const BUTTON_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-semibold shadow-sm';

export const BUTTON_SUCCESS = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const BUTTON_ICON_BASE = 'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 transition-all duration-150 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white active:scale-95 active:bg-slate-300/80 dark:active:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 leading-none shrink-0';

export const BUTTON_ICON_CALL = 'hover:bg-brand-blue/20 hover:text-brand-blue active:bg-brand-blue/30 focus-visible:ring-brand-blue/40';

export const BUTTON_ICON_SMS = 'hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300 active:bg-emerald-200 dark:active:bg-emerald-500/30 focus-visible:ring-emerald-400/40';

export const statusBadgeClasses = (status: CustomerStatus) => {
  switch (status) {
    case CustomerStatus.ACTIVE:
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300';
    case CustomerStatus.INACTIVE:
      return 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300';
    case CustomerStatus.PROSPECTIVE:
      return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
};

export const priorityBadgeClasses = (priority: number) => {
  if (priority >= 150) {
    return 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300';
  }
  if (priority >= 110) {
    return 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
};

export const DIRECTION_BADGE_CLASSES = {
  inbound: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  outbound: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
} as const;

export const OUTCOME_BADGE_CLASSES = {
  positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  negative: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  follow_up: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
} as const;

export const INPUT_BASE = 'bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1';

export const CARD_BASE = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm';

export const FILTER_TAB_ACTIVE = 'bg-brand-blue text-white border-brand-blue';

export const FILTER_TAB_INACTIVE = 'bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800';
