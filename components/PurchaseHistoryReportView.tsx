import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCcw, Search } from 'lucide-react';
import {
  PurchaseHistoryCustomer,
  PurchaseHistoryDateType,
  PurchaseHistoryReport,
  purchaseHistoryReportService,
} from '../services/purchaseHistoryReportService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const dateTypeOptions: Array<{ value: PurchaseHistoryDateType; label: string }> = [
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

const PurchaseHistoryReportView: React.FC = () => {
  const [customers, setCustomers] = useState<PurchaseHistoryCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [dateType, setDateType] = useState<PurchaseHistoryDateType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<PurchaseHistoryReport | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(customerSearch.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let active = true;
    setLoadingCustomers(true);
    purchaseHistoryReportService
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

  const summary = useMemo(() => {
    const rows = report?.items || [];
    const totalAmount = rows.reduce((sum, row) => sum + (row.line_total || 0), 0);
    const totalQty = rows.reduce((sum, row) => sum + (row.lqty || 0), 0);
    const totalReturnQty = rows.reduce((sum, row) => sum + (row.return_qty || 0), 0);

    const partNoMap = new Map<string, { partNo: string; desc: string; qty: number }>();
    rows.forEach((row) => {
      const key = (row.lpartno || row.litemcode || '').trim();
      if (!key) return;
      const current = partNoMap.get(key) || { partNo: row.lpartno || row.litemcode, desc: row.ldesc || '', qty: 0 };
      current.qty += row.lqty || 0;
      if (!current.desc && row.ldesc) current.desc = row.ldesc;
      partNoMap.set(key, current);
    });

    const topPartNos = Array.from(partNoMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12);

    return {
      totalAmount,
      totalQty,
      totalReturnQty,
      uniqueItems: partNoMap.size,
      topPartNos,
    };
  }, [report]);

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
      const payload = await purchaseHistoryReportService.getReport({
        customerId: selectedCustomerId,
        dateType,
        customDateFrom: dateType === 'custom' ? dateFrom : undefined,
        customDateTo: dateType === 'custom' ? dateTo : undefined,
      });
      setReport(payload);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load purchase history report');
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
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Purchase History Report</h2>
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

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date Type
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as PurchaseHistoryDateType)}
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

              <div className="grid grid-cols-2 gap-2 md:col-span-3 xl:col-span-1">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-xs text-slate-500">Rows</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{report?.items.length || 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-xs text-slate-500">Unique Part Nos</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.uniqueItems}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {loading ? (
              <p className="text-sm text-slate-500">Loading purchase history...</p>
            ) : !report ? (
              <p className="text-sm text-slate-500">No report loaded.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-xs text-slate-500">Total Amount</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{peso.format(summary.totalAmount)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-xs text-slate-500">Total Qty</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{summary.totalQty.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-xs text-slate-500">Returned Qty</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{summary.totalReturnQty.toLocaleString()}</p>
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Trans No.</th>
                        <th className="px-3 py-2 text-left">Item Code</th>
                        <th className="px-3 py-2 text-left">Part No.</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Brand</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Return</th>
                        <th className="px-3 py-2 text-right">Net</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.items.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-3 py-6 text-center text-slate-500">No purchase history rows found.</td>
                        </tr>
                      ) : (
                        report.items.map((row, idx) => (
                          <tr key={`${row.source_refno}-${row.litemcode}-${idx}`}>
                            <td className="px-3 py-2">{formatDate(row.ldate)}</td>
                            <td className="px-3 py-2">{row.source_type || '-'}</td>
                            <td className="px-3 py-2">{row.source_no || '-'}</td>
                            <td className="px-3 py-2">{row.litemcode || '-'}</td>
                            <td className="px-3 py-2">{row.lpartno || '-'}</td>
                            <td className="px-3 py-2">{row.ldesc || '-'}</td>
                            <td className="px-3 py-2">{row.lbrand || '-'}</td>
                            <td className="px-3 py-2 text-right">{(row.lqty || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{(row.return_qty || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{(row.net_qty || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{peso.format(row.lprice || 0)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{peso.format(row.line_total || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Top Part No.</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Total Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summary.topPartNos.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">No part-no totals available.</td>
                        </tr>
                      ) : (
                        summary.topPartNos.map((row, idx) => (
                          <tr key={`${row.partNo}-${idx}`}>
                            <td className="px-3 py-2">{row.partNo}</td>
                            <td className="px-3 py-2">{row.desc || '-'}</td>
                            <td className="px-3 py-2 text-right font-semibold">{row.qty.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PurchaseHistoryReportView;
