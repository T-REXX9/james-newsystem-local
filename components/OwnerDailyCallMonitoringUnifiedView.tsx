import React, { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Award, BarChart3, Clock3, Package, Table2, Target, Wallet, X } from 'lucide-react';
import { VERIFIED_PROSPECT_POTENTIAL } from '../utils/dailyCallPotentialSales';
import { matchesDailyCallMonitorBucket } from '../utils/dailyCallListCategory';
import DailyCallMasterListView from './DailyCallMasterListView';
import DailyCallSalesColorBreakdown from './DailyCallSalesColorBreakdown';
import PersonalSalesQuotaEditor from './PersonalSalesQuotaEditor';
import { fetchDailyCallMasterList } from '../services/dailyCallMonitoringService';
import { getSalesReportData } from '../services/salesReportService';
import { DailyCallMasterCustomerRow, SalesReportData, UserProfile } from '../types';

interface OwnerDailyCallMonitoringUnifiedViewProps {
  currentUser: UserProfile | null;
  initialSelectedDate?: string;
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

const calculateSummary = (rows: DailyCallMasterCustomerRow[]) => {
  const priority = rows.filter((row) => matchesDailyCallMonitorBucket(row, 'priority'));
  const recovery = rows.filter((row) => matchesDailyCallMonitorBucket(row, 'recovery'));
  const blocked = rows.filter((row) => matchesDailyCallMonitorBucket(row, 'blocked'));
  const verified = rows.filter((row) => matchesDailyCallMonitorBucket(row, 'verified'));
  const totalPotential = priority.reduce((sum, row) => sum + row.averageMonthlySales, 0)
    + recovery.reduce((sum, row) => sum + row.averageMonthlySales, 0)
    + blocked.reduce((sum, row) => sum + row.averageMonthlySales, 0)
    + (verified.length * VERIFIED_PROSPECT_POTENTIAL);

  return { totalPotential };
};

const currentMonthRange = (): { from: string; to: string } => {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  // Format in the browser's local calendar. `toISOString()` would shift a
  // Philippine midnight back into the previous UTC day/month.
  const format = (value: Date) => [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
  return { from: format(from), to: format(today) };
};

const getTopCustomers = (report: SalesReportData) => {
  const totals = new Map<string, { customer: string; total: number }>();
  for (const transaction of report.transactions) {
    const amount = transaction.drAmount + transaction.invoiceAmount;
    const key = transaction.customerId || transaction.customer || 'unknown';
    const existing = totals.get(key);
    if (existing) existing.total += amount;
    else totals.set(key, { customer: transaction.customer || 'Unknown customer', total: amount });
  }
  return Array.from(totals.values()).filter((customer) => customer.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
};

interface CurrentMonthSalesBreakdownModalProps {
  report: SalesReportData;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}

const CurrentMonthSalesBreakdownModal: React.FC<CurrentMonthSalesBreakdownModalProps> = ({ report, dateFrom, dateTo, onClose }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Tab') {
        const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? []).filter((element) => element.getAttribute('aria-hidden') !== 'true');
        if (!focusableElements.length) {
          event.preventDefault();
          closeButtonRef.current?.focus();
          return;
        }
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  const topAgents = (report.summary.salespersonTotals || []).filter((agent) => agent.total > 0).slice(0, 5);
  const topCustomers = getTopCustomers(report);
  const topProducts = (report.summary.productTotals || []).filter((product) => product.total > 0).slice(0, 5);
  const formatDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const period = `${formatDay(dateFrom)} – ${formatDay(dateTo)}`;

  const renderRankedRows = (rows: Array<{ label: string; detail?: string; total: number }>) => (
    rows.length ? rows.map((row, index) => (
      <li key={`${row.label}-${index}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{index + 1}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">{row.label}</span>
          {row.detail && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{row.detail}</span>}
        </span>
        <span className="text-right text-sm font-extrabold text-slate-900 dark:text-white">{peso.format(row.total)}</span>
      </li>
    )) : (
      <li className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No posted sales in this period.</li>
    )
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="current-month-sales-breakdown-title" className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">{period} · Sales Report</p>
            <h2 id="current-month-sales-breakdown-title" className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">Current Month Sales Breakdown</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ranked by posted delivery receipts and invoices.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close sales breakdown" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
            <span className="text-sm font-bold text-blue-900 dark:text-blue-100">Total company current month sales</span>
            <span className="text-xl font-extrabold text-blue-900 dark:text-white">{peso.format(report.summary.grandTotal.total)}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="top-sales-agents-title">
              <h3 id="top-sales-agents-title" className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-white"><Award className="h-4 w-4 text-amber-600" />Top Sales Agents</h3>
              <ol className="mt-2">{renderRankedRows(topAgents.map((agent) => ({ label: agent.salesperson, total: agent.total })))}</ol>
            </section>
            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="top-customers-title">
              <h3 id="top-customers-title" className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-white"><Wallet className="h-4 w-4 text-blue-600" />Top 5 Customers</h3>
              <ol className="mt-2">{renderRankedRows(topCustomers.map((customer) => ({ label: customer.customer, total: customer.total })))}</ol>
            </section>
            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="top-products-title">
              <h3 id="top-products-title" className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-white"><Package className="h-4 w-4 text-emerald-600" />Top 5 Products</h3>
              <ol className="mt-2">{renderRankedRows(topProducts.map((product) => ({
                label: product.product,
                detail: [product.itemCode, product.partNo, product.brand].filter(Boolean).join(' · '),
                total: product.total,
              })))}</ol>
            </section>
          </div>
          <div className="mt-4">
            <DailyCallSalesColorBreakdown />
          </div>
        </div>
      </section>
    </div>
  );
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
  const [summary, setSummary] = useState({ current: 0, totalPotential: 0 });
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [isSalesBreakdownOpen, setIsSalesBreakdownOpen] = useState(false);
  const monthRange = useMemo(currentMonthRange, []);
  const closeSalesBreakdown = useCallback(() => setIsSalesBreakdownOpen(false), []);

  useEffect(() => {
    let isMounted = true;
    const { from, to } = monthRange;
    Promise.all([
      fetchDailyCallMasterList({ fromDate, forceRefresh: true }),
      // The Sales Report is the authoritative sales calculation. Daily Call must
      // not add ledger and transaction figures on top of it.
      getSalesReportData({ dateFrom: from, dateTo: to, customerId: 'all' }),
    ])
      .then(([masterList, salesReport]) => {
        if (!isMounted) return;
        setSalesReport(salesReport);
        setSummary({
          current: salesReport.summary.grandTotal.total,
          totalPotential: calculateSummary(masterList.items).totalPotential,
        });
      })
      .catch(() => {
        if (isMounted) {
          setSalesReport(null);
          setSummary({ current: 0, totalPotential: 0 });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [monthRange]);

  const quickSummaryItems = useMemo(() => {
    const pipelineVsTarget = monthlyTarget ? (summary.totalPotential / monthlyTarget) * 100 : 0;

    return [
      {
        label: 'Current Month Sales (Sales Report)',
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
      <section className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden p-2 sm:p-3 xl:p-4">
          <header
            className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily Call Monitoring Dashboard</p>
                  <h2 className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                    <Table2 className="h-5 w-5 text-blue-600" />
                    Master List
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">Quick Summary (MTD)</h3>
                  <PersonalSalesQuotaEditor quota={Number(currentUser?.monthly_quota || 0)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {quickSummaryItems.map(({ label, value, Icon, tone, iconClass }) => {
                  const cardContent = (
                    <>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{label}</p>
                        <p className="mt-1 truncate text-xl font-extrabold text-slate-950">{value}</p>
                      </div>
                      <Icon className={`h-6 w-6 shrink-0 ${iconClass}`} />
                    </>
                  );
                  const cardClass = `flex min-h-[78px] items-center justify-between rounded-xl border px-3 py-2 ${tone}`;
                  return label === 'Current Month Sales (Sales Report)' ? (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setIsSalesBreakdownOpen(true)}
                      disabled={!salesReport}
                      aria-haspopup="dialog"
                      aria-label={`Open current month sales breakdown, ${value}`}
                      className={`${cardClass} w-full cursor-pointer text-left transition hover:border-blue-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-70`}
                    >
                      {cardContent}
                    </button>
                  ) : (
                    <article key={label} className={cardClass}>{cardContent}</article>
                  );
                })}
              </div>
          </header>

          <div className="min-h-0 flex-1 overflow-hidden">
            <LocalErrorBoundary>
              <DailyCallMasterListView currentUser={currentUser} />
            </LocalErrorBoundary>
        </div>
      </section>
      {isSalesBreakdownOpen && salesReport && (
        <CurrentMonthSalesBreakdownModal
          report={salesReport}
          dateFrom={monthRange.from}
          dateTo={monthRange.to}
          onClose={closeSalesBreakdown}
        />
      )}
    </div>
  );
};

export default OwnerDailyCallMonitoringUnifiedView;
