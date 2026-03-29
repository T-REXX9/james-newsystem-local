import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import {
  freightChargesService,
  FreightCharge,
  FreightTransactionType,
  LedgerCustomer,
} from '../services/freightChargesService';
import { getAllInvoices } from '../services/invoiceLocalApiService';
import { getAllOrderSlips } from '../services/orderSlipLocalApiService';
import { Contact, Invoice, OrderSlip } from '../types';
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import { useDebounce } from '../hooks/useDebounce';

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

interface SourceDocument {
  id: string;
  doc_no: string;
  type: 'Invoice' | 'Order Slip';
  contact_id: string;
  customer_name: string;
  sales_date: string;
  sales_person: string;
  grand_total: number;
}

const SourceDocumentAutocomplete: React.FC<{
  documents: SourceDocument[];
  selectedDoc: SourceDocument | null;
  onSelect: (doc: SourceDocument) => void;
  disabled?: boolean;
}> = ({ documents, selectedDoc, onSelect, disabled = false }) => {
  const [query, setQuery] = useState(selectedDoc?.doc_no || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    setQuery(selectedDoc?.doc_no || '');
  }, [selectedDoc]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const sorted = [...documents].sort((a, b) => b.sales_date.localeCompare(a.sales_date));
    if (!q) return sorted.slice(0, 40);
    return sorted.filter((doc) => {
      const values = [
        doc.doc_no,
        doc.id,
        doc.customer_name,
        doc.sales_person,
      ];
      return values.some((value) => (value || '').toLowerCase().includes(q));
    }).slice(0, 40);
  }, [debouncedQuery, documents]);

  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const handleSelect = (doc: SourceDocument) => {
    onSelect(doc);
    setQuery(doc.doc_no || doc.id);
    setShowDropdown(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!showDropdown && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setShowDropdown(true);
      return;
    }
    if (!showDropdown) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
      return;
    }
    if (event.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const isSearching = query !== debouncedQuery;

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (!disabled) setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search invoice or order slip..."
          className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">No invoice or order slip found.</div>
          ) : (
            <ul className="max-h-72 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((doc, index) => (
                <li
                  key={`${doc.type}-${doc.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(doc);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`cursor-pointer px-3 py-2 ${selectedIndex === index ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{doc.doc_no || doc.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${doc.type === 'Invoice' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {doc.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{doc.customer_name || 'Unknown Customer'}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {doc.sales_date || '-'} | {doc.sales_person || '-'} | {peso.format(doc.grand_total || 0)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const FreightChargesDebitView: React.FC = () => {
  const today = new Date();
  const [rows, setRows] = useState<FreightCharge[]>([]);
  const [selectedRefno, setSelectedRefno] = useState('');
  const [selected, setSelected] = useState<FreightCharge | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [month, setMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(today.getFullYear()));

  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [sourceDocs, setSourceDocs] = useState<SourceDocument[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SourceDocument | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    date: toDateInput(new Date().toISOString()),
    courierName: '',
    trackingNo: '',
    amount: '',
    remarks: '',
    isFreightCollect: false,
    transactionType: 'No Reference' as FreightTransactionType,
    transactionRefNo: '',
    invoiceNo: '',
  });

  const fetchList = async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await freightChargesService.list({
        search,
        status: statusFilter,
        month,
        year,
        page,
        perPage,
      });
      setRows(data.items);
      setTotalPages(Math.max(1, data.meta.total_pages || 1));

      if (isCreating) return;

      if (!selectedRefno && data.items[0]?.lrefno) {
        setSelectedRefno(data.items[0].lrefno);
      } else if (selectedRefno && !data.items.some((row) => row.lrefno === selectedRefno)) {
        setSelectedRefno(data.items[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load freight charges');
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
      const item = await freightChargesService.show(refno);
      setSelected(item);
      setForm({
        customerId: item.lcustomer || '',
        date: toDateInput(item.ldate),
        courierName: item.lcurier_name || '',
        trackingNo: item.ltrackingno || '',
        amount: String(item.lamt ?? ''),
        remarks: item.lremarks || '',
        isFreightCollect: Number(item.IsFreightCollect || 0) === 1,
        transactionType: item.ltransaction_type || 'No Reference',
        transactionRefNo: item.ltrans_refno || '',
        invoiceNo: item.linvoice_no || '',
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load record');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchCustomers = async (searchText = '') => {
    try {
      const list = await freightChargesService.getCustomers(searchText);
      setCustomers(list);
      if (isCreating && !form.customerId && list[0]?.sessionId) {
        setForm((prev) => ({ ...prev, customerId: list[0].sessionId }));
      }
    } catch {
      setCustomers([]);
    }
  };

  const fetchSourceDocuments = async () => {
    try {
      const [customerRows, invoices, orderSlips] = await Promise.all([
        fetchContacts().catch(() => [] as Contact[]),
        getAllInvoices().catch(() => [] as Invoice[]),
        getAllOrderSlips().catch(() => [] as OrderSlip[]),
      ]);

      const customerById = new Map(customerRows.map((contact) => [contact.id, contact.company || '']));
      const docs: SourceDocument[] = [
        ...invoices.map((invoice) => ({
          id: invoice.id,
          doc_no: invoice.invoice_no,
          type: 'Invoice' as const,
          contact_id: invoice.contact_id,
          customer_name: customerById.get(invoice.contact_id) || '',
          sales_date: invoice.sales_date,
          sales_person: invoice.sales_person,
          grand_total: Number(invoice.grand_total || 0),
        })),
        ...orderSlips.map((slip) => ({
          id: slip.id,
          doc_no: slip.slip_no,
          type: 'Order Slip' as const,
          contact_id: slip.contact_id,
          customer_name: customerById.get(slip.contact_id) || slip.customer_name || '',
          sales_date: slip.sales_date,
          sales_person: slip.sales_person,
          grand_total: Number(slip.grand_total || 0),
        })),
      ];

      setContacts(customerRows);
      setSourceDocs(docs);
    } catch {
      setContacts([]);
      setSourceDocs([]);
    }
  };

  const applySourceDocument = (doc: SourceDocument | null) => {
    setSelectedDoc(doc);
    if (!doc) {
      setForm((prev) => ({
        ...prev,
        transactionType: 'No Reference',
        transactionRefNo: '',
        invoiceNo: '',
      }));
      return;
    }

    const matchedCustomer = customers.find((customer) => customer.sessionId === doc.contact_id);
    const matchedContact = contacts.find((contact) => contact.id === doc.contact_id);
    const customerName = matchedCustomer?.company || matchedContact?.company || doc.customer_name || '';

    setCustomerSearch(customerName);
    setForm((prev) => ({
      ...prev,
      customerId: doc.contact_id || prev.customerId,
      transactionType: doc.type,
      transactionRefNo: doc.id,
      invoiceNo: doc.doc_no,
      date: toDateInput(doc.sales_date) || prev.date,
    }));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCustomers(customerSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    fetchList();
  }, [search, statusFilter, month, year, page]);

  useEffect(() => {
    if (!selectedRefno || isCreating) {
      if (!isCreating) setSelected(null);
      return;
    }
    fetchDetail(selectedRefno);
  }, [selectedRefno, isCreating]);

  useEffect(() => {
    fetchCustomers('');
    fetchSourceDocuments();
  }, []);

  useEffect(() => {
    if (!form.transactionRefNo || !sourceDocs.length) {
      setSelectedDoc(null);
      return;
    }

    const matched = sourceDocs.find((doc) => doc.id === form.transactionRefNo)
      || sourceDocs.find((doc) => doc.doc_no === form.invoiceNo && doc.type === form.transactionType);
    setSelectedDoc(matched || null);
  }, [form.transactionRefNo, form.invoiceNo, form.transactionType, sourceDocs]);

  const selectedCustomerName = useMemo(() => {
    const customer = customers.find((c) => c.sessionId === form.customerId);
    if (customer) return customer.company;
    if (selected?.lcustomer === form.customerId) return selected.lcustomer_lname;
    return '';
  }, [customers, form.customerId, selected]);

  const canEdit = isCreating || selected?.lstatus === 'Pending';

  const handleCreateMode = async () => {
    setIsCreating(true);
    setSelectedRefno('');
    setSelected(null);
    setError('');
    setForm({
      customerId: customers[0]?.sessionId || '',
      date: toDateInput(new Date().toISOString()),
      courierName: '',
      trackingNo: '',
      amount: '',
      remarks: '',
      isFreightCollect: false,
      transactionType: 'No Reference',
      transactionRefNo: '',
      invoiceNo: '',
    });
    setSelectedDoc(null);
    if (customers.length === 0) {
      await fetchCustomers('');
    }
  };

  const handleCreate = async () => {
    if (!form.customerId || !form.date || !form.courierName.trim() || !form.trackingNo.trim()) {
      setError('Customer, date, courier, and tracking no are required');
      return;
    }
    if (!form.isFreightCollect && !(Number(form.amount) >= 0)) {
      setError('Amount must be zero or higher');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await freightChargesService.create({
        customerId: form.customerId,
        date: form.date,
        courierName: form.courierName.trim(),
        trackingNo: form.trackingNo.trim(),
        amount: Number(form.amount || 0),
        remarks: form.remarks,
        isFreightCollect: form.isFreightCollect,
        transactionType: form.transactionType,
        transactionRefNo: form.transactionRefNo,
        invoiceNo: form.invoiceNo,
      });
      setIsCreating(false);
      setPage(1);
      await fetchList();
      setSelectedRefno(created.lrefno);
      await fetchDetail(created.lrefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to create freight charge');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!form.customerId || !form.date || !form.courierName.trim() || !form.trackingNo.trim()) {
      setError('Customer, date, courier, and tracking no are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await freightChargesService.update(selected.lrefno, {
        customerId: form.customerId,
        date: form.date,
        courierName: form.courierName.trim(),
        trackingNo: form.trackingNo.trim(),
        amount: Number(form.amount || 0),
        remarks: form.remarks,
        isFreightCollect: form.isFreightCollect,
        transactionType: form.transactionType,
        transactionRefNo: form.transactionRefNo,
        invoiceNo: form.invoiceNo,
      });
      setSelected(updated);
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to update freight charge');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'post' | 'unpost') => {
    if (!selected) return;
    const promptText = action === 'post'
      ? 'Post this freight charge? It will write to customer ledger.'
      : 'Unpost this freight charge? It will remove related ledger entries.';
    if (!window.confirm(promptText)) return;

    setSaving(true);
    setError('');
    try {
      await freightChargesService.action(selected.lrefno, action);
      await Promise.all([fetchList(), fetchDetail(selected.lrefno)]);
    } catch (err: any) {
      setError(err?.message || `Failed to ${action} record`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete freight charge ${selected.ldm_no}?`)) return;

    setSaving(true);
    setError('');
    try {
      await freightChargesService.remove(selected.lrefno);
      setSelected(null);
      setSelectedRefno('');
      setPage(1);
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Freight Charges</h2>
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
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Search DM/tracking/customer"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              >
                <option>All</option>
                <option>Pending</option>
                <option>Posted</option>
              </select>
              <button
                type="button"
                onClick={fetchList}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-2 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <RefreshCcw size={14} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              >
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                value={year}
                onChange={(e) => {
                  setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                placeholder="YYYY"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto divide-y divide-slate-200 dark:divide-slate-800">
            {loadingList && <div className="p-4 text-sm text-slate-500">Loading records...</div>}
            {!loadingList && rows.length === 0 && <div className="p-4 text-sm text-slate-500">No freight charges found.</div>}
            {rows.map((row) => (
              <button
                key={row.lrefno}
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setSelectedRefno(row.lrefno);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedRefno === row.lrefno ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{row.ldm_no || row.lrefno}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${row.lstatus === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {row.lstatus}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{row.lcustomer_lname || 'N/A'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{row.ltrackingno || '-'} | {peso.format(Number(row.lamt || 0))}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-700"
            >
              Prev
            </button>
            <span className="text-slate-600 dark:text-slate-300">Page {page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-8 xl:col-span-9 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-auto">
          {error && (
            <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {!isCreating && !selected && !loadingDetail && (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">Select a freight charge to view details.</div>
          )}

          {(isCreating || selected) && (
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{isCreating ? 'New Freight Charge' : (selected?.ldm_no || 'Freight Charge')}</h3>
                  <p className="text-xs text-slate-500">{isCreating ? 'Create a pending freight debit memo' : `Status: ${selected?.lstatus || '-'}`}</p>
                </div>
                {!isCreating && selected && (
                  <div className="flex flex-wrap gap-2">
                    {selected.lstatus === 'Pending' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleAction('post')}
                        className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Post
                      </button>
                    )}
                    {selected.lstatus === 'Posted' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleAction('unpost')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Unpost
                      </button>
                    )}
                    {selected.lstatus === 'Pending' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleDelete}
                        className="rounded-lg border border-rose-300 text-rose-700 px-3 py-2 text-sm hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Customer</span>
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-2 dark:bg-slate-900 dark:border-slate-700"
                  />
                  <select
                    value={form.customerId}
                    disabled={!canEdit}
                    onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.sessionId} value={c.sessionId}>{c.company}</option>
                    ))}
                  </select>
                  {selectedCustomerName && <span className="mt-1 block text-xs text-slate-500">{selectedCustomerName}</span>}
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Date</span>
                  <input
                    type="date"
                    value={form.date}
                    disabled={!canEdit}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Courier Name</span>
                  <input
                    value={form.courierName}
                    disabled={!canEdit}
                    onChange={(e) => setForm((prev) => ({ ...prev, courierName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Tracking No</span>
                  <input
                    value={form.trackingNo}
                    disabled={!canEdit}
                    onChange={(e) => setForm((prev) => ({ ...prev, trackingNo: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Invoice / Order Slip</span>
                  <SourceDocumentAutocomplete
                    documents={sourceDocs}
                    selectedDoc={selectedDoc}
                    onSelect={applySourceDocument}
                    disabled={!canEdit}
                  />
                  <span className="mt-1 block text-xs text-slate-500">Selecting a document auto-fills customer, date, type, and reference.</span>
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Transaction Type</span>
                  <select
                    value={form.transactionType}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const nextType = e.target.value as FreightTransactionType;
                      setSelectedDoc((prev) => (prev?.type === nextType ? prev : null));
                      setForm((prev) => ({
                        ...prev,
                        transactionType: nextType,
                        ...(nextType === 'No Reference' ? { transactionRefNo: '', invoiceNo: '' } : {}),
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="No Reference">No Reference</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Order Slip">Order Slip</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Reference No (Optional)</span>
                  <input
                    value={form.transactionRefNo}
                    disabled={!canEdit}
                    onChange={(e) => {
                      setSelectedDoc(null);
                      setForm((prev) => ({ ...prev, transactionRefNo: e.target.value }));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </label>

                <label className="text-sm md:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isFreightCollect}
                    disabled={!canEdit}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      isFreightCollect: e.target.checked,
                      amount: e.target.checked ? '0' : prev.amount,
                      remarks: e.target.checked && !prev.remarks.startsWith('Freight Collect:') ? 'Freight Collect: ' : prev.remarks,
                    }))}
                  />
                  Freight Collection
                </label>

                <label className="text-sm">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    disabled={!canEdit || form.isFreightCollect}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="block text-slate-600 dark:text-slate-300 mb-1">Remarks</span>
                  <textarea
                    rows={3}
                    value={form.remarks}
                    disabled={!canEdit}
                    onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </label>
              </div>

              {canEdit && (
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={isCreating ? handleCreate : handleSave}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : (isCreating ? 'Create Freight Charge' : 'Save Changes')}
                  </button>
                  {isCreating && (
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {loadingDetail && <div className="p-4 text-sm text-slate-500">Loading details...</div>}
        </main>
      </div>
    </div>
  );
};

export default FreightChargesDebitView;
