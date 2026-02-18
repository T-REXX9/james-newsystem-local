import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import {
  adjustmentEntryService,
  AdjustmentEntry,
  AdjustmentStatus,
  AdjustmentType,
  LedgerCustomer,
} from '../services/adjustmentEntryService';

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

interface AdjustmentEntryViewProps {
  initialAdjustmentNo?: string;
}

const AdjustmentEntryView: React.FC<AdjustmentEntryViewProps> = ({ initialAdjustmentNo }) => {
  const today = new Date();
  const [rows, setRows] = useState<AdjustmentEntry[]>([]);
  const [selectedRefno, setSelectedRefno] = useState('');
  const [selected, setSelected] = useState<AdjustmentEntry | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [month, setMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(today.getFullYear()));

  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    date: toDateInput(new Date().toISOString()),
    type: 'Debit' as AdjustmentType,
    amount: '',
    remark: '',
  });

  const fetchList = async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await adjustmentEntryService.list({
        search,
        status: statusFilter,
        type: typeFilter,
        month,
        year,
        page: 1,
        perPage: 100,
      });
      setRows(data.items);

      if (isCreating) return;

      if (initialAdjustmentNo) {
        const foundByNo = data.items.find((row) => String(row.lno || '').toLowerCase() === initialAdjustmentNo.toLowerCase());
        if (foundByNo) {
          setSelectedRefno(foundByNo.lrefno);
          return;
        }
      }

      if (!selectedRefno && data.items[0]?.lrefno) {
        setSelectedRefno(data.items[0].lrefno);
      } else if (selectedRefno && !data.items.some((row) => row.lrefno === selectedRefno)) {
        setSelectedRefno(data.items[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load adjustment entries');
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDetail = async (refno: string) => {
    if (!refno) return;
    setLoadingDetail(true);
    setError('');
    try {
      const item = await adjustmentEntryService.show(refno);
      setSelected(item);
      setForm({
        customerId: item.lcustomerid || '',
        date: toDateInput(item.ldate),
        type: item.ltype,
        amount: String(item.lamount ?? ''),
        remark: item.lremark || '',
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load record');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchCustomers = async (searchText = '') => {
    setLoadingCustomers(true);
    try {
      const list = await adjustmentEntryService.getCustomers(searchText);
      setCustomers(list);
      if (isCreating && !form.customerId && list[0]?.sessionId) {
        setForm((prev) => ({ ...prev, customerId: list[0].sessionId }));
      }
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [statusFilter, typeFilter, month, year]);

  useEffect(() => {
    if (!selectedRefno || isCreating) {
      if (!isCreating) {
        setSelected(null);
      }
      return;
    }
    fetchDetail(selectedRefno);
  }, [selectedRefno, isCreating]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCustomers(customerSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const selectedCustomerName = useMemo(() => {
    const customer = customers.find((c) => c.sessionId === form.customerId);
    if (customer) return customer.company;
    if (selected?.lcustomerid === form.customerId) return selected.lcustomername;
    return '';
  }, [customers, form.customerId, selected]);

  const canEdit = isCreating || selected?.lstatus === 'Pending';
  const isZeroOut = form.type === 'Zero-Out';

  const handleCreateMode = async () => {
    setIsCreating(true);
    setSelectedRefno('');
    setSelected(null);
    setError('');
    setForm({
      customerId: customers[0]?.sessionId || '',
      date: toDateInput(new Date().toISOString()),
      type: 'Debit',
      amount: '',
      remark: '',
    });
    if (customers.length === 0) {
      await fetchCustomers('');
    }
  };

  const handleCreate = async () => {
    if (!form.customerId) {
      setError('Customer is required');
      return;
    }
    if (!form.date) {
      setError('Date is required');
      return;
    }
    if (!isZeroOut && !(Number(form.amount) > 0)) {
      setError('Amount must be greater than 0');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await adjustmentEntryService.create({
        customerId: form.customerId,
        date: form.date,
        type: form.type,
        amount: Number(form.amount || 0),
        remark: form.remark,
      });

      setIsCreating(false);
      await fetchList();
      setSelectedRefno(created.lrefno);
      await fetchDetail(created.lrefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to create record');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!form.customerId || !form.date) {
      setError('Customer and date are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await adjustmentEntryService.update(selected.lrefno, {
        customerId: form.customerId,
        date: form.date,
        amount: isZeroOut ? undefined : Number(form.amount || 0),
        remark: form.remark,
      });
      setSelected(updated);
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to update record');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'post' | 'unpost') => {
    if (!selected) return;
    const promptText = action === 'post'
      ? 'Post this adjustment? It will write to customer ledger.'
      : 'Unpost this adjustment? It will remove ledger entries.';
    if (!window.confirm(promptText)) return;

    setSaving(true);
    setError('');
    try {
      await adjustmentEntryService.action(selected.lrefno, action);
      await Promise.all([fetchList(), fetchDetail(selected.lrefno)]);
    } catch (err: any) {
      setError(err?.message || `Failed to ${action} record`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete adjustment ${selected.lno}?`)) return;

    setSaving(true);
    setError('');
    try {
      await adjustmentEntryService.remove(selected.lrefno);
      setSelected(null);
      setSelectedRefno('');
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-4">
      <div className="h-full grid grid-cols-12 gap-4 overflow-hidden">
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Adjustment Entry</h2>
              <button
                type="button"
                onClick={handleCreateMode}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ref/customer"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700">
                {Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, '0')).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700">
                <option>All</option>
                <option>Pending</option>
                <option>Posted</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700">
                <option>All</option>
                <option>Debit</option>
                <option>Credit</option>
                <option>Zero-Out</option>
              </select>
            </div>

            <button
              type="button"
              onClick={fetchList}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingList ? (
              <p className="p-4 text-sm text-slate-500">Loading entries...</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No records found.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => {
                  const active = selectedRefno === row.lrefno && !isCreating;
                  return (
                    <li key={row.lrefno}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreating(false);
                          setSelectedRefno(row.lrefno);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${active ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 pl-3' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{row.lno || row.lrefno}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.lstatus === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {row.lstatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{row.lcustomername || '-'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{toDateInput(row.ldate)} • {row.ltype} • {peso.format(Number(row.lamount || 0))}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-8 xl:col-span-9 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isCreating ? 'New Adjustment Entry' : 'Adjustment Details'}</h2>
                <p className="text-sm text-slate-500">
                  Ref No: {isCreating ? 'Auto-generated on save' : (selected?.lno || '-')}
                </p>
              </div>
              {!isCreating && selected && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.lstatus === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selected.lstatus}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4 overflow-auto flex-1">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {loadingDetail && !isCreating ? (
              <p className="text-sm text-slate-500">Loading record...</p>
            ) : (!isCreating && !selected) ? (
              <p className="text-sm text-slate-500">Select a record from the sidebar, or create a new one.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <label className="text-sm text-slate-600 dark:text-slate-300">
                    Customer
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search customer"
                          disabled={!canEdit}
                          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                        />
                      </div>
                      <select
                        value={form.customerId}
                        onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
                        disabled={!canEdit || loadingCustomers}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                      >
                        <option value="">Select customer</option>
                        {customers.map((customer) => (
                          <option key={customer.sessionId} value={customer.sessionId}>{customer.company}</option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="text-sm text-slate-600 dark:text-slate-300">
                    Date
                    <div className="relative mt-1">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                        disabled={!canEdit}
                        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                  </label>

                  <label className="text-sm text-slate-600 dark:text-slate-300">
                    Type
                    <select
                      value={form.type}
                      onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AdjustmentType }))}
                      disabled={!canEdit || !isCreating}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                    >
                      <option value="Debit">Debit</option>
                      <option value="Credit">Credit</option>
                      <option value="Zero-Out">Zero-Out</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-600 dark:text-slate-300">
                    Amount
                    <input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      disabled={!canEdit || isZeroOut}
                      placeholder={isZeroOut ? 'Auto-computed by API' : 'Input amount'}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                    />
                  </label>
                </div>

                <label className="text-sm text-slate-600 dark:text-slate-300 block">
                  Remark
                  <input
                    value={form.remark}
                    onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                    placeholder="Input remark"
                  />
                </label>

                <div className="text-xs text-slate-500">
                  Selected customer: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedCustomerName || '-'}</span>
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              {saving ? 'Processing...' : 'Actions follow old-system workflow (Pending/Posted).'}
            </div>
            <div className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setSelectedRefno(rows[0]?.lrefno || '');
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Create Record
                  </button>
                </>
              ) : selected ? (
                <>
                  {selected.lstatus === 'Pending' && (
                    <>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction('post')}
                        disabled={saving}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Post Adjustment
                      </button>
                    </>
                  )}
                  {selected.lstatus === 'Posted' && (
                    <button
                      type="button"
                      onClick={() => handleAction('unpost')}
                      disabled={saving}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      Unpost
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdjustmentEntryView;
