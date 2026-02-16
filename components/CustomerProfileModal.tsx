import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  Send,
  ShoppingBag,
  User,
  Wallet,
  X
} from 'lucide-react';
import { CallLogEntry, Contact, Inquiry, Purchase, UserProfile } from '../types';
import {
  createCallLog,
  fetchCallLogs,
  fetchCustomerMetrics,
  fetchInquiries,
  fetchPurchases,
  fetchSalesReturns
} from '../services/supabaseService';
import SalesReturnTab from './SalesReturnTab';
import ValidationSummary from './ValidationSummary';
import { validateMinLength, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface CustomerProfileModalProps {
  contact: Contact;
  currentUser: UserProfile | null;
  onClose: () => void;
}

interface CustomerMetrics {
  outstanding_balance?: number;
  credit_limit?: number;
  currency?: string;
}

type ActiveTab = 'log' | 'purchases' | 'returns' | 'inquiries' | 'calls' | 'credit';

type TimelineItem =
  | { id: string; type: 'call'; occurred_at: string; direction: 'inbound' | 'outbound'; content: string; agentName: string; channel: string; outcome: string; durationSeconds: number }
  | { id: string; type: 'inquiry'; occurred_at: string; content: string; title: string; channel: string }
  | { id: string; type: 'system'; occurred_at: string; content: string; event: 'purchase' | 'return' | 'system'; amount?: number };

const formatCurrency = (value: number, currency: string = 'PHP') =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({ contact, currentUser, onClose }) => {
  const { addToast } = useToast();
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('log');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [allCalls, allInquiries, allPurchases, returnsData, metricData] = await Promise.all([
        fetchCallLogs(),
        fetchInquiries(),
        fetchPurchases(),
        fetchSalesReturns(contact.id),
        fetchCustomerMetrics(contact.id)
      ]);

      const contactCalls = allCalls.filter((item) => item.contact_id === contact.id);
      const contactInquiries = allInquiries.filter((item) => item.contact_id === contact.id);
      const contactPurchases = allPurchases.filter((item) => item.contact_id === contact.id);

      setCallLogs(contactCalls);
      setInquiries(contactInquiries);
      setPurchases(contactPurchases);
      setSalesReturns(returnsData || []);
      setMetrics((metricData as CustomerMetrics | null) ?? null);

      const callEvents: TimelineItem[] = contactCalls.map((item) => ({
        id: `call-${item.id}`,
        type: 'call',
        occurred_at: item.occurred_at,
        direction: item.direction,
        content: item.notes || 'Call logged',
        agentName: item.agent_name || 'Sales Agent',
        channel: item.channel,
        outcome: item.outcome,
        durationSeconds: item.duration_seconds || 0
      }));

      const inquiryEvents: TimelineItem[] = contactInquiries.map((item) => ({
        id: `inquiry-${item.id}`,
        type: 'inquiry',
        occurred_at: item.occurred_at,
        content: item.notes || 'Inquiry logged',
        title: item.title || 'Inquiry',
        channel: item.channel
      }));

      const purchaseEvents: TimelineItem[] = contactPurchases.map((item) => ({
        id: `purchase-${item.id}`,
        type: 'system',
        event: 'purchase',
        occurred_at: item.purchased_at,
        content: `Purchase recorded (${item.status}).`,
        amount: item.amount
      }));

      const returnEvents: TimelineItem[] = (returnsData || []).map((item: any) => ({
        id: `return-${item.id}`,
        type: 'system',
        event: 'return',
        occurred_at: item.return_date,
        content: `Sales return ${item.status || 'pending'}.`,
        amount: item.total_refund || 0
      }));

      setTimeline(
        [...callEvents, ...inquiryEvents, ...purchaseEvents, ...returnEvents].sort(
          (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
        )
      );
    } catch (error) {
      setLoadError(parseSupabaseError(error, 'customer history'));
      addToast({
        type: 'error',
        title: 'Unable to load customer profile',
        description: parseSupabaseError(error, 'customer history'),
        durationMs: 6000
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [contact.id]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const visibleTimeline = useMemo(() => {
    if (activeTab === 'calls') return timeline.filter((item) => item.type === 'call');
    if (activeTab === 'inquiries') return timeline.filter((item) => item.type === 'inquiry');
    if (activeTab === 'purchases') return timeline.filter((item) => item.type === 'system' && item.event === 'purchase');
    if (activeTab === 'returns') return timeline.filter((item) => item.type === 'system' && item.event === 'return');
    return timeline;
  }, [activeTab, timeline]);

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleTimeline.length]);

  const rtoCount = salesReturns.length;
  const vipTier = (contact.priceGroup || '').toUpperCase().includes('VIP')
    ? contact.priceGroup
    : (contact.totalSales || 0) >= 500000
      ? 'VIP 2'
      : (contact.totalSales || 0) >= 250000
        ? 'VIP 1'
        : 'STANDARD';
  const currency = metrics?.currency || 'PHP';
  const outstandingBalance = metrics?.outstanding_balance || 0;
  const creditLimit = contact.creditLimit || metrics?.credit_limit || 0;
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);

  const handleBlurMessage = (value: string) => {
    const requiredCheck = validateRequired(value, 'a message');
    if (!requiredCheck.isValid) {
      setValidationErrors({ message: requiredCheck.message });
      return;
    }
    const lengthCheck = validateMinLength(value, 'message', 3);
    setValidationErrors({ message: lengthCheck.isValid ? '' : lengthCheck.message });
  };

  const handleSubmitMessage = async (event: React.FormEvent) => {
    event.preventDefault();
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
    setValidationErrors({});
    try {
      await createCallLog({
        contact_id: contact.id,
        agent_name: currentUser?.full_name || 'System',
        channel: 'text',
        direction: 'outbound',
        duration_seconds: 0,
        notes: newMessage.trim(),
        outcome: 'note',
        occurred_at: new Date().toISOString(),
        next_action: null,
        next_action_due: null
      });

      setNewMessage('');
      setActiveTab('log');
      await loadData();
      addToast({
        type: 'success',
        title: 'Entry added',
        description: 'New immutable timeline entry was saved.',
        durationMs: 4000
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to add entry',
        description: parseSupabaseError(error, 'call log'),
        durationMs: 6000
      });
    } finally {
      setSubmitting(false);
    }
  };

  const navItems: Array<{ key: ActiveTab; label: string; count?: number }> = [
    { key: 'log', label: 'Immutable Log', count: timeline.length },
    { key: 'purchases', label: 'Purchase History', count: purchases.length },
    { key: 'returns', label: 'Sales Returns', count: salesReturns.length },
    { key: 'inquiries', label: 'Inquiry History', count: inquiries.length },
    { key: 'calls', label: 'Daily Call Logs', count: callLogs.length },
    { key: 'credit', label: 'Credit Ledger' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm p-2 md:p-4 animate-fadeIn">
      <div className="mx-auto flex h-[90vh] w-full max-w-[1400px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-slate-50 p-4 md:flex md:flex-col dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-xl font-bold text-white">
                {contact.company?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{contact.company}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Member since {contact.customerSince || '—'}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Close modal">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-2">
            {rtoCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                RTO {rtoCount}
              </span>
            )}
            <span className="rounded-full bg-brand-blue/10 px-2 py-1 text-[11px] font-bold text-brand-blue">
              {vipTier}
            </span>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="truncate">{contact.email || 'No email'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>{contact.mobile || contact.phone || 'No phone'}</span>
            </div>
            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
              <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
              <span>{contact.address || `${contact.city}, ${contact.province}` || 'No address'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['Email', 'Phone', 'Address'].map((field) => (
                <button
                  key={field}
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => addToast({ type: 'info', title: 'Change proposal', description: `Propose ${field} change from Contact Details panel.` })}
                >
                  Propose {field}
                </button>
              ))}
            </div>
          </div>

          <nav className="mt-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activeTab === item.key
                    ? 'bg-brand-blue text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.count === 'number' && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${activeTab === item.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col border-r border-slate-200 dark:border-slate-800">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Interaction Timeline</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Logs are immutable. Errors must be corrected with new entries.</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Close modal">
              <X className="h-5 w-5" />
            </button>
          </header>

          <section className="flex-1 overflow-y-auto bg-slate-50/80 p-4 dark:bg-slate-950">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading charts...</div>
            ) : loadError ? (
              <div className="flex h-full items-center justify-center text-sm text-rose-500">{loadError}</div>
            ) : visibleTimeline.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No history yet</div>
            ) : (
              visibleTimeline.map((item, index) => {
                const prev = visibleTimeline[index - 1];
                const currentDate = new Date(item.occurred_at).toDateString();
                const previousDate = prev ? new Date(prev.occurred_at).toDateString() : '';
                const showDateDivider = currentDate !== previousDate;
                const isRight = item.type === 'call' && item.direction === 'outbound';

                return (
                  <div key={item.id}>
                    {showDateDivider && (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {new Date(item.occurred_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div className={`mb-3 flex ${isRight ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm shadow-sm ${isRight ? 'rounded-tr-sm border-brand-blue/40 bg-brand-blue text-white' : 'rounded-tl-sm border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}>
                        {item.type === 'inquiry' && (
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">{item.title}</div>
                        )}
                        <p>{item.content}</p>
                        <div className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] ${isRight ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(item.occurred_at).toLocaleString()}</span>
                          {item.type === 'call' && (
                            <>
                              <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{item.channel}</span>
                              <span>{item.outcome}</span>
                              <span>{Math.round(item.durationSeconds / 60)}m</span>
                            </>
                          )}
                          {item.type === 'inquiry' && <span>via {item.channel}</span>}
                          {item.type === 'system' && item.amount !== undefined && <span>{formatCurrency(item.amount, currency)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={timelineEndRef} />
          </section>

          <footer className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
            <form onSubmit={handleSubmitMessage} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onBlur={(event) => handleBlurMessage(event.target.value)}
                  placeholder="Add immutable message/note..."
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30 ${validationErrors.message ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-950`}
                />
                <button
                  type="submit"
                  disabled={submitting || !newMessage.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
              {validationErrors.message && <p className="text-xs text-rose-600">{validationErrors.message}</p>}
              <p className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Logs are immutable. Errors must be corrected with new entries.
              </p>
            </form>
          </footer>
        </main>

        <aside className="hidden w-[400px] shrink-0 flex-col lg:flex">
          <div className="border-b border-slate-200 p-2 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                className={`rounded-md px-2 py-2 text-xs font-semibold ${activeTab === 'purchases' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                onClick={() => setActiveTab('purchases')}
              >
                Purchases
              </button>
              <button
                className={`rounded-md px-2 py-2 text-xs font-semibold ${activeTab === 'returns' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                onClick={() => setActiveTab('returns')}
              >
                Returns
              </button>
              <button
                className={`rounded-md px-2 py-2 text-xs font-semibold ${activeTab === 'credit' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                onClick={() => setActiveTab('credit')}
              >
                Profile
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'purchases' && (
              <div className="space-y-3">
                {purchases.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500">No purchases</div>
                ) : (
                  [...purchases]
                    .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
                    .map((purchase) => (
                      <article key={purchase.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h4 className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
                            <ShoppingBag className="h-4 w-4 text-brand-blue" />
                            {(purchase as any).item_name || 'Purchase'}
                          </h4>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${purchase.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                            {purchase.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(purchase.purchased_at).toLocaleDateString('en-PH')}</p>
                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(purchase.amount, currency)}</p>
                      </article>
                    ))
                )}
              </div>
            )}

            {activeTab === 'returns' && (
              <SalesReturnTab contactId={contact.id} currentUserId={currentUser?.id} />
            )}

            {activeTab === 'credit' && (
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Contact Details</h4>
                  <div className="space-y-2 text-sm">
                    <p className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200"><User className="h-4 w-4 text-slate-400" />{contact.name || '—'}</p>
                    <p className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200"><Phone className="h-4 w-4 text-slate-400" />{contact.mobile || contact.phone || '—'}</p>
                    <p className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200"><Mail className="h-4 w-4 text-slate-400" />{contact.email || '—'}</p>
                    <p className="inline-flex items-start gap-2 text-slate-700 dark:text-slate-200"><MapPin className="mt-0.5 h-4 w-4 text-slate-400" />{contact.address || '—'}</p>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Business Terms</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <p className="text-slate-500">Price Group</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{contact.priceGroup || 'Standard'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <p className="text-slate-500">VAT Type</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{contact.vatType || 'Non-VAT'}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Credit Ledger</h4>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center justify-between"><span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><Wallet className="h-4 w-4 text-slate-400" />Outstanding</span><span className="font-semibold text-rose-600">{formatCurrency(outstandingBalance, currency)}</span></p>
                    <p className="flex items-center justify-between"><span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><Calendar className="h-4 w-4 text-slate-400" />Credit Limit</span><span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(creditLimit, currency)}</span></p>
                    <p className="flex items-center justify-between"><span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><CheckCircle2 className="h-4 w-4 text-slate-400" />Available</span><span className="font-semibold text-emerald-600">{formatCurrency(availableCredit, currency)}</span></p>
                  </div>
                </section>
              </div>
            )}

            {activeTab !== 'purchases' && activeTab !== 'returns' && activeTab !== 'credit' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold text-slate-900 dark:text-white">Profile Snapshot</p>
                <p className="text-slate-600 dark:text-slate-300">Use Purchases, Returns, and Profile tabs for detailed history and credit information.</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-white">{purchases.length}</p>
                    <p className="text-slate-500">Purchases</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-white">{salesReturns.length}</p>
                    <p className="text-slate-500">Returns</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-white">{callLogs.length}</p>
                    <p className="text-slate-500">Calls</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CustomerProfileModal;
