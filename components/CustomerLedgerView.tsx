import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCcw, Search } from 'lucide-react';
import {
  customerLedgerService,
  CustomerLedgerResponse,
  LedgerCustomer,
  LedgerDateType,
  LedgerReportType,
} from '../services/customerLedgerService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const dateTypeOptions: Array<{ value: LedgerDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date' },
];

const CustomerLedgerView: React.FC = () => {
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [reportType, setReportType] = useState<LedgerReportType>('detailed');
  const [dateType, setDateType] = useState<LedgerDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResponse | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    customerLedgerService
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

  const loadLedger = async () => {
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
      const payload = await customerLedgerService.getLedger(selectedCustomerId, {
        reportType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setLedgerData(payload);
    } catch (err: any) {
      setLedgerData(null);
      setError(err?.message || 'Failed to load customer ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCustomerId) return;
    loadLedger();
  }, [selectedCustomerId]);

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-4">
      <div className="h-full grid grid-cols-12 gap-4 overflow-hidden">
        <aside className="col-span-12 lg:col-span-3 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customers</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer Ledger</h2>
                <p className="text-sm text-slate-500">{selectedCustomer?.company || 'Select a customer to generate report'}</p>
              </div>
              <button
                type="button"
                onClick={loadLedger}
                disabled={loading || !selectedCustomerId}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Generate
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date Covered
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as LedgerDateType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  {dateTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Report Type
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as LedgerReportType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="detailed">Detailed</option>
                  <option value="summary">Summary</option>
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

          <div className="p-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard label="Dealership Since" value={formatDate(ledgerData?.metrics.dealership_since)} />
            <MetricCard label="Dealership Sales" value={peso.format(ledgerData?.metrics.dealership_sales || 0)} />
            <MetricCard label="Dealership Quota" value={peso.format(ledgerData?.metrics.dealership_quota || 0)} />
            <MetricCard label="Monthly Sales" value={peso.format(ledgerData?.metrics.monthly_sales || 0)} />
            <MetricCard label="Customer Since" value={formatDate(ledgerData?.metrics.customer_since)} />
            <MetricCard label="Credit Limit" value={peso.format(ledgerData?.metrics.credit_limit || 0)} />
            <MetricCard label="Terms" value={ledgerData?.metrics.terms || '-'} />
            <MetricCard label="Balance" value={peso.format(ledgerData?.metrics.balance || 0)} />
          </div>

          <div className="flex-1 overflow-auto p-4">
            {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
            {loading ? (
              <p className="text-sm text-slate-500">Loading ledger...</p>
            ) : !ledgerData ? (
              <p className="text-sm text-slate-500">No report loaded.</p>
            ) : reportType === 'summary' ? (
              <SummaryTable data={ledgerData} />
            ) : (
              <DetailedTable data={ledgerData} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{value}</p>
  </div>
);

const DetailedTable: React.FC<{ data: CustomerLedgerResponse }> = ({ data }) => (
  <table className="min-w-full text-sm">
    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
      <tr>
        <th className="text-left px-2 py-2">Date</th>
        <th className="text-left px-2 py-2">Ref</th>
        <th className="text-left px-2 py-2">Chk No.</th>
        <th className="text-left px-2 py-2">Chk Date</th>
        <th className="text-left px-2 py-2">DCR</th>
        <th className="text-right px-2 py-2">Debit</th>
        <th className="text-right px-2 py-2">Credit</th>
        <th className="text-right px-2 py-2">PDC</th>
        <th className="text-right px-2 py-2">Balance</th>
        <th className="text-left px-2 py-2">Remarks</th>
        <th className="text-left px-2 py-2">Promise to Pay</th>
      </tr>
    </thead>
    <tbody>
      {data.rows.map((row, index) => (
        <tr key={`${row.id}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
          <td className="px-2 py-1.5">{formatDate(row.date)}</td>
          <td className="px-2 py-1.5">{row.reference || '-'}</td>
          <td className="px-2 py-1.5">{row.check_no || '-'}</td>
          <td className="px-2 py-1.5">{formatDate(row.check_date)}</td>
          <td className="px-2 py-1.5">{row.dcr || '-'}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.debit || 0)}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.credit || 0)}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.pdc || 0)}</td>
          <td className="px-2 py-1.5 text-right font-semibold">{peso.format(row.balance || 0)}</td>
          <td className="px-2 py-1.5">{row.remarks || '-'}</td>
          <td className="px-2 py-1.5">{row.promise_to_pay || '-'}</td>
        </tr>
      ))}
      <tr className="font-semibold bg-slate-50 dark:bg-slate-900/50">
        <td className="px-2 py-2" colSpan={5}>TOTAL</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.debit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.credit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.pdc || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.balance || 0)}</td>
        <td className="px-2 py-2" colSpan={2}></td>
      </tr>
    </tbody>
  </table>
);

const SummaryTable: React.FC<{ data: CustomerLedgerResponse }> = ({ data }) => (
  <table className="min-w-full text-sm">
    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
      <tr>
        <th className="text-left px-2 py-2">Year</th>
        <th className="text-left px-2 py-2">Month</th>
        <th className="text-right px-2 py-2">Debit</th>
        <th className="text-right px-2 py-2">Credit</th>
        <th className="text-right px-2 py-2">Balance</th>
      </tr>
    </thead>
    <tbody>
      {data.summary_rows.map((row, index) => (
        <tr key={`${row.year}-${row.month}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
          <td className="px-2 py-1.5">{row.year}</td>
          <td className="px-2 py-1.5">{row.month_name || row.month}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.debit || 0)}</td>
          <td className="px-2 py-1.5 text-right">{peso.format(row.credit || 0)}</td>
          <td className="px-2 py-1.5 text-right font-semibold">{peso.format(row.balance || 0)}</td>
        </tr>
      ))}
      <tr className="font-semibold bg-slate-50 dark:bg-slate-900/50">
        <td className="px-2 py-2" colSpan={2}>TOTAL</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.debit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.credit || 0)}</td>
        <td className="px-2 py-2 text-right text-rose-600">{peso.format(data.totals.balance || 0)}</td>
      </tr>
    </tbody>
  </table>
);

export default CustomerLedgerView;
