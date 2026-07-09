import React, { Component, ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowUp, BarChart3, Clock3, Table2, Target, Wallet } from 'lucide-react';
import OwnerLiveCallMonitoringView from './OwnerLiveCallMonitoringView';
import DailyCallMonitoringMiniSidebar, { DailyCallOwnerViewMode } from './DailyCallMonitoringMiniSidebar';
import DailyCallMasterListView from './DailyCallMasterListView';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
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
  const priority = rows.filter((row) => row.purchaseCount > 0);
  const recovery = rows.filter((row) => row.purchaseAgeGroup === 'over_one_month');
  const verified = rows.filter((row) => row.purchaseAgeGroup === 'no_purchase' && isProspectRow(row) && row.verification === 'Verified');
  const unverified = rows.filter((row) => row.purchaseAgeGroup === 'no_purchase' && isProspectRow(row) && row.verification !== 'Verified');
  const totalPotential = [priority, recovery, verified, unverified]
    .reduce((sum, categoryRows) => sum + categoryRows.reduce((categorySum, row) => categorySum + row.totalSales, 0), 0);

  return { current, totalPotential };
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

  return (
    <div className="h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
        <DailyCallMonitoringMiniSidebar activeView={activeView} onChangeView={setActiveView} currentUser={currentUser} />

        <section className={`min-h-0 min-w-0 flex-1 p-3 md:p-4 2xl:p-6 ${activeView === 'master-list' ? 'flex flex-col gap-4 overflow-hidden' : 'overflow-hidden'}`}>
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
