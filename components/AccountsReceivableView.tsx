import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Printer, RefreshCcw } from 'lucide-react';
import {
  accountsReceivableService,
  ArDateType,
  ArDebtType,
  ArResponse,
  ArRow,
} from '../services/accountsReceivableService';
import SearchableFilterSelect from './SearchableFilterSelect';
import { getCustomerList } from '../services/salesReportService';
import { CustomerOption } from '../types';
import { BUTTON_BASE, BUTTON_PRIMARY } from '../utils/uiConstants';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: ArDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const debtTypeOptions: Array<{ value: ArDebtType; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Good', label: 'Good Only' },
  { value: 'Bad', label: 'Bad Only' },
];

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200';

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const buildDateRangeLabel = (report: ArResponse | null): string => {
  if (!report) return 'ALL DATES';
  if (report.date_from && report.date_to) {
    return `FROM ${formatDate(report.date_from)} TO ${formatDate(report.date_to)}`;
  }
  return 'ALL DATES';
};

const flattenRows = (report: ArResponse | null): Array<ArRow & { customer: string; sessionId: string }> => {
  if (!report) return [];
  return report.customers.flatMap((customer) =>
    customer.rows.map((row) => ({
      ...row,
      customer: customer.company || customer.customer_code || customer.session_id,
      sessionId: customer.session_id,
    }))
  );
};

const AccountsReceivableView: React.FC = () => {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [debtType, setDebtType] = useState<ArDebtType>('All');
  const [dateType, setDateType] = useState<ArDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ArResponse | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      setCustomersLoading(true);
      try {
        setCustomers(await getCustomerList());
      } finally {
        setCustomersLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const generate = async () => {
    if (dateType === 'custom' && (!dateFrom || !dateTo)) {
      setError('Custom date range requires Date From and Date To');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await accountsReceivableService.getReport({
        customerId: selectedCustomer || undefined,
        debtType,
        dateType,
        dateFrom: dateType === 'custom' ? dateFrom : undefined,
        dateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setReport(payload);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load accounts receivable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, []);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: customer.company,
        keywords: [customer.company, customer.id],
      })),
    [customers]
  );
  const flattenedRows = useMemo(() => flattenRows(report), [report]);
  const isSingleCustomer = !!selectedCustomer;
  const selectedCustomerName = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomer)?.company || '';
  }, [customers, selectedCustomer]);

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-4">
      <div className="h-full grid grid-cols-12 gap-4 overflow-hidden">
        <aside className="col-span-12 lg:col-span-3 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Accounting Report</p>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Accounts Receivable</h2>
            </div>

            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Customer
              <div className="mt-1">
                {customersLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading customers...
                  </div>
                ) : (
                  <SearchableFilterSelect
                    value={selectedCustomer || undefined}
                    options={customerOptions}
                    placeholder="Search customer..."
                    allLabel="All Customers"
                    onChange={(value) => setSelectedCustomer(value || '')}
                  />
                )}
              </div>
            </label>

            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Debt Type
              <select
                value={debtType}
                onChange={(e) => setDebtType(e.target.value as ArDebtType)}
                className={`${INPUT_CLASS} mt-1`}
              >
                {debtTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Date Type
              <select
                value={dateType}
                onChange={(e) => setDateType(e.target.value as ArDateType)}
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
                  disabled={dateType !== 'custom'}
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
                  disabled={dateType !== 'custom'}
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">ACCOUNTS RECEIVABLE</h2>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{buildDateRangeLabel(report)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">As of: {new Date().toLocaleDateString('en-US')}</p>
              {isSingleCustomer && selectedCustomerName ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{selectedCustomerName}</p>
              ) : null}
            </div>

            <button type="button" className={BUTTON_BASE} onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
            {loading ? (
              <p className="text-sm text-slate-500">Loading accounts receivable...</p>
            ) : !report ? (
              <p className="text-sm text-slate-500">No report loaded.</p>
            ) : flattenedRows.length === 0 ? (
              <p className="text-sm text-slate-500">No outstanding balances found.</p>
            ) : (
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                    <tr>
                      {!isSingleCustomer ? <th className="px-3 py-2 text-left">Customer</th> : null}
                      <th className="px-3 py-2 text-left">Terms</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">DR/INV</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Amount Paid</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {flattenedRows.map((row, index) => (
                      <tr key={`${row.sessionId}-${row.reference}-${index}`}>
                        {!isSingleCustomer ? <td className="px-3 py-2">{row.customer || '-'}</td> : null}
                        <td className="px-3 py-2">{row.terms || '-'}</td>
                        <td className="px-3 py-2">{formatDate(row.date)}</td>
                        <td className="px-3 py-2">{row.reference || '-'}</td>
                        <td className="px-3 py-2 text-right">{peso.format(row.amount || 0)}</td>
                        <td className="px-3 py-2 text-right">{peso.format(row.amount_paid || 0)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{peso.format(row.balance || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
                    <tr>
                      <td className="px-3 py-3 text-rose-600" colSpan={isSingleCustomer ? 6 : 7}>
                        GRAND TOTAL BALANCE: {peso.format(report.grand_total_balance || 0)}
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

export default AccountsReceivableView;
