import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileWarning,
  PackageSearch,
  Plus,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import SalesReportTab from './SalesReportTab';
import ItemIssueReportTab from './ItemIssueReportTab';
import IncidentReportTab from './IncidentReportTab';
import CustomerRequestsTab from './CustomerRequestsTab';
import PersonalCommentsTab from './PersonalCommentsTab';
import CallReportActivityPanel from './CallReportActivityPanel';
import { DailyCallCustomerRow, UserProfile, VipTierConfig } from '../types';
import { formatLegacyPriceGroupLabel } from '../constants/pricingGroups';
import { formatPreferredBrand } from '../constants/customerPreferredBrand';
import { getVipStandingSummary } from '../utils/vipStanding';
import { DEFAULT_VIP_TIER_CONFIG } from '../utils/vipTierConfig';
import { getVipTierConfig } from '../services/vipTierSettingsService';
import { fetchManagementInstructions } from '../services/dailyCallMonitoringService';
import { DO_NOT_CONTACT_LABEL, isBlockedDailyCallCustomerRow } from '../utils/dailyCallBlockedCustomer';

export type DetailTabId =
  | 'overview'
  | 'comments'
  | 'human'
  | 'sales'
  | 'item-issues'
  | 'incident'
  | 'requests';

interface DailyCallCustomerDetailExpansionProps {
  customer: DailyCallCustomerRow;
  currentUser: UserProfile | null;
  initialTab?: DetailTabId;
  viewOnlyDoNotContact?: boolean;
}

const tabs: Array<{
  id: DetailTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: ShieldCheck },
  { id: 'comments', label: 'Management Instructions', icon: ClipboardList },
  { id: 'human', label: 'Sales Agent Activity', icon: UserRound },
  { id: 'sales', label: 'Sales Inquiry', icon: BarChart3 },
  { id: 'item-issues', label: 'Item Issues', icon: PackageSearch },
  { id: 'incident', label: 'Incident Reports', icon: FileWarning },
  { id: 'requests', label: 'Request for management approval', icon: ClipboardList },
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
    : new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
};

const vipBadgeIconUrl = new URL('../vip-svgrepo-com.svg', import.meta.url).href;

const PanelCard: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, icon: Icon, tone = 'text-blue-700', action, onAction, children }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-3">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800">
        <Icon className={`h-4 w-4 ${tone}`} /> {title}
      </h3>
      {action && (onAction ? (
        <button type="button" onClick={onAction} className="rounded px-1 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 hover:underline">
          {action}
        </button>
      ) : <span className="text-[10px] font-bold text-blue-700">{action}</span>)}
    </header>
    <div className="p-3">{children}</div>
  </section>
);

const DailyCallCustomerDetailExpansion: React.FC<DailyCallCustomerDetailExpansionProps> = ({
  customer,
  currentUser,
  initialTab = 'overview',
  viewOnlyDoNotContact = false,
}) => {
  const readOnly = viewOnlyDoNotContact || isBlockedDailyCallCustomerRow(customer);
  const visibleTabs = useMemo(
    () => (readOnly ? tabs.filter((tab) => tab.id !== 'sales') : tabs),
    [readOnly]
  );
  const [activeTab, setActiveTab] = useState<DetailTabId>(initialTab);
  const [vipConfig, setVipConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);
  const [latestInstruction, setLatestInstruction] = useState<any | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, customer.id]);

  useEffect(() => {
    if (readOnly && activeTab === 'sales') {
      setActiveTab('overview');
    }
  }, [activeTab, readOnly]);

  useEffect(() => {
    let disposed = false;
    getVipTierConfig().then((config) => {
      if (!disposed) setVipConfig(config);
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    setLatestInstruction(null);
    fetchManagementInstructions(customer.id).then((comments) => {
      if (!disposed) setLatestInstruction(comments[0] || null);
    });
    return () => { disposed = true; };
  }, [customer.id, activeTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const index = visibleTabs.findIndex((tab) => tab.id === activeTab);
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      setActiveTab(visibleTabs[(index + offset + visibleTabs.length) % visibleTabs.length].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, visibleTabs]);

  const priceGroupLabel = useMemo(
    () => formatLegacyPriceGroupLabel(customer.dealerPriceGroup || customer.codeDate?.split(' (')[0]),
    [customer.codeDate, customer.dealerPriceGroup]
  );

  const vipStanding = useMemo(
    () => getVipStandingSummary('', customer.lastMonthOrder, vipConfig),
    [customer.lastMonthOrder, vipConfig]
  );
  const activities = useMemo(() => customer.dailyActivity || [], [customer.dailyActivity]);
  const location = [customer.city, customer.province].filter((value) => value && value !== '—').join(', ') || customer.courier || '—';
  const isActive = String(customer.status).toLowerCase() === 'active';
  const totalActivity = activities.reduce((sum, activity) => sum + activity.activity_count, 0);

  const overview = (
    <div className="space-y-3 bg-slate-50 p-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-3">
          <PanelCard title="Management Instructions" icon={ClipboardList} tone="text-violet-700" action="+ Add Instruction" onAction={() => setActiveTab('comments')}>
            {latestInstruction ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-bold text-slate-800">{latestInstruction.author_name || 'Management'}</span>
                  <span>{formatDate(latestInstruction.timestamp)}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-700">{latestInstruction.text}</p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                No management instructions have been saved for this customer.
              </p>
            )}
            <button type="button" onClick={() => setActiveTab('comments')} className="mt-3 w-full text-center text-[11px] font-bold text-blue-700 hover:underline">
              View All Instructions →
            </button>
          </PanelCard>

          <PanelCard title="AI Summary" icon={Bot} tone="text-blue-700">
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {isActive ? 'Customer account is active.' : 'Customer account needs re-engagement.'}</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {totalActivity} recent interactions recorded.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Price group: {priceGroupLabel}.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Last month sales: {formatCurrency(customer.lastMonthOrder)}.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> VIP discount: {vipStanding.tierLabel}.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 divide-x rounded-lg border border-slate-200 bg-white py-3 text-center">
              <div><p className="text-[10px] text-slate-500">Activity Score</p><p className="mt-1 text-xl font-bold text-emerald-700">{Math.min(100, 45 + totalActivity * 5)}%</p></div>
              <div><p className="text-[10px] text-slate-500">Risk Level</p><p className={`mt-1 text-xl font-bold ${isActive ? 'text-emerald-700' : 'text-amber-600'}`}>{isActive ? 'Low' : 'Review'}</p></div>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">Managed in Maintenance &gt; Customer &gt; VIP Thresholds</p>
          </PanelCard>
        </div>

        <div className="space-y-3">
          <PanelCard title={`Sales Agent Activity (${customer.assignedTo || 'Unassigned'})`} icon={UserRound} action="View All" onAction={() => setActiveTab('human')}>
            <CallReportActivityPanel
              contactId={customer.id}
              currentUser={currentUser}
              assignedAgentName={customer.assignedTo}
              compact
            />
            <button type="button" onClick={() => setActiveTab('human')} className="mt-3 w-full text-center text-[11px] font-bold text-blue-700 hover:underline">View All Sales Agent Activity →</button>
          </PanelCard>

          <PanelCard title="AI Agent Activity" icon={Bot} tone="text-violet-700">
            <p className="py-5 text-center text-xs text-slate-500">No AI-agent activity has been recorded for this customer.</p>
          </PanelCard>
        </div>

      </div>
    </div>
  );

  const panel = useMemo(() => {
    if (activeTab === 'overview') return overview;
    if (activeTab === 'sales') {
      if (readOnly) {
        return (
          <div className="p-5">
            <PanelCard title="Sales Inquiry" icon={BarChart3}>
              <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                {DO_NOT_CONTACT_LABEL}. Sales inquiries cannot be created for this customer.
              </p>
            </PanelCard>
          </div>
        );
      }
      return <SalesReportTab contactId={customer.id} currentUserId={currentUser?.id} />;
    }
    if (activeTab === 'item-issues') return <ItemIssueReportTab contactId={customer.id} />;
    if (activeTab === 'incident') return <IncidentReportTab contactId={customer.id} currentUser={currentUser} />;
    if (activeTab === 'requests') return <CustomerRequestsTab contactId={customer.id} currentUser={currentUser} />;
    if (activeTab === 'comments') {
      return <PersonalCommentsTab contactId={customer.id} currentUserId={currentUser?.id} currentUserName={currentUser?.full_name || currentUser?.email || 'Owner'} currentUserAvatar={currentUser?.avatar_url} mode="instruction" autoFocus />;
    }
    if (activeTab === 'human') {
      return <div className="p-5"><PanelCard title={`Sales Agent Activity (${customer.assignedTo || 'Unassigned'})`} icon={UserRound}>
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          Sales agents submit call reports from <strong>Sales → Daily Call Monitoring</strong>. Each report appears below as a conversation entry. Master Users can reply directly to each report.
        </div>
        <CallReportActivityPanel
          contactId={customer.id}
          currentUser={currentUser}
          assignedAgentName={customer.assignedTo}
        />
      </PanelCard></div>;
    }
    return null;
  }, [activeTab, activities, currentUser, customer, overview, readOnly]);

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
              {vipStanding.badgeVisible && <span className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-amber-950"><img src={vipBadgeIconUrl} alt={`${vipStanding.tierLabel} badge`} className="h-3.5 w-3.5" /> {vipStanding.tierLabel.toUpperCase()}</span>}
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
              <div><dt className="text-slate-500">Price Group</dt><dd className="mt-1 font-bold">{priceGroupLabel}</dd></div>
              <div><dt className="text-slate-500">Preferred Brand</dt><dd className="mt-1 font-bold">{formatPreferredBrand(customer.preferredBrand)}</dd></div>
              <div><dt className="text-slate-500">Outstanding Balance</dt><dd className="mt-1 font-bold text-rose-600">{formatCurrency(customer.outstandingBalance)}</dd></div>
              <div><dt className="text-slate-500">VIP Discount</dt><dd className="mt-1 font-bold">{vipStanding.tierLabel}</dd></div>
              <div><dt className="text-slate-500">Account Status</dt><dd className={`mt-1 font-bold ${isActive ? 'text-emerald-700' : 'text-amber-600'}`}>{isActive ? 'Current' : 'Review'}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-800"><BarChart3 className="h-4 w-4 text-blue-700" /> Sales Snapshot (MTD)</h3>
            <dl className="mt-5 grid grid-cols-3 gap-4 text-xs"><div><dt className="text-slate-500">Current Month Sales</dt><dd className="mt-2 text-xl font-bold">{formatCurrency(customer.monthlyOrder)}</dd></div><div><dt className="text-slate-500">Last Month Sales</dt><dd className="mt-2 text-xl font-bold">{formatCurrency(customer.lastMonthOrder)}</dd></div><div><dt className="text-slate-500">Average Monthly Sales</dt><dd className="mt-2 text-xl font-bold">{formatCurrency(customer.averageMonthlyOrder)}</dd></div></dl>
            {!readOnly && (
              <button type="button" onClick={() => setActiveTab('sales')} className="mt-5 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">View Sales Inquiries</button>
            )}
          </section>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white px-3" aria-label="Customer detail sections">
        <div className="flex overflow-x-auto" role="tablist">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[11px] font-semibold transition ${selected ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-blue-700'}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>;
          })}
        </div>
      </nav>

      <div className="min-h-[390px]">{panel}</div>

      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Quick Actions</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-6">
          {[
            ['Add Instruction', Plus, 'text-cyan-700 border-cyan-200 bg-cyan-50', 'comments'],
            ['Sales Agent Reports', UserRound, 'text-emerald-700 border-emerald-200 bg-emerald-50', 'human'],
            ...(!readOnly ? [['Sales Inquiry', BarChart3, 'text-white border-blue-900 bg-blue-950', 'sales']] : []),
          ].map(([label, Icon, tone, target]) => <button key={String(label)} type="button" onClick={() => setActiveTab(target as DetailTabId)} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-bold ${tone}`}><Icon className="h-3.5 w-3.5" />{String(label)}</button>)}
        </div>
      </footer>
    </section>
  );
};

export default DailyCallCustomerDetailExpansion;
