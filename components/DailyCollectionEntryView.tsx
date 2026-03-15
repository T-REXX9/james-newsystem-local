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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [workingAction, setWorkingAction] = useState('');
  const [error, setError] = useState('');
  const [showApproverLogsModal, setShowApproverLogsModal] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    type: 'Cash',
    bank: '',
    checkNo: '',
    checkDate: toDateInput(new Date().toISOString()),
    amount: '',
    status: 'Received',
    collectDate: toDateInput(new Date().toISOString()),
    remarks: '',
  });

  const selectedAmount = useMemo(() => {
    return unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  }, [unpaidRows, selectedTransactions]);

  const totalCheck = useMemo(() => items.filter((i) => i.ltype === 'Check').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const totalTT = useMemo(() => items.filter((i) => i.ltype === 'TT').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const totalCash = useMemo(() => items.filter((i) => i.ltype === 'Cash').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const grandTotal = useMemo(() => items.reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);

  const fetchList = async () => {
    setListLoading(true);
    setError('');
    try {
      let dateFrom = '';
      let dateTo = '';
      if (filterMonth !== 'All') {
        const year = parseInt(filterYear, 10);
        const month = parseInt(filterMonth, 10);
        if (!Number.isNaN(year) && year >= 2000 && year <= 2099) {
          dateFrom = `${year}-${filterMonth}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          dateTo = `${year}-${filterMonth}-${String(lastDay).padStart(2, '0')}`;
        }
      }
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
  }, [statusFilter, filterMonth, filterYear]);

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

  const handleDeleteSelectedItems = async () => {
    if (!selectedRefno || selectedItemIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.length} selected payment line(s)?`)) return;
    setWorkingAction('delete-selected');
    setError('');
    try {
      for (const itemId of selectedItemIds) {
        await dailyCollectionService.deleteItem(itemId);
      }
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete selected lines');
    } finally {
      setWorkingAction('');
    }
  };

  const handleTypeChange = (newType: string) => {
    let autoStatus = 'Received';
    if (newType === 'Check') autoStatus = 'Pending';
    else if (newType === 'TT') autoStatus = 'Deposited';
    else if (newType === 'Cash') autoStatus = 'Received';
    setForm((prev) => ({ ...prev, type: newType, status: autoStatus }));
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

  const canAddPayment = selectedHeader?.lstatus === 'Pending' || selectedHeader?.lstatus === 'Submitted' || selectedHeader?.lstatus === 'Posted';

  const renderStatusButtons = () => {
    const status = selectedHeader?.lstatus;
    const buttons: React.ReactNode[] = [];

    if (status === 'Pending') {
      buttons.push(
        <button key="submit" onClick={() => handleAction('submitrecord')} disabled={!!workingAction} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">For Approval</button>,
      );
    }
    if (status === 'Submitted') {
      buttons.push(
        <button key="approve" onClick={() => handleAction('approverecord')} disabled={!!workingAction} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>,
        <button key="disapprove" onClick={() => handleAction('disapproverecord')} disabled={!!workingAction} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Disapprove</button>,
      );
    }
    if (status === 'Approved') {
      buttons.push(
        <button key="post" onClick={() => handleAction('postrecord')} disabled={!!workingAction} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60">Post</button>,
        <button key="postledger" onClick={() => handleAction('posttoledger')} disabled={!!workingAction} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700">Post to Ledger</button>,
      );
    }
    if (status === 'Posted') {
      buttons.push(
        <button key="print" onClick={() => window.print()} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700">Print</button>,
      );
    }

    return buttons;
  };

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-2">
      <div className="h-full grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Sidebar - Narrow DCR List */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 h-full overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={workingAction === 'create'}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Plus size={14} /> Create New
                </button>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded border border-slate-200 px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="All">All</option>
                  {MONTH_NAMES.map((name, idx) => {
                    const val = String(idx + 1).padStart(2, '0');
                    return <option key={val} value={val}>{name.substring(0, 3)}</option>;
                  })}
                </select>
                <input
                  type="number"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-16 rounded border border-slate-200 px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  min="2000"
                  max="2099"
                />
              </div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search DCR no / refno"
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading && <div className="p-3 text-xs text-slate-500">Loading collections...</div>}
            {!listLoading && headers.length === 0 && <div className="p-3 text-xs text-slate-500">No collection record found.</div>}
            {headers.map((row) => (
              <button
                key={row.lrefno}
                type="button"
                onClick={() => setSelectedRefno(row.lrefno)}
                className={`w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 ${
                  selectedRefno === row.lrefno ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{toDateInput(row.ldatetime) || '-'}</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">{row.lcolection_no || row.lrefno}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="col-span-12 lg:col-span-9 xl:col-span-10 h-full overflow-hidden border border-l-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          {!selectedRefno && <div className="h-full grid place-items-center text-slate-400">Select or create a DCR record</div>}

          {selectedRefno && (
            <>
              {/* Top Action Bar with workflow buttons + Approver Logs */}
              <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusButtons()}
                  <button
                    type="button"
                    onClick={() => setShowApproverLogsModal(true)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Approver Logs
                  </button>
                </div>
              </div>

              {/* Header info */}
              <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedHeader?.lcolection_no || selectedRefno}</h3>
                    <p className="text-sm text-slate-500">Refno: {selectedRefno}</p>
                  </div>
                </div>
                {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {/* Bulk action toolbar above table */}
                {!detailLoading && canAddPayment && (
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleDeleteSelectedItems}
                      disabled={selectedItemIds.length === 0 || !!workingAction}
                      className="rounded border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Delete Selected
                    </button>
                    <button
                      type="button"
                      onClick={handlePostSelectedItems}
                      disabled={selectedItemIds.length === 0 || !!workingAction}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Post Selected
                    </button>
                    <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                      <input type="date" value={form.collectDate} onChange={(e) => setForm((prev) => ({ ...prev, collectDate: e.target.value }))} className="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" title="Collection Date" />
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(form.status)}`}>
                        {form.status}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment Lines Table - no card wrapper */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-300 dark:border-slate-600 text-left text-xs uppercase text-slate-500">
                        <th className="px-2 py-2">Customer</th>
                        <th className="px-2 py-2">Transaction No.</th>
                        <th className="px-2 py-2">Check/Cash</th>
                        <th className="px-2 py-2">Bank</th>
                        <th className="px-2 py-2">Check No.</th>
                        <th className="px-2 py-2">Check Date</th>
                        <th className="px-2 py-2">Check Amount</th>
                        <th className="px-2 py-2">Remarks</th>
                        <th className="px-2 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLoading && (
                        <tr>
                          <td colSpan={9} className="px-3 py-4 text-center text-slate-500">Loading payment lines...</td>
                        </tr>
                      )}
                      {!detailLoading && items.length === 0 && !canAddPayment && (
                        <tr>
                          <td colSpan={9} className="px-3 py-4 text-center text-slate-500">No payment lines yet.</td>
                        </tr>
                      )}
                      {!detailLoading && items.map((item, index) => {
                        const posted = item.lpost === 1 || item.lcollection_status === 'Posted';
                        return (
                          <tr key={item.lid} className={`border-t border-slate-100 dark:border-slate-800 ${index % 2 === 1 ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}>
                            <td className="px-2 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                {!posted && (
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.includes(item.lid)}
                                    onChange={(e) => setSelectedItemIds((prev) => (e.target.checked ? [...prev, item.lid] : prev.filter((id) => id !== item.lid)))}
                                  />
                                )}
                                {posted && <Calendar size={14} className="text-emerald-600" />}
                                {item.lcustomer_fname || item.lcustomer}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-500">{item.ltransaction_no || '-'}</td>
                            <td className="px-2 py-2">{item.ltype}</td>
                            <td className="px-2 py-2 text-xs text-slate-500">{(item as any).lbank || '-'}</td>
                            <td className="px-2 py-2 text-xs text-slate-500">{(item as any).lcheck_no || '-'}</td>
                            <td className="px-2 py-2 text-xs text-slate-500">{(item as any).lcheck_date ? toDateInput((item as any).lcheck_date) : '-'}</td>
                            <td className="px-2 py-2 font-medium">{peso.format(item.lamt || 0)}</td>
                            <td className="px-2 py-2 text-xs text-slate-500">{item.lremarks || '-'}</td>
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
                      {/* Inline Add Payment Row */}
                      {!detailLoading && canAddPayment && (
                        <tr className="border-t-2 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10">
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={items.length > 0 && selectedItemIds.length === items.filter((i) => i.lpost !== 1 && i.lcollection_status !== 'Posted').length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedItemIds(items.filter((i) => i.lpost !== 1 && i.lcollection_status !== 'Posted').map((i) => i.lid));
                                  } else {
                                    setSelectedItemIds([]);
                                  }
                                }}
                                title="Select all"
                              />
                              <select
                                value={form.customerId}
                                onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
                                className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="">Customer</option>
                                {customers.map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.code ? `${customer.code} - ` : ''}{customer.company}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              multiple
                              value={Object.entries(selectedTransactions).filter(([, v]) => v).map(([k]) => k)}
                              onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                                const newSelections: Record<string, boolean> = {};
                                unpaidRows.forEach((row) => {
                                  const key = `${row.transactionType}:${row.lrefno}`;
                                  newSelections[key] = selected.includes(key);
                                });
                                setSelectedTransactions(newSelections);
                              }}
                              className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                              style={{ minHeight: '28px', maxHeight: '60px' }}
                            >
                              {!form.customerId && <option disabled>Pick a customer</option>}
                              {form.customerId && unpaidRows.length === 0 && <option disabled>No unpaid items</option>}
                              {unpaidRows.map((row) => {
                                const key = `${row.transactionType}:${row.lrefno}`;
                                return (
                                  <option key={key} value={key}>
                                    {row.linvoice_no} — {peso.format(row.totalAmount || 0)}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={form.type}
                              onChange={(e) => handleTypeChange(e.target.value)}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            >
                              <option>Cash</option>
                              <option>Check</option>
                              <option>TT</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input value={form.bank} onChange={(e) => setForm((prev) => ({ ...prev, bank: e.target.value }))} className="w-full min-w-[60px] rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="Bank" />
                          </td>
                          <td className="px-2 py-2">
                            <input value={form.checkNo} onChange={(e) => setForm((prev) => ({ ...prev, checkNo: e.target.value }))} className="w-full min-w-[60px] rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" placeholder="Check No." />
                          </td>
                          <td className="px-2 py-2">
                            <input type="date" value={form.checkDate} onChange={(e) => setForm((prev) => ({ ...prev, checkDate: e.target.value }))} className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" title="Check Date" />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={form.amount}
                              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                              className="w-full min-w-[70px] rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={form.remarks}
                              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                              className="w-full min-w-[80px] rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                              placeholder="Remarks"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={handleSavePayment}
                              disabled={savingPayment}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {savingPayment ? 'Saving...' : 'Add'}
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/70">
                      <tr className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <td className="px-2 py-2" />
                        <td className="px-2 py-2 text-right">Total Check:</td>
                        <td className="px-2 py-2">{peso.format(totalCheck)}</td>
                        <td className="px-2 py-2 text-right">Total T/T:</td>
                        <td className="px-2 py-2">{peso.format(totalTT)}</td>
                        <td className="px-2 py-2 text-right">Total Cash:</td>
                        <td className="px-2 py-2">{peso.format(totalCash)}</td>
                        <td className="px-2 py-2" />
                        <td className="px-2 py-2 text-right font-bold">Grand Total: {peso.format(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Approver Logs Modal */}
              {showApproverLogsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApproverLogsModal(false)}>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Approver Logs</h3>
                      <button
                        type="button"
                        onClick={() => setShowApproverLogsModal(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                      {approverLogs.length === 0 && <p className="text-sm text-slate-500">No approver logs yet.</p>}
                      {approverLogs.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/70">
                            <tr className="text-left text-xs uppercase text-slate-500">
                              <th className="px-3 py-2">ID</th>
                              <th className="px-3 py-2">Approver Name</th>
                              <th className="px-3 py-2">Date & Time</th>
                              <th className="px-3 py-2">Remark</th>
                              <th className="px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approverLogs.map((log) => (
                              <tr key={log.lid} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="px-3 py-2">{log.lid}</td>
                                <td className="px-3 py-2">{((log.staff_fName || '') + ' ' + (log.staff_lName || '')).trim() || log.lstaff_id}</td>
                                <td className="px-3 py-2 text-xs">{log.ldatetime || '-'}</td>
                                <td className="px-3 py-2 text-xs">{log.lremarks || '-'}</td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(log.lstatus || 'Pending')}`}>
                                    {log.lstatus || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowApproverLogsModal(false)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default DailyCollectionEntryView;
