import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCcw, Search, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import {
  SalesReturnItem,
  SalesReturnRecord,
  SourceItem,
  salesReturnService,
} from '../services/salesReturnLocalApiService';
import { Contact } from '../types';
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import CustomerAutocomplete from './CustomerAutocomplete';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

/* -------------------------------------------------------------------------- */
/*  Confirmation Dialog                                                        */
/* -------------------------------------------------------------------------- */
const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Source Items Modal (pick items from linked Invoice/OR)                      */
/* -------------------------------------------------------------------------- */
const SourceItemsModal: React.FC<{
  open: boolean;
  sourceItems: SourceItem[];
  loading: boolean;
  onAdd: (item: SourceItem, qty: number) => void;
  onClose: () => void;
}> = ({ open, sourceItems, loading, onAdd, onClose }) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    if (open) {
      const defaults: Record<number, number> = {};
      sourceItems.forEach((si) => {
        defaults[si.source_item_id] = si.remaining_qty;
      });
      setQuantities(defaults);
    }
  }, [open, sourceItems]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Items from Source Document</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-500">Loading source items...</div>
          ) : sourceItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              No available items to return. All items have been fully returned or no source document is linked.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="px-3 py-2">Item Code</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2 text-right">Return Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sourceItems.map((si) => (
                  <tr key={si.source_item_id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2">{si.item_code}</td>
                    <td className="px-3 py-2">{si.description}</td>
                    <td className="px-3 py-2 text-right">{si.remaining_qty}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={si.remaining_qty}
                        value={quantities[si.source_item_id] ?? si.remaining_qty}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [si.source_item_id]: Math.max(1, Math.min(si.remaining_qty, Number(e.target.value) || 1)),
                          }))
                        }
                        className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{peso.format(si.unit_price)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onAdd(si, quantities[si.source_item_id] ?? si.remaining_qty)}
                        className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Create Credit Memo Modal                                                   */
/* -------------------------------------------------------------------------- */
const CreateModal: React.FC<{
  open: boolean;
  onCreated: (record: SalesReturnRecord) => void;
  onClose: () => void;
}> = ({ open, onCreated, onClose }) => {
  const [form, setForm] = useState({
    customer_id: '',
    invoice_refno: '',
    type: '',
    salesman: '',
    remark: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);

  useEffect(() => {
    if (open) {
      fetchContacts().then(setCustomers).catch(() => setCustomers([]));
    }
  }, [open]);

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const record = await salesReturnService.create(form as Record<string, unknown>);
      onCreated(record);
    } catch (err: any) {
      setError(err?.message || 'Failed to create credit memo');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">New Credit Memo</h3>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="block">
            <span className="text-slate-600 dark:text-slate-300 text-sm">Customer</span>
            <CustomerAutocomplete
              contacts={customers}
              selectedCustomer={selectedCustomer}
              onSelect={(customer) => {
                setSelectedCustomer(customer);
                setForm((f) => ({ ...f, customer_id: customer.id }));
              }}
              placeholder="Search customer..."
              inputClassName="border-slate-300 dark:border-slate-600"
            />
          </div>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-300">Invoice Refno (optional)</span>
            <input
              value={form.invoice_refno}
              onChange={(e) => setForm((f) => ({ ...f, invoice_refno: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              >
                <option value="">Select type</option>
                <option value="Invoice">Invoice</option>
                <option value="OR">OR (Delivery Receipt)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-300">Salesman</span>
            <input
              value={form.salesman}
              onChange={(e) => setForm((f) => ({ ...f, salesman: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </label>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-300">Remark</span>
            <textarea
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              rows={2}
              className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main Page                                                                  */
/* -------------------------------------------------------------------------- */
const SalesReturnPage: React.FC = () => {
  const today = new Date();
  const [rows, setRows] = useState<SalesReturnRecord[]>([]);
  const [selectedRefno, setSelectedRefno] = useState('');
  const [selected, setSelected] = useState<SalesReturnRecord | null>(null);
  const [items, setItems] = useState<SalesReturnItem[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [month, setMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(today.getFullYear()));

  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showSourceItems, setShowSourceItems] = useState(false);
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', message: '', confirmLabel: '', action: async () => {} });

  const isPending = selected?.lstatus?.toLowerCase() === 'pending' || selected?.lstatus === '';
  const isPosted = selected?.lstatus?.toLowerCase() === 'posted';

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await salesReturnService.list({ search, status, month, year, page, perPage });
      setRows(data.items);
      setTotalPages(Math.max(1, data.meta.total_pages || 1));

      if (!selectedRefno && data.items[0]?.lrefno) {
        setSelectedRefno(data.items[0].lrefno);
      } else if (selectedRefno && !data.items.some((r) => r.lrefno === selectedRefno)) {
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
  }, [search, status, month, year, page, perPage, selectedRefno]);

  const loadDetail = useCallback(
    async (refno: string) => {
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
    },
    []
  );

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

  /* ---- Actions ---- */
  const handleCreated = (record: SalesReturnRecord) => {
    setShowCreate(false);
    setSelectedRefno(record.lrefno);
    loadList();
  };

  const openSourceItemsModal = async () => {
    if (!selectedRefno) return;
    setShowSourceItems(true);
    setLoadingSource(true);
    try {
      const items = await salesReturnService.sourceItems(selectedRefno);
      setSourceItems(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load source items');
      setSourceItems([]);
    } finally {
      setLoadingSource(false);
    }
  };

  const handleAddSourceItem = async (si: SourceItem, qty: number) => {
    setActionLoading(true);
    try {
      await salesReturnService.addItem(selectedRefno, {
        item_code: si.item_code,
        part_no: si.part_no,
        brand: si.brand,
        description: si.description,
        unit_price: si.unit_price,
        qty,
        linv_refno: si.linv_refno,
        original_qty: si.original_qty,
        unit: si.unit,
        discount: si.discount,
      });
      // Refresh items and source items
      const [updatedItems, updatedSource] = await Promise.all([
        salesReturnService.items(selectedRefno),
        salesReturnService.sourceItems(selectedRefno),
      ]);
      setItems(updatedItems);
      setSourceItems(updatedSource);
      // Also refresh the list to update totals
      loadList();
    } catch (err: any) {
      setError(err?.message || 'Failed to add item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = (itemId: number) => {
    setConfirmAction({
      open: true,
      title: 'Delete Item',
      message: 'Are you sure you want to remove this item from the credit memo?',
      confirmLabel: 'Delete',
      action: async () => {
        setActionLoading(true);
        try {
          await salesReturnService.deleteItem(itemId);
          const updatedItems = await salesReturnService.items(selectedRefno);
          setItems(updatedItems);
          loadList();
        } catch (err: any) {
          setError(err?.message || 'Failed to delete item');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handlePost = () => {
    setConfirmAction({
      open: true,
      title: 'Post Credit Memo',
      message:
        'Posting will create a ledger credit entry and restore inventory quantities. Are you sure you want to post this credit memo?',
      confirmLabel: 'Post',
      action: async () => {
        setActionLoading(true);
        try {
          const updated = await salesReturnService.post(selectedRefno);
          setSelected(updated);
          loadList();
        } catch (err: any) {
          setError(err?.message || 'Failed to post credit memo');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleUnpost = () => {
    setConfirmAction({
      open: true,
      title: 'Unpost Credit Memo',
      message:
        'Unposting will remove the ledger and inventory log entries created during posting. Are you sure?',
      confirmLabel: 'Unpost',
      action: async () => {
        setActionLoading(true);
        try {
          const updated = await salesReturnService.unpost(selectedRefno);
          setSelected(updated);
          loadList();
        } catch (err: any) {
          setError(err?.message || 'Failed to unpost credit memo');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleConfirmAction = async () => {
    await confirmAction.action();
    setConfirmAction((prev) => ({ ...prev, open: false }));
  };

  /* ---- Status badge ---- */
  const statusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'posted':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'canceled':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="h-full grid grid-cols-1 xl:grid-cols-[460px_1fr] gap-4 p-4">
        {/* ---- Left Panel: List ---- */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sales Return</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
                <button
                  onClick={() => loadList()}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
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

        {/* ---- Right Panel: Detail ---- */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {selected?.lcredit_no ? `CM ${selected.lcredit_no}` : 'Sales Return Details'}
              </h2>
              {selected && (
                <div className="flex items-center gap-2">
                  {/* Post / Unpost buttons */}
                  {isPending && items.length > 0 && (
                    <button
                      onClick={handlePost}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Post
                    </button>
                  )}
                  {isPosted && (
                    <button
                      onClick={handleUnpost}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Unpost
                    </button>
                  )}
                  {/* Add Items button (only for Pending) */}
                  {isPending && (
                    <button
                      onClick={openSourceItemsModal}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Items
                    </button>
                  )}
                </div>
              )}
            </div>

            {selected ? (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
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
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(selected.lstatus)}`}>
                    {selected.lstatus || 'Pending'}
                  </span>
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
                {selected.lremark && (
                  <div className="md:col-span-3">
                    <div className="text-slate-500 dark:text-slate-400">Remark</div>
                    <div className="font-medium">{selected.lremark}</div>
                  </div>
                )}
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
                  {isPending && <th className="px-3 py-2 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {!selectedRefno || (!loadingDetail && items.length === 0) ? (
                  <tr>
                    <td colSpan={isPending ? 7 : 6} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
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
                      {isPending && (
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={actionLoading}
                            className="text-red-500 hover:text-red-700 disabled:opacity-40"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right">
                      {items.reduce((sum, i) => sum + i.qty, 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right">
                      {peso.format(items.reduce((sum, i) => sum + i.amount, 0))}
                    </td>
                    {isPending && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateModal open={showCreate} onCreated={handleCreated} onClose={() => setShowCreate(false)} />

      <SourceItemsModal
        open={showSourceItems}
        sourceItems={sourceItems}
        loading={loadingSource}
        onAdd={handleAddSourceItem}
        onClose={() => setShowSourceItems(false)}
      />

      <ConfirmDialog
        open={confirmAction.open}
        title={confirmAction.title}
        message={confirmAction.message}
        confirmLabel={confirmAction.confirmLabel}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default SalesReturnPage;
