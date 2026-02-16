import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    X,
    Send,
    Phone,
    MessageSquare,
    Clock,
    Briefcase,
    MapPin,
    CreditCard,
    AlertTriangle,
    History,
    ShoppingBag,
    RotateCcw,
    User,
    PhoneIncoming,
    PhoneOutgoing,
    Calendar
} from 'lucide-react';
import {
    CallLogEntry,
    Contact,
    CustomerStatus,
    Inquiry,
    Purchase
} from '../types';
import {
    fetchCallLogs,
    fetchInquiries,
    fetchPurchases,
    fetchSalesReturns,
    createCallLog,
    fetchCustomerMetrics
} from '../services/supabaseService';
import SalesReturnTab from './SalesReturnTab'; // Reuse existing logic
import ValidationSummary from './ValidationSummary';
import { validateMinLength, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface PatientChartModalProps {
    contact: Contact;
    currentUser: any;
    onClose: () => void;
}

type TimelineItem =
    | (CallLogEntry & { type: 'call' })
    | (Inquiry & { type: 'inquiry' });

const PatientChartModal: React.FC<PatientChartModalProps> = ({
    contact,
    currentUser,
    onClose
}) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'profile' | 'purchases' | 'returns'>('purchases');
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [metrics, setMetrics] = useState<any>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [submitCount, setSubmitCount] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, [contact.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [timeline]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [calls, inqs, metricData] = await Promise.all([
                fetchCallLogs(), // We'll filter by contact locally or arguably should have a specific fetch
                fetchInquiries(), // Same here
                fetchCustomerMetrics(contact.id)
            ]);

            // Filter for this contact
            const contactCalls = calls.filter((c) => c.contact_id === contact.id);
            const contactInqs = inqs.filter((i) => i.contact_id === contact.id);

            const combined: TimelineItem[] = [
                ...contactCalls.map((c) => ({ ...c, type: 'call' as const })),
                ...contactInqs.map((i) => ({ ...i, type: 'inquiry' as const }))
            ].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

            setTimeline(combined);
            setMetrics(metricData);
        } catch (error) {
            console.error('Error loading patient chart data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        const requiredCheck = validateRequired(newMessage, 'a message');
        if (!requiredCheck.isValid) {
            setValidationErrors({ message: requiredCheck.message });
            setSubmitCount((prev) => prev + 1);
            return;
        }
        const lengthCheck = validateMinLength(newMessage, 'message', 3);
        if (!lengthCheck.isValid) {
            setValidationErrors({ message: lengthCheck.message });
            setSubmitCount((prev) => prev + 1);
            return;
        }

        setSubmitting(true);
        try {
            const entry: Omit<CallLogEntry, 'id'> = {
                contact_id: contact.id,
                agent: currentUser?.full_name || 'System',
                agent_name: currentUser?.full_name || 'System',
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                type: 'General',
                outcome: 'note',
                notes: newMessage,
                direction: 'outbound',
                channel: 'text',
                occurred_at: new Date().toISOString(),
                duration_seconds: 0
            };

            await createCallLog(entry);
            setNewMessage('');
            await loadData(); // Refresh to show new message
            addToast({
                type: 'success',
                title: 'Message sent',
                description: 'Your message has been sent successfully.',
                durationMs: 4000,
            });
        } catch (err) {
            console.error('Error sending message', err);
            addToast({
                type: 'error',
                title: 'Unable to send message',
                description: parseSupabaseError(err, 'message'),
                durationMs: 6000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleMessageBlur = (value: string) => {
        const requiredCheck = validateRequired(value, 'a message');
        if (!requiredCheck.isValid) {
            setValidationErrors({ message: requiredCheck.message });
            return;
        }
        const lengthCheck = validateMinLength(value, 'message', 3);
        setValidationErrors({ message: lengthCheck.isValid ? '' : lengthCheck.message });
    };

    const statusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return 'bg-emerald-500';
            case 'inactive':
                return 'bg-amber-500';
            case 'prospective':
                return 'bg-blue-500';
            default:
                return 'bg-slate-400';
        }
    };

    const TimelineBubble = ({ item }: { item: TimelineItem }) => {
        const isCall = item.type === 'call';
        const isAgent = isCall && item.direction === 'outbound';
        // "Agent" messages (our staff) on right, "Customer" inquiries on left?
        // Actually, owner wants to see "history".
        // Usually chat interfaces have "Me" on right, "Them" on left.
        // Inquiries are from customer -> Left.
        // Outbound calls/notes are from agent -> Right.
        // Inbound calls from customer -> Left.

        const isRight = (isCall && item.direction === 'outbound') || (isCall && item.outcome === 'note');

        return (
            <div className={`flex w-full ${isRight ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar / Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isRight ? 'bg-brand-blue text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                        {isCall ? (
                            item.outcome === 'note' ? <MessageSquare size={14} /> : <Phone size={14} />
                        ) : (
                            <User size={14} />
                        )}
                    </div>

                    {/* Bubble */}
                    <div className={`flex flex-col ${isRight ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                {isRight ? item.agent_name || 'Agent' : contact.company || 'Customer'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                {new Date(item.occurred_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${isRight
                            ? 'bg-brand-blue text-white rounded-tr-none'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none'
                            }`}>
                            {isCall ? (
                                <>
                                    {item.notes || <span className="italic opacity-70">No notes</span>}
                                    <div className={`mt-2 flex gap-2 text-[10px] font-medium uppercase tracking-wider opacity-80 ${isRight ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {item.channel !== 'text' && <span>{item.channel}</span>}
                                        {item.outcome && item.outcome !== 'note' && <span>• {item.outcome.replace('_', ' ')}</span>}
                                        {item.duration && item.duration !== '0' && <span>• {item.duration}m</span>}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="font-semibold mb-1 ">{item.title}</div>
                                    <div>{item.notes || 'Inquiry logged'}</div>
                                    <div className="mt-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                        Via {item.channel}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

                {/* Header - "Vital Signs" */}
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xl border border-slate-200 dark:border-slate-700">
                            {contact.company.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                {contact.company}
                                <span className={`w-2.5 h-2.5 rounded-full ${statusColor(contact.status)} ring-2 ring-white dark:ring-slate-900`} />
                            </h2>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <span className="flex items-center gap-1"><MapPin size={12} /> {contact.city}, {contact.province}</span>
                                <span className="block w-px h-3 bg-slate-300 dark:bg-slate-700" />
                                <span className="flex items-center gap-1"><Briefcase size={12} /> {metrics?.currency || 'PHP'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden md:block">
                            <div className="text-xs text-slate-400 uppercase font-semibold">Outstanding Balance</div>
                            <div className={`text-lg font-bold ${metrics?.outstanding_balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                ₱{metrics?.outstanding_balance?.toLocaleString() || '0'}
                            </div>
                        </div>
                        <div className="text-right hidden md:block">
                            <div className="text-xs text-slate-400 uppercase font-semibold">Credit Limit</div>
                            <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                                ₱{contact.creditLimit?.toLocaleString() || '0'}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="w-6 h-6 text-slate-500" />
                        </button>
                    </div>
                </header>

                {/* Main Content Grid */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT PANEL: Chat / Activity Log */}
                    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
                        {/* Chat Stream */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading charts...</div>
                            ) : timeline.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm opacity-60">
                                    <History size={48} className="mb-2" />
                                    <p>Patient chart initialized. No history yet.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-center my-4">
                                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                            Start of History
                                        </span>
                                    </div>
                                    {timeline.map((item) => (
                                        <TimelineBubble key={`${item.type}-${item.id}`} item={item} />
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Message Input */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                            <form onSubmit={handleSendMessage} className="relative">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onBlur={(e) => handleMessageBlur(e.target.value)}
                                    placeholder="Type a new entry, observation, or call log..."
                                    className={`w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400 text-sm ${
                                        validationErrors.message ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                />
                                <button
                                    type="submit"
                                    disabled={submitting || !newMessage.trim()}
                                    className="absolute right-2 top-2 p-1.5 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                            {validationErrors.message && (
                                <p className="mt-2 text-xs text-rose-600">{validationErrors.message}</p>
                            )}
                            <div className="mt-2 flex items-center justify-between px-1">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    Logs are <strong className="text-slate-600 dark:text-slate-300">immutable</strong>. Errors must be corrected with new entries.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: History Tabs */}
                    <div className="w-[400px] lg:w-[450px] shrink-0 bg-white dark:bg-slate-900 flex flex-col border-l border-slate-200 dark:border-slate-800">
                        <div className="flex items-center p-1 m-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                            {['purchases', 'returns', 'profile'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === tab
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {tab === 'purchases' && <ShoppingBag size={14} />}
                                    {tab === 'returns' && <RotateCcw size={14} />}
                                    {tab === 'profile' && <User size={14} />}
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contact Details</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <Phone size={14} className="mt-0.5 text-slate-400" />
                                                <div className="text-sm">
                                                    <div className="font-medium">{contact.mobile || contact.phone || '—'}</div>
                                                    <div className="text-xs text-slate-500">Primary Phone</div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <User size={14} className="mt-0.5 text-slate-400" />
                                                <div className="text-sm">
                                                    <div className="font-medium">{contact.name || '—'}</div>
                                                    <div className="text-xs text-slate-500">Contact Person</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Terms</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                                <div className="text-xs text-slate-500">Price Group</div>
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{contact.priceGroup || 'Standard'}</div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                                <div className="text-xs text-slate-500">VAT Type</div>
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{contact.vatType || 'Non-VAT'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'purchases' && (
                                <PurchaseHistoryList contactId={contact.id} />
                            )}

                            {activeTab === 'returns' && (
                                <SalesReturnTab contactId={contact.id} currentUserId={currentUser?.id} />
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// Mini component for Purchase History List to keep main clean
const PurchaseHistoryList = ({ contactId }: { contactId: string }) => {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPurchases().then(data => {
            setPurchases(data.filter(p => p.contact_id === contactId).sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()));
            setLoading(false);
        });
    }, [contactId]);

    if (loading) return <div className="text-center p-4 text-xs text-slate-400">Loading history...</div>;
    if (purchases.length === 0) return <div className="text-center p-8 text-slate-400 text-sm">No purchase history</div>;

    return (
        <div className="space-y-3">
            {purchases.map(purchase => (
                <div key={purchase.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-lg hover:border-brand-blue/30 transition-colors group">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <div className="text-sm font-bold text-slate-700 dark:text-white group-hover:text-brand-blue transition-colors">
                                {purchase.item_name || 'Purchase Order'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(purchase.purchased_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                ₱{purchase.amount.toLocaleString()}
                            </div>
                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${purchase.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                {purchase.status}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PatientChartModal;
