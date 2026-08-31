import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, Search } from 'lucide-react';
import { RecoveryItem, getAllRecycleBinItems, restoreRecycleBinItem } from '../services/recycleBinService';

const TYPE_LABELS: Record<string, string> = {
  contact: 'Customer',
  product: 'Product',
  purchase_request: 'Purchase Request',
  purchase_order: 'Purchase Order',
  receiving_report: 'Receiving Report',
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Deleted Records' },
  { value: 'contact', label: 'Customers' },
  { value: 'product', label: 'Products' },
  { value: 'purchase_request', label: 'Purchase Requests' },
  { value: 'purchase_order', label: 'Purchase Orders' },
  { value: 'receiving_report', label: 'Receiving Reports' },
];

const formatType = (item: RecoveryItem): string => item.module || TYPE_LABELS[item.item_type] || item.item_type;

const formatDeletedAt = (value: string): string => {
  if (!value) return 'No delete date recorded';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function RecycleBinView() {
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [restoringId, setRestoringId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAllRecycleBinItems()
      .then(rows => { if (active) setItems(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load recovery records'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const handleRestore = async (item: RecoveryItem) => {
    setRestoringId(item.id);
    setError('');
    try {
      await restoreRecycleBinItem(item);
      setRevision(n => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to restore deleted record');
    } finally {
      setRestoringId('');
    }
  };

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      if (typeFilter !== 'all' && item.item_type !== typeFilter) return false;
      if (!needle) return true;
      return [
        item.label,
        item.item_id,
        item.record_number,
        item.module,
        item.status,
        item.delete_reason,
      ].some(value => String(value || '').toLowerCase().includes(needle));
    });
  }, [items, search, typeFilter]);

  const counts = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc.all = (acc.all || 0) + 1;
      acc[item.item_type] = (acc[item.item_type] || 0) + 1;
      return acc;
    }, { all: 0 });
  }, [items]);

  return (
    <section className="h-full overflow-y-auto bg-[#f7f9fc] p-5 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Recycle Bin</h1>
            <p className="mt-1 text-sm text-slate-500">Deleted records from customers, products, purchase requests, purchase orders, and receiving reports.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search deleted record number, name, status, or reason" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </div>
          <select aria-label="Filter deleted record type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            {TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label} ({counts[option.value] || 0})</option>
            ))}
          </select>
        </div>

        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        {loading ? (
          <p role="status" className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading recovery records...</p>
        ) : !error && filteredItems.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No deleted records found.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Deleted</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <strong className="block text-slate-900">{item.record_number || item.label || item.item_id}</strong>
                        <span className="text-xs text-slate-500">{item.item_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{formatType(item)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.status || 'Deleted'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDeletedAt(item.deleted_at)}</td>
                      <td className="max-w-[260px] px-4 py-3 text-slate-600">{item.delete_reason || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={restoringId === item.id}
                          onClick={() => handleRestore(item)}
                          className="ml-auto inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${restoringId === item.id ? 'animate-spin' : ''}`} />
                          {restoringId === item.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </section>
  );
}
