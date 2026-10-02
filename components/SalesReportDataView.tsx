import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Printer, Tags } from 'lucide-react';
import CustomerStarIndicator from './CustomerStarIndicator';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import type { SalesReportData, SalesReportTransaction, UserProfile } from '../types';
import { getSalesReportData } from '../services/salesReportService';
import type { SalesReportPeriod } from './SalesReportFilter';

interface SalesReportDataViewProps {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  agentId?: string;
  reportType: SalesReportPeriod;
  onBack: () => void;
  currentUser?: UserProfile;
}

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const customerTypeStyles = {
  new: { label: 'New customers', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  old: { label: 'Existing customers', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  unclassified: { label: 'Unclassified', className: 'border-slate-200 bg-slate-100 text-slate-700' },
} as const;

const normalizePaymentTerm = (value: string): string => {
  const term = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!term) return 'UNSPECIFIED TERMS';
  if (/^AP\s*\/\s*TT-PNB$/.test(term)) return 'AP/TT-PNB';
  if (/^LBC\s+COD$/.test(term)) return 'LBC COP';
  return term.replace(/\b(\d+)DAYS\b/g, '$1 DAYS').replace(/\s*\/\s*/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
};

const isCashTerm = (term: string): boolean => /\b(CASH|COD|COP)\b/.test(term) || term === 'AP/TT-PNB';

const scrollReportToTop = (start: HTMLElement | null): void => {
  let element = start;
  while (element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    if (element.scrollHeight > element.clientHeight && /(auto|scroll|overlay)/.test(overflowY)) {
      element.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    element = element.parentElement;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const parseReportDate = (value: string): Date => {
  const date = new Date(value);
  return date;
};

const formatRowDate = (value: string): string => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

const formatCenteredDate = (value: string): string => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value.toUpperCase();
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(/ /g, '-').replace(',', '').toUpperCase();
};

const formatCustomDate = (value: string): string => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const displayReportHeading = (reportType: SalesReportPeriod, dateFrom: string, dateTo: string) => {
  const from = parseReportDate(dateFrom);
  const heading = reportType === 'today'
    ? 'DAILY SALES'
    : reportType === 'month'
      ? 'MONTHLY SALES'
      : 'SALES REPORT';
  const coveredDates = reportType === 'today'
    ? from.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()
    : reportType === 'month'
      ? `FOR THE MONTH OF ${from.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}`
      : `DATE COVERED: ${reportType === 'custom' ? formatCustomDate(dateFrom).toUpperCase() : formatCenteredDate(dateFrom)} TO ${reportType === 'custom' ? formatCustomDate(dateTo).toUpperCase() : formatCenteredDate(dateTo)}`;
  return (
    <div className="space-y-1 text-center">
      <p className="text-[17px] font-semibold leading-6">{heading}</p>
      <p className="text-[15px] leading-6">{coveredDates}</p>
    </div>
  );
};

const SalesReportDataView: React.FC<SalesReportDataViewProps> = ({
  dateFrom,
  dateTo,
  customerId,
  agentId = '',
  reportType,
  onBack,
}) => {
  const reportTopRef = useRef<HTMLDivElement>(null);
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      try {
        setReportData(await getSalesReportData({ dateFrom, dateTo, customerId, agentId, dateType: reportType }));
      } finally {
        setIsLoading(false);
      }
    };
    void loadReport();
  }, [dateFrom, dateTo, customerId, agentId, reportType]);

  const transactions = useMemo(
    () => [...(reportData?.transactions || [])].sort((left, right) => (
      new Date(left.date).getTime() - new Date(right.date).getTime()
    )),
    [reportData],
  );

  const salespersonGrandTotal = (reportData?.summary.salespersonTotals || []).reduce(
    (total, salesperson) => total + salesperson.total,
    0,
  );

  const salespersonPerformance = useMemo(() => {
    const agents = new Map<string, {
      salesperson: string;
      total: number;
      transactionCount: number;
      customers: Set<string>;
      segments: Record<'new' | 'old' | 'unclassified', { total: number; customers: Set<string> }>;
    }>();

    for (const salesperson of reportData?.summary.salespersonTotals || []) {
      agents.set(salesperson.salesperson, {
        salesperson: salesperson.salesperson,
        total: 0,
        transactionCount: 0,
        customers: new Set<string>(),
        segments: {
          new: { total: 0, customers: new Set<string>() },
          old: { total: 0, customers: new Set<string>() },
          unclassified: { total: 0, customers: new Set<string>() },
        },
      });
    }

    for (const transaction of transactions) {
      const name = transaction.salesperson.trim() || 'Unassigned';
      let agent = agents.get(name);
      if (!agent) {
        agent = {
          salesperson: name,
          total: 0,
          transactionCount: 0,
          customers: new Set<string>(),
          segments: {
            new: { total: 0, customers: new Set<string>() },
            old: { total: 0, customers: new Set<string>() },
            unclassified: { total: 0, customers: new Set<string>() },
          },
        };
        agents.set(name, agent);
      }

      const postedSales = (transaction.drAmount || 0) + (transaction.invoiceAmount || 0);
      const customerType = transaction.customerType === 'new' || transaction.customerType === 'old'
        ? transaction.customerType
        : 'unclassified';
      const customerKey = transaction.customerId.trim()
        || (transaction.customer.trim() ? 'name:' + transaction.customer.trim().toLowerCase() : 'transaction:' + transaction.type + ':' + transaction.id);
      agent.total += postedSales;
      agent.transactionCount += 1;
      agent.customers.add(customerKey);
      agent.segments[customerType].total += postedSales;
      agent.segments[customerType].customers.add(customerKey);
    }

    return [...agents.values()].sort((left, right) => right.total - left.total || left.salesperson.localeCompare(right.salesperson));
  }, [transactions, reportData?.summary.salespersonTotals]);

  const paymentTerms = useMemo(() => {
    const groups = new Map<string, { label: string; soAmount: number; drAmount: number; invoiceAmount: number; cash: boolean; rawLabel?: string }>();
    for (const transaction of transactions) {
      const rawTerm = transaction.terms.trim();
      const key = rawTerm ? rawTerm.toUpperCase().replace(/\s+/g, ' ') : '__UNSPECIFIED__';
      const existing = groups.get(key) ?? {
        label: normalizePaymentTerm(transaction.terms), soAmount: 0, drAmount: 0, invoiceAmount: 0,
        cash: isCashTerm(normalizePaymentTerm(transaction.terms)), rawLabel: rawTerm === 'LBC COD' ? 'LBC COD' : undefined,
      };
      existing.soAmount += transaction.soAmount || 0;
      existing.drAmount += transaction.drAmount || 0;
      existing.invoiceAmount += transaction.invoiceAmount || 0;
      groups.set(key, existing);
    }
    const rows = [...groups.entries()].map(([key, value]) => ({ key, ...value }));
    const sum = (items: typeof rows) => items.reduce((total, item) => ({
      soAmount: total.soAmount + item.soAmount,
      drAmount: total.drAmount + item.drAmount,
      invoiceAmount: total.invoiceAmount + item.invoiceAmount,
    }), { soAmount: 0, drAmount: 0, invoiceAmount: 0 });
    const cashRows = rows.filter(row => row.cash);
    const termsRows = rows.filter(row => !row.cash);
    return { rows, cashTotal: sum(cashRows), termsTotal: sum(termsRows), total: sum(rows) };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f4f4]">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div ref={reportTopRef} className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333] print:bg-white print:p-0">
      <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] print:max-w-none print:border-0 print:shadow-none">
        <header className="flex min-h-[64px] items-center justify-between border-b border-[#e5e5e5] px-5 print:hidden">
          <h1 className="self-stretch border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
            Sales Report
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-[3px] border border-[#398439] bg-[#5cb85c] px-[10px] py-[5px] text-[12px] font-semibold text-white hover:bg-[#47a447]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              BACK
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-[10px] py-[5px] text-[12px] font-semibold text-[#333] hover:bg-[#ebebeb]"
            >
              <Printer className="h-3.5 w-3.5" />
              PRINT
            </button>
          </div>
        </header>

        <main id="print_area" className="p-5">
          <div className="mb-5">
            {displayReportHeading(reportType, dateFrom, dateTo)}
          </div>

          {transactions.length === 0 ? (
            <div className="py-20 text-center text-[#777]">
              <Tags className="mx-auto mb-3 h-12 w-12" />
              <h3 className="text-[20px] font-semibold">Empty!</h3>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] table-fixed border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="w-[9%] px-2 py-2 text-left">DATE</th>
                      <th className="w-[19%] px-2 py-2 text-left">CUSTOMER</th>
                      <th className="w-[14%] px-2 py-2 text-left">TERMS</th>
                      <th className="w-[10%] px-2 py-2 text-left">REF #</th>
                      <th className="w-[9%] px-2 py-2 text-left">SO#</th>
                      <th className="w-[10%] px-2 py-2 text-right">Amount</th>
                      <th className="w-[8%] px-2 py-2 text-right">DR</th>
                      <th className="w-[11%] px-2 py-2 text-right">INVOICE</th>
                      <th className="w-[10%] px-2 py-2 text-left">ASSIGNED AGENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={`${transaction.type}-${transaction.id}`} className="border-t border-[#ddd]">
                        <td className="break-words px-2 py-2">{formatRowDate(transaction.date)}</td>
                        <td className="break-words px-2 py-2">
                          <span>{transaction.customer}</span><CustomerStarIndicator customerId={transaction.customerId} isStarred={transaction.isStarred} className="mx-1 inline h-3.5 w-3.5" />{' '}
                          <span className={'inline-flex rounded-full border px-1.5 py-0.5 align-middle text-[9px] font-semibold ' + customerTypeStyles[transaction.customerType || 'unclassified'].className}>
                            {transaction.customerType === 'new' ? 'New' : transaction.customerType === 'old' ? 'Existing' : 'Unclassified'}
                          </span>
                        </td>
                        <td className="break-words px-2 py-2">{transaction.terms}</td>
                        <td className="break-words px-2 py-2">{transaction.refNo}</td>
                        <td className="break-words px-2 py-2">{transaction.soNo}</td>
                        <td className="break-words px-2 py-2 text-right">{money.format(transaction.soAmount || 0)}</td>
                        <td className="break-words px-2 py-2 text-right">{money.format(transaction.drAmount || 0)}</td>
                        <td className="break-words px-2 py-2 text-right">{money.format(transaction.invoiceAmount || 0)}</td>
                        <td className="break-words px-2 py-2">{transaction.salesperson}</td>
                      </tr>
                    ))}

                    {reportType !== 'today' && (
                      <tr>
                        <td />
                        <td colSpan={2} className="px-2 py-2 font-semibold">TOTAL </td>
                        <td colSpan={2} />
                        <td className="border-y border-black px-2 py-2 font-semibold">{money.format(reportData?.summary.grandTotal.soAmount || 0)}</td>
                        <td className="border-y border-black px-2 py-2 font-semibold">{money.format(reportData?.summary.grandTotal.drAmount || 0)}</td>
                        <td className="border-y border-black px-2 py-2 font-semibold">{money.format(reportData?.summary.grandTotal.invoiceAmount || 0)}</td>
                        <td />
                      </tr>
                    )}

                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">SUBTOTAL --&gt;</td>
                      <td className="border-y border-black px-2 py-3 font-semibold">{money.format(reportData?.summary.grandTotal.soAmount || 0)}</td>
                      <td className="border-y border-black px-2 py-3 font-semibold">{money.format(reportData?.summary.grandTotal.drAmount || 0)}</td>
                      <td className="border-y border-black px-2 py-3 font-semibold">{money.format(reportData?.summary.grandTotal.invoiceAmount || 0)}</td>
                      <td />
                    </tr>

                    {reportType !== 'today' && (
                      <tr>
                        <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">TOTAL  --&gt;</td>
                        <td />
                        <td colSpan={2} className="px-2 py-3 text-center font-semibold">{money.format(reportData?.summary.grandTotal.total || 0)}</td>
                        <td />
                      </tr>
                    )}
                    <tr>
                      <td colSpan={6} />
                      <td colSpan={2} className="border-t border-black" />
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-right text-[16px] font-semibold">GRAND TOTAL --&gt;</td>
                      <td />
                      <td colSpan={2} className="border-b-4 border-double border-black px-2 py-3 text-center font-semibold">{money.format(reportData?.summary.grandTotal.total || 0)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              <section className="mt-6" data-testid="payment-terms-breakdown">
                <h2 className="mb-2 text-[13px] font-semibold">PAYMENT TERMS BREAKDOWN</h2>
                <table className="w-full border-collapse text-[12px]">
                  <thead><tr className="border-b border-black"><th className="px-2 py-2 text-left">PAYMENT TERMS</th><th className="px-2 py-2 text-right">SO</th><th className="px-2 py-2 text-right">DR</th><th className="px-2 py-2 text-right">INVOICE</th></tr></thead>
                  <tbody>
                    {paymentTerms.rows.map(row => (
                      <tr key={row.key} className="border-b border-[#ddd]">
                        <td className="px-2 py-2">{row.rawLabel && <span className="mr-2">{row.rawLabel}</span>}{row.label}</td>
                        <td className="px-2 py-2 text-right">{money.format(row.soAmount)}</td>
                        <td className="px-2 py-2 text-right">{money.format(row.drAmount)}</td>
                        <td className="px-2 py-2 text-right">{money.format(row.invoiceAmount)}</td>
                      </tr>
                    ))}
                    {([
                      ['CASH SALES TOTAL', paymentTerms.cashTotal],
                      ['TERMS SALES TOTAL', paymentTerms.termsTotal],
                      ['PAYMENT TERMS TOTAL', paymentTerms.total],
                    ] as const).map(([label, totals]) => (
                      <tr key={label} className="font-semibold">
                        <td className="border-t border-black px-2 py-2">{label}</td>
                        <td className="border-t border-black px-2 py-2 text-right">{money.format(totals.soAmount)}</td>
                        <td className="border-t border-black px-2 py-2 text-right">{money.format(totals.drAmount)}</td>
                        <td className="border-t border-black px-2 py-2 text-right">{money.format(totals.invoiceAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="mt-6" aria-labelledby="agent-performance-heading" data-testid="agent-customer-type-breakdown">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 id="agent-performance-heading" className="text-[15px] font-semibold">SALES PERFORMANCE BY AGENT</h2>
                    <p className="mt-1 text-xs text-[#666]">Posted sales are delivery receipts plus invoices, matching the report total.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]" aria-label="Customer type color legend">
                    {(Object.entries(customerTypeStyles) as [keyof typeof customerTypeStyles, (typeof customerTypeStyles)['new']][]).map(([type, style]) => (
                      <span key={type} className={'inline-flex items-center rounded-full border px-2.5 py-1 ' + style.className}>
                        {style.label}
                      </span>
                    ))}
                  </div>
                </div>
                {salespersonPerformance.length === 0 ? (
                  <p className="rounded border border-[#ddd] px-3 py-4 text-center text-sm text-[#666]">No agent sales data available.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {salespersonPerformance.map(agent => (
                      <article key={agent.salesperson} className="min-w-0 rounded border border-[#ddd] bg-white p-3" aria-label={agent.salesperson + ' sales performance'}>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5e5e5] pb-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{agent.salesperson}</h3>
                            <p className="text-xs text-[#666]">{agent.transactionCount} posted {agent.transactionCount === 1 ? 'transaction' : 'transactions'} · {agent.customers.size} {agent.customers.size === 1 ? 'customer' : 'customers'}</p>
                          </div>
                          <p className="shrink-0 text-right text-sm font-bold tabular-nums">{money.format(agent.total)}</p>
                        </div>
                        <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {(Object.keys(customerTypeStyles) as Array<keyof typeof customerTypeStyles>).map(type => {
                            const style = customerTypeStyles[type];
                            const segment = agent.segments[type];
                            return (
                              <div key={type} className={'min-w-0 rounded border px-2.5 py-2 ' + style.className}>
                                <dt className="truncate text-[10px] font-semibold uppercase tracking-wide">{style.label}</dt>
                                <dd className="mt-1 text-sm font-bold tabular-nums">{money.format(segment.total)}</dd>
                                <dd className="text-[10px]">{segment.customers.size} {segment.customers.size === 1 ? 'customer' : 'customers'}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <div className="mt-3 grid min-w-0 grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div className="min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[420px] table-fixed border-collapse text-[12px]" data-testid="salesperson-category-summary">
                      <tbody>
                        {(reportData?.summary.salespersonTotals || []).map(salesperson => (
                          <React.Fragment key={salesperson.salesperson}>
                            <tr><td className="px-2 py-2">{salesperson.salesperson}</td><td /><td /></tr>
                            {salesperson.categories.map(category => (
                              <tr key={`${salesperson.salesperson}-${category.category}`}>
                                <td />
                                <td className="px-2 py-2">{category.category}</td>
                                <td className="px-2 py-2 text-right">{money.format(category.soAmount + category.drAmount + category.invoiceAmount)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={2} className="border-b border-black" />
                              <td className="border-y border-black px-2 py-2 text-right">{money.format(salesperson.total)}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                        <tr><td colSpan={3} className="border-b border-black" /></tr>
                        <tr>
                          <td colSpan={2} className="border-b border-black px-2 py-2">TOTAL</td>
                          <td className="border-b border-black px-2 py-2 text-right">{money.format(salespersonGrandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                </div>
                <div className="min-w-0 break-words text-[12px]">
                  <p className="font-semibold">Checked and Audited by/ Date: </p>
                  <p aria-hidden="true" className="mb-4 mt-2 h-5 w-full border-b border-[#333]" />
                  <p className="font-semibold">Noted by/ Date: </p>
                  <p aria-hidden="true" className="mt-2 h-5 w-full border-b border-[#333]" />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <button
        type="button"
        onClick={() => scrollReportToTop(reportTopRef.current)}
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full border border-[#315574] bg-[#315574] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#24435d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66afe9] focus-visible:ring-offset-2 print:hidden"
        aria-label="Back to top of sales report"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        Back to top
      </button>
    </div>
  );
};

export default SalesReportDataView;
