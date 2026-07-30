import React, { useEffect, useMemo, useRef, useState } from 'react';
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
          placeholder="*Input DR/INV Number*"
          aria-busy={isSearching}
          className="h-[34px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 text-[13px] text-[#555] outline-none focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,.6)] disabled:bg-[#eee]"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[3px] border border-[#ccc] bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-[#777]">No invoice or order slip found.</div>
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
                  className={`cursor-pointer px-3 py-2 ${selectedIndex === index ? 'bg-[#ddd]' : 'hover:bg-[#eee]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#333]">{doc.doc_no || doc.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${doc.type === 'Invoice' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {doc.type}
                    </span>
                  </div>
                  <div className="truncate text-xs text-[#777]">{doc.customer_name || 'Unknown Customer'}</div>
                  <div className="text-[11px] text-[#999]">
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
  const [appliedMonth, setAppliedMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [appliedYear, setAppliedYear] = useState(String(today.getFullYear()));

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
        month: appliedMonth,
        year: appliedYear,
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
  }, [search, statusFilter, appliedMonth, appliedYear, page]);

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
    setAppliedMonth(String(today.getMonth() + 1).padStart(2, '0'));
    setAppliedYear(String(today.getFullYear()));
    setPage(1);
  };

  const openSelectedRecord = (row: FreightCharge) => {
    setIsCreating(false);
    setSelectedRefno(row.lrefno);
  };

  const fieldClass = 'h-[34px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 text-[13px] text-[#555] outline-none focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,.6)] disabled:bg-[#eee] disabled:text-[#777]';
  const labelCellClass = 'w-[15%] border-0 px-2 py-2 text-right align-middle text-[13px] font-semibold text-[#444]';
  const valueCellClass = 'w-[35%] border-0 px-2 py-2 align-middle text-[13px] text-[#444]';
  const secondaryButton = 'inline-flex min-h-[34px] items-center justify-center rounded-[4px] border border-[#54718d] bg-[#6685a4] px-3 text-[13px] font-normal text-white shadow-sm hover:bg-[#516c87] disabled:cursor-not-allowed disabled:opacity-60';
  const successButton = 'inline-flex min-h-[34px] items-center justify-center rounded-[4px] border border-[#4cae4c] bg-[#5cb85c] px-3 text-[13px] font-normal text-white shadow-sm hover:bg-[#449d44] disabled:cursor-not-allowed disabled:opacity-60';
  const dangerButton = 'inline-flex min-h-[34px] items-center justify-center rounded-[4px] border border-[#d43f3a] bg-[#d9534f] px-3 text-[13px] font-normal text-white shadow-sm hover:bg-[#c9302c] disabled:cursor-not-allowed disabled:opacity-60';
  const cellClass = 'border border-[#ddd] px-2 py-2 text-[13px] text-[#444]';

  return (
    <div className="h-full overflow-auto bg-white px-[15px] py-5 font-sans text-[#444]">
      <div className="relative mx-auto w-full max-w-[1170px]">
        {error && (
          <div className="mb-5 rounded-[4px] border border-[#ebccd1] bg-[#f2dede] px-[15px] py-[15px] text-[13px] text-[#a94442]">
            <strong>Ooops !</strong> {error}.
          </div>
        )}

        <section className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-t-[5px] border border-[#ddd] px-5 py-5">
            <div className="flex flex-wrap gap-[5px]">
              <button type="button" onClick={() => setShowSearchModal(true)} className={secondaryButton}>Search</button>
              <button type="button" onClick={handleCreateMode} className={successButton}>Create New</button>
              <button type="button" onClick={clearFilters} className={successButton}>Refresh</button>
            </div>
            <div className="flex flex-wrap items-center gap-[10px]">
              <label className="text-[14px] font-semibold">Filter by Month:</label>
              <select value={month} onChange={(event) => setMonth(event.target.value)} className={`${fieldClass} w-[200px]`}>
                {monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))} className={`${fieldClass} w-[100px]`} />
              <button
                type="button"
                onClick={() => {
                  setAppliedMonth(month);
                  setAppliedYear(year);
                  setPage(1);
                }}
                className={successButton}
              >
                Filter
              </button>
            </div>
          </div>

          <div className="rounded-b-[5px] border border-t-0 border-[#ddd] bg-white p-[25px] pt-[30px]">
            <div className="mb-2 text-[13px]"><b>Filtered By:</b> {search || 'All Records'}</div>
            <div className="max-h-[150px] overflow-auto">
              <table id="tblrecordlist" className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    <th className={`${cellClass} w-[10%] text-left font-medium shadow-[2px_2px_2px_-1px_rgba(0,0,0,.4)]`}>Date</th>
                    <th className={`${cellClass} w-[25%] text-left font-medium shadow-[2px_2px_2px_-1px_rgba(0,0,0,.4)]`}>Customer</th>
                    <th className={`${cellClass} w-[10%] text-left font-medium shadow-[2px_2px_2px_-1px_rgba(0,0,0,.4)]`}>DM No.</th>
                    <th className={`${cellClass} w-[10%] text-left font-medium shadow-[2px_2px_2px_-1px_rgba(0,0,0,.4)]`}>Transaction No.</th>
                    <th className={`${cellClass} w-[15%] text-left font-medium shadow-[2px_2px_2px_-1px_rgba(0,0,0,.4)]`}>Tracking No.</th>
                    <th className={`${cellClass} w-[15%] text-left font-medium shadow-[2px_2px_2px_-1px_rgba(0,0,0,.4)]`}>Courier</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList && <tr><td colSpan={6} className={`${cellClass} text-center`}>Loading records...</td></tr>}
                  {!loadingList && rows.length === 0 && <tr><td colSpan={6} className={`${cellClass} text-center`}>No freight charges found.</td></tr>}
                  {!loadingList && rows.map((row) => {
                    const isSelected = selectedRefno === row.lrefno;
                    return (
                      <tr key={row.lrefno} onClick={() => openSelectedRecord(row)} className={`cursor-pointer ${isSelected ? 'text-blue-600' : ''}`}>
                        <td className={`${cellClass} ${isSelected ? 'text-blue-600' : ''}`}>{formatShortDate(row.ldate)}</td>
                        <td className={`${cellClass} ${isSelected ? 'text-blue-600' : ''}`}>{row.lcustomer_lname || '-'}</td>
                        <td className={`${cellClass} underline ${isSelected ? 'text-blue-600' : ''}`}>{row.ldm_no || row.lrefno}</td>
                        <td className={`${cellClass} text-blue-600 underline`}>{getTransactionNo(row)}</td>
                        <td className={`${cellClass} ${isSelected ? 'text-blue-600' : ''}`}>{row.ltrackingno || '-'}</td>
                        <td className={`${cellClass} ${isSelected ? 'text-blue-600' : ''}`}>{row.lcurier_name || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="flex min-h-[75px] flex-wrap items-center justify-between gap-4 rounded-t-[5px] border border-[#ddd] px-5 py-5">
            <h2 className="relative m-0 text-[18px] font-medium after:absolute after:-bottom-[23px] after:left-0 after:h-px after:w-full after:bg-[#6685a4]">Freight Charges</h2>
            <div className="flex items-center gap-2 text-[14px]">
              {!isCreating && selected?.lstatus === 'Pending' && (
                <button type="button" disabled={saving} onClick={() => handleAction('post')} className={successButton}>
                  <b>POST <u>Freight Charges</u></b>
                </button>
              )}
              {isCreating ? (
                <>
                  <span className="font-semibold">No. :</span>
                  <input value="" disabled className={`${fieldClass} w-[165px]`} />
                </>
              ) : selected ? (
                <span className="font-semibold">DM No. : {selected.ldm_no}</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-b-[5px] border border-t-0 border-[#ddd] bg-white p-[25px] pt-[30px]">
            {loadingDetail && <div className="py-3 text-[13px] text-[#777]">Loading details...</div>}
            {!isCreating && !selected && !loadingDetail && (
              <div className="py-6 text-center text-[13px] text-[#777]">Select a freight charge from the list, or click Create New.</div>
            )}
            {(isCreating || selected) && (
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={labelCellClass}>{isCreating ? 'Sold to :' : 'Customer:'}</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <select value={form.customerId} onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value }))} className={fieldClass}>
                          <option value="">Select Customer</option>
                          {customers.map((customer) => <option key={customer.sessionId} value={customer.sessionId}>{customer.company}</option>)}
                        </select>
                      ) : selectedCustomerName || selected?.lcustomer_lname || '-'}
                    </td>
                    <td className={labelCellClass}>Date :</td>
                    <td className={valueCellClass}>
                      {canEdit ? <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} className={fieldClass} /> : formatShortDate(selected?.ldate)}
                    </td>
                  </tr>
                  <tr>
                    <td className={labelCellClass}>{isCreating ? 'Invoice/DR No. :' : 'Transaction No.:'}</td>
                    <td className={valueCellClass}>
                      {isCreating ? <SourceDocumentAutocomplete documents={sourceDocs} selectedDoc={selectedDoc} onSelect={applySourceDocument} /> : getTransactionNo(selected)}
                    </td>
                    <td className={labelCellClass}>{isCreating ? '' : 'Tracking No. :'}</td>
                    <td className={valueCellClass}>
                      {!isCreating && (canEdit ? <input value={form.trackingNo} onChange={(event) => setForm((prev) => ({ ...prev, trackingNo: event.target.value }))} placeholder="Input Tracking Number" className={fieldClass} /> : selected?.ltrackingno || '-')}
                    </td>
                  </tr>
                  {isCreating && (
                    <tr>
                      <td className={labelCellClass}>Tracking No. :</td>
                      <td className={valueCellClass}><input value={form.trackingNo} onChange={(event) => setForm((prev) => ({ ...prev, trackingNo: event.target.value }))} placeholder="Input Tracking Number" className={fieldClass} /></td>
                      <td className={labelCellClass}>Courier Name :</td>
                      <td className={valueCellClass}><input value={form.courierName} onChange={(event) => setForm((prev) => ({ ...prev, courierName: event.target.value }))} placeholder="Input Courier" className={fieldClass} /></td>
                    </tr>
                  )}
                  {!isCreating && (
                    <tr>
                      <td className={labelCellClass}>Courier Name :</td>
                      <td className={valueCellClass}>{canEdit ? <input value={form.courierName} onChange={(event) => setForm((prev) => ({ ...prev, courierName: event.target.value }))} placeholder="Input Courier" className={fieldClass} /> : selected?.lcurier_name || '-'}</td>
                      <td className={labelCellClass}></td>
                      <td className={valueCellClass}></td>
                    </tr>
                  )}
                  <tr>
                    <td className={labelCellClass}>{isCreating ? '' : 'Collection Type'}</td>
                    <td className={valueCellClass}>
                      {canEdit ? (
                        <label className="inline-flex items-center gap-1 text-[13px] font-semibold">
                          <input
                            type="checkbox"
                            checked={form.isFreightCollect}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              isFreightCollect: event.target.checked,
                              amount: event.target.checked ? '0' : '',
                              remarks: event.target.checked ? 'Freight Collect: ' : '',
                            }))}
                          />
                          {isCreating ? 'Freight Collection' : 'Freight Collection?'}
                        </label>
                      ) : Number(selected?.IsFreightCollect || 0) === 1 ? 'Freight Collection' : 'REGULAR'}
                    </td>
                    <td className={labelCellClass}></td>
                    <td className={valueCellClass}></td>
                  </tr>
                  <tr>
                    <td className={labelCellClass}>Amount :</td>
                    <td className={valueCellClass}>{canEdit ? <input type="number" min="0" step="0.01" value={form.amount} readOnly={form.isFreightCollect} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Input Amount" className={fieldClass} /> : String(Number(selected?.lamt || 0))}</td>
                    <td className={labelCellClass}>Remarks :</td>
                    <td className={valueCellClass}>{canEdit ? <input value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} placeholder="Input Remarks" className={fieldClass} /> : selected?.lremarks || '-'}</td>
                  </tr>
                  {isCreating && (
                    <tr>
                      <td className={labelCellClass}></td>
                      <td colSpan={3} className={valueCellClass}>
                        <button type="button" disabled={saving} onClick={handleCreate} className={secondaryButton}>{saving ? 'Saving...' : 'Add Record'}</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {!isCreating && (
          <section className="mb-8 rounded-[5px] border border-[#ddd] bg-white">
            <div className="flex min-h-[75px] flex-wrap items-center gap-[5px] px-5 py-5">
              {selected?.lstatus === 'Pending' && (
                <>
                  <button type="button" disabled={saving} onClick={handleDelete} className={`${dangerButton} w-[90px]`}>Delete</button>
                  <button type="button" disabled={saving} onClick={handleSave} className={`${successButton} w-[90px]`}>{saving ? 'Saving...' : 'Save'}</button>
                </>
              )}
              {selected?.lstatus === 'Posted' && (
                <>
                  <button type="button" disabled={saving} onClick={() => handleAction('unpost')} className={`${dangerButton} w-[90px]`}>UnPost</button>
                  <button type="button" onClick={() => window.print()} className={`${successButton} w-[90px]`}>Print</button>
                </>
              )}
              {!selected && (
                <>
                  <button type="button" disabled className={`${successButton} w-[90px]`}>Delete</button>
                  <button type="button" disabled className={`${successButton} w-[90px]`}>Print</button>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[600px] rounded-[6px] border border-black/20 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-[15px] py-[15px]">
              <h3 className="m-0 text-[20px] font-medium">Search Options</h3>
              <button type="button" onClick={() => setShowSearchModal(false)} className="text-[21px] font-bold leading-none text-black/30 hover:text-black/60">&times;</button>
            </div>
            <div className="space-y-5 px-[15px] py-[15px]">
              <label className="grid grid-cols-[25%_58.333%] items-center text-[13px]">
                <span className="text-right font-semibold pr-[15px]">Ref No.</span>
                <input value={searchDraft.dmNo} onChange={(event) => setSearchDraft((prev) => ({ ...prev, dmNo: event.target.value }))} placeholder="Input DM No." className={fieldClass} />
              </label>
              <label className="grid grid-cols-[25%_58.333%] items-center text-[13px]">
                <span className="text-right font-semibold pr-[15px]">Customer</span>
                <select value={searchDraft.customer} onChange={(event) => setSearchDraft((prev) => ({ ...prev, customer: event.target.value }))} className={fieldClass}>
                  <option value="">Select Customer</option>
                  {customers.map((customer) => <option key={customer.sessionId} value={customer.company}>{customer.company}</option>)}
                </select>
              </label>
              <label className="grid grid-cols-[25%_58.333%] items-center text-[13px]">
                <span className="text-right font-semibold pr-[15px]">Tracking No.</span>
                <input value={searchDraft.trackingNo} onChange={(event) => setSearchDraft((prev) => ({ ...prev, trackingNo: event.target.value }))} placeholder="Input Tracking No." className={fieldClass} />
              </label>
            </div>
            <div className="flex justify-end gap-[5px] border-t border-[#e5e5e5] px-[15px] py-[15px]">
              <button type="button" onClick={applySearchModal} className={successButton}>Submit</button>
              <button type="button" onClick={() => setShowSearchModal(false)} className={secondaryButton}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightChargesDebitView;
