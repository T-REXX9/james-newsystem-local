import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCcw, Search } from 'lucide-react';
import {
  SoaCustomer,
  SoaDateType,
  SoaReportType,
  SoaResponse,
  statementOfAccountService,
} from '../services/statementOfAccountService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: SoaDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const StatementOfAccountView: React.FC = () => {
  const [customers, setCustomers] = useState<SoaCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [reportType, setReportType] = useState<SoaReportType>('detailed');
  const [dateType, setDateType] = useState<SoaDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SoaResponse | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    statementOfAccountService
      .getCustomers(debouncedSearch)
      .then((rows) => {
        if (!active) return;
        setCustomers(rows);
        if (!selectedCustomerId && rows[0]?.sessionId) {
          setSelectedCustomerId(rows[0].sessionId);
        }
      })
      .catch(() => {
        if (!active) return;
        setCustomers([]);
      })
      .finally(() => {
        if (active) setLoadingCustomers(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.sessionId === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const generate = async () => {
    if (!selectedCustomerId) {
      setError('Select a customer first');
      return;
    }
    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await statementOfAccountService.getStatement({
        customerId: selectedCustomerId,
        reportType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setReport(payload);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load statement of account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCustomerId) return;
    generate();
  }, [selectedCustomerId]);

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-4">
      <div className="h-full grid grid-cols-12 gap-4 overflow-hidden">
        <aside className="col-span-12 lg:col-span-3 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customers</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingCustomers ? (
              <p className="p-4 text-sm text-slate-500">Loading customers...</p>
            ) : customers.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No customers found.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((customer) => {
                  const active = customer.sessionId === selectedCustomerId;
                  return (
                    <li key={customer.sessionId}>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(customer.sessionId)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          active ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 pl-3' : ''
                        }`}
                      >
                        <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{customer.company || 'Unnamed Customer'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{customer.customerCode || customer.sessionId}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-9 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Statement of Account</h2>
                <p className="text-sm text-slate-500">{selectedCustomer?.company || 'Select a customer'}</p>
              </div>
              <button
                type="button"
                onClick={generate}
                disabled={loading || !selectedCustomerId}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Generate
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Report Type
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as SoaReportType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="detailed">Detailed</option>
                  <option value="summary">Monthly</option>
                </select>
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date Type
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as SoaDateType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  {dateTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date From
                <div className="relative mt-1">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    disabled={dateType !== 'custom'}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date To
                <div className="relative mt-1">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    disabled={dateType !== 'custom'}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
            {loading ? (
              <p className="text-sm text-slate-500">Loading statement of account...</p>
            ) : !report ? (
              <p className="text-sm text-slate-500">No report loaded.</p>
            ) : reportType === 'summary' ? (
              <SummaryTable report={report} />
            ) : (
              <DetailedTable report={report} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const DetailedTable: React.FC<{ report: SoaResponse }> = ({ report }) => (
  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
        <tr>
          <th className="px-3 py-2 text-left">Terms</th>
          <th className="px-3 py-2 text-left">Date</th>
          <th className="px-3 py-2 text-left">DR/INV</th>
          <th className="px-3 py-2 text-right">Amount</th>
          <th className="px-3 py-2 text-right">Amount Paid</th>
          <th className="px-3 py-2 text-right">Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {report.rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No statement rows found.</td>
          </tr>
        ) : (
          report.rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2">{row.terms || '-'}</td>
              <td className="px-3 py-2">{formatDate(row.date)}</td>
              <td className="px-3 py-2">{row.reference || '-'}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.amount || 0)}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.amount_paid || 0)}</td>
              <td className="px-3 py-2 text-right font-semibold">{peso.format(row.balance || 0)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
        <tr>
          <td className="px-3 py-2" colSpan={3}>TOTAL BALANCE</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount || 0)}</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount_paid || 0)}</td>
          <td className="px-3 py-2 text-right text-rose-600">{peso.format(report.totals.balance || 0)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

const SummaryTable: React.FC<{ report: SoaResponse }> = ({ report }) => (
  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
        <tr>
          <th className="px-3 py-2 text-left">Year</th>
          <th className="px-3 py-2 text-left">Month</th>
          <th className="px-3 py-2 text-right">Debit</th>
          <th className="px-3 py-2 text-right">Credit</th>
          <th className="px-3 py-2 text-right">Running Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {report.summary_rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No monthly rows found.</td>
          </tr>
        ) : (
          report.summary_rows.map((row, index) => (
            <tr key={`${row.year}-${row.month}-${index}`}>
              <td className="px-3 py-2">{row.year || '-'}</td>
              <td className="px-3 py-2">{row.month_name || row.month || '-'}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.total_debit || 0)}</td>
              <td className="px-3 py-2 text-right">{peso.format(row.total_credit || 0)}</td>
              <td className="px-3 py-2 text-right font-semibold">{peso.format(row.balance || 0)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
        <tr>
          <td className="px-3 py-2" colSpan={2}>TOTAL</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount || 0)}</td>
          <td className="px-3 py-2 text-right">{peso.format(report.totals.amount_paid || 0)}</td>
          <td className="px-3 py-2 text-right text-rose-600">{peso.format(report.totals.balance || 0)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

export default StatementOfAccountView;
