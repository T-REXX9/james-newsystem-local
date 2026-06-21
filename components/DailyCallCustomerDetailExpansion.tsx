import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  FileWarning,
  MessageSquare,
  PackageSearch,
  Phone,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  WalletCards,
} from 'lucide-react';
import SalesReportTab from './SalesReportTab';
import ItemIssueReportTab from './ItemIssueReportTab';
import IncidentReportTab from './IncidentReportTab';
import SalesReturnTab from './SalesReturnTab';
import PurchaseHistoryTab from './PurchaseHistoryTab';
import PersonalCommentsTab from './PersonalCommentsTab';
import LBCRTOTab from './LBCRTOTab';
import { DailyActivityRecord, DailyCallCustomerRow, UserProfile, VipTierConfig } from '../types';
import { isKnownPriceGroup, normalizePriceGroup } from '../constants/pricingGroups';
import { getVipStandingSummary } from '../utils/vipStanding';
import { DEFAULT_VIP_TIER_CONFIG } from '../utils/vipTierConfig';
import { getVipTierConfig } from '../services/vipTierSettingsService';

type DetailTabId =
  | 'overview'
  | 'comments'
  | 'human'
  | 'ai'
  | 'communication'
  | 'sales'
  | 'item-issues'
  | 'purchase'
  | 'collections'
  | 'incident'
  | 'returns';

interface DailyCallCustomerDetailExpansionProps {
  customer: DailyCallCustomerRow;
  currentUser: UserProfile | null;
}

const tabs: Array<{
  id: DetailTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: ShieldCheck },
  { id: 'comments', label: 'Management Instructions', icon: ClipboardList },
  { id: 'human', label: 'Human Agent Activity', icon: UserRound },
  { id: 'ai', label: 'AI Agent Activity', icon: Bot },
  { id: 'communication', label: 'Communication Timeline', icon: MessageSquare },
  { id: 'sales', label: 'Sales Report', icon: BarChart3 },
  { id: 'item-issues', label: 'Item Issues', icon: PackageSearch },
  { id: 'purchase', label: 'Orders', icon: ShoppingCart },
  { id: 'collections', label: 'Collections', icon: WalletCards },
  { id: 'incident', label: 'Incident Reports', icon: FileWarning },
  { id: 'returns', label: 'Sales Returns', icon: RotateCcw },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value?: string) => {
  if (!value || value === '—') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const vipBadgeIconUrl = new URL('../vip-svgrepo-com.svg', import.meta.url).href;

const activityLabel = (activity: DailyActivityRecord) => {
  if (activity.activity_type === 'call' && activity.notes?.startsWith('[Sales Agent Report]')) return 'Sales agent call report';
  if (activity.activity_type === 'call') return 'Customer call';
  if (activity.activity_type === 'text') return 'Customer message';
  if (activity.activity_type === 'order') return 'Customer order';
  return 'Customer activity';
};

const activityNotes = (activity: DailyActivityRecord) =>
  activity.notes?.replace(/^\[Sales Agent Report\]\s*/, '') ||
  `${activity.activity_count} ${activity.activity_type} interaction${activity.activity_count === 1 ? '' : 's'} recorded.`;

const ActivityList: React.FC<{
  activities: DailyActivityRecord[];
  emptyLabel: string;
  compact?: boolean;
}> = ({ activities, emptyLabel, compact = false }) => {
  if (activities.length === 0) {
    return (
      <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {activities.slice(0, compact ? 4 : 7).map((activity, index) => {
        const isCall = activity.activity_type === 'call';
        const Icon = isCall ? Phone : activity.activity_type === 'order' ? ShoppingCart : MessageSquare;
        return (
          <div key={`${activity.activity_date}-${index}`} className="flex gap-3 px-3 py-3">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${isCall ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                <span>{formatDate(activity.activity_date)}</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Recorded</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-900">{activityLabel(activity)}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                {activityNotes(activity)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PanelCard: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
  action?: string;
  children: React.ReactNode;
}> = ({ title, icon: Icon, tone = 'text-blue-700', action, children }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-3">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        <Icon className={`h-4 w-4 ${tone}`} /> {title}
      </h3>
      {action && <span className="text-[10px] font-bold text-blue-700">{action}</span>}
    </header>
    <div className="p-3">{children}</div>
  </section>
);

const DailyCallCustomerDetailExpansion: React.FC<DailyCallCustomerDetailExpansionProps> = ({
  customer,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTabId>('overview');
  const [vipConfig, setVipConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);

  useEffect(() => {
    let disposed = false;
    getVipTierConfig().then((config) => {
      if (!disposed) setVipConfig(config);
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const index = tabs.findIndex((tab) => tab.id === activeTab);
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      setActiveTab(tabs[(index + offset + tabs.length) % tabs.length].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  const dealerPriceTier = useMemo(() => {
    const raw = String(customer.dealerPriceGroup || '');
    if (isKnownPriceGroup(raw)) return normalizePriceGroup(raw);
    if (customer.monthlyOrder >= 30000) return 'Gold';
    if (customer.monthlyOrder >= 10000) return 'Silver';
    return 'Regular';
  }, [customer.dealerPriceGroup, customer.monthlyOrder]);

  const vipStanding = useMemo(
    () => getVipStandingSummary(dealerPriceTier, customer.monthlyOrder, vipConfig),
    [dealerPriceTier, customer.monthlyOrder, vipConfig]
  );
  const activities = useMemo(() => customer.dailyActivity || [], [customer.dailyActivity]);
  const location = [customer.city, customer.province].filter((value) => value && value !== '—').join(', ') || customer.courier || '—';
  const isActive = String(customer.status).toLowerCase() === 'active';
  const totalActivity = activities.reduce((sum, activity) => sum + activity.activity_count, 0);

  const overview = (
    <div className="space-y-3 bg-slate-50 p-3">
      <div className="grid gap-3 xl:grid-cols-[0.82fr_1.02fr_1.35fr]">
        <div className="space-y-3">
          <PanelCard title="Management Instructions" icon={ClipboardList} tone="text-violet-700" action="+ Add Instruction">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span className="font-bold text-slate-800">{currentUser?.full_name || 'Owner'}</span>
                <span>Customer guidance</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-700">
                Review account terms, recent activity, and outstanding balance before the next customer contact.
              </p>
            </div>
            <button type="button" onClick={() => setActiveTab('comments')} className="mt-3 w-full text-center text-[11px] font-bold text-blue-700 hover:underline">
              View All Instructions →
            </button>
          </PanelCard>

          <PanelCard title="AI Summary" icon={Bot} tone="text-blue-700">
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {isActive ? 'Customer account is active.' : 'Customer account needs re-engagement.'}</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {totalActivity} recent interactions recorded.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Current monthly sales: {formatCurrency(customer.monthlyOrder)}.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> VIP standing: {vipStanding.tierLabel}.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 divide-x rounded-lg border border-slate-200 bg-white py-3 text-center">
              <div><p className="text-[10px] text-slate-500">Activity Score</p><p className="mt-1 text-xl font-bold text-emerald-700">{Math.min(100, 45 + totalActivity * 5)}%</p></div>
              <div><p className="text-[10px] text-slate-500">Risk Level</p><p className={`mt-1 text-xl font-bold ${isActive ? 'text-emerald-700' : 'text-amber-600'}`}>{isActive ? 'Low' : 'Review'}</p></div>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">Managed in Maintenance &gt; Customer &gt; VIP Thresholds</p>
          </PanelCard>
        </div>

        <div className="space-y-3">
          <PanelCard title={`Human Agent Activity (${customer.assignedTo || 'Unassigned'})`} icon={UserRound} action="View All">
            <ActivityList activities={activities} emptyLabel="No human-agent activity has been recorded for this customer." compact />
            <button type="button" onClick={() => setActiveTab('human')} className="mt-3 w-full text-center text-[11px] font-bold text-blue-700 hover:underline">View All Human Agent Activity →</button>
          </PanelCard>

          <PanelCard title="AI Agent Activity" icon={Bot} tone="text-violet-700" action="View All">
            <div className="space-y-2">
              {activities.slice(0, 4).map((activity, index) => (
                <div key={`${activity.activity_date}-ai-${index}`} className="flex items-center gap-2 border-l-2 border-violet-300 pl-3 text-xs">
                  <Bot className="h-3.5 w-3.5 text-violet-700" />
                  <span className="text-slate-500">{formatDate(activity.activity_date)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">AI follow-up review</span>
                  <span className="text-[10px] font-bold text-emerald-700">Ready</span>
                </div>
              ))}
              {activities.length === 0 && <p className="py-5 text-center text-xs text-slate-500">No AI-agent activity available.</p>}
            </div>
          </PanelCard>
        </div>

        <PanelCard title="Communication Timeline (All)" icon={MessageSquare} tone="text-slate-700" action="All ▾">
          <ActivityList activities={activities} emptyLabel="No communication history is available for this customer." />
          <button type="button" onClick={() => setActiveTab('communication')} className="mt-3 w-full text-center text-[11px] font-bold text-blue-700 hover:underline">View Full Communication History →</button>
        </PanelCard>
      </div>
    </div>
  );

  const panel = useMemo(() => {
    if (activeTab === 'overview') return overview;
    if (activeTab === 'sales') return <SalesReportTab contactId={customer.id} currentUserId={currentUser?.id} />;
    if (activeTab === 'item-issues') return <ItemIssueReportTab contactId={customer.id} />;
    if (activeTab === 'incident') return <IncidentReportTab contactId={customer.id} currentUser={currentUser} />;
    if (activeTab === 'returns') return <SalesReturnTab contactId={customer.id} currentUserId={currentUser?.id} />;
    if (activeTab === 'purchase') return <PurchaseHistoryTab contactId={customer.id} />;
    if (activeTab === 'collections') return <LBCRTOTab contactId={customer.id} />;
    if (activeTab === 'comments') {
      return <PersonalCommentsTab contactId={customer.id} currentUserId={currentUser?.id} currentUserName={currentUser?.full_name || currentUser?.email || 'Owner'} currentUserAvatar={currentUser?.avatar_url} />;
    }
    if (activeTab === 'ai') {
      return <div className="p-5"><PanelCard title="AI Agent Activity" icon={Bot}><ActivityList activities={activities} emptyLabel="No AI-agent activity available." /></PanelCard></div>;
    }
    return <div className="p-5"><PanelCard title={activeTab === 'human' ? `Human Agent Activity (${customer.assignedTo})` : 'Communication Timeline (All)'} icon={activeTab === 'human' ? UserRound : MessageSquare}><ActivityList activities={activities} emptyLabel="No activity is available for this customer." /></PanelCard></div>;
  }, [activeTab, activities, currentUser, customer, overview]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="border-b border-slate-200 bg-white p-4">
        <div className="grid gap-4 xl:grid-cols-[220px_1.55fr_1fr_0.85fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="grid h-32 place-items-center bg-gradient-to-br from-slate-200 to-slate-100 text-slate-400">
              <Building2 className="h-14 w-14" />
            </div>
            <p className="border-t border-slate-200 py-2 text-center text-[11px] font-bold text-blue-700">Customer photo unavailable</p>
          </div>

          <div className="min-w-0 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold text-slate-950">{customer.shopName}</h2>
              <span className={`rounded px-2.5 py-1 text-[10px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{customer.status}</span>
              {vipStanding.badgeVisible && <span className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-amber-950"><img src={vipBadgeIconUrl} alt={`${vipStanding.tierLabel} badge`} className="h-3.5 w-3.5" /> VIP {dealerPriceTier.toUpperCase()}</span>}
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 text-xs">
              <dl className="space-y-4 pr-4"><div><dt className="text-slate-500">Contact</dt><dd className="mt-1 font-bold">{customer.contactNumber || '—'}</dd></div><div><dt className="text-slate-500">Source</dt><dd className="mt-1 font-bold">{customer.source || '—'}</dd></div></dl>
              <dl className="space-y-4 px-4"><div><dt className="text-slate-500">Location</dt><dd className="mt-1 font-bold">{location}</dd></div><div><dt className="text-slate-500">Assigned Agent (Human)</dt><dd className="mt-1 font-bold">{customer.assignedTo || 'Unassigned'}</dd></div></dl>
              <dl className="space-y-4 pl-4"><div><dt className="text-slate-500">Last Activity</dt><dd className="mt-1 font-bold">{formatDate(activities[0]?.activity_date || customer.statusDate)}</dd></div><div><dt className="text-slate-500">Member Since</dt><dd className="mt-1 font-bold">{formatDate(customer.clientSince)}</dd></div></dl>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold uppercase text-slate-800">Payment & Credit</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-xs">
              <div><dt className="flex items-center gap-1.5 text-slate-500"><CreditCard className="h-3.5 w-3.5 text-emerald-600" /> Term of Payment</dt><dd className="mt-1 font-bold">{customer.terms || customer.modeOfPayment || '—'}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-slate-500"><WalletCards className="h-3.5 w-3.5 text-emerald-600" /> Credit Limit</dt><dd className="mt-1 font-bold">{formatCurrency(customer.quota)}</dd></div>
              <div><dt className="text-slate-500">Outstanding Balance</dt><dd className="mt-1 font-bold text-rose-600">{formatCurrency(customer.outstandingBalance)}</dd></div>
              <div><dt className="text-slate-500">Account Status</dt><dd className={`mt-1 font-bold ${isActive ? 'text-emerald-700' : 'text-amber-600'}`}>{isActive ? 'Current' : 'Review'}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-800"><BarChart3 className="h-4 w-4 text-blue-700" /> Sales Snapshot (MTD)</h3>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-slate-500">Current Month Sales</dt><dd className="mt-2 text-xl font-bold">{formatCurrency(customer.monthlyOrder)}</dd></div><div><dt className="text-slate-500">Average Monthly Sales</dt><dd className="mt-2 text-xl font-bold">{formatCurrency(customer.averageMonthlyOrder)}</dd></div></dl>
            <button type="button" onClick={() => setActiveTab('sales')} className="mt-5 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">View Full Sales Report</button>
          </section>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white px-3" aria-label="Customer detail sections">
        <div className="flex overflow-x-auto" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[11px] font-semibold transition ${selected ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-blue-700'}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>;
          })}
        </div>
      </nav>

      <div className="min-h-[390px]">{panel}</div>

      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Quick Actions</h3>
        <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-8">
          {[
            ['Call Customer', Phone, 'text-emerald-700 border-emerald-200 bg-emerald-50'],
            ['Send SMS', Send, 'text-blue-700 border-blue-200 bg-blue-50'],
            ['AI SMS', Bot, 'text-violet-700 border-violet-200 bg-violet-50'],
            ['Create Follow-Up', CalendarDays, 'text-orange-700 border-orange-200 bg-orange-50'],
            ['Add Comment', Plus, 'text-cyan-700 border-cyan-200 bg-cyan-50'],
            ['Sales Report', BarChart3, 'text-white border-blue-900 bg-blue-950'],
            ['View Orders', ShoppingCart, 'text-white border-slate-700 bg-slate-700'],
            ['Timeline', Clock3, 'text-slate-700 border-slate-200 bg-white'],
          ].map(([label, Icon, tone]) => <button key={String(label)} type="button" className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold ${tone}`}><Icon className="h-3.5 w-3.5" />{String(label)}</button>)}
        </div>
      </footer>
    </section>
  );
};

export default DailyCallCustomerDetailExpansion;
