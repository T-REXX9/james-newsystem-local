import {
  isMasterUserAccount,
  DEFAULT_ACTION_PERMISSIONS,
} from '../constants';
import type { PageActionPermissions } from '../types';

/** Fixed page set for Backdated posting (System Access labels). Transfer Stock excluded. */
export const BACKDATED_POSTING_PAGE_LABELS = [
  'Inventory Audit',
  'Purchase Request',
  'Purchase Order',
  'Receiving Stock',
  'Return to Supplier',
  'Sales Inquiry',
  'Sales Order',
  'Order Slip',
  'Invoice',
  'Freight Charges',
  'Sales Return',
  'Adjustment Entry',
  'Daily Collection Entry',
] as const;

export type BackdatedPostingPageLabel = (typeof BACKDATED_POSTING_PAGE_LABELS)[number];

export const hasBackdatedPostingPermission = (
  user: { role?: string | null; user_type?: string | number | null; action_permissions?: PageActionPermissions | null } | null | undefined
): boolean => {
  if (isMasterUserAccount(user)) return true;
  return Boolean(user?.action_permissions?.can_backdate);
};

export const setBackdatedPostingPermission = (
  permissions: PageActionPermissions | null | undefined,
  enabled: boolean
): PageActionPermissions => {
  const current = permissions || {};
  const global = current.global
    ? { ...DEFAULT_ACTION_PERMISSIONS, ...current.global }
    : current.pages
      ? { ...DEFAULT_ACTION_PERMISSIONS }
      : { ...DEFAULT_ACTION_PERMISSIONS, ...normalizeLegacyFlat(current) };

  return {
    global,
    pages: { ...(current.pages || {}) },
    can_backdate: enabled,
  };
};

const normalizeLegacyFlat = (permissions: PageActionPermissions): Partial<typeof DEFAULT_ACTION_PERMISSIONS> => {
  const flat: Partial<typeof DEFAULT_ACTION_PERMISSIONS> = {};
  (Object.keys(DEFAULT_ACTION_PERMISSIONS) as (keyof typeof DEFAULT_ACTION_PERMISSIONS)[]).forEach((key) => {
    const value = permissions[key as keyof PageActionPermissions];
    if (typeof value === 'boolean') flat[key] = value;
  });
  return flat;
};

export const canMutateDocumentDateField = (opts: {
  canEdit: boolean;
  hasBackdatedPosting: boolean;
  isPosted: boolean;
}): boolean => opts.canEdit && opts.hasBackdatedPosting && !opts.isPosted;

const toYmd = (value: string): string => value.slice(0, 10);

export const validateDocumentDateWrite = (opts: {
  hasBackdatedPosting: boolean;
  proposedYmd: string;
  previousYmd?: string | null;
  todayYmd: string;
}): { ok: true } | { ok: false; reason: string } => {
  const proposed = toYmd(opts.proposedYmd || '');
  const today = toYmd(opts.todayYmd);
  const previous = opts.previousYmd ? toYmd(opts.previousYmd) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(proposed)) {
    return { ok: false, reason: 'Document date is required.' };
  }
  if (proposed > today) {
    return { ok: false, reason: 'Document date cannot be in the future.' };
  }
  if (previous && proposed === previous) {
    return { ok: true };
  }
  if (opts.hasBackdatedPosting) {
    return { ok: true };
  }
  if (proposed < today) {
    return { ok: false, reason: 'Backdated posting permission is required to use a past document date.' };
  }
  if (previous && previous < today && proposed !== previous) {
    return { ok: false, reason: 'Backdated posting permission is required to change a past document date.' };
  }
  return { ok: true };
};

/** Local calendar YYYY-MM-DD (Philippine-facing UI uses the browser/local day). */
export const localTodayYmd = (now: Date = new Date()): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
