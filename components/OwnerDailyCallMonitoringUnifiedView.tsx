import React, { Component, ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowUp, BarChart3, Clock3, FileText, PackageSearch, ReceiptText, Table2, Target, Users, Wallet } from 'lucide-react';
import OwnerLiveCallMonitoringView from './OwnerLiveCallMonitoringView';
import DailyCallMonitoringMiniSidebar, { DailyCallOwnerViewMode } from './DailyCallMonitoringMiniSidebar';
import DailyCallMasterListView from './DailyCallMasterListView';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { getAllSalesOrders } from '../services/salesOrderLocalApiService';
import { getAllInvoices } from '../services/invoiceLocalApiService';
import { fetchProductsPage } from '../services/productLocalApiService';
import { DailyCallMasterCustomerRow, UserProfile } from '../types';

interface OwnerDailyCallMonitoringUnifiedViewProps {
  currentUser: UserProfile | null;
}

interface LocalErrorBoundaryProps {
  children: ReactNode;
}

interface LocalErrorBoundaryState {
  hasError: boolean;
}

const fromDate = '2025-10-01';
const monthlyTarget = 3_000_000;

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const isProspectRow = (row: DailyCallMasterCustomerRow) => {
  const profileType = String(row.profileType || '').trim().toLowerCase();
  return profileType.includes('prospect');
};

const calculateSummary = (rows: DailyCallMasterCustomerRow[]) => {
  const current = rows.reduce((sum, row) => sum + row.currentMonthSales, 0);
  const priority = rows.filter((row) => row.listCategory === 'priority');
  const recovery = rows.filter((row) => row.listCategory === 'recovery');
  const verified = rows.filter((row) => row.purchaseAgeGroup === 'no_purchase' && isProspectRow(row) && row.verification === 'Verified');
  const unverified = rows.filter((row) => row.purchaseAgeGroup === 'no_purchase' && isProspectRow(row) && row.verification !== 'Verified');
  const totalPotential = [priority, recovery, verified, unverified]
    .reduce((sum, categoryRows) => sum + categoryRows.reduce((categorySum, row) => categorySum + row.totalSales, 0), 0);

  return { current, totalPotential };
};

const navigateToModule = (tab: string) => {
  window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab } }));
};

class LocalErrorBoundary extends Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  state: LocalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Owner daily call unified view failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          <p className="font-semibold">Something went wrong while rendering this page.</p>
          <p className="mt-1 text-sm">Please refresh and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const OwnerDailyCallMonitoringUnifiedView: React.FC<OwnerDailyCallMonitoringUnifiedViewProps> = ({ currentUser }) => {
  const [activeView, setActiveView] = useState<DailyCallOwnerViewMode>('chart');
  const [summary, setSummary] = useState({ current: 0, totalPotential: 0 });
  const [workQueueCounts, setWorkQueueCounts] = useState({
    followUps: 0,
    pendingOrders: 0,
    unpaidInvoices: 0,
    lowStock: 0,
  });

  useEffect(() => {
    if (activeView !== 'master-list') return;

    let isMounted = true;
    fetchDailyCallMasterList({ fromDate })
      .then((result) => {
        if (!isMounted) return;
        setSummary(calculateSummary(result.items));
      })
      .catch(() => {
        if (isMounted) setSummary({ current: 0, totalPotential: 0 });
      });

    return () => {
      isMounted = false;
    };
  }, [activeView]);

  useEffect(() => {
    let isMounted = true;
    const loadWorkQueueCounts = async () => {
      const [callsResult, ordersResult, invoicesResult, productsResult] = await Promise.allSettled([
        fetchDailyCallMasterList({ fromDate }),
        getAllSalesOrders(),
        getAllInvoices(),
        fetchProductsPage({ status: 'active', page: 1, perPage: 100 }),
      ]);

      if (!isMounted) return;

      const followUps = callsResult.status === 'fulfilled'
        ? callsResult.value.items.filter((row) => row.purchaseAgeGroup !== 'current_month').length
        : 0;
      const pendingOrders = ordersResult.status === 'fulfilled'
        ? ordersResult.value.filter((order) => ['pending', 'submitted'].includes(String(order.status || '').toLowerCase())).length
        : 0;
      const unpaidInvoices = invoicesResult.status === 'fulfilled'
        ? invoicesResult.value.filter((invoice) => !['paid', 'cancelled'].includes(String(invoice.status || '').toLowerCase())).length
        : 0;
      const lowStock = productsResult.status === 'fulfilled'
        ? productsResult.value.items.filter((product) => {
            const totalStock =
              Number(product.stock_wh1 || 0) +
              Number(product.stock_wh2 || 0) +
              Number(product.stock_wh3 || 0) +
              Number(product.stock_wh4 || 0) +
              Number(product.stock_wh5 || 0) +
              Number(product.stock_wh6 || 0);
            return Number(product.reorder_quantity || 0) > 0 && totalStock <= Number(product.reorder_quantity || 0);
          }).length
        : 0;

      setWorkQueueCounts({ followUps, pendingOrders, unpaidInvoices, lowStock });
    };

    void loadWorkQueueCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  const quickSummaryItems = useMemo(() => {
    const pipelineVsTarget = monthlyTarget ? (summary.totalPotential / monthlyTarget) * 100 : 0;

    return [
      {
        label: 'Current Month Sales',
        value: peso.format(summary.current),
        Icon: Wallet,
        tone: 'border-blue-200 bg-blue-50/70 text-blue-700',
        iconClass: 'text-blue-700',
      },
      {
        label: 'Monthly Target',
        value: peso.format(monthlyTarget),
        Icon: Target,
        tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
        iconClass: 'text-emerald-700',
      },
      {
        label: 'Remaining to Target',
        value: peso.format(Math.max(0, monthlyTarget - summary.current)),
        Icon: Clock3,
        tone: 'border-orange-200 bg-orange-50/70 text-orange-600',
        iconClass: 'text-orange-600',
      },
      {
        label: 'Total Potential Sales',
        value: peso.format(summary.totalPotential),
        Icon: BarChart3,
        tone: 'border-violet-200 bg-violet-50/70 text-violet-700',
        iconClass: 'text-violet-700',
      },
      {
        label: 'Pipeline vs Target',
        value: `${pipelineVsTarget.toFixed(2)}%`,
        Icon: ArrowUp,
        tone: 'border-sky-200 bg-sky-50/70 text-sky-700',
        iconClass: 'text-blue-700',
      },
    ];
  }, [summary]);

  const workQueueCards = useMemo(() => [
    {
      title: 'Follow up inquiries',
      count: workQueueCounts.followUps,
      description: 'Review active customer calls and open inquiry work.',
      action: 'Open follow-ups',
      Icon: Users,
      route: 'sales-transaction-daily-call-monitoring',
    },
    {
      title: 'Pending sales orders',
      count: workQueueCounts.pendingOrders,
      description: 'Check orders waiting for approval or next documents.',
      action: 'Review orders',
      Icon: FileText,
      route: 'sales-transaction-sales-order',
    },
    {
      title: 'Unpaid invoices',
      count: workQueueCounts.unpaidInvoices,
      description: 'Open receivables and see customer balances.',
      action: 'View AR',
      Icon: ReceiptText,
      route: 'accounting-accounting-accounts-receivable',
    },
    {
      title: 'Collections to review',
      count: null,
      description: 'Post, check, or reconcile daily collections.',
      action: 'Open collections',
      Icon: Wallet,
      route: 'accounting-transactions-daily-collection-entry',
    },
    {
      title: 'Low stock watch',
      count: workQueueCounts.lowStock,
      description: 'Review reorder and suggested stock reports.',
      action: 'Check stock',
      Icon: PackageSearch,
      route: 'warehouse-reports-reorder-report',
    },
  ], [workQueueCounts.followUps, workQueueCounts.lowStock, workQueueCounts.pendingOrders, workQueueCounts.unpaidInvoices]);

  return (
    <div className="h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
        <DailyCallMonitoringMiniSidebar activeView={activeView} onChangeView={setActiveView} currentUser={currentUser} />

        <section className={`min-h-0 min-w-0 flex-1 p-3 md:p-4 2xl:p-6 ${activeView === 'master-list' ? 'flex flex-col gap-4 overflow-hidden' : 'flex flex-col gap-4 overflow-hidden'}`}>
          {activeView !== 'master-list' && (
            <header className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today&apos;s Work Queue</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">What needs attention now</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('master-list')}
                  className="rounded-lg bg-brand-blue px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0a3d74]"
                >
                  Open master list
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {workQueueCards.map(({ title, count, description, action, Icon, route }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => navigateToModule(route)}
                    className="group flex min-h-[112px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-blue/40 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
                        {typeof count === 'number' && (
                          <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-brand-blue shadow-sm dark:bg-slate-800">
                            {count.toLocaleString()} open
                          </span>
                        )}
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span>
                      </span>
                      <Icon className="h-5 w-5 shrink-0 text-brand-blue" />
                    </span>
                    <span className="mt-3 text-xs font-bold text-brand-blue group-hover:underline">{action}</span>
                  </button>
                ))}
              </div>
            </header>
          )}

          {activeView === 'master-list' && (
            <header
              className="shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              style={{ zoom: 1.05, width: '95.2381%' } as React.CSSProperties}
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Daily Call Monitoring</p>
                  <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                    <Table2 className="h-5 w-5 text-blue-600" />
                    Master List
                  </h2>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">Quick Summary (MTD)</h3>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {quickSummaryItems.map(({ label, value, Icon, tone, iconClass }) => (
                  <article key={label} className={`flex min-h-[78px] items-center justify-between rounded-xl border px-3 py-2 ${tone}`}>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold">{label}</p>
                      <p className="mt-2 truncate text-lg font-extrabold text-slate-950">{value}</p>
                    </div>
                    <Icon className={`h-6 w-6 shrink-0 ${iconClass}`} />
                  </article>
                ))}
              </div>
            </header>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            <LocalErrorBoundary>
              {activeView === 'master-list' ? (
                <DailyCallMasterListView />
              ) : (
                <OwnerLiveCallMonitoringView currentUser={currentUser} />
              )}
            </LocalErrorBoundary>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OwnerDailyCallMonitoringUnifiedView;
