import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, FileWarning, History, MessageSquare, RotateCcw, Truck } from 'lucide-react';
import SalesReportTab from './SalesReportTab';
import IncidentReportTab from './IncidentReportTab';
import SalesReturnTab from './SalesReturnTab';
import PurchaseHistoryTab from './PurchaseHistoryTab';
import PersonalCommentsTab from './PersonalCommentsTab';
import LBCRTOTab from './LBCRTOTab';
import { DailyCallCustomerRow, UserProfile } from '../types';
import { isKnownPriceGroup, normalizePriceGroup } from '../constants/pricingGroups';

type DetailTabId = 'sales' | 'incident' | 'returns' | 'lbc-rto' | 'purchase' | 'comments';

interface DailyCallCustomerDetailExpansionProps {
  customer: DailyCallCustomerRow;
  currentUser: UserProfile | null;
}

const tabs: Array<{
  id: DetailTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'sales', label: 'Sales Reports', icon: BarChart3 },
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

const DailyCallCustomerDetailExpansion: React.FC<DailyCallCustomerDetailExpansionProps> = ({
  customer,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTabId>('sales');

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

  const panel = useMemo(() => {
    if (activeTab === 'sales') {
      return <SalesReportTab contactId={customer.id} currentUserId={currentUser?.id} />;
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

  const location = customer.courier || [customer.city, customer.province].filter(Boolean).join(', ') || '—';

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
