import React, { useEffect, useMemo, useState } from 'react';
import {
    ClipboardList, Plus, RefreshCw, CheckCircle2, XCircle, Clock3,
    Send, Tag, FileText, MessageSquare, AlertCircle, ChevronDown, ChevronUp,
    Wallet, UserCog, Hash
} from 'lucide-react';
import { CustomerRequest, createDiscountRequest, fetchCustomerRequests, requestCustomerUpdate, reviewCustomerRequest } from '../services/customerWorkflowLocalApiService';
import { Contact, UserProfile } from '../types';
import { isCompanyOwnerRole } from '../constants';
import { toast } from 'sonner';

type RequestCategory = 'terms' | 'contact_details' | 'discount' | 'others';

const CATEGORY_LABELS: Record<RequestCategory, string> = {
    terms: 'Terms',
    contact_details: 'Contact Details',
    discount: 'Discount',
    others: 'Others',
};

const CATEGORY_FIELDS: Record<RequestCategory, (keyof Contact)[]> = {
    terms: ['terms', 'priceGroup', 'transactionType', 'vatType', 'creditLimit'],
    contact_details: ['company', 'name', 'phone', 'mobile', 'email', 'address', 'city', 'province', 'area', 'tin'],
    discount: [],
    others: ['comment'],
};

const CATEGORY_ICONS: Record<RequestCategory, React.ComponentType<{ className?: string }>> = {
    terms: Wallet,
    contact_details: UserCog,
    discount: Tag,
    others: FileText,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
    pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', icon: Clock3, label: 'Pending Review' },
    approved: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', icon: CheckCircle2, label: 'Approved' },
    rejected: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', icon: XCircle, label: 'Rejected' },
};

const formatPayloadValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};

export default function CustomerRequestsTab({ contactId, contact: contactProp, currentUser }: { contactId: string; contact?: Contact | null; currentUser: UserProfile | null }) {
    const contact = contactProp ?? null;
    const [rows, setRows] = useState<CustomerRequest[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [refresh, setRefresh] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [createCategory, setCreateCategory] = useState<RequestCategory>('contact_details');
    const [createField, setCreateField] = useState<keyof Contact>('company');
    const [createValue, setCreateValue] = useState('');
    const [createNotes, setCreateNotes] = useState('');
    const [discountPercent, setDiscountPercent] = useState('');
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const owner = isCompanyOwnerRole(currentUser?.role);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setRows([]);
        fetchCustomerRequests(contactId)
            .then(data => { if (active) setRows(data); })
            .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load requests'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [contactId, refresh]);

    useEffect(() => {
        const fields = CATEGORY_FIELDS[createCategory];
        if (fields.length > 0) setCreateField(fields[0]);
    }, [createCategory]);

    const review = async (row: CustomerRequest, decision: 'approved' | 'rejected') => {
        setBusy(row.id);
        setError('');
        try {
            await reviewCustomerRequest(contactId, row.id, decision, notes[row.id] || '');
            setRefresh(n => n + 1);
            toast.success(`Request ${decision === 'approved' ? 'approved' : 'rejected'}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Review failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setBusy('');
        }
    };

    const submit = async () => {
        if (!contact) return;
        setBusy('create');
        setError('');
        try {
            if (createCategory === 'discount') {
                if (!discountPercent.trim() || !createNotes.trim() || createNotes.trim().length < 10) {
                    setError('Enter a discount percentage and a reason of at least 10 characters');
                    setBusy('');
                    return;
                }
                await createDiscountRequest({ contact_id: contactId, discount_percentage: Number(discountPercent), reason: createNotes.trim() });
            } else {
                if (!createValue.trim()) {
                    setError('Please enter a proposed value');
                    setBusy('');
                    return;
                }
                const payload: Record<string, unknown> = { [createField]: createValue.trim() };
                if (createNotes.trim()) payload.notes = createNotes.trim();
                await requestCustomerUpdate(contactId, payload as Partial<Contact>);
            }
            setCreateValue('');
            setCreateNotes('');
            setDiscountPercent('');
            setShowCreate(false);
            setRefresh(n => n + 1);
            toast.success('Request submitted for approval');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Submission failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setBusy('');
        }
    };

    const counts = useMemo(() => ({
        all: rows.length,
        pending: rows.filter(r => r.status === 'pending').length,
        approved: rows.filter(r => r.status === 'approved').length,
        rejected: rows.filter(r => r.status === 'rejected').length,
    }), [rows]);

    const filteredRows = useMemo(() => {
        if (filter === 'all') return rows;
        return rows.filter(r => r.status === filter);
    }, [rows, filter]);

    const toggleExpand = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="space-y-5 p-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        Requests for Management Approval
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Sales agents submit customer detail changes here for management approval. Approved changes are then applied to the customer record. Discount approval records authorization; it does not automatically change prices on existing sales documents.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={loading || !!busy}
                        onClick={() => setRefresh(n => n + 1)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    {!owner && contact && !showCreate && (
                        <button
                            type="button"
                            onClick={() => setShowCreate(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New Request
                        </button>
                    )}
                </div>
            </div>

            {/* Status Filter Tabs */}
            {!loading && rows.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {([
                        { key: 'all', label: 'All', count: counts.all, color: 'slate' },
                        { key: 'pending', label: 'Pending', count: counts.pending, color: 'amber' },
                        { key: 'approved', label: 'Approved', count: counts.approved, color: 'emerald' },
                        { key: 'rejected', label: 'Rejected', count: counts.rejected, color: 'rose' },
                    ] as const).map(({ key, label, count, color }) => {
                        const active = filter === key;
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
                                onClick={() => setFilter(key as typeof filter)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${colorClasses[color]}`}
                            >
                                {label}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Create Form */}
            {!owner && contact && showCreate && (
                <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between border-b border-blue-200 bg-white px-4 py-3 dark:border-blue-900/40 dark:bg-slate-900">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <Plus className="h-4 w-4 text-blue-600" />
                            New Request
                        </h4>
                        <button
                            type="button"
                            onClick={() => { setShowCreate(false); setCreateValue(''); setCreateNotes(''); setDiscountPercent(''); setError(''); }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-4 p-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                <Tag className="mr-1 inline h-3 w-3" />
                                Request Type
                            </label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {(Object.keys(CATEGORY_LABELS) as RequestCategory[]).map(c => {
                                    const Icon = CATEGORY_ICONS[c];
                                    const active = createCategory === c;
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCreateCategory(c)}
                                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${active
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {CATEGORY_LABELS[c]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {createCategory !== 'discount' && CATEGORY_FIELDS[createCategory].length > 0 && (
                            <>
                                <div>
                                    <label htmlFor="cr-field" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        <Hash className="mr-1 inline h-3 w-3" />
                                        Field to Update
                                    </label>
                                    <select
                                        id="cr-field"
                                        value={String(createField)}
                                        onChange={e => setCreateField(e.target.value as keyof Contact)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    >
                                        {CATEGORY_FIELDS[createCategory].map(f => (
                                            <option key={String(f)} value={String(f)}>
                                                {String(f).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="cr-current" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Current Value
                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">read-only</span>
                                    </label>
                                    <input
                                        id="cr-current"
                                        readOnly
                                        value={String((contact as unknown as Record<string, unknown>)[createField] ?? '—')}
                                        className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="cr-proposed" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        New Value <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="cr-proposed"
                                        value={createValue}
                                        onChange={e => setCreateValue(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        placeholder="Type the new value here"
                                    />
                                </div>
                            </>
                        )}

                        {createCategory === 'discount' && (
                            <div>
                                <label htmlFor="cr-discount" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    <Tag className="mr-1 inline h-3 w-3" />
                                    Discount Percentage (1-100) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="cr-discount"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={discountPercent}
                                    onChange={e => setDiscountPercent(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    placeholder="e.g. 10"
                                />
                            </div>
                        )}

                        <div>
                            <label htmlFor="cr-notes" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                <MessageSquare className="mr-1 inline h-3 w-3" />
                                Reason / Notes {createCategory === 'discount' && <span className="text-rose-500">*</span>}
                            </label>
                            <textarea
                                id="cr-notes"
                                value={createNotes}
                                onChange={e => setCreateNotes(e.target.value)}
                                maxLength={2000}
                                rows={3}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                placeholder={createCategory === 'discount' ? 'Explain why this discount is needed (min 10 characters)...' : 'Optional notes for the reviewer...'}
                            />
                            <p className="mt-1 text-right text-[10px] text-slate-400">{createNotes.length}/2000</p>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => { setShowCreate(false); setCreateValue(''); setCreateNotes(''); setDiscountPercent(''); setError(''); }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={busy === 'create'}
                                onClick={() => void submit()}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Send className="h-3.5 w-3.5" />
                                {busy === 'create' ? 'Submitting…' : 'Submit for Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Requests List */}
            {loading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <p className="text-sm">Loading requests…</p>
                </div>
            ) : !rows.length ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
                    <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No requests yet</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted requests for management approval will appear here.</p>
                </div>
            ) : !filteredRows.length ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/30">
                    <p className="text-sm text-slate-500">No {filter} requests.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRows.map(row => {
                        const status = STATUS_STYLES[row.status] || STATUS_STYLES.pending;
                        const StatusIcon = status.icon;
                        const isDiscount = row.kind === 'discount';
                        const isExpanded = expandedRows[row.id] ?? false;
                        const payloadEntries = Object.entries(row.payload);
                        return (
                            <article
                                key={row.id}
                                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900 ${status.border}`}
                            >
                                <header className="flex flex-wrap items-start justify-between gap-3 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${status.bg}`}>
                                            <StatusIcon className={`h-4 w-4 ${status.text}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {isDiscount ? 'Discount Request' : 'Customer Update'}
                                                </h4>
                                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.bg} ${status.text} ${status.border}`}>
                                                    <StatusIcon className="h-2.5 w-2.5" />
                                                    {status.label}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                <span>By <span className="font-semibold text-slate-700 dark:text-slate-200">{row.submitted_by_name}</span></span>
                                                <span>·</span>
                                                <span>{formatDate(row.submitted_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(row.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    >
                                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                        {isExpanded ? 'Hide' : 'Details'}
                                    </button>
                                </header>

                                {(isExpanded || (!isDiscount && payloadEntries.length <= 2)) && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                                        <dl className="space-y-2">
                                            {payloadEntries.map(([key, value]) => (
                                                <div key={key} className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr]">
                                                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        {key.replaceAll('_', ' ')}
                                                    </dt>
                                                    <dd className="break-words text-sm text-slate-800 dark:text-slate-200">
                                                        {formatPayloadValue(value)}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </div>
                                )}

                                {row.review_note && (
                                    <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/30">
                                        <span className="font-bold text-slate-600 dark:text-slate-400">Review note: </span>
                                        <span className="text-slate-700 dark:text-slate-300">{row.review_note}</span>
                                    </div>
                                )}

                                {owner && row.status === 'pending' && (
                                    <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Review note (optional)
                                        </label>
                                        <input
                                            maxLength={2000}
                                            value={notes[row.id] || ''}
                                            onChange={e => setNotes(old => ({ ...old, [row.id]: e.target.value }))}
                                            placeholder="Add a comment for the requester…"
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        />
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={busy === row.id}
                                                onClick={() => void review(row, 'approved')}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                {busy === row.id ? 'Working…' : 'Approve'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy === row.id}
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
        </div>
    );
}
