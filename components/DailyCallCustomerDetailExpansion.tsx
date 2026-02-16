import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, FileWarning, History, MessageSquare, RotateCcw, Truck } from 'lucide-react';
import SalesReportTab from './SalesReportTab';
import IncidentReportTab from './IncidentReportTab';
import SalesReturnTab from './SalesReturnTab';
import PurchaseHistoryTab from './PurchaseHistoryTab';
import PersonalCommentsTab from './PersonalCommentsTab';
import LBCRTOTab from './LBCRTOTab';
import { DailyCallCustomerRow, UserProfile } from '../types';

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

  return (
    <section className="animate-[fadeIn_180ms_ease-out] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Detail</p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              {customer.shopName}
            </h3>
            <p className="text-xs text-slate-500">{customer.city} • {customer.assignedTo}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Source</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.source}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Assigned Rep/Date</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.assignedTo}</p>
            <p className="text-xs text-slate-500">{customer.assignedDate || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Client Since</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.clientSince}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Contact Number</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.contactNumber}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Code/Date</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.codeDate}</p>
            <p className="text-xs text-slate-500">Code Text: {customer.quota.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Mode of Payment</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.modeOfPayment}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Courier</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.courier}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Status</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.status}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">City/Shop Name</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer.city}</p>
            <p className="text-xs text-slate-500">{customer.shopName}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Outstanding</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(customer.outstandingBalance)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Monthly Order</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(customer.monthlyOrder)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Average Monthly</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(customer.averageMonthlyOrder)}</p>
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
