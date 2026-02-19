import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Circle, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import {
  dailyCollectionService,
  DailyCollectionApproverLog,
  DailyCollectionHeader,
  DailyCollectionItem,
  CollectionCustomer,
  CollectionUnpaidRow,
} from '../services/dailyCollectionService';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const toDateInput = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const statusTone = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === 'approved' || normalized === 'posted') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'rejected' || normalized === 'cancelled') return 'bg-rose-100 text-rose-700';
  if (normalized === 'submitted') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
};

const DailyCollectionEntryView: React.FC = () => {
  const [headers, setHeaders] = useState<DailyCollectionHeader[]>([]);
  const [selectedRefno, setSelectedRefno] = useState<string>('');
  const [selectedHeader, setSelectedHeader] = useState<DailyCollectionHeader | null>(null);
  const [items, setItems] = useState<DailyCollectionItem[]>([]);
  const [approverLogs, setApproverLogs] = useState<DailyCollectionApproverLog[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const [customers, setCustomers] = useState<CollectionCustomer[]>([]);
  const [unpaidRows, setUnpaidRows] = useState<CollectionUnpaidRow[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Record<string, boolean>>({});

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [workingAction, setWorkingAction] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    customerId: '',
    type: 'Cash',
    bank: '',
    checkNo: '',
    checkDate: toDateInput(new Date().toISOString()),
    amount: '',
    status: 'Cleared',
    collectDate: toDateInput(new Date().toISOString()),
    remarks: '',
  });

  const selectedAmount = useMemo(() => {
    return unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  }, [unpaidRows, selectedTransactions]);

  const fetchList = async () => {
    setListLoading(true);
    setError('');
    try {
      const rows = await dailyCollectionService.listCollections({
        search,
        status: statusFilter,
        dateFrom,
        dateTo,
      });
      setHeaders(rows);
      if (!selectedRefno && rows[0]?.lrefno) {
        setSelectedRefno(rows[0].lrefno);
      } else if (selectedRefno && !rows.some((row) => row.lrefno === selectedRefno)) {
        setSelectedRefno(rows[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load collections');
    } finally {
      setListLoading(false);
    }
  };

  const fetchDetail = async (refno: string) => {
    if (!refno) return;
    setDetailLoading(true);
    setError('');
    setSelectedTransactions({});
    setSelectedItemIds([]);
    try {
      const [header, collectionItems, logs] = await Promise.all([
        dailyCollectionService.getCollection(refno),
        dailyCollectionService.getCollectionItems(refno),
        dailyCollectionService.getApproverLogs(refno),
      ]);
      setSelectedHeader(header);
      setItems(collectionItems);
      setApproverLogs(logs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load collection detail');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    dailyCollectionService.getCustomers('').then(setCustomers).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    fetchList();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedRefno) {
      setSelectedHeader(null);
      setItems([]);
      setApproverLogs([]);
      return;
    }
    fetchDetail(selectedRefno);
  }, [selectedRefno]);

  useEffect(() => {
    if (!form.customerId) {
      setUnpaidRows([]);
      return;
    }
    dailyCollectionService
      .getUnpaidTransactions(form.customerId)
      .then(setUnpaidRows)
      .catch(() => setUnpaidRows([]));
  }, [form.customerId]);

  useEffect(() => {
    if (selectedAmount > 0) {
      setForm((prev) => ({ ...prev, amount: selectedAmount.toFixed(2) }));
    }
  }, [selectedAmount]);

  const handleCreate = async () => {
    setWorkingAction('create');
    setError('');
    try {
      const created = await dailyCollectionService.createCollection();
      await fetchList();
      setSelectedRefno(created.lrefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to create DCR');
    } finally {
      setWorkingAction('');
    }
  };

  const handleAction = async (action: 'submitrecord' | 'approverecord' | 'disapproverecord' | 'cancelrecord' | 'postrecord' | 'posttoledger') => {
    if (!selectedRefno) return;
    let remarks = '';
    if (action === 'disapproverecord') {
      remarks = window.prompt('Reason for disapproval', '') || '';
    }
    setWorkingAction(action);
    setError('');
    try {
      await dailyCollectionService.runAction(selectedRefno, action, remarks);
      await Promise.all([fetchList(), fetchDetail(selectedRefno)]);
    } catch (err: any) {
      setError(err?.message || `Failed to run ${action}`);
    } finally {
      setWorkingAction('');
    }
  };

  const handlePostSelectedItems = async () => {
    if (!selectedRefno || selectedItemIds.length === 0) return;
    setWorkingAction('post-items');
    setError('');
    try {
      await dailyCollectionService.postItems(selectedRefno, selectedItemIds);
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to post selected lines');
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedRefno || !window.confirm('Delete this payment line?')) return;
    setWorkingAction(`delete-${itemId}`);
    setError('');
    try {
      await dailyCollectionService.deleteItem(itemId);
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete payment line');
    } finally {
      setWorkingAction('');
    }
  };

  const handleSavePayment = async () => {
    if (!selectedRefno) return;
    if (!form.customerId) {
      setError('Customer is required');
      return;
    }
    const amount = Number(form.amount || 0);
    if (!(amount > 0)) {
      setError('Amount must be greater than 0');
      return;
    }
    if (!form.collectDate) {
      setError('Collection date is required');
      return;
    }

    const transactions = unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .map((row) => ({
        transaction_type: row.transactionType,
        transaction_refno: row.lrefno,
        transaction_no: row.linvoice_no,
        transaction_amount: Number(row.totalAmount || 0),
      }));

    setSavingPayment(true);
    setError('');
    try {
      await dailyCollectionService.addPayment(selectedRefno, {
        customerId: form.customerId,
        type: form.type,
        bank: form.bank,
        checkNo: form.checkNo,
        checkDate: form.checkDate,
        amount,
        status: form.status,
        remarks: form.remarks,
        collectDate: form.collectDate,
        transactions,
      });
      setForm((prev) => ({
        ...prev,
        bank: '',
        checkNo: '',
        amount: '',
        remarks: '',
      }));
      setSelectedTransactions({});
      await Promise.all([fetchDetail(selectedRefno), fetchList()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to add payment line');
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-4">
      <div className="h-full grid grid-cols-12 gap-4 overflow-hidden">
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 h-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daily Collection</h2>
              <button
                type="button"
                onClick={handleCreate}
                disabled={workingAction === 'create'}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Plus size={14} /> New DCR
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search DCR no / refno"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option>All</option>
                <option>Pending</option>
                <option>Submitted</option>
                <option>Approved</option>
                <option>Rejected</option>
                <option>Posted</option>
                <option>Cancelled</option>
              </select>
              <button
                type="button"
                onClick={fetchList}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <RefreshCcw size={14} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading && <div className="p-4 text-sm text-slate-500">Loading collections...</div>}
            {!listLoading && headers.length === 0 && <div className="p-4 text-sm text-slate-500">No collection record found.</div>}
            {headers.map((row) => (
              <button
                key={row.lrefno}
                type="button"
                onClick={() => setSelectedRefno(row.lrefno)}
                className={`w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 ${
                  selectedRefno === row.lrefno ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{row.lcolection_no || row.lrefno}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.lstatus)}`}>
                    {row.lstatus || 'Pending'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{toDateInput(row.ldatetime) || '-'}</p>
                <p className="text-xs text-slate-500">{peso.format(Number(row.total_amt || 0))}</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-8 xl:col-span-9 h-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          {!selectedRefno && <div className="h-full grid place-items-center text-slate-400">Select or create a DCR record</div>}

          {selectedRefno && (
            <>
              <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedHeader?.lcolection_no || selectedRefno}</h3>
                    <p className="text-sm text-slate-500">Refno: {selectedRefno}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleAction('submitrecord')} disabled={!!workingAction} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Submit</button>
                    <button onClick={() => handleAction('approverecord')} disabled={!!workingAction} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                    <button onClick={() => handleAction('disapproverecord')} disabled={!!workingAction} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Disapprove</button>
                    <button onClick={() => handleAction('cancelrecord')} disabled={!!workingAction} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
                    <button onClick={() => handleAction('postrecord')} disabled={!!workingAction} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60">Post</button>
                    <button onClick={() => handleAction('posttoledger')} disabled={!!workingAction} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700">Post to Ledger</button>
                  </div>
                </div>
                {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Add Payment Line</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
                      <select
                        value={form.customerId}
                        onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="">Select customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.code ? `${customer.code} - ` : ''}{customer.company}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option>Cash</option>
                        <option>Check</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Bank</label>
                      <input value={form.bank} onChange={(e) => setForm((prev) => ({ ...prev, bank: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Check No.</label>
                      <input value={form.checkNo} onChange={(e) => setForm((prev) => ({ ...prev, checkNo: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Check Date</label>
                      <input type="date" value={form.checkDate} onChange={(e) => setForm((prev) => ({ ...prev, checkDate: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Collection Date</label>
                      <input type="date" value={form.collectDate} onChange={(e) => setForm((prev) => ({ ...prev, collectDate: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                      <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                        <option>Cleared</option>
                        <option>Pending</option>
                        <option>Bounced</option>
                        <option>Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Remarks</label>
                      <input value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800">
                      <span>Unpaid Invoice / Order Slip</span>
                      <span>{peso.format(selectedAmount)}</span>
                    </div>
                    <div className="max-h-44 overflow-y-auto">
                      {form.customerId && unpaidRows.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No unpaid invoices/order slips.</div>}
                      {!form.customerId && <div className="px-3 py-2 text-xs text-slate-500">Pick a customer to load unpaid transactions.</div>}
                      {unpaidRows.map((row) => {
                        const key = `${row.transactionType}:${row.lrefno}`;
                        const checked = !!selectedTransactions[key];
                        return (
                          <label key={key} className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              {checked ? <CheckCircle2 size={15} className="text-blue-600" /> : <Circle size={15} className="text-slate-400" />}
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setSelectedTransactions((prev) => ({ ...prev, [key]: e.target.checked }))}
                                className="hidden"
                              />
                              <div>
                                <p className="font-medium text-slate-700 dark:text-slate-200">{row.linvoice_no}</p>
                                <p className="text-xs text-slate-500">{row.transactionType}</p>
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{peso.format(row.totalAmount || 0)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSavePayment}
                      disabled={savingPayment}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingPayment ? 'Saving...' : 'Add Payment'}
                    </button>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Lines</h4>
                    <button
                      type="button"
                      onClick={handlePostSelectedItems}
                      disabled={selectedItemIds.length === 0 || !!workingAction}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Post Selected
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/70">
                        <tr className="text-left text-xs uppercase text-slate-500">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Transactions</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailLoading && (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-slate-500">Loading payment lines...</td>
                          </tr>
                        )}
                        {!detailLoading && items.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-slate-500">No payment lines yet.</td>
                          </tr>
                        )}
                        {!detailLoading && items.map((item, index) => {
                          const posted = item.lpost === 1 || item.lcollection_status === 'Posted';
                          return (
                            <tr key={item.lid} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2">
                                {!posted && (
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.includes(item.lid)}
                                    onChange={(e) => setSelectedItemIds((prev) => (e.target.checked ? [...prev, item.lid] : prev.filter((id) => id !== item.lid)))}
                                  />
                                )}
                                {posted && <Calendar size={14} className="text-emerald-600" />}
                              </td>
                              <td className="px-3 py-2">{item.lcustomer_fname || item.lcustomer}</td>
                              <td className="px-3 py-2">{item.ltype}</td>
                              <td className="px-3 py-2 text-xs text-slate-500">{item.ltransaction_no || '-'}</td>
                              <td className="px-3 py-2 font-medium">{peso.format(item.lamt || 0)}</td>
                              <td className="px-3 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.lcollection_status || item.lstatus || 'Pending')}`}>
                                  {item.lcollection_status || item.lstatus || 'Pending'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.lid)}
                                  disabled={!!workingAction || posted}
                                  className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                  title={posted ? 'Posted lines cannot be deleted' : 'Delete line'}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Approver Logs</h4>
                  {approverLogs.length === 0 && <p className="text-xs text-slate-500">No approver logs yet.</p>}
                  {approverLogs.length > 0 && (
                    <div className="space-y-2">
                      {approverLogs.map((log) => (
                        <div key={log.lid} className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {(log.staff_fName || '') + ' ' + (log.staff_lName || '') || log.lstaff_id}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(log.lstatus || 'Pending')}`}>
                              {log.lstatus || 'Pending'}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-500">{log.lremarks || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default DailyCollectionEntryView;
