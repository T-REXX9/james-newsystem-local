import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import {
  CollectionSummaryDateType,
  CollectionSummaryResponse,
  dailyCollectionService,
} from '../services/dailyCollectionService';
import { BUTTON_BASE, BUTTON_PRIMARY } from '../utils/uiConstants';
import { formatAccountingTimestamp, formatDate as formatDisplayDate } from '../utils/formatUtils';
import CustomerStarIndicator from './CustomerStarIndicator';

import { shouldSuppressAuthError } from '../services/localApiAuth';
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: CollectionSummaryDateType; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date' },
];

const formatDate = (value?: string): string => {
  if (!value) return '-';
  return formatDisplayDate(value);
};

const formatTimestamp = (value?: Date | null): string => {
  if (!value) return '-';
  return value.toLocaleString('en-US');
};

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

interface CollectionSummaryViewProps {
  initialDateType?: CollectionSummaryDateType;
  initialDateFrom?: string;
  initialDateTo?: string;
}

const CollectionSummaryView: React.FC<CollectionSummaryViewProps> = ({ initialDateType, initialDateFrom, initialDateTo }) => {
  const [dateType, setDateType] = useState<CollectionSummaryDateType>(initialDateType || 'today');
  const [dateFrom, setDateFrom] = useState(initialDateFrom || '');
  const [dateTo, setDateTo] = useState(initialDateTo || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CollectionSummaryResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!initialDateType && !initialDateFrom && !initialDateTo) return;
    setDateType(initialDateType || 'today');
    setDateFrom(initialDateFrom || '');
    setDateTo(initialDateTo || '');
    setReport(null);
  }, [initialDateFrom, initialDateTo, initialDateType]);

  const reportRangeLabel = useMemo(() => {
    if (!report) return '';
    return `FROM ${formatDate(report.date_from)} TO ${formatDate(report.date_to)}`;
  }, [report]);

  const generate = async () => {
    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await dailyCollectionService.getSummary({
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
        limit: 200,
      });
      setReport(payload);
      setGeneratedAt(new Date());
    } catch (err: any) {
      if (shouldSuppressAuthError(err)) return;
      setReport(null);
      setError(err?.message || 'Failed to load collection summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialDateType || !initialDateFrom || !initialDateTo) return;
    void generate();
  }, [initialDateFrom, initialDateTo, initialDateType]);

  const handleBackToOption = () => {
    setReport(null);
  };

  const handleCancel = () => {
    setDateType('today');
    setDateFrom('');
    setDateTo('');
    setError('');
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
      <div className="mx-auto max-w-[1140px] space-y-5">
      {!report && <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Collection Report</h2></header>
        <div className="p-6">
          <p className="mb-8 text-sm">Field mark with (<span className="text-red-600">*</span>) is required. Press generate after you select the sorting options</p>
          {error && <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"><b>Oops!</b> {error}</div>}
          <div className="mx-auto max-w-[720px] space-y-5">
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[200px_1fr] sm:gap-4">
              <label htmlFor="collection-report-type" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Report Type <span className="text-rose-600">*</span></label>
              <select id="collection-report-type" className={INPUT_CLASS} value={dateType} onChange={e => setDateType(e.target.value as CollectionSummaryDateType)}>
                {dateTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            {dateType === 'custom' && <>
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[200px_1fr] sm:gap-4"><label htmlFor="collection-date-from" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Date From <span className="text-rose-600">*</span></label><input id="collection-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={INPUT_CLASS} /></div>
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[200px_1fr] sm:gap-4"><label htmlFor="collection-date-to" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Date To <span className="text-rose-600">*</span></label><input id="collection-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={INPUT_CLASS} /></div>
            </>}
            <div className="flex flex-wrap gap-2 sm:ml-[216px]">
              <button className={`${BUTTON_PRIMARY} disabled:cursor-wait disabled:opacity-50`} onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate Report'}</button>
              <button className={BUTTON_BASE} onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </div>
      </section>}

      {/* Report content card */}
      {report && <div className="mx-auto max-w-[1600px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Collection Summary</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BUTTON_BASE} onClick={handleBackToOption}><ArrowLeft size={16} /> Back to Option</button>
            <button type="button" className={BUTTON_PRIMARY} onClick={() => window.print()}><Printer size={16} /> Print Preview</button>
          </div>
        </div>
        <div id="collection-summary-print-area">
        <div className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {loading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Generating report...</p>
          )}

          {!report || loading ? null : (
            <>
              {/* Report header */}
              <div className="border-b-2 border-brand-blue bg-slate-50 px-6 py-4 text-center dark:bg-slate-800/50">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">COLLECTION SUMMARY</h3>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{reportRangeLabel}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">System generated <strong>{formatTimestamp(generatedAt)}</strong></p>
              </div>

              {/* Collection items table */}
              <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-white sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Timestamp</th>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Customer</th>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">DCR No.</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Cash</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Check</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">T/T</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Less</th>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {report.collection_items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                          No collection rows found.
                        </td>
                      </tr>
                    ) : (
                      report.collection_items.map((row, index) => (
                        <tr
                          key={`${row.dcr_no}-${index}`}
                          className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'} hover:bg-slate-100 dark:hover:bg-slate-800`}
                        >
                          <td className="px-3 py-2">{formatDate(row.date)}</td>
                          <td className="whitespace-nowrap px-3 py-2">{formatAccountingTimestamp(row.created_at)}</td>
                          <td className="px-3 py-2">{row.customer || '-'}<CustomerStarIndicator customerId={row.customer_id} className="ml-1 inline h-3.5 w-3.5" /></td>
                          <td className="px-3 py-2">{row.dcr_no || '-'}</td>
                          <td className="px-3 py-2 text-right">{peso.format(row.cash || 0)}</td>
                          <td className="px-3 py-2 text-right">{peso.format(row.check || 0)}</td>
                          <td className="px-3 py-2 text-right">{peso.format(row.tt || 0)}</td>
                          <td className="px-3 py-2 text-right">{peso.format(row.less || 0)}</td>
                          <td className="px-3 py-2">{row.remarks || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-sm">
                      <td colSpan={4} className="px-3 py-3 text-right text-red-600 dark:text-red-400"><span className="underline decoration-double underline-offset-2">GRAND TOTAL --&gt;</span></td>
                      <td className="px-3 py-3 text-right text-red-600 dark:text-red-400">{peso.format(report.collection_totals.cash || 0)}</td>
                      <td className="px-3 py-3 text-right text-red-600 dark:text-red-400">{peso.format(report.collection_totals.check || 0)}</td>
                      <td className="px-3 py-3 text-right text-red-600 dark:text-red-400">{peso.format(report.collection_totals.tt || 0)}</td>
                      <td className="px-3 py-3 text-right text-red-600 dark:text-red-400">{peso.format(report.collection_totals.less || 0)}</td>
                      <td className="px-3 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Debit memo section */}
              <div>
                <hr className="my-4 border-slate-200 dark:border-slate-800" />
                <div className="mb-3 border-b border-slate-200 pb-3 text-center dark:border-slate-800">
                  <h4 className="mt-1 text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">DEBIT MEMO (DM) SUMMARY</h4>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{reportRangeLabel}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">System generated <strong>{formatTimestamp(generatedAt)}</strong></p>
                </div>
                <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-white sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">DM No.</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Code</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Name</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Date</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Timestamp</th>
                        <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {report.debit_items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                            No debit memo rows found.
                          </td>
                        </tr>
                      ) : (
                        report.debit_items.map((row, index) => (
                          <tr
                            key={row.lrefno || row.ldm_no}
                            className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'} hover:bg-slate-100 dark:hover:bg-slate-800`}
                          >
                            <td className="px-3 py-2">{row.ldm_no || '-'}</td>
                            <td className="px-3 py-2">{row.lcustomer_code || '-'}</td>
                            <td className="px-3 py-2">{row.lcustomer_name || '-'}<CustomerStarIndicator customerId={row.customer_id} className="ml-1 inline h-3.5 w-3.5" /></td>
                            <td className="px-3 py-2">{formatDate(row.ldatetime)}</td>
                            <td className="whitespace-nowrap px-3 py-2">{formatAccountingTimestamp(row.created_at)}</td>
                            <td className="px-3 py-2 text-right">{peso.format(row.lamount || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-sm">
                        <td colSpan={5} className="px-3 py-3 text-slate-900 dark:text-slate-100">TOTAL</td>
                        <td className="px-3 py-3 text-right text-slate-900 dark:text-slate-100">{peso.format(report.debit_totals.amount || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
        <style>{`@media print {
          body * { visibility: hidden !important; }
          #collection-summary-print-area, #collection-summary-print-area * { visibility: visible !important; }
          #collection-summary-print-area { position: fixed !important; inset: 0 !important; width: 100% !important; padding: 0 !important; background: #fff !important; color: #111 !important; overflow: visible !important; }
          #collection-summary-print-area .overflow-x-auto { overflow: visible !important; max-height: none !important; }
          #collection-summary-print-area table { width: 100% !important; min-width: 0 !important; font-size: 10pt !important; }
          #collection-summary-print-area th, #collection-summary-print-area td { border: 1px solid #bbb !important; color: #111 !important; }
          #collection-summary-print-area tr { break-inside: avoid; }
        }`}</style>
      </div>}
      </div>
    </div>
  );
};

export default CollectionSummaryView;
