import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ClipboardList, RefreshCw, Search, CheckCircle2, XCircle, Clock3,
    Building2, Tag, FileText, User, Loader2,
} from 'lucide-react';
import {
    CustomerRequest, fetchAllCustomerRequests, reviewCustomerRequest,
} from '../services/customerWorkflowLocalApiService';
import { Contact, DailyCallCustomerRow, UserProfile } from '../types';
import { isMasterUserAccount } from '../constants';
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import { fetchCustomersForDailyCall } from '../services/dailyCallMonitoringService';
import { toast } from 'sonner';
import { formatDateTime } from '../utils/formatUtils';
import DailyCallCustomerDetailModal from './DailyCallCustomerDetailModal';
import { isBlockedDailyCallCustomerRow } from '../utils/dailyCallBlockedCustomer';

import { shouldSuppressAuthError } from '../services/localApiAuth';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
    pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', icon: Clock3, label: 'Pending Review' },
    approved: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', icon: CheckCircle2, label: 'Approved' },
    rejected: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', icon: XCircle, label: 'Rejected' },
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatDateTime(date);
};

const APPROVAL_CUSTOMER_DETAIL_HISTORY_KEY = '__jamesApprovalCustomerDetail';

const summarizePayload = (row: CustomerRequest): string => {
    if (row.kind === 'discount') {
        const pct = row.payload?.discount_percentage;
        const reason = row.payload?.reason ? String(row.payload.reason) : '';
        return `${typeof pct === 'number' ? pct : ''}% discount${reason ? ` — ${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}` : ''}`;
    }
    const entries = Object.entries(row.payload || {}).filter(([key]) => key !== 'notes');
    if (!entries.length) {
        const notes = row.payload?.notes;
        return notes ? String(notes).slice(0, 120) : 'Customer update';
    }
    return entries
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}`)
        .join(' · ')
        .slice(0, 160);
};

interface ApprovalRequestsViewProps {
    currentUser: UserProfile | null;
    initialRequestId?: string;
    /** When true, restricts the view to owners/managers only. Default: true. */
    restrictToOwners?: boolean;
}

export default function ApprovalRequestsView({
    currentUser,
    initialRequestId,
    restrictToOwners = true,
}: ApprovalRequestsViewProps) {
    const owner = isMasterUserAccount(currentUser);
    const canApprove = owner;
    const visible = !restrictToOwners || owner;

    const [rows, setRows] = useState<CustomerRequest[]>([]);
    const [contacts, setContacts] = useState<Map<string, Contact>>(new Map());
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [search, setSearch] = useState('');
    const reviewingRef = useRef(false);
    const [busyId, setBusyId] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<DailyCallCustomerRow | null>(null);
    const [selectedApprovalRequest, setSelectedApprovalRequest] = useState<CustomerRequest | null>(null);
    const dailyCallCustomersRef = useRef<DailyCallCustomerRow[] | null>(null);
    const [loadingContactId, setLoadingContactId] = useState('');
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [refreshTick, setRefreshTick] = useState(0);
    const initialRequestHandled = useRef(false);
    const ownsModalHistoryEntry = useRef(false);

    const openCustomerDetails = useCallback(async (contactId: string, request: CustomerRequest) => {
        setLoadingContactId(contactId);
        try {
            if (!dailyCallCustomersRef.current) {
                dailyCallCustomersRef.current = await fetchCustomersForDailyCall({});
            }
            const customer = dailyCallCustomersRef.current.find((row) => String(row.id) === contactId);
            if (!customer) {
                toast.error('Customer details are unavailable.');
                return;
            }
            const historyState = window.history.state && typeof window.history.state === 'object'
                ? window.history.state as Record<string, unknown>
                : {};
            if (!ownsModalHistoryEntry.current) {
                window.history.pushState(
                    { ...historyState, [APPROVAL_CUSTOMER_DETAIL_HISTORY_KEY]: { contactId, requestId: request.id } },
                    '',
                    window.location.href,
                );
                ownsModalHistoryEntry.current = true;
            }
            setSelectedCustomer(customer);
            setSelectedApprovalRequest(request);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Customer details are unavailable.');
        } finally {
            setLoadingContactId('');
        }
    }, []);

    const closeCustomerDetails = useCallback(() => {
        if (ownsModalHistoryEntry.current) {
            window.history.back();
        } else {
            setSelectedCustomer(null);
            setSelectedApprovalRequest(null);
        }
    }, []);

    useEffect(() => {
        const syncCustomerModalWithHistory = (event: PopStateEvent) => {
            const historyState = event.state && typeof event.state === 'object'
                ? event.state as Record<string, unknown>
                : {};
            const detail = historyState[APPROVAL_CUSTOMER_DETAIL_HISTORY_KEY] as { contactId?: string } | undefined;
            if (!detail?.contactId) {
                ownsModalHistoryEntry.current = false;
                setSelectedCustomer(null);
                setSelectedApprovalRequest(null);
                return;
            }
            ownsModalHistoryEntry.current = true;
            const customer = dailyCallCustomersRef.current?.find((row) => String(row.id) === detail.contactId);
            if (customer) setSelectedCustomer(customer);
            const request = rows.find((row) => String(row.id) === String(detail.requestId));
            if (request) setSelectedApprovalRequest(request);
        };
        window.addEventListener('popstate', syncCustomerModalWithHistory);
        return () => window.removeEventListener('popstate', syncCustomerModalWithHistory);
    }, [rows]);

    useEffect(() => {
        if (!initialRequestId || initialRequestHandled.current) return;
        const request = rows.find((row) => String(row.id) === String(initialRequestId));
        if (request) {
            initialRequestHandled.current = true;
            void openCustomerDetails(String(request.contact_id), request);
        }
    }, [initialRequestId, openCustomerDetails, rows]);

    useEffect(() => {
        if (!visible) return;
        let active = true;
        setLoading(true);
        setError('');
        Promise.allSettled([fetchAllCustomerRequests(), fetchContacts()])
            .then(([reqRes, contactsRes]) => {
                if (!active) return;
                if (reqRes.status === 'fulfilled') {
                    setRows(Array.isArray(reqRes.value) ? reqRes.value : []);
                } else {
                    setError(reqRes.reason instanceof Error ? reqRes.reason.message : 'Failed to load requests');
                }
                if (contactsRes.status === 'fulfilled') {
                    const map = new Map<string, Contact>();
                    (contactsRes.value || []).forEach((c) => {
                        if (c?.id) map.set(String(c.id), c);
                    });
                    setContacts(map);
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [visible, refreshTick]);

    const refresh = async () => {
        setRefreshing(true);
        try {
            const [next, contactsRes] = await Promise.all([
                fetchAllCustomerRequests(),
                fetchContacts(),
            ]);
            setRows(Array.isArray(next) ? next : []);
            const map = new Map<string, Contact>();
            (contactsRes || []).forEach((c) => { if (c?.id) map.set(String(c.id), c); });
            setContacts(map);
        } catch (err) {
      if (shouldSuppressAuthError(err)) return;
            const msg = err instanceof Error ? err.message : 'Failed to refresh';
            toast.error(msg);
        } finally {
            setRefreshing(false);
        }
    };

    const counts = useMemo(() => ({
        all: rows.length,
        pending: rows.filter((r) => r.status === 'pending').length,
        approved: rows.filter((r) => r.status === 'approved').length,
        rejected: rows.filter((r) => r.status === 'rejected').length,
    }), [rows]);

    const filteredRows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return rows
            .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
            .filter((r) => {
                if (!term) return true;
                const contact = contacts.get(String(r.contact_id));
                const haystack = [
                    contact?.company,
                    contact?.name,
                    r.submitted_by_name,
                    r.kind,
                    summarizePayload(r),
                ].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(term);
            })
            .sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
    }, [rows, statusFilter, search, contacts]);

    const review = async (row: CustomerRequest, decision: 'approved' | 'rejected') => {
        if (!canApprove || reviewingRef.current || row.status !== 'pending') return;
        reviewingRef.current = true;
        setBusyId(row.id);
        try {
            await reviewCustomerRequest(
                String(row.contact_id),
                String(row.id),
                decision,
                notes[row.id] || '',
            );
            toast.success(`Request ${decision === 'approved' ? 'approved' : 'rejected'}`);
            setRows(current => current.map(item => item.id === row.id ? { ...item, status: decision } : item));
            setRefreshTick((n) => n + 1);
            if (String(selectedApprovalRequest?.id) === String(row.id)) {
                closeCustomerDetails();
            }
        } catch (err) {
      if (shouldSuppressAuthError(err)) return;
            const msg = err instanceof Error ? err.message : 'Review failed';
            toast.error(msg);
            try { setRows(await fetchAllCustomerRequests()); } catch { /* Keep the last known state when refresh is unavailable. */ }
        } finally {
            reviewingRef.current = false;
            setBusyId('');
        }
    };

    const activeApprovalRequest = selectedApprovalRequest
        ? rows.find((row) => String(row.id) === String(selectedApprovalRequest.id)) || selectedApprovalRequest
        : null;
    const modalFooterActions = canApprove && activeApprovalRequest?.status === 'pending' ? (
        <>
            <button
                type="button"
                disabled={busyId === String(activeApprovalRequest.id)}
                onClick={() => void review(activeApprovalRequest, 'approved')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
                <CheckCircle2 className="h-4 w-4" />
                Approve
            </button>
            <button
                type="button"
                disabled={busyId === String(activeApprovalRequest.id)}
                onClick={() => void review(activeApprovalRequest, 'rejected')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/20"
            >
                <XCircle className="h-4 w-4" />
                Reject
            </button>
        </>
    ) : null;

    if (!visible) {
        return (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
                <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Approvals restricted</p>
                <p className="mt-1 text-xs text-slate-500">Only owners and managers can view the centralized approval list.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        Customer Approval Requests
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Review pending customer updates and duplicate prospect requests.
                    </p>
                </div>
                <button
                    type="button"
                    disabled={refreshing || loading}
                    onClick={() => void refresh()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing || loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                {([
                    { key: 'pending', label: 'Pending', count: counts.pending, color: 'amber' },
                    { key: 'approved', label: 'Approved', count: counts.approved, color: 'emerald' },
                    { key: 'rejected', label: 'Rejected', count: counts.rejected, color: 'rose' },
                    { key: 'all', label: 'All', count: counts.all, color: 'slate' },
                ] as const).map(({ key, label, count, color }) => {
                    const active = statusFilter === key;
                    const colorClasses: Record<string, string> = {
                        slate: active ? 'bg-slate-900 text-white dark:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
                        amber: active ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-slate-900 dark:border-amber-800 dark:text-amber-300',
                        emerald: active ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-slate-900 dark:border-emerald-800 dark:text-emerald-300',
                        rose: active ? 'bg-rose-600 text-white' : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50 dark:bg-slate-900 dark:border-rose-800 dark:text-rose-300',
                    };
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setStatusFilter(key)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${colorClasses[color]}`}
                        >
                            {label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}

                <div className="relative ml-auto min-w-[220px] flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search customer, submitter, or detail…"
                        className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                </div>
            </div>

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <p className="text-sm">Loading requests…</p>
                </div>
            ) : !filteredRows.length ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
                    <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No {statusFilter === 'all' ? '' : statusFilter} requests</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted customer updates and duplicate prospects appear here.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredRows.map((row) => {
                        const status = STATUS_STYLES[row.status] || STATUS_STYLES.pending;
                        const StatusIcon = status.icon;
                        const isDiscount = row.kind === 'discount';
                        const isDuplicateProspect = row.kind === 'duplicate_prospect';
                        const KindIcon = isDiscount ? Tag : FileText;
                        const contact = contacts.get(String(row.contact_id));
                        const customerLabel = contact?.company || contact?.name || String(row.payload?.company || (isDuplicateProspect ? 'Duplicate prospect' : `Customer #${row.contact_id}`));
                        return (
                            <article
                                key={row.id}
                                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow dark:bg-slate-900 ${status.border}`}
                            >
                                <button
                                    type="button"
                                    aria-label={`View customer details for ${customerLabel}`}
                                    onClick={() => void openCustomerDetails(String(row.contact_id), row)}
                                    className="flex w-full flex-wrap items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800/60"
                                >
                                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${status.bg}`}>
                                        <StatusIcon className={`h-4 w-4 ${status.text}`} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                                                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                {customerLabel}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                <KindIcon className="h-2.5 w-2.5" />
                                                {isDiscount ? 'Discount' : (isDuplicateProspect ? 'Duplicate Prospect' : 'Customer Update')}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.bg} ${status.text} ${status.border}`}>
                                                <StatusIcon className="h-2.5 w-2.5" />
                                                {status.label}
                                            </span>
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {row.submitted_by_name || '—'}
                                            </span>
                                            <span>·</span>
                                            <span>{formatDate(row.submitted_at)}</span>
                                        </div>

                                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                                            {summarizePayload(row)}
                                        </p>
                                    </div>

                                    {loadingContactId === String(row.contact_id)
                                        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                                        : <Building2 className="h-4 w-4 shrink-0 text-slate-400" />}
                                </button>

                                {row.review_note && (
                                    <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                                        <span className="font-bold">Review note: </span>{row.review_note}
                                    </p>
                                )}
                                {canApprove && row.status === 'pending' && (
                                            <div className="space-y-2 border-t border-slate-100 p-4 dark:border-slate-800">
                                                <input
                                                    maxLength={2000}
                                                    value={notes[String(row.id)] || ''}
                                                    onChange={(e) => setNotes((prev) => ({ ...prev, [String(row.id)]: e.target.value }))}
                                                    placeholder="Add a review note (optional)…"
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={busyId === String(row.id)}
                                                        onClick={() => void review(row, 'approved')}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busyId === String(row.id)}
                                                        onClick={() => void review(row, 'rejected')}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                            </article>
                        );
                    })}
                </div>
            )}
            <DailyCallCustomerDetailModal
                isOpen={Boolean(selectedCustomer)}
                customer={selectedCustomer}
                currentUser={currentUser}
                viewOnlyDoNotContact={Boolean(selectedCustomer && isBlockedDailyCallCustomerRow(selectedCustomer))}
                footerActions={modalFooterActions}
                onClose={closeCustomerDetails}
            />
        </div>
    );
}
