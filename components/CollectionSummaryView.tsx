import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText } from 'lucide-react';
import {
  CollectionSummaryDateType,
  CollectionSummaryResponse,
  dailyCollectionService,
} from '../services/dailyCollectionService';
import { BUTTON_BASE, BUTTON_PRIMARY } from '../utils/uiConstants';

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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const formatTimestamp = (value?: Date | null): string => {
  if (!value) return '-';
  return value.toLocaleString('en-US');
};

const INPUT_CLASS = 'w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-sm';
const SELECT_CLASS = 'px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-sm';

const CollectionSummaryView: React.FC = () => {
  const [dateType, setDateType] = useState<CollectionSummaryDateType>('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CollectionSummaryResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

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
      setReport(null);
      setError(err?.message || 'Failed to load collection summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, []);

  const handleBackToOption = () => {
    setReport(null);
  };

  return (
    <div className="w-full flex flex-col bg-white dark:bg-slate-900 p-3 gap-4">
      {/* Top controls card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 border-t-4 border-t-brand-blue">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Collection Report</p>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Collection Summary</h2>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
            <div className="min-w-[220px]">
              <label className="text-sm text-slate-700 dark:text-slate-300 mb-1 block">Date Type</label>
              <select
                className={`${SELECT_CLASS} w-full`}
                value={dateType}
                onChange={(e) => setDateType(e.target.value as CollectionSummaryDateType)}
              >
                {dateTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {dateType === 'custom' && (
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-sm text-slate-700 dark:text-slate-300 mb-1 block">Date From</label>
                  <div className="relative">
                    <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      className={`${INPUT_CLASS} pl-9`}
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-700 dark:text-slate-300 mb-1 block">Date To</label>
                  <div className="relative">
                    <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      className={`${INPUT_CLASS} pl-9`}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              className={`${BUTTON_PRIMARY} px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={generate}
              disabled={loading}
            >
              Generate Report
            </button>

            {report && (
              <div className="flex gap-2">
                <button
                  className={`${BUTTON_BASE} text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20`}
                  onClick={handleBackToOption}
                >
                  Back to Option
                </button>
                <button className={BUTTON_BASE} onClick={() => window.print()}>
                  Print Preview
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report content card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg py-4 px-6 text-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">COLLECTION SUMMARY</h3>
                <hr className="my-2 border-brand-blue border-b-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{reportRangeLabel}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">System generated {formatTimestamp(generatedAt)}</p>
              </div>

              {/* Collection items table */}
              <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-white sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Date</th>
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
                        <td colSpan={8} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
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
                          <td className="px-3 py-2">{row.customer || '-'}</td>
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
                      <td colSpan={3} className="px-3 py-3 text-red-600 dark:text-red-400">GRAND TOTAL</td>
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
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={18} className="text-slate-600 dark:text-slate-400" />
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border border-brand-blue text-brand-blue">
                    DEBIT MEMO (DM) SUMMARY
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-white sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">DM No.</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Code</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Name</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Date</th>
                        <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {report.debit_items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
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
                            <td className="px-3 py-2">{row.lcustomer_name || '-'}</td>
                            <td className="px-3 py-2">{formatDate(row.ldatetime)}</td>
                            <td className="px-3 py-2 text-right">{peso.format(row.lamount || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-sm">
                        <td colSpan={4} className="px-3 py-3 text-slate-900 dark:text-slate-100">TOTAL</td>
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
    </div>
  );
};

export default CollectionSummaryView;
