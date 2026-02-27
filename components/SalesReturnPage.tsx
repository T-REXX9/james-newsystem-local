import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';
import { SalesReturnItem, SalesReturnRecord, salesReturnService } from '../services/salesReturnLocalApiService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const SalesReturnPage: React.FC = () => {
  const today = new Date();
  const [rows, setRows] = useState<SalesReturnRecord[]>([]);
  const [selectedRefno, setSelectedRefno] = useState('');
  const [selected, setSelected] = useState<SalesReturnRecord | null>(null);
  const [items, setItems] = useState<SalesReturnItem[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [month, setMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(today.getFullYear()));

  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  const loadList = async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await salesReturnService.list({
        search,
        status,
        month,
        year,
        page,
        perPage,
      });
      setRows(data.items);
      setTotalPages(Math.max(1, data.meta.total_pages || 1));

      if (!selectedRefno && data.items[0]?.lrefno) {
        setSelectedRefno(data.items[0].lrefno);
      } else if (selectedRefno && !data.items.some((record) => record.lrefno === selectedRefno)) {
        setSelectedRefno(data.items[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load sales return records');
      setRows([]);
      setTotalPages(1);
      setSelectedRefno('');
      setSelected(null);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (refno: string) => {
    if (!refno) {
      setSelected(null);
      setItems([]);
      return;
    }

    setLoadingDetail(true);
    setError('');
    try {
      const [header, detailItems] = await Promise.all([
        salesReturnService.show(refno),
        salesReturnService.items(refno),
      ]);
      setSelected(header);
      setItems(detailItems);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sales return detail');
      setSelected(null);
      setItems([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadList();
  }, [search, status, month, year, page]);

  useEffect(() => {
    loadDetail(selectedRefno);
  }, [selectedRefno]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.qty += Number(row.total_qty || 0);
        acc.amount += Number(row.total_amount || 0);
        return acc;
      },
      { qty: 0, amount: 0 }
    );
  }, [rows]);

  return (
    <div className="h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="h-full grid grid-cols-1 xl:grid-cols-[460px_1fr] gap-4 p-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sales Return</h1>
              <button
                onClick={() => loadList()}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search CM no, invoice, customer..."
                className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-2"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Posted">Posted</option>
                <option value="Canceled">Canceled</option>
              </select>
              <select
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-2"
              >
                {Array.from({ length: 12 }).map((_, idx) => {
                  const val = String(idx + 1).padStart(2, '0');
                  return (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
              <input
                value={year}
                onChange={(e) => {
                  setYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                  setPage(1);
                }}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-2"
                placeholder="Year"
              />
            </div>
          </div>

          <div className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            {loadingList ? 'Loading...' : `${rows.length} record(s) on this page`} | Qty: {totals.qty.toFixed(2)} | Amount:{' '}
            {peso.format(totals.amount)}
          </div>

          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 && !loadingList ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No sales return records found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">CM No.</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.lrefno}
                      onClick={() => setSelectedRefno(row.lrefno)}
                      className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                        selectedRefno === row.lrefno ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2">{formatDate(row.ldate)}</td>
                      <td className="px-3 py-2 font-semibold">{row.lcredit_no || 'N/A'}</td>
                      <td className="px-3 py-2">{row.customer_name}</td>
                      <td className="px-3 py-2 text-right">{peso.format(row.total_amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loadingList}
              className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loadingList}
              className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {selected?.lcredit_no ? `CM ${selected.lcredit_no}` : 'Sales Return Details'}
            </h2>
            {selected ? (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Customer</div>
                  <div className="font-medium">{selected.customer_name}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Date</div>
                  <div className="font-medium">{formatDate(selected.ldate)}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Status</div>
                  <div className="font-medium">{selected.lstatus || 'Pending'}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Invoice</div>
                  <div className="font-medium">{selected.linvoice_no || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Salesperson</div>
                  <div className="font-medium">{selected.sales_person || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Ship/Tracking</div>
                  <div className="font-medium">
                    {selected.ship_via || 'N/A'} {selected.tracking_no ? `• ${selected.tracking_no}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Select a sales return record from the list.</p>
            )}
          </div>

          {error ? (
            <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
          ) : null}

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Part No</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {!selectedRefno || (!loadingDetail && items.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                      {loadingDetail ? 'Loading items...' : 'No line items for this record.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{item.item_code || 'N/A'}</td>
                      <td className="px-3 py-2">{item.part_no || 'N/A'}</td>
                      <td className="px-3 py-2">
                        <div>{item.description || 'N/A'}</div>
                        {item.brand || item.location || item.remark ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {[item.brand, item.location, item.remark].filter(Boolean).join(' • ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">{item.qty.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{peso.format(item.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{peso.format(item.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReturnPage;

