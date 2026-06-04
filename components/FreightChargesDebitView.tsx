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
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchDraft, setSearchDraft] = useState({
    dmNo: '',
    customer: '',
    trackingNo: '',
  });
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

  const monthOptions = [
    ['01', 'January'],
    ['02', 'February'],
    ['03', 'March'],
    ['04', 'April'],
    ['05', 'May'],
    ['06', 'June'],
    ['07', 'July'],
    ['08', 'August'],
    ['09', 'September'],
    ['10', 'October'],
    ['11', 'November'],
    ['12', 'December'],
  ];

  const formatShortDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const getTransactionNo = (row: FreightCharge | null) => {
    if (!row) return '';
    if (row.ltransaction_type === 'No Reference') return 'No Reference';
    return row.linvoice_no || row.ltrans_refno || row.ltransaction_type;
  };

  const applySearchModal = () => {
    const nextSearch = [searchDraft.dmNo, searchDraft.customer, searchDraft.trackingNo]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ');
    setSearchInput(nextSearch);
    setSearch(nextSearch);
    setPage(1);
    setShowSearchModal(false);
  };

  const clearFilters = () => {
    setSearchDraft({ dmNo: '', customer: '', trackingNo: '' });
    setSearchInput('');
    setSearch('');
    setStatusFilter('All');
    setMonth(String(today.getMonth() + 1).padStart(2, '0'));
    setYear(String(today.getFullYear()));
    setPage(1);
    fetchList();
  };

  const openSelectedRecord = (row: FreightCharge) => {
    setIsCreating(false);
    setSelectedRefno(row.lrefno);
  };

  const fieldClass = 'h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800';
  const labelCellClass = 'w-[15%] border-t-0 px-3 py-2 text-right align-middle text-sm font-semibold text-slate-700 dark:text-slate-200';
  const valueCellClass = 'w-[35%] border-t-0 px-3 py-2 align-middle text-sm text-slate-800 dark:text-slate-100';
  const buttonClass = 'inline-flex h-9 items-center justify-center gap-1.5 rounded bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="h-full overflow-auto bg-slate-100 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            <strong>Ooops !</strong> {error}.
          </div>
        )}

        <section className="rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowSearchModal(true)} className={buttonClass}>
                <Search className="h-4 w-4" />
                Search
              </button>
              <button type="button" onClick={handleCreateMode} className={buttonClass}>
                <Plus className="h-4 w-4" />
                Create New
              </button>
              <button type="button" onClick={clearFilters} className={buttonClass}>
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-semibold">Filter by Month:</label>
              <select
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setPage(1);
                }}
                className="h-9 w-52 rounded border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {monthOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                value={year}
                onChange={(event) => {
                  setYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4));
                  setPage(1);
                }}
                className="h-9 w-24 rounded border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                placeholder="YYYY"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 w-28 rounded border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option>All</option>
                <option>Pending</option>
                <option>Posted</option>
              </select>
              <button type="button" onClick={fetchList} className={buttonClass}>Filter</button>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 text-sm">
              <b>Filtered By:</b> {search || 'All Records'}
            </div>
            <div className="max-h-44 overflow-auto border border-slate-200 dark:border-slate-800">
              <table id="tblrecordlist" className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                  <tr>
                    <th className="w-[10%] border border-slate-200 px-3 py-2 dark:border-slate-700">Date</th>
                    <th className="w-[25%] border border-slate-200 px-3 py-2 dark:border-slate-700">Customer</th>
                    <th className="w-[10%] border border-slate-200 px-3 py-2 dark:border-slate-700">DM No.</th>
                    <th className="w-[15%] border border-slate-200 px-3 py-2 dark:border-slate-700">Transaction No.</th>
                    <th className="w-[20%] border border-slate-200 px-3 py-2 dark:border-slate-700">Tracking No.</th>
                    <th className="w-[15%] border border-slate-200 px-3 py-2 dark:border-slate-700">Courier</th>
                    <th className="w-[5%] border border-slate-200 px-3 py-2 dark:border-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList && (
                    <tr>
                      <td colSpan={7} className="border border-slate-200 px-3 py-4 text-center text-slate-500 dark:border-slate-800">
                        Loading records...
                      </td>
                    </tr>
                  )}
                  {!loadingList && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="border border-slate-200 px-3 py-4 text-center text-slate-500 dark:border-slate-800">
                        No freight charges found.
                      </td>
                    </tr>
                  )}
                  {!loadingList && rows.map((row) => {
                    const isSelected = selectedRefno === row.lrefno;
                    return (
                      <tr
                        key={row.lrefno}
                        onClick={() => openSelectedRecord(row)}
                        className={`cursor-pointer ${isSelected ? 'bg-blue-50 text-blue-700 underline dark:bg-blue-950/40 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <td className="border border-slate-200 px-3 py-2 dark:border-slate-800">{formatShortDate(row.ldate)}</td>
                        <td className="border border-slate-200 px-3 py-2 dark:border-slate-800">{row.lcustomer_lname || '-'}</td>
                        <td className="border border-slate-200 px-3 py-2 font-semibold dark:border-slate-800">{row.ldm_no || row.lrefno}</td>
                        <td className="border border-slate-200 px-3 py-2 dark:border-slate-800">{getTransactionNo(row)}</td>
                        <td className="border border-slate-200 px-3 py-2 dark:border-slate-800">{row.ltrackingno || '-'}</td>
                        <td className="border border-slate-200 px-3 py-2 dark:border-slate-800">{row.lcurier_name || '-'}</td>
                        <td className="border border-slate-200 px-3 py-2 dark:border-slate-800">{row.lstatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-700">Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-700">Next</button>
            </div>
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-base font-bold">Freight Charges</h2>
            <div className="flex items-center gap-3 text-sm">
              {!isCreating && selected?.lstatus === 'Pending' && (
                <button type="button" disabled={saving} onClick={() => handleAction('post')} className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  POST <u>Freight Charges</u>
                </button>
              )}
              <span className="font-semibold">DM No. :</span>
              <input value={isCreating ? '' : selected?.ldm_no || ''} disabled className="h-9 w-44 rounded border border-slate-300 bg-slate-50 px-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </div>
          </div>

          {loadingDetail && <div className="px-4 py-3 text-sm text-slate-500">Loading details...</div>}

          {!isCreating && !selected && !loadingDetail && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Select a freight charge from the list, or click Create New.
            </div>
          )}

          {(isCreating || selected) && (
            <div className="p-4">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={labelCellClass}>{isCreating ? 'Sold to :' : 'Customer:'}</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <>
                          <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer" className={`${fieldClass} mb-2`} />
                          <select value={form.customerId} onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value }))} className={fieldClass}>
                            <option value="">Select Customer</option>
                            {customers.map((customer) => (
                              <option key={customer.sessionId} value={customer.sessionId}>{customer.company}</option>
                            ))}
                          </select>
                          {selectedCustomerName && <div className="mt-1 text-xs text-slate-500">{selectedCustomerName}</div>}
                        </>
                      ) : selectedCustomerName || selected?.lcustomer_lname || '-'}
                    </td>
                    <td className={labelCellClass}>Date :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} className={fieldClass} />
                      ) : formatShortDate(selected?.ldate)}
                    </td>
                  </tr>

                  <tr>
                    <td className={labelCellClass}>{isCreating ? 'Invoice/DR No. :' : 'Transaction No.:'}</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <SourceDocumentAutocomplete documents={sourceDocs} selectedDoc={selectedDoc} onSelect={applySourceDocument} disabled={!canEdit} />
                      ) : getTransactionNo(selected)}
                    </td>
                    <td className={labelCellClass}>Tracking No. :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <input value={form.trackingNo} onChange={(event) => setForm((prev) => ({ ...prev, trackingNo: event.target.value }))} placeholder="Input Tracking Number" className={fieldClass} />
                      ) : selected?.ltrackingno || '-'}
                    </td>
                  </tr>

                  <tr>
                    <td className={labelCellClass}>Courier Name :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <input value={form.courierName} onChange={(event) => setForm((prev) => ({ ...prev, courierName: event.target.value }))} placeholder="Input Courier" className={fieldClass} />
                      ) : selected?.lcurier_name || '-'}
                    </td>
                    <td className={labelCellClass}>Transaction Type :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <select
                          value={form.transactionType}
                          onChange={(event) => {
                            const nextType = event.target.value as FreightTransactionType;
                            setSelectedDoc((prev) => (prev?.type === nextType ? prev : null));
                            setForm((prev) => ({
                              ...prev,
                              transactionType: nextType,
                              ...(nextType === 'No Reference' ? { transactionRefNo: '', invoiceNo: '' } : {}),
                            }));
                          }}
                          className={fieldClass}
                        >
                          <option value="No Reference">No Reference</option>
                          <option value="Invoice">Invoice</option>
                          <option value="Order Slip">Order Slip</option>
                        </select>
                      ) : selected?.ltransaction_type || '-'}
                    </td>
                  </tr>

                  <tr>
                    <td className={labelCellClass}>{isCreating ? '' : 'Collection Type'}</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.isFreightCollect}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              isFreightCollect: event.target.checked,
                              amount: event.target.checked ? '0' : prev.amount,
                              remarks: event.target.checked && !prev.remarks.startsWith('Freight Collect:') ? 'Freight Collect: ' : prev.remarks,
                            }))}
                          />
                          {isCreating ? 'Freight Collection' : 'Freight Collection?'}
                        </label>
                      ) : Number(selected?.IsFreightCollect || 0) === 1 ? 'Freight Collection' : 'REGULAR'}
                    </td>
                    <td className={labelCellClass}>Reference No :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <input
                          value={form.transactionRefNo}
                          onChange={(event) => {
                            setSelectedDoc(null);
                            setForm((prev) => ({ ...prev, transactionRefNo: event.target.value }));
                          }}
                          className={fieldClass}
                        />
                      ) : selected?.ltrans_refno || '-'}
                    </td>
                  </tr>

                  <tr>
                    <td className={labelCellClass}>Amount :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <input type="number" min="0" step="0.01" value={form.amount} disabled={form.isFreightCollect} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Input Amount" className={fieldClass} />
                      ) : peso.format(Number(selected?.lamt || 0))}
                    </td>
                    <td className={labelCellClass}>Remarks :</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <input value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} placeholder="Input Remarks" className={fieldClass} />
                      ) : selected?.lremarks || '-'}
                    </td>
                  </tr>

                  {isCreating && (
                    <tr>
                      <td className={labelCellClass}></td>
                      <td colSpan={3} className={valueCellClass}>
                        <button type="button" disabled={saving} onClick={handleCreate} className={buttonClass}>
                          {saving ? 'Saving...' : 'Add Record'}
                        </button>
                        <button type="button" onClick={() => setIsCreating(false)} className="ml-2 inline-flex h-9 items-center rounded border border-slate-300 px-4 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {!isCreating && selected?.lstatus === 'Pending' && (
              <>
                <button type="button" disabled={saving} onClick={handleDelete} className="inline-flex h-9 w-24 items-center justify-center rounded bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </button>
                <button type="button" disabled={saving} onClick={handleSave} className={buttonClass}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            {!isCreating && selected?.lstatus === 'Posted' && (
              <>
                <button type="button" disabled={saving} onClick={() => handleAction('unpost')} className="inline-flex h-9 w-24 items-center justify-center rounded bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                  UnPost
                </button>
                <button type="button" onClick={() => window.print()} className={buttonClass}>
                  Print
                </button>
              </>
            )}
            {!selected && !isCreating && (
              <>
                <button type="button" disabled className={`${buttonClass} opacity-60`}>Delete</button>
                <button type="button" disabled className={`${buttonClass} opacity-60`}>Print</button>
              </>
            )}
          </div>
        </section>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="text-lg font-semibold">Search Options</h3>
              <button type="button" onClick={() => setShowSearchModal(false)} className="text-xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-slate-100">&times;</button>
            </div>
            <div className="space-y-4 p-4">
              <label className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3 text-sm">
                <span className="font-semibold">Ref No.</span>
                <input value={searchDraft.dmNo} onChange={(event) => setSearchDraft((prev) => ({ ...prev, dmNo: event.target.value }))} placeholder="Input DM No." className={fieldClass} />
              </label>
              <label className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3 text-sm">
                <span className="font-semibold">Customer</span>
                <input value={searchDraft.customer} onChange={(event) => setSearchDraft((prev) => ({ ...prev, customer: event.target.value }))} placeholder="Input Customer" className={fieldClass} />
              </label>
              <label className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3 text-sm">
                <span className="font-semibold">Tracking No.</span>
                <input value={searchDraft.trackingNo} onChange={(event) => setSearchDraft((prev) => ({ ...prev, trackingNo: event.target.value }))} placeholder="Input Tracking No." className={fieldClass} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <button type="button" onClick={applySearchModal} className={buttonClass}>Submit</button>
              <button type="button" onClick={() => setShowSearchModal(false)} className="inline-flex h-9 items-center rounded border border-slate-300 px-4 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightChargesDebitView;
