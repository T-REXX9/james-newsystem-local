import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Printer, RefreshCcw } from 'lucide-react';
import {
  freightChargesReportService,
  FreightChargesReportDateType,
  FreightChargesReportResponse,
} from '../services/freightChargesReportService';
import { BUTTON_BASE, BUTTON_PRIMARY } from '../utils/uiConstants';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: FreightChargesReportDateType; label: string }> = [
  { value: 'Today', label: 'Today' },
  { value: 'Week', label: 'This Week' },
  { value: 'Month', label: 'This Month' },
  { value: 'Year', label: 'This Year' },
  { value: 'Custom', label: 'Custom Date' },
];

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200';

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US');
};

const buildRangeLabel = (report: FreightChargesReportResponse | null): string => {
  if (!report?.date_from || !report?.date_to) {
    return '';
  }
  return `FROM ${formatDate(report.date_from)} TO ${formatDate(report.date_to)}`;
};

const FreightChargesReportView: React.FC = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateType, setDateType] = useState<FreightChargesReportDateType>('Today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<FreightChargesReportResponse | null>(null);

  const generate = async () => {
    if (dateType === 'Custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
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
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load freight charges report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, []);

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-4">
      <div className="h-full grid grid-cols-12 gap-4 overflow-hidden">
        <aside className="col-span-12 lg:col-span-3 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Accounting Report</p>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Freight Charges Report</h2>
            </div>

            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Report Type
              <select
                value={dateType}
                onChange={(e) => setDateType(e.target.value as FreightChargesReportDateType)}
                className={`${INPUT_CLASS} mt-1`}
              >
                {dateTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Date From
              <div className="relative mt-1">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={dateType !== 'Custom'}
                  className={`${INPUT_CLASS} pl-9 disabled:bg-slate-100 disabled:text-slate-400`}
                />
              </div>
            </label>

            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Date To
              <div className="relative mt-1">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={dateType !== 'Custom'}
                  className={`${INPUT_CLASS} pl-9 disabled:bg-slate-100 disabled:text-slate-400`}
                />
              </div>
            </label>

            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className={`${BUTTON_PRIMARY} w-full justify-center px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Generate Report
            </button>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-9 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">FREIGHT CHARGES (DEBIT) REPORT</h2>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{buildRangeLabel(report)}</p>
            </div>

            <button type="button" className={BUTTON_BASE} onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
            {loading ? (
              <p className="text-sm text-slate-500">Loading freight charges report...</p>
            ) : !report ? (
              <p className="text-sm text-slate-500">No report loaded.</p>
            ) : report.rows.length === 0 ? (
              <p className="text-sm text-slate-500">No freight charges found for the selected date range.</p>
            ) : (
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left">DM No.</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Transaction</th>
                      <th className="px-3 py-2 text-left">Tracking No.</th>
                      <th className="px-3 py-2 text-left">Courier</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.rows.map((row) => (
                      <tr key={row.id || row.refno}>
                        <td className="px-3 py-2">{row.dm_no || '-'}</td>
                        <td className="px-3 py-2">{row.customer || '-'}</td>
                        <td className="px-3 py-2">{row.transaction || '-'}</td>
                        <td className="px-3 py-2">{row.tracking_no || '-'}</td>
                        <td className="px-3 py-2">{row.courier || '-'}</td>
                        <td className="px-3 py-2">{formatDate(row.date)}</td>
                        <td className="px-3 py-2">{row.status || '-'}</td>
                        <td className="px-3 py-2 text-right font-semibold">{peso.format(row.amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
                    <tr>
                      <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200" colSpan={7}>
                        Total:
                      </td>
                      <td className="px-3 py-3 text-right text-rose-600">
                        {peso.format(report.total_amount || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FreightChargesReportView;
