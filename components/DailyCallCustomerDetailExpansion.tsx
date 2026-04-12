import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, FileWarning, History, MessageSquare, PackageSearch, RotateCcw, Truck } from 'lucide-react';
import SalesReportTab from './SalesReportTab';
import ItemIssueReportTab from './ItemIssueReportTab';
import IncidentReportTab from './IncidentReportTab';
import SalesReturnTab from './SalesReturnTab';
import PurchaseHistoryTab from './PurchaseHistoryTab';
import PersonalCommentsTab from './PersonalCommentsTab';
import LBCRTOTab from './LBCRTOTab';
import { DailyCallCustomerRow, UserProfile, VipTierConfig } from '../types';
import { isKnownPriceGroup, normalizePriceGroup } from '../constants/pricingGroups';
import { getVipStandingSummary } from '../utils/vipStanding';
import { DEFAULT_VIP_TIER_CONFIG } from '../utils/vipTierConfig';
import { getVipTierConfig } from '../services/vipTierSettingsService';

type DetailTabId = 'sales' | 'item-issues' | 'incident' | 'returns' | 'lbc-rto' | 'purchase' | 'comments';

interface DailyCallCustomerDetailExpansionProps {
  customer: DailyCallCustomerRow;
  currentUser: UserProfile | null;
}

const tabs: Array<{
  id: DetailTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'sales', label: 'Sales Inquiry Reports', icon: BarChart3 },
  { id: 'item-issues', label: 'Item Issue Reports', icon: PackageSearch },
  { id: 'incident', label: 'Incident Reports', icon: FileWarning },
  { id: 'returns', label: 'Sales Returns', icon: RotateCcw },
  { id: 'lbc-rto', label: 'LBC RTO', icon: Truck },
  { id: 'purchase', label: 'Purchase History', icon: History },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0);
const vipBadgeIconUrl = new URL('../vip-svgrepo-com.svg', import.meta.url).href;

const DailyCallCustomerDetailExpansion: React.FC<DailyCallCustomerDetailExpansionProps> = ({
  customer,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTabId>('sales');
  const [vipConfig, setVipConfig] = useState<VipTierConfig>(DEFAULT_VIP_TIER_CONFIG);
  const [vipConfigLoading, setVipConfigLoading] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;

      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
      if (currentIndex < 0) return;

      if (event.key === 'ArrowRight') {
        setActiveTab(tabs[(currentIndex + 1) % tabs.length].id);
      } else {
        setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  useEffect(() => {
    let isDisposed = false;

    setVipConfigLoading(true);
    getVipTierConfig()
      .then((config) => {
        if (isDisposed) return;
        setVipConfig(config);
      })
      .finally(() => {
        if (!isDisposed) {
          setVipConfigLoading(false);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  const panel = useMemo(() => {
    if (activeTab === 'sales') {
      return <SalesReportTab contactId={customer.id} currentUserId={currentUser?.id} />;
    }
    if (activeTab === 'item-issues') {
      return <ItemIssueReportTab contactId={customer.id} />;
    }
    if (activeTab === 'incident') {
      return <IncidentReportTab contactId={customer.id} currentUser={currentUser} />;
    }
    if (activeTab === 'returns') {
      return <SalesReturnTab contactId={customer.id} currentUserId={currentUser?.id} />;
    }
    if (activeTab === 'lbc-rto') {
      return <LBCRTOTab contactId={customer.id} />;
    }
    if (activeTab === 'purchase') {
      return <PurchaseHistoryTab contactId={customer.id} />;
    }
    return (
      <PersonalCommentsTab
        contactId={customer.id}
        currentUserId={currentUser?.id}
        currentUserName={currentUser?.full_name || currentUser?.email || 'Owner'}
        currentUserAvatar={currentUser?.avatar_url}
      />
    );
  }, [activeTab, currentUser, customer.id]);

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

  const location = customer.courier || [customer.city, customer.province].filter(Boolean).join(', ') || '—';

  const vipPolicyCards = [
    {
      key: 'silver-entry',
      label: 'Silver Qualification',
      value: vipConfig.silver_entry_threshold,
    },
    {
      key: 'gold-entry',
      label: 'Gold Qualification',
      value: vipConfig.gold_entry_threshold,
    },
    {
      key: 'silver-maintenance',
      label: 'Silver Maintenance',
      value: vipConfig.silver_maintenance_threshold,
    },
    {
      key: 'gold-maintenance',
      label: 'Gold Maintenance',
      value: vipConfig.gold_maintenance_threshold,
    },
  ];

  return (
    <section className="animate-[fadeIn_180ms_ease-out] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              {customer.shopName}
            </h3>
            <p className="text-xs text-slate-500">{location} &bull; {customer.assignedTo}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
              customer.status === 'Active' || customer.status === 'active'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : customer.status === 'Prospective' || customer.status === 'prospective'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {customer.status}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              dealerPriceTier === 'Gold' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : dealerPriceTier === 'Silver' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : dealerPriceTier === 'Platinum' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {dealerPriceTier}
            </span>
          </div>
        </div>

        {/* Basic Info */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Source</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.source || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Assigned Rep</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.assignedTo || '—'}</p>
            <p className="text-xs text-slate-500">{customer.assignedDate || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Client Since</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.clientSince || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Status / Date</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{customer.status || '—'}</p>
            <p className="text-xs text-slate-500">{customer.statusDate || '—'}</p>
          </div>
        </div>

        {/* Contact & Location */}
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Contact Number</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.contactNumber || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Address</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.courier || '—'}</p>
            {(customer.city || customer.province) && (
              <p className="text-xs text-slate-500">{[customer.city, customer.province].filter(Boolean).join(', ')}</p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Mode of Payment</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.modeOfPayment || '—'}</p>
          </div>
        </div>

        {/* Dealer & Pricing Info */}
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Dealer Price Group</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{dealerPriceTier}</p>
            <p className="text-xs text-slate-500">{customer.dealerPriceDate || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Code / Date</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.codeDate || '—'}</p>
            <p className="text-xs text-slate-500">Quota: {customer.quota.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Terms</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.terms || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Dealer Since</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.ishinomotoDealerSince || '—'}</p>
            {customer.ishinomotoSignageSince && (
              <p className="text-xs text-slate-500">Signage: {customer.ishinomotoSignageSince}</p>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
            <p className="text-[11px] font-semibold uppercase text-blue-600 dark:text-blue-400">Outstanding Balance</p>
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{formatCurrency(customer.outstandingBalance)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
            <p className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Monthly Order</p>
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">{formatCurrency(customer.monthlyOrder)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
            <p className="text-[11px] font-semibold uppercase text-amber-600 dark:text-amber-400">Average Monthly</p>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{formatCurrency(customer.averageMonthlyOrder)}</p>
          </div>
        </div>

        <div
          className={`mt-2 rounded-lg border px-3 py-3 ${
            vipStanding.tone === 'gold'
              ? 'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-900/10'
              : vipStanding.tone === 'silver'
              ? 'border-violet-200 bg-violet-50/80 dark:border-violet-900/40 dark:bg-violet-900/10'
              : vipStanding.tone === 'platinum'
              ? 'border-slate-300 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-800/60'
              : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
                  vipStanding.tone === 'gold'
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : vipStanding.tone === 'silver'
                    ? 'bg-violet-100 dark:bg-violet-900/30'
                    : vipStanding.tone === 'platinum'
                    ? 'bg-slate-200 dark:bg-slate-700'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                {vipStanding.badgeVisible ? (
                  <img
                    src={vipBadgeIconUrl}
                    alt={`${vipStanding.tierLabel} badge`}
                    style={{ width: '19.2px', height: '19.2px' }}
                    className="flex-shrink-0"
                  />
                ) : (
                  <PackageSearch className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">VIP Standing</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{vipStanding.tierLabel}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{vipStanding.currentMonthSpendLabel}</p>
              </div>
            </div>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
              Internal staff guidance
            </span>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Progression</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{vipStanding.progressionLabel}</p>
            </div>
            <div className="rounded-lg bg-white/80 px-3 py-2 dark:bg-slate-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Retention</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{vipStanding.retentionLabel}</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-white/80 px-3 py-3 dark:bg-slate-900/50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">VIP Policy Reference</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Internal qualification and retention thresholds used in the VIP standing guidance for this account.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Managed in Maintenance &gt; Customer &gt; VIP Thresholds
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {vipPolicyCards.map((policyCard) => (
                <div key={policyCard.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {policyCard.label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(policyCard.value)}</p>
                </div>
              ))}
            </div>

            {vipConfigLoading && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Loading saved VIP thresholds...</p>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 px-2 py-2 dark:border-slate-700">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">{panel}</div>
    </section>
  );
};

export default DailyCallCustomerDetailExpansion;
