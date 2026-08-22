import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardCheck, Clock3, FileText, FolderOpen, Loader2, PackageCheck, Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, RefreshCw, RotateCcw, ShoppingCart, Truck, XCircle } from 'lucide-react';
import { fetchOperationsDashboardSnapshot, OperationsDashboardSnapshot } from '../services/operationsDashboardService';

interface OperationsDashboardProps {
  onNavigate: (route: string, payload?: Record<string, string>) => void;
}

type MetricTone = 'blue' | 'green' | 'orange' | 'red' | 'violet' | 'cyan';
const tones: Record<MetricTone, string> = {
  blue: 'text-blue-700 bg-blue-50 border-blue-100', green: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  orange: 'text-orange-700 bg-orange-50 border-orange-100', red: 'text-rose-700 bg-rose-50 border-rose-100',
  violet: 'text-violet-700 bg-violet-50 border-violet-100', cyan: 'text-cyan-700 bg-cyan-50 border-cyan-100',
};
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
const percent = (value: number) => `${Math.abs(value || 0).toFixed(2)}%`;
const duration = (seconds: number) => {
  const value = Math.max(0, Math.round(seconds || 0));
  return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor((value % 3600) / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
const change = (current: number, previous: number) => previous > 0 ? ((current - previous) / previous) * 100 : 0;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 className="mb-3 text-sm font-black uppercase tracking-tight text-[#101b45]">{title}</h2>{children}
  </section>
);

const MetricRow: React.FC<{ label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone?: MetricTone; onClick: () => void }> = ({ label, value, icon: Icon, tone = 'blue', onClick }) => (
  <button type="button" onClick={onClick} className="group flex w-full items-center gap-2.5 border-b border-slate-100 py-2 text-left last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1 text-xs font-semibold text-slate-700 group-hover:text-blue-800">{label}</span><strong className="shrink-0 text-sm text-slate-950">{value}</strong>
  </button>
);

const emptySnapshot: OperationsDashboardSnapshot = {
  orders: { inquiries: 0, orders: 0, open: 0, cancelled: 0, previousInquiries: 0, previousOrders: 0, previousOpen: 0, previousCancelled: 0 },
  calls: { incoming: 0, outgoing: 0, missed: 0, returned: 0, unanswered: 0, averageResponseSeconds: 0 },
  delivery: { ready: 0, shipped: 0, inTransit: 0, delivered: 0, delayed: 0, failed: 0, total: 0 },
  lbcRto: { total: 0, delivered: 0, rto: 0, refused: 0, wrongAddress: 0, unclaimed: 0 },
  returns: { requests: 0, inspection: 0, approved: 0, disapproved: 0, replacement: 0, refunded: 0 },
  collections: { total: 0, sales: 0, rate: 0, previousChange: 0, today: 0 },
  receivables: { total: 0, current: 0, days31to60: 0, days61to90: 0, over90: 0 }, activities: [], unavailable: [],
};

const OperationsDashboard: React.FC<OperationsDashboardProps> = ({ onNavigate }) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSnapshot(await fetchOperationsDashboardSnapshot(new Date(`${selectedDate}T12:00:00`))); }
    catch (err: any) { setError(err?.message || 'Unable to load operations dashboard.'); }
    finally { setLoading(false); }
  }, [selectedDate]);
  useEffect(() => { void load(); }, [load]);
  const displayDate = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' }).format(new Date(`${selectedDate}T12:00:00`)), [selectedDate]);
  const nav = (route: string, payload?: Record<string, string>) => () => onNavigate(route, payload);
  const orderCards = [
    ['New Inquiry', snapshot.orders.inquiries, snapshot.orders.previousInquiries, PhoneCall, 'blue', 'sales-transaction-sales-inquiry'],
    ['New Order', snapshot.orders.orders, snapshot.orders.previousOrders, ShoppingCart, 'green', 'sales-transaction-sales-order'],
    ['Open Inquiries', snapshot.orders.open, snapshot.orders.previousOpen, FolderOpen, 'orange', 'sales-transaction-sales-inquiry'],
    ['Cancelled', snapshot.orders.cancelled, snapshot.orders.previousCancelled, XCircle, 'red', 'sales-transaction-sales-inquiry'],
  ] as const;

  return <div className="h-full overflow-y-auto bg-[#f7f8fb] p-3 text-slate-900 sm:p-5 xl:p-6"><div className="mx-auto max-w-[1700px] space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-black tracking-tight text-[#101b45] sm:text-3xl">OPERATIONS DASHBOARD</h1><p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700"><CalendarDays className="h-4 w-4" />{displayDate}</p></div>
      <div className="flex items-end gap-2"><label className="block min-w-[220px] text-xs font-bold text-slate-700">Filter by Date<input aria-label="Filter operations dashboard by date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh operations dashboard" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button></div>
    </header>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {snapshot.unavailable.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">Some live sources are temporarily unavailable: {snapshot.unavailable.join(', ')}. Other sections remain live.</p>}

    <Section title="1. Order Overview (This Month)"><div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">{orderCards.map(([label, value, previous, Icon, tone, route]) => { const delta = change(value, previous); return <button key={label} type="button" onClick={nav(route)} className="flex items-center gap-4 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${tones[tone]}`}><Icon className="h-6 w-6" /></span><span><span className="block text-xs font-black uppercase text-[#101b45]">{label}</span><strong className="block text-3xl font-black text-[#101b45]">{value}</strong><span className="block text-[11px] text-slate-500">vs last month: {previous}</span><span className={`block text-xs font-black ${delta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{delta < 0 ? '▼' : '▲'} {percent(delta)}</span></span></button>; })}</div></Section>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Section title="2. Call Overview (Selected Date)"><MetricRow label="Incoming Calls" value={snapshot.calls.incoming} icon={PhoneIncoming} onClick={nav('sales-transaction-daily-call-monitoring')} /><MetricRow label="Outgoing Calls" value={snapshot.calls.outgoing} icon={PhoneOutgoing} tone="cyan" onClick={nav('sales-transaction-daily-call-monitoring')} /><MetricRow label="Missed Calls" value={snapshot.calls.missed} icon={PhoneMissed} tone="red" onClick={nav('sales-transaction-daily-call-monitoring')} /><MetricRow label="Returned Calls" value={snapshot.calls.returned} icon={PhoneCall} tone="green" onClick={nav('sales-transaction-daily-call-monitoring')} /><MetricRow label="Unanswered Calls" value={snapshot.calls.unanswered} icon={Phone} tone="orange" onClick={nav('sales-transaction-daily-call-monitoring')} /><div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-right"><span className="float-left text-[10px] font-bold uppercase text-slate-500">Average Duration</span><strong className="text-lg text-blue-700">{duration(snapshot.calls.averageResponseSeconds)}</strong></div></Section>
      <Section title="3. Delivery Overview (This Month)"><MetricRow label="Ready to Ship" value={snapshot.delivery.ready} icon={Truck} onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Shipped" value={snapshot.delivery.shipped} icon={Truck} tone="cyan" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="In Transit" value={snapshot.delivery.inTransit} icon={Truck} tone="green" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Delivered" value={snapshot.delivery.delivered} icon={PackageCheck} tone="green" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Delayed Delivery" value={snapshot.delivery.delayed} icon={Clock3} tone="orange" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Failed Delivery" value={snapshot.delivery.failed} icon={AlertCircle} tone="red" onClick={nav('sales-transaction-order-slip')} /><p className="mt-3 flex justify-between border-t pt-2 text-xs font-bold"><span>Total Shipments</span><strong className="text-xl text-blue-700">{snapshot.delivery.total}</strong></p></Section>
      <Section title="4. LBC / RTO Overview (This Month)"><MetricRow label="Total Tracked Shipments" value={snapshot.lbcRto.total} icon={Truck} tone="red" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Successfully Delivered" value={snapshot.lbcRto.delivered} icon={CheckCircle2} tone="green" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Return to Origin (RTO)" value={snapshot.lbcRto.rto} icon={Clock3} tone="orange" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Customer Refused" value={snapshot.lbcRto.refused} icon={XCircle} tone="red" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Wrong Address" value={snapshot.lbcRto.wrongAddress} icon={XCircle} tone="red" onClick={nav('sales-transaction-order-slip')} /><MetricRow label="Unclaimed" value={snapshot.lbcRto.unclaimed} icon={XCircle} tone="red" onClick={nav('sales-transaction-order-slip')} /><p className="mt-3 flex justify-between border-t pt-2 text-xs font-bold"><span>RTO Rate</span><strong className="text-lg text-rose-600">{percent(snapshot.lbcRto.total ? snapshot.lbcRto.rto / snapshot.lbcRto.total * 100 : 0)}</strong></p></Section>
      <Section title="5. Sales Return Overview (This Month)"><MetricRow label="Return Requests" value={snapshot.returns.requests} icon={ClipboardCheck} tone="violet" onClick={nav('accounting-transactions-sales-return-credit')} /><MetricRow label="Under Inspection" value={snapshot.returns.inspection} icon={ClipboardCheck} tone="violet" onClick={nav('accounting-transactions-sales-return-credit')} /><MetricRow label="Approved" value={snapshot.returns.approved} icon={CheckCircle2} tone="green" onClick={nav('accounting-transactions-sales-return-credit')} /><MetricRow label="Disapproved" value={snapshot.returns.disapproved} icon={XCircle} tone="red" onClick={nav('accounting-transactions-sales-return-credit')} /><MetricRow label="Replacement Sent" value={snapshot.returns.replacement} icon={FolderOpen} onClick={nav('accounting-transactions-sales-return-credit')} /><MetricRow label="Refund Completed" value={snapshot.returns.refunded} icon={RotateCcw} tone="violet" onClick={nav('accounting-transactions-sales-return-credit')} /><p className="mt-3 flex justify-between border-t pt-2 text-xs font-bold"><span>Approval Rate</span><strong className="text-lg text-violet-700">{percent(snapshot.returns.requests ? snapshot.returns.approved / snapshot.returns.requests * 100 : 0)}</strong></p></Section>
    </div>

    <div className="grid gap-4 xl:grid-cols-[0.9fr_0.9fr_1.8fr]">
      <Section title="6. Collections Overview (This Month)"><MetricRow label="Total Collection (PHP)" value={money(snapshot.collections.total)} icon={CircleDollarSign} onClick={nav('accounting-accounting-collection-summary')} /><MetricRow label="Total Sales (PHP)" value={money(snapshot.collections.sales)} icon={ShoppingCart} tone="orange" onClick={nav('sales-transaction-sales-order')} /><MetricRow label="Collection Rate" value={percent(snapshot.collections.rate)} icon={CheckCircle2} tone="green" onClick={nav('accounting-accounting-collection-summary')} /><div className="mt-3 rounded-lg bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800"><span>Collected on Selected Date</span><strong className="float-right">{money(snapshot.collections.today)}</strong></div></Section>
      <Section title="7. Receivables Overview (As of Selected Date)"><MetricRow label="Total Outstanding (PHP)" value={money(snapshot.receivables.total)} icon={FileText} onClick={nav('accounting-reports-accounts-receivable-report')} /><MetricRow label="Current (0–30 days)" value={money(snapshot.receivables.current)} icon={Clock3} tone="orange" onClick={nav('accounting-reports-accounts-receivable-report')} /><MetricRow label="31–60 days" value={money(snapshot.receivables.days31to60)} icon={CalendarDays} onClick={nav('accounting-reports-accounts-receivable-report')} /><MetricRow label="61–90 days" value={money(snapshot.receivables.days61to90)} icon={CalendarDays} onClick={nav('accounting-reports-accounts-receivable-report')} /><MetricRow label="Over 90 days" value={money(snapshot.receivables.over90)} icon={CalendarDays} tone="red" onClick={nav('accounting-reports-accounts-receivable-report')} /></Section>
      <Section title="Activity Log"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[11px]"><thead className="border-b text-slate-500"><tr><th className="pb-2">Time</th><th className="pb-2">Activity</th><th className="pb-2">Description</th><th className="pb-2">Reference</th><th className="pb-2">By</th></tr></thead><tbody className="divide-y">{snapshot.activities.slice(0, 8).map((activity) => <tr key={activity.id}><td className="py-2 font-semibold">{activity.time}</td><td className="py-2 font-bold">{activity.activity}</td><td className="max-w-[240px] truncate py-2" title={activity.description}>{activity.description}</td><td className="py-2">{activity.route ? <button type="button" className="font-bold text-blue-700 hover:underline" onClick={nav(activity.route, activity.payload)}>{activity.reference}</button> : <span>{activity.reference}</span>}</td><td className="py-2">{activity.by}</td></tr>)}{!loading && snapshot.activities.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No operations activity recorded for the selected date.</td></tr>}</tbody></table></div><button type="button" onClick={nav('maintenance-profile-activity-logs')} className="mt-3 w-full rounded-lg border py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">View Complete Activity Log →</button></Section>
    </div>
  </div></div>;
};

export default OperationsDashboard;
