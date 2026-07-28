import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  adjustmentEntryService,
  AdjustmentEntry,
  AdjustmentStatus,
  AdjustmentType,
  LedgerCustomer,
} from '../services/adjustmentEntryService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const toDateInput = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatLegacyDate = (value?: string): string => {
  const input = toDateInput(value);
  if (!input) return '';
  const [yyyy, mm, dd] = input.split('-');
  return `${mm}/${dd}/${yyyy}`;
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
  const [showSearchModal, setShowSearchModal] = useState(false);

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
      customerId: '',
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
    <div className="min-h-full bg-[#f4f4f4] px-4 py-10 text-[13px] text-[#222]">
      <div className="mx-auto max-w-[1140px] space-y-6">
        <section className="overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white">
          <div className="flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-[#ddd] px-9 py-5">
            <div className="flex gap-1">
              <button type="button" onClick={() => setShowSearchModal(true)} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white">Search</button>
              <button type="button" onClick={handleCreateMode} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-white">Create New</button>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-['Oswald'] text-[20px] text-[#263f52]">Filter by Month:</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-[34px] w-[200px] rounded-[3px] border border-[#ccc] bg-white px-3">
                {MONTHS.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-[34px] w-[100px] rounded-[3px] border border-[#ccc] px-3" />
            </div>
          </div>
          <div className="px-6 py-7">
            {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
            <div className="max-h-[150px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="sticky top-0 bg-white font-['Oswald'] text-[14px]">
                  <tr className="border-b-2 border-[#ddd]">
                    <th className="w-[12%] px-2 py-2">Date</th>
                    <th className="w-[35%] px-2 py-2">Customer</th>
                    <th className="w-[16%] px-2 py-2">Ref No.</th>
                    <th className="w-[18%] px-2 py-2">Type</th>
                    <th className="w-[18%] px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList && <tr><td colSpan={5} className="px-2 py-4 text-slate-500">Loading entries...</td></tr>}
                  {!loadingList && rows.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-slate-500">No records found.</td></tr>}
                  {!loadingList && rows.map((row) => {
                    const active = selectedRefno === row.lrefno && !isCreating;
                    return (
                      <tr
                        key={row.lrefno}
                        onClick={() => { setIsCreating(false); setSelectedRefno(row.lrefno); }}
                        className={`cursor-pointer border-b border-[#ddd] ${active ? 'text-blue-600' : ''}`}
                      >
                        <td className="px-2 py-2">{formatLegacyDate(row.ldate)}</td>
                        <td className="px-2 py-2">{row.lcustomername || '-'}</td>
                        <td className="px-2 py-2 underline">{row.lno || row.lrefno}</td>
                        <td className="px-2 py-2">{row.ltype}</td>
                        <td className="px-2 py-2">{row.lstatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white">
          <div className="flex min-h-[64px] items-center justify-between border-b border-[#ddd] px-5">
            <h2 className="border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] uppercase text-[#315574]">Adjustment Entry</h2>
            <div className="flex items-center gap-2 font-['Oswald'] text-[18px] text-[#263f52]">
              {!isCreating && selected?.lstatus === 'Pending' && (
                <button type="button" onClick={() => handleAction('post')} disabled={saving} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-[12px] font-bold text-white">
                  POST <u>Adjustment</u>
                </button>
              )}
              <span>Ref No. :</span>
              <input value={isCreating ? '' : (selected?.lno || '')} readOnly className="h-[34px] w-[130px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3 font-sans text-[13px]" />
            </div>
          </div>
          <div className="min-h-[300px] px-10 py-8">
            {loadingDetail && !isCreating ? (
              <p className="text-slate-500">Loading record...</p>
            ) : (!isCreating && !selected) ? (
              <p className="text-slate-500">Select an adjustment record or click Create New.</p>
            ) : (
              <div className="mx-auto max-w-[920px]">
                <div className="grid grid-cols-[110px_1fr_90px_240px] items-center gap-x-4 gap-y-5">
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Sold to :</label>
                  <div>
                    <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} disabled={!canEdit} placeholder="Search customer" className="mb-2 h-[34px] w-full rounded-[3px] border border-[#ccc] px-3 disabled:bg-[#eee]" />
                    <select value={form.customerId} onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))} disabled={!canEdit || loadingCustomers} className="h-[34px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 disabled:bg-[#eee]">
                      <option value="">Select Customer</option>
                      {customers.map((customer) => <option key={customer.sessionId} value={customer.sessionId}>{customer.company}</option>)}
                    </select>
                  </div>
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Date :</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} disabled={!canEdit} className="h-[34px] rounded-[3px] border border-[#ccc] px-3 disabled:bg-[#eee]" />

                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Remark :</label>
                  <input value={form.remark} onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))} disabled={!canEdit} className="h-[34px] rounded-[3px] border border-[#ccc] px-3 disabled:bg-[#eee]" />
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Type :</label>
                  {isCreating ? (
                    <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AdjustmentType }))} className="h-[34px] rounded-[3px] border border-[#ccc] bg-white px-3">
                      <option value="Debit">Debit</option>
                      <option value="Credit">Credit</option>
                      <option value="Zero-Out">Zero-Out</option>
                    </select>
                  ) : <span>{form.type}</span>}

                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Amount :</label>
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} disabled={!canEdit || isZeroOut} placeholder={isZeroOut ? 'Auto-computed' : 'Input Amount'} className="h-[34px] rounded-[3px] border border-[#ccc] px-3 disabled:bg-[#eee]" />
                  <span />
                  <span className="text-xs text-slate-500">{selectedCustomerName ? `Selected: ${selectedCustomerName}` : ''}</span>
                </div>

                <div className="mt-7 ml-[126px] flex gap-2">
                  {isCreating ? (
                    <>
                      <button type="button" onClick={handleCreate} disabled={saving} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white disabled:opacity-50">Add Record</button>
                      <button type="button" onClick={() => { setIsCreating(false); setSelectedRefno(rows[0]?.lrefno || ''); }} className="rounded-[4px] border border-[#ccc] bg-white px-4 py-2">Cancel</button>
                    </>
                  ) : selected?.lstatus === 'Pending' ? (
                    <>
                      <button type="button" onClick={handleSave} disabled={saving} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white disabled:opacity-50">Save</button>
                      <button type="button" onClick={handleDelete} disabled={saving} className="inline-flex items-center gap-1 rounded-[4px] bg-[#d9534f] px-4 py-2 text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                    </>
                  ) : selected?.lstatus === 'Posted' ? (
                    <button type="button" onClick={() => handleAction('unpost')} disabled={saving} className="rounded-[4px] bg-[#f0ad4e] px-4 py-2 text-white disabled:opacity-50">Unpost</button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[600px] rounded-[5px] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-[20px] font-semibold">Search Adjustment</h3>
              <button type="button" onClick={() => setShowSearchModal(false)} className="text-2xl text-slate-500">×</button>
            </div>
            <div className="space-y-4 px-8 py-6">
              <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>DM No.</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Input DM No." className="h-[36px] rounded border border-[#ccc] px-3" /></label>
              <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-[36px] rounded border border-[#ccc] bg-white px-3"><option>All</option><option>Pending</option><option>Posted</option></select></label>
              <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Type</span><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-[36px] rounded border border-[#ccc] bg-white px-3"><option>All</option><option>Debit</option><option>Credit</option><option>Zero-Out</option></select></label>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button type="button" onClick={async () => { await fetchList(); setShowSearchModal(false); }} className="rounded bg-[#51b957] px-4 py-2 text-white">Save</button>
              <button type="button" onClick={() => setShowSearchModal(false)} className="rounded bg-[#5d82a2] px-4 py-2 text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdjustmentEntryView;
