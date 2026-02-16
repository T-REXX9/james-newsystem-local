import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    Building2,
    Calendar,
    Clock,
    CreditCard,
    FileText,
    Mail,
    MapPin,
    MessageSquare,
    Phone,
    Plus,
    ShoppingBag,
    User,
    X,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import {
    fetchCallLogs,
    fetchIncidentReports,
    fetchInquiries,
    fetchPurchases,
} from '../services/supabaseService';
import {
    CallLogEntry,
    Contact,
    CustomerStatus,
    IncidentReport,
    Inquiry,
    Purchase,
    UserProfile,
} from '../types';

interface CustomerRecordModalProps {
    contact: Contact;
    currentUser: UserProfile | null;
    onClose: () => void;
    onCreateInquiry?: (contact: Contact) => void;
}

type TabKey = 'purchases' | 'complaints' | 'timeline';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 0,
    }).format(value);

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatRelativeTime = (value?: string | null) => {
    if (!value) return 'No date';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'No date';
    const diffMs = Date.now() - parsed.getTime();
    const days = Math.round(diffMs / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.round(days / 7)}w ago`;
    return `${Math.round(days / 30)}mo ago`;
};

const statusBadgeClasses = (status: CustomerStatus) => {
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

const CustomerRecordModal: React.FC<CustomerRecordModalProps> = ({
    contact,
    currentUser,
    onClose,
    onCreateInquiry,
}) => {
    const [activeTab, setActiveTab] = useState<TabKey>('purchases');
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [incidents, setIncidents] = useState<IncidentReport[]>([]);
    const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [purchaseData, incidentData, callLogData, inquiryData] = await Promise.all([
                    fetchPurchases(),
                    fetchIncidentReports(contact.id),
                    fetchCallLogs(),
                    fetchInquiries(),
                ]);

                setPurchases(
                    purchaseData
                        .filter((p) => p.contact_id === contact.id)
                        .sort((a, b) => Date.parse(b.purchased_at) - Date.parse(a.purchased_at))
                );
                setIncidents(
                    incidentData.sort((a, b) => Date.parse(b.report_date) - Date.parse(a.report_date))
                );
                setCallLogs(
                    callLogData
                        .filter((log) => log.contact_id === contact.id)
                        .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
                );
                setInquiries(
                    inquiryData
                        .filter((inq) => inq.contact_id === contact.id)
                        .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
                );
            } catch (error) {
                console.error('Error loading customer record:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [contact.id]);

    // Build combined timeline
    const timeline = useMemo(() => {
        const items: Array<{
            id: string;
            type: 'call' | 'inquiry' | 'purchase';
            title: string;
            date: string;
            detail?: string;
            meta?: string;
        }> = [];

        callLogs.forEach((log) => {
            items.push({
                id: `call-${log.id}`,
                type: 'call',
                title: log.channel === 'text' ? 'SMS' : 'Call',
                date: log.occurred_at,
                detail: log.notes,
                meta: `${log.direction === 'inbound' ? 'Inbound' : 'Outbound'} • ${log.outcome?.replace('_', ' ') || 'Logged'}`,
            });
        });

        inquiries.forEach((inq) => {
            items.push({
                id: `inq-${inq.id}`,
                type: 'inquiry',
                title: 'Inquiry',
                date: inq.occurred_at,
                detail: inq.notes || inq.title,
                meta: `via ${inq.channel}`,
            });
        });

        purchases.forEach((p) => {
            items.push({
                id: `purchase-${p.id}`,
                type: 'purchase',
                title: 'Purchase',
                date: p.purchased_at,
                detail: p.notes,
                meta: `${formatCurrency(p.amount)} • ${p.status}`,
            });
        });

        return items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }, [callLogs, inquiries, purchases]);

    const totalPurchases = purchases.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

    const handleCreateInquiry = () => {
        if (onCreateInquiry) {
            onCreateInquiry(contact);
        }
        onClose();
    };

    const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
        { key: 'purchases', label: 'Purchases', count: purchases.length },
        { key: 'complaints', label: 'Complaints', count: incidents.length },
        { key: 'timeline', label: 'Timeline', count: timeline.length },
    ];

	    const modal = (
	        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
	            {/*
	              Keep modal size stable across tab switches by using a fixed viewport-based height.
	              Content scrolls inside, instead of the modal resizing to fit each tab.
	            */}
	            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center text-white text-xl font-bold">
                                {contact.company?.charAt(0) || 'C'}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                    {contact.company}
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span
                                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeClasses(
                                            contact.status
                                        )}`}
                                    >
                                        {contact.status}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Assigned to {contact.salesman}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="truncate">{contact.city || contact.province || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="truncate">{contact.phone || contact.mobile || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <span>Limit: {formatCurrency(contact.creditLimit || 0)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Since {contact.customerSince || '—'}</span>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                {formatCurrency(totalPurchases)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Total Purchases</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                {purchases.length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Transactions</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                {incidents.length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Complaints</p>
                        </div>
                        <div className="ml-auto">
                            <button
                                onClick={handleCreateInquiry}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-semibold shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/30 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Create Inquiry
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-5 pt-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === tab.key
                                ? 'bg-slate-100 dark:bg-slate-800 text-brand-blue'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

	                {/* Content */}
	                {/*
	                  Prevent perceived modal resizing when switching tabs: if a tab overflows,
	                  the scrollbar can appear/disappear and cause layout shift. Force a stable
	                  scrollbar gutter and always reserve scrollbar space.
	                */}
	                <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable] p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <CustomLoadingSpinner label="Loading" />
                        </div>
                    ) : (
                        <>
                            {/* Purchases Tab */}
                            {activeTab === 'purchases' && (
                                <div className="space-y-3">
                                    {purchases.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                            <p>No purchase history</p>
                                        </div>
                                    ) : (
                                        purchases.map((purchase) => (
                                            <div
                                                key={purchase.id}
                                                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <ShoppingBag className="w-4 h-4 text-brand-blue" />
                                                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                                                            {formatCurrency(purchase.amount)}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${purchase.status === 'paid'
                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                            : purchase.status === 'pending'
                                                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}
                                                    >
                                                        {purchase.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                                    <span>{formatDate(purchase.purchased_at)}</span>
                                                    <span>{formatRelativeTime(purchase.purchased_at)}</span>
                                                </div>
                                                {purchase.notes && (
                                                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                                        {purchase.notes}
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Complaints Tab */}
                            {activeTab === 'complaints' && (
                                <div className="space-y-3">
                                    {incidents.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                            <p>No complaints or incidents reported</p>
                                        </div>
                                    ) : (
                                        incidents.map((incident) => (
                                            <div
                                                key={incident.id}
                                                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                        <span className="text-sm font-semibold text-slate-800 dark:text-white capitalize">
                                                            {incident.issue_type?.replace('_', ' ') || 'Issue'}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${incident.approval_status === 'approved'
                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                            : incident.approval_status === 'rejected'
                                                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                                                                : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                                                            }`}
                                                    >
                                                        {incident.approval_status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                                                    {incident.description}
                                                </p>
                                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                                    <span>Reported: {formatDate(incident.report_date)}</span>
                                                    <span>Incident: {formatDate(incident.incident_date)}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Timeline Tab */}
                            {activeTab === 'timeline' && (
                                <div className="space-y-3">
                                    {timeline.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                            <p>No activity recorded</p>
                                        </div>
                                    ) : (
                                        timeline.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {item.type === 'call' && (
                                                            <Phone className="w-4 h-4 text-brand-blue" />
                                                        )}
                                                        {item.type === 'inquiry' && (
                                                            <MessageSquare className="w-4 h-4 text-purple-500" />
                                                        )}
                                                        {item.type === 'purchase' && (
                                                            <ShoppingBag className="w-4 h-4 text-emerald-500" />
                                                        )}
                                                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                                                            {item.title}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {formatRelativeTime(item.date)}
                                                    </span>
                                                </div>
                                                {item.detail && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                                                        {item.detail}
                                                    </p>
                                                )}
                                                {item.meta && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {item.meta}
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
	        </div>
	    );

	    // IMPORTANT: This modal is rendered inside views that use `animate-fadeIn` (which applies
	    // `transform`). A transformed ancestor changes how `position: fixed` is calculated and can
	    // cause the overlay/backdrop to NOT cover the full viewport. Portaling to `document.body`
	    // ensures the backdrop always occupies the full screen.
	    if (typeof document === 'undefined' || !document.body) return null;
	    return createPortal(modal, document.body);
};

export default CustomerRecordModal;
