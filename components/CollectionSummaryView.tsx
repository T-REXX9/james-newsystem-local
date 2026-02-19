import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCcw, Search } from 'lucide-react';
import {
  CollectionSummaryDateType,
  CollectionSummaryResponse,
  CollectionCustomer,
  dailyCollectionService,
} from '../services/dailyCollectionService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: CollectionSummaryDateType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

const formatDate = (value?: string): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US');
};

const CollectionSummaryView: React.FC = () => {
  const [dateType, setDateType] = useState<CollectionSummaryDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bank, setBank] = useState('');
  const [checkStatus, setCheckStatus] = useState('');
  const [collectionType, setCollectionType] = useState<'All' | 'Cash' | 'Cheque'>('All');

  const [customers, setCustomers] = useState<CollectionCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<CollectionSummaryResponse | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    dailyCollectionService
      .getCustomers(debouncedCustomerSearch)
      .then((rows) => {
        if (!active) return;
        setCustomers(rows);
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
  }, [debouncedCustomerSearch]);

  const selectedCustomerLabel = useMemo(() => {
    const row = customers.find((item) => item.id === selectedCustomerId);
    return row?.company || '';
  }, [customers, selectedCustomerId]);

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
        bank: bank.trim() || undefined,
        checkStatus: checkStatus.trim() || undefined,
        customerId: selectedCustomerId || undefined,
        collectionType,
        limit: 200,
      });
      setReport(payload);
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

  useEffect(() => {
    if (report === null) return;
    const timer = window.setTimeout(() => {
      generate();
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {selectedCustomerLabel && <p className="text-xs text-slate-500">Selected: {selectedCustomerLabel}</p>}
          </div>

          <div className="flex-1 overflow-auto">
            {loadingCustomers ? (
              <p className="p-4 text-sm text-slate-500">Loading customers...</p>
            ) : customers.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No customers found.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                <li>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId('')}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      selectedCustomerId === '' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 pl-3' : ''
                    }`}
                  >
                    All Customers
                  </button>
                </li>
                {customers.map((customer) => {
                  const active = customer.id === selectedCustomerId;
                  return (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          active ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 pl-3' : ''
                        }`}
                      >
                        <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{customer.company || 'Unnamed Customer'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{customer.code || customer.id}</p>
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
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Collection Summary</h2>
                <p className="text-sm text-slate-500">
                  {report ? `${formatDate(report.date_from)} to ${formatDate(report.date_to)}` : 'Generate report'}
                </p>
              </div>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Generate
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date Type
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as CollectionSummaryDateType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  {dateTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Collection Type
                <select
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value as 'All' | 'Cash' | 'Cheque')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="All">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Bank
                <input
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                />
              </label>

              <label className="text-sm text-slate-600 dark:text-slate-300">
                Check Status
                <input
                  value={checkStatus}
                  onChange={(e) => setCheckStatus(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                />
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

          <div className="flex-1 overflow-auto p-4 space-y-6">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {loading ? <p className="text-sm text-slate-500">Generating report...</p> : null}

            {!report || loading ? null : (
              <>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Collection Summary</h3>
                  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-left">DCR No.</th>
                          <th className="px-3 py-2 text-right">Cash</th>
                          <th className="px-3 py-2 text-right">Check</th>
                          <th className="px-3 py-2 text-right">T/T</th>
                          <th className="px-3 py-2 text-right">Less</th>
                          <th className="px-3 py-2 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.collection_items.length === 0 ? (
                          <tr>
                            <td className="px-3 py-5 text-center text-slate-500" colSpan={8}>No collection rows found.</td>
                          </tr>
                        ) : (
                          report.collection_items.map((row, index) => (
                            <tr key={`${row.dcr_no}-${index}`}>
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
                      <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
                        <tr>
                          <td className="px-3 py-2" colSpan={3}>Totals</td>
                          <td className="px-3 py-2 text-right">{peso.format(report.collection_totals.cash || 0)}</td>
                          <td className="px-3 py-2 text-right">{peso.format(report.collection_totals.check || 0)}</td>
                          <td className="px-3 py-2 text-right">{peso.format(report.collection_totals.tt || 0)}</td>
                          <td className="px-3 py-2 text-right">{peso.format(report.collection_totals.less || 0)}</td>
                          <td className="px-3 py-2" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Debit Memo (DM) Summary</h3>
                  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-left">DM No.</th>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.debit_items.length === 0 ? (
                          <tr>
                            <td className="px-3 py-5 text-center text-slate-500" colSpan={5}>No debit memo rows found.</td>
                          </tr>
                        ) : (
                          report.debit_items.map((row) => (
                            <tr key={row.lrefno || row.ldm_no}>
                              <td className="px-3 py-2">{row.ldm_no || '-'}</td>
                              <td className="px-3 py-2">{row.lcustomer_code || '-'}</td>
                              <td className="px-3 py-2">{row.lcustomer_name || '-'}</td>
                              <td className="px-3 py-2">{formatDate(row.ldatetime)}</td>
                              <td className="px-3 py-2 text-right">{peso.format(row.lamount || 0)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-semibold">
                        <tr>
                          <td className="px-3 py-2" colSpan={4}>Total</td>
                          <td className="px-3 py-2 text-right">{peso.format(report.debit_totals.amount || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CollectionSummaryView;
