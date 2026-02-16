import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowUpRight,
    BarChart3,
    Building2,
    ChevronDown,
    Clock,
    MapPin,
    Phone,
    PhilippinePeso,
    Plus,
    ShieldAlert,
    Target,
    TrendingUp,
    UserCheck,
    UserPlus,
    Users,
    UserX,
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import CustomerRecordModal from './CustomerRecordModal';
import {
    fetchCallLogs,
    fetchContacts,
    fetchPurchases,
} from '../services/supabaseService';
import {
    CallLogEntry,
    Contact,
    CustomerStatus,
    Purchase,
    UserProfile,
} from '../types';

interface SalespersonDashboardViewProps {
    currentUser: UserProfile | null;
    onNavigate?: (tab: string, data?: any) => void;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        maximumFractionDigits: 0,
    }).format(value);

const formatRelativeTime = (value?: string | null) => {
    if (!value) return 'No activity';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'No activity';
    const diffMs = Date.now() - parsed.getTime();
    const days = Math.round(diffMs / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.round(days / 7)}w ago`;
    return `${Math.round(days / 30)}mo ago`;
};

const isWithinCurrentMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
    );
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

type CallListKey = 'active' | 'inactivePositive' | 'prospective';

const SalespersonDashboardView: React.FC<SalespersonDashboardViewProps> = ({
    currentUser,
    onNavigate,
}) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedData, setHasLoadedData] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [expandedLists, setExpandedLists] = useState<Record<CallListKey, boolean>>({
        active: true,
        inactivePositive: false,
        prospective: false,
    });

    const agentName = currentUser?.full_name?.trim() || null;
    const isSalesAgent = Boolean(
        currentUser?.role && currentUser.role.toLowerCase().includes('agent')
    );

    const loadData = useCallback(async () => {
        if (!agentName || !isSalesAgent) return;
        setLoading(true);
        try {
            const [contactData, purchaseData, callLogData] = await Promise.all([
                fetchContacts(),
                fetchPurchases(),
                fetchCallLogs(),
            ]);

            const assignedContacts = contactData.filter(
                (contact) => contact.salesman === agentName
            );
            const contactIds = new Set(assignedContacts.map((c) => c.id));

            setContacts(assignedContacts);
            setPurchases(purchaseData.filter((p) => contactIds.has(p.contact_id)));
            setCallLogs(callLogData.filter((log) => log.agent_name === agentName));
            setHasLoadedData(true);
        } catch (error) {
            console.error('Error loading salesperson dashboard:', error);
        } finally {
            setLoading(false);
        }
    }, [agentName, isSalesAgent]);

    useEffect(() => {
        if (!agentName || !isSalesAgent) {
            setLoading(false);
            return;
        }
        loadData();
    }, [agentName, isSalesAgent, loadData]);

    // KPI Calculations
    const quota = currentUser?.monthly_quota || 0;
    const currentMonthPurchases = useMemo(
        () =>
            purchases.filter(
                (p) => isWithinCurrentMonth(p.purchased_at) && p.status === 'paid'
            ),
        [purchases]
    );
    const currentSales = useMemo(
        () => currentMonthPurchases.reduce((sum, p) => sum + (p.amount || 0), 0),
        [currentMonthPurchases]
    );
    const percentAchieved = quota > 0 ? Math.min(100, Math.round((currentSales / quota) * 100)) : 0;

    // Build contact lists with last contact info
    const lastContactMap = useMemo(() => {
        const map = new Map<string, string>();
        callLogs.forEach((log) => {
            const current = map.get(log.contact_id);
            if (!current || Date.parse(log.occurred_at) > Date.parse(current)) {
                map.set(log.contact_id, log.occurred_at);
            }
        });
        return map;
    }, [callLogs]);

    const purchasesByContact = useMemo(() => {
        const map = new Map<string, Purchase[]>();
        purchases.forEach((p) => {
            if (!map.has(p.contact_id)) map.set(p.contact_id, []);
            map.get(p.contact_id)!.push(p);
        });
        return map;
    }, [purchases]);

    const buildContactEntry = useCallback(
        (contact: Contact) => {
            const lastContact = lastContactMap.get(contact.id);
            const totalSales =
                purchasesByContact
                    .get(contact.id)
                    ?.filter((p) => p.status === 'paid')
                    .reduce((sum, p) => sum + p.amount, 0) || 0;
            return { contact, lastContact, totalSales };
        },
        [lastContactMap, purchasesByContact]
    );

    const hasPositiveIndicator = (contact: Contact) =>
        contact.comment?.toLowerCase().includes('positive') || false;

    const callLists = useMemo(() => {
        return {
            active: contacts
                .filter((c) => c.status === CustomerStatus.ACTIVE)
                .map(buildContactEntry)
                .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0)),
            inactivePositive: contacts
                .filter(
                    (c) =>
                        c.status === CustomerStatus.INACTIVE && hasPositiveIndicator(c)
                )
                .map(buildContactEntry)
                .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0)),
            prospective: contacts
                .filter((c) => c.status === CustomerStatus.PROSPECTIVE)
                .map(buildContactEntry)
                .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0)),
        };
    }, [contacts, buildContactEntry]);

    const toggleList = (key: CallListKey) => {
        setExpandedLists((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleContactClick = (contact: Contact) => {
        setSelectedContact(contact);
        setShowCustomerModal(true);
    };

    const handleAddProspect = () => {
        if (onNavigate) {
            onNavigate('maintenance-customer-customer-database', { action: 'create', status: 'Prospective' });
        }
    };

    const handleCreateInquiry = (contact: Contact) => {
        if (onNavigate) {
            onNavigate('sales-workflow-sales-inquiry', { prefill: contact });
        }
    };

    // Guard states
    if (!currentUser) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm max-w-md">
                    <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                        Sign in required
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Please sign in with your sales agent account to view the dashboard.
                    </p>
                </div>
            </div>
        );
    }

    if (!isSalesAgent) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center shadow-sm max-w-md">
                    <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                        Sales agent view
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        This dashboard is designed for sales agents. Please use the main
                        dashboard for other roles.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <CustomLoadingSpinner label="Loading" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-6 space-y-6 animate-fadeIn">
            {/* Header */}
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Sales Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Welcome back, <span className="font-semibold">{agentName}</span>
                    </p>
                </div>
                <button
                    onClick={handleAddProspect}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-semibold shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/30 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Prospect
                </button>
            </header>

            {/* KPI Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Monthly Quota */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                            <Target className="w-5 h-5" />
                            <span className="text-xs font-semibold uppercase tracking-wide">
                                Monthly Quota
                            </span>
                        </div>
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
                            <PhilippinePeso className="w-5 h-5 text-brand-blue" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">
                        {formatCurrency(quota)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Target for this month
                    </p>
                </div>

                {/* Current Sales */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                            <TrendingUp className="w-5 h-5" />
                            <span className="text-xs font-semibold uppercase tracking-wide">
                                Current Sales
                            </span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">
                        {hasLoadedData ? formatCurrency(currentSales) : '—'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {currentMonthPurchases.length} transactions this month
                    </p>
                </div>

                {/* Achievement Percentage */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                            <BarChart3 className="w-5 h-5" />
                            <span className="text-xs font-semibold uppercase tracking-wide">
                                Achievement
                            </span>
                        </div>
                        <div
                            className={`p-2 rounded-xl ${percentAchieved >= 80
                                    ? 'bg-emerald-50 dark:bg-emerald-900/30'
                                    : percentAchieved >= 50
                                        ? 'bg-amber-50 dark:bg-amber-900/30'
                                        : 'bg-rose-50 dark:bg-rose-900/30'
                                }`}
                        >
                            {percentAchieved >= 80 ? (
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <AlertCircle
                                    className={`w-5 h-5 ${percentAchieved >= 50 ? 'text-amber-500' : 'text-rose-500'
                                        }`}
                                />
                            )}
                        </div>
                    </div>
                    <p
                        className={`text-3xl font-bold ${percentAchieved >= 80
                                ? 'text-emerald-500'
                                : percentAchieved >= 50
                                    ? 'text-amber-500'
                                    : 'text-slate-800 dark:text-white'
                            }`}
                    >
                        {hasLoadedData ? `${percentAchieved}%` : '—'}
                    </p>
                    <div className="mt-3 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${percentAchieved >= 80
                                    ? 'bg-emerald-500'
                                    : percentAchieved >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-brand-blue'
                                }`}
                            style={{ width: `${percentAchieved}%` }}
                        />
                    </div>
                </div>
            </section>

            {/* Call Lists */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20">
                            <Phone className="w-5 h-5 text-brand-blue" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                                Call List
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Customers to contact — click to view details
                            </p>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Active Customers */}
                    <CallListSection
                        title="Active Customers"
                        icon={UserCheck}
                        iconColor="text-emerald-500"
                        items={callLists.active}
                        isExpanded={expandedLists.active}
                        onToggle={() => toggleList('active')}
                        onContactClick={handleContactClick}
                    />

                    {/* Inactive-Positive */}
                    <CallListSection
                        title="Inactive-Positive"
                        icon={UserPlus}
                        iconColor="text-amber-500"
                        items={callLists.inactivePositive}
                        isExpanded={expandedLists.inactivePositive}
                        onToggle={() => toggleList('inactivePositive')}
                        onContactClick={handleContactClick}
                    />

                    {/* Prospective */}
                    <CallListSection
                        title="Prospective"
                        icon={Users}
                        iconColor="text-blue-500"
                        items={callLists.prospective}
                        isExpanded={expandedLists.prospective}
                        onToggle={() => toggleList('prospective')}
                        onContactClick={handleContactClick}
                    />
                </div>
            </section>

            {/* Customer Record Modal */}
            {showCustomerModal && selectedContact && (
                <CustomerRecordModal
                    contact={selectedContact}
                    currentUser={currentUser}
                    onClose={() => setShowCustomerModal(false)}
                    onCreateInquiry={handleCreateInquiry}
                />
            )}
        </div>
    );
};

// Collapsible Call List Section Component
interface CallListSectionProps {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    items: Array<{ contact: Contact; lastContact?: string; totalSales: number }>;
    isExpanded: boolean;
    onToggle: () => void;
    onContactClick: (contact: Contact) => void;
}

const CallListSection: React.FC<CallListSectionProps> = ({
    title,
    icon: Icon,
    iconColor,
    items,
    isExpanded,
    onToggle,
    onContactClick,
}) => {
    return (
        <div>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
                        {title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {items.length}
                    </span>
                </div>
                <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {isExpanded && (
                <div className="px-5 pb-4">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                            No customers in this segment
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.slice(0, 12).map(({ contact, lastContact, totalSales }) => (
                                <button
                                    key={contact.id}
                                    onClick={() => onContactClick(contact)}
                                    className="text-left p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-brand-blue hover:shadow-sm transition-all group"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate group-hover:text-brand-blue transition-colors">
                                                {contact.company}
                                            </p>
                                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                <MapPin className="w-3 h-3" />
                                                <span className="truncate">{contact.city || contact.province || 'No location'}</span>
                                            </div>
                                        </div>
                                        <span
                                            className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadgeClasses(
                                                contact.status
                                            )}`}
                                        >
                                            {contact.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatRelativeTime(lastContact)}</span>
                                        </div>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {formatCurrency(totalSales)}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {items.length > 12 && (
                        <div className="text-center mt-4">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                +{items.length - 12} more customers
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SalespersonDashboardView;
