import React, { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Printer } from 'lucide-react';
import {
  freightChargesReportService,
  FreightChargesReportDateType,
  FreightChargesReportResponse,
} from '../services/freightChargesReportService';
import { BUTTON_BASE, BUTTON_PRIMARY } from '../utils/uiConstants';
import { navigateWorkflow } from '../utils/workflowNavigate';
import { formatAccountingTimestamp } from '../utils/formatUtils';

import { shouldSuppressAuthError } from '../services/localApiAuth';

const amountFormat = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateTypeOptions: Array<{ value: FreightChargesReportDateType; label: string }> = [
  { value: 'Today', label: 'Today' },
  { value: 'Week', label: 'This Week' },
  { value: 'Month', label: 'This Month' },
  { value: 'Year', label: 'This Year' },
  { value: 'Custom', label: 'Custom Date' },
];

const INPUT_CLASS = 'form-control w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

const parseReportDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string | null): string => {
  const date = parseReportDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric',
  }).format(date);
};

const formatRangeDate = (value?: string | null): string => {
  const date = parseReportDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'long', day: '2-digit', year: 'numeric',
  }).format(date).toUpperCase();
};

const buildRangeLabel = (report: FreightChargesReportResponse | null): string => {
  if (!report?.date_from || !report?.date_to) return '';
  return `FROM ${formatRangeDate(report.date_from)} TO ${formatRangeDate(report.date_to)}`;
};

const FreightChargesReportView: React.FC = () => {
  const today = useMemo(() => {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return localToday.toISOString().slice(0, 10);
  }, []);
  const [dateType, setDateType] = useState<FreightChargesReportDateType>('Today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<FreightChargesReportResponse | null>(null);
  const [showReport, setShowReport] = useState(false);

  const navigateToFreightCharges = (createNew = false) => {
    navigateWorkflow('accounting-transactions-freight-charges-debit', createNew ? { createNew: 'true' } : undefined);
  };

  const generate = async () => {
    if (dateType === 'Custom' && (!dateFrom || !dateTo)) {
      setError('Date From and Date To are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await freightChargesReportService.getReport({
        dateType,
        dateFrom: dateType === 'Custom' ? dateFrom : undefined,
        dateTo: dateType === 'Custom' ? dateTo : undefined,
      });
      setReport(payload);
      setShowReport(true);
    } catch (err: any) {
      if (shouldSuppressAuthError(err)) return;
      setError(err?.message || 'Failed to load freight charges report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-[1170px]">
        <section className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:overflow-visible">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 print:hidden">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {showReport ? 'Freight Charges (Debit) Report' : 'Debit Memo Report'}
            </h1>
            {showReport && (
              <div className="flex items-center gap-2">
                <button type="button" className={`${BUTTON_BASE} rounded-md px-3 py-1.5 text-xs`} onClick={() => setShowReport(false)}>
                  <ArrowLeft className="h-4 w-4" />
                  BACK
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  PRINT
                </button>
              </div>
            )}
          </header>

          {!showReport ? (
            <div className="p-5 sm:p-6">
              <p className="mb-8 text-sm text-slate-600 dark:text-slate-300">
                Field marked with (<span className="font-semibold text-rose-600">*</span>) is required. Press generate after you select the sorting options.
              </p>

              {error && (
                <div role="alert" className="mb-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                  <strong>Oops!</strong> {error}
                </div>
              )}

              <form onSubmit={(event) => { event.preventDefault(); void generate(); }} className="space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,25%)_minmax(0,41.666667%)] md:items-center md:gap-x-0">
                  <label htmlFor="freight-report-type" className="text-sm font-medium text-slate-700 dark:text-slate-200 md:pr-[15px] md:text-right">
                    Report Type <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="freight-report-type"
                    value={dateType}
                    onChange={(event) => setDateType(event.target.value as FreightChargesReportDateType)}
                    className={INPUT_CLASS}
                  >
                    {dateTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {dateType === 'Custom' && (
                  <>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,25%)_minmax(0,41.666667%)] md:items-center md:gap-x-0">
                      <label htmlFor="freight-report-date-from" className="text-sm font-medium text-slate-700 dark:text-slate-200 md:pr-[15px] md:text-right">
                        Date From <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <Calendar aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="freight-report-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={`${INPUT_CLASS} pl-9`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,25%)_minmax(0,41.666667%)] md:items-center md:gap-x-0">
                      <label htmlFor="freight-report-date-to" className="text-sm font-medium text-slate-700 dark:text-slate-200 md:pr-[15px] md:text-right">
                        Date To <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <Calendar aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input id="freight-report-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={`${INPUT_CLASS} pl-9`} />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-2 md:ml-[25%]">
                  <button type="submit" disabled={loading} className={`${BUTTON_PRIMARY} rounded-md px-4 py-2 text-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading ? 'Generating...' : 'Generate Report'}
                  </button>
                  <button type="button" onClick={navigateToFreightCharges} className={`${BUTTON_BASE} rounded-md px-4 py-2 text-sm`}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div id="freight-charges-report-print-area" className="p-5 sm:p-6 print:p-0">
              {!report?.rows.length ? (
                <div className="mx-auto flex min-h-[360px] max-w-lg flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue" aria-hidden="true">
                    <Calendar className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">No Debit Memo found!</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create Debit Memo</p>
                  <button type="button" onClick={() => navigateToFreightCharges(true)} className={`${BUTTON_PRIMARY} mt-5 rounded-md px-4 py-2 text-sm`}>
                    Create New
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-center text-sm font-medium text-slate-800 dark:text-slate-100 print:text-black">
                    <p>Freight Charges (Debit) Report</p>
                    <p className="-mt-1">{buildRangeLabel(report)}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-sm print:min-w-0">
                      <thead>
                        <tr className="border-b-2 border-slate-300 text-left dark:border-slate-700 print:border-black">
                          <th scope="col" className="px-3 py-2 font-semibold">DM No.</th>
                          <th scope="col" className="px-3 py-2 font-semibold">Customer</th>
                          <th scope="col" className="px-3 py-2 font-semibold">Transaction</th>
                          <th scope="col" className="px-3 py-2 font-semibold">Tracking No.</th>
                          <th scope="col" className="px-3 py-2 font-semibold">Courier</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Timestamp</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                        {report.rows.map((row) => (
                          <tr key={row.id || row.refno}>
                            <td className="whitespace-nowrap px-3 py-2">{row.dm_no || '-'}</td>
                            <td className="px-3 py-2">{row.customer || '-'}</td>
                            <td className="px-3 py-2">{row.transaction || '-'}</td>
                            <td className="px-3 py-2">{row.tracking_no || '-'}</td>
                            <td className="px-3 py-2">{row.courier || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2">{formatDate(row.date)}</td>
                            <td className="whitespace-nowrap px-3 py-2">{formatAccountingTimestamp(row.created_at)}</td>
                            <td className="px-3 py-2">{row.status || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">{amountFormat.format(row.amount || 0)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td colSpan={8} className="px-3 py-3 text-right">Total:</td>
                          <td className="whitespace-nowrap border-b-2 border-slate-700 px-3 py-3 text-right dark:border-slate-200 print:border-black">
                            {amountFormat.format(report.total_amount || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden !important; }
          #freight-charges-report-print-area,
          #freight-charges-report-print-area * { visibility: visible !important; }
          #freight-charges-report-print-area { position: fixed; inset: 0; width: 100%; overflow: visible !important; background: #fff !important; color: #000 !important; }
          #freight-charges-report-print-area table { width: 100% !important; min-width: 0 !important; }
          #freight-charges-report-print-area button { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default FreightChargesReportView;
