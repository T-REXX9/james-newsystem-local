import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Search, Printer, Pencil } from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  getInvoice,
  getInvoicesPage,
  printInvoice,
  cancelInvoice,
  unpostInvoice,
  updateInvoiceNumber,
} from '../services/invoiceLocalApiService';
import { getLocalAuthSession } from '../services/localAuthService';
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import { isInvoiceAllowedForTransactionType, syncDocumentPolicyState } from '../services/salesOrderLocalApiService';
import { Contact, Invoice, InvoiceStatus } from '../types';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';

interface InvoiceViewProps {
  initialInvoiceId?: string;
  initialInvoiceRefNo?: string;
}

const VAT_RATE = 0.12;
const FINAL_DOCUMENT_STATUSES = new Set<InvoiceStatus>([InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED]);

const MONTH_OPTIONS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const INVOICE_LIST_COLUMN_WIDTHS = [
  '8rem',
  '23%',
  '11rem',
  '11rem',
  '10rem',
  '11rem',
  '10rem',
  '14%',
  '10rem',
];

const documentStatusMeta: Record<InvoiceStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  [InvoiceStatus.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [InvoiceStatus.SENT]: { label: 'Sent', tone: 'info' },
  [InvoiceStatus.PAID]: { label: 'Paid', tone: 'success' },
  [InvoiceStatus.OVERDUE]: { label: 'Overdue', tone: 'warning' },
  [InvoiceStatus.CANCELLED]: { label: 'Cancelled', tone: 'danger' },
};

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const formatCurrency = (value?: number | string | null): string => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString()}`;
};

const InvoiceView: React.FC<InvoiceViewProps> = ({ initialInvoiceId, initialInvoiceRefNo }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [draftCustomerFilter, setDraftCustomerFilter] = useState('');
  const [draftCustomerSearchTerm, setDraftCustomerSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [printing, setPrinting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [unpostModalOpen, setUnpostModalOpen] = useState(false);
  const [unpostLoading, setUnpostLoading] = useState(false);
  const [editNumberModalOpen, setEditNumberModalOpen] = useState(false);
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editTrackingNo, setEditTrackingNo] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const isAdminOrOwner = useMemo(() => {
    const session = getLocalAuthSession();
    const role = (session?.context?.user_type || session?.context?.user?.type || '').toLowerCase();
    return role === 'owner' || role === 'admin';
  }, []);

  const targetMonthYear = useMemo(() => {
    if (!dateRange.from) {
      return {
        month: undefined as number | undefined,
        year: undefined as number | undefined,
      };
    }
    const src = new Date(dateRange.from);
    return {
      month: src.getMonth() + 1,
      year: src.getFullYear(),
    };
  }, [dateRange.from]);

  const loadContacts = useCallback(async () => {
    try {
      const contactsData = await fetchContacts();
      setContacts(contactsData);
    } catch (err) {
      console.error('Failed loading invoice contacts:', err);
      setContacts([]);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getInvoicesPage({
        month: targetMonthYear.month,
        year: targetMonthYear.year,
        status: statusFilter === 'all' ? 'all' : statusFilter,
        search: debouncedSearch,
        page,
        perPage: 100,
      });
      setInvoices(result.items);
      setTotalPages(Math.max(1, result.meta.total_pages || 1));
    } catch (err) {
      console.error('Failed loading invoices:', err);
      setInvoices([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, statusFilter, targetMonthYear.month, targetMonthYear.year]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => String(a.company || '').localeCompare(String(b.company || ''), undefined, { sensitivity: 'base' })),
    [contacts]
  );
  const visibleCustomerOptions = useMemo(() => {
    const query = draftCustomerSearchTerm.trim().toLowerCase();
    if (!query) return sortedContacts;
    return sortedContacts.filter(contact => String(contact.company || '').toLowerCase().includes(query));
  }, [draftCustomerSearchTerm, sortedContacts]);

  const notifyInvoiceEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: 'success' | 'failed',
    entityId: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    void title;
    void message;
    void action;
    void status;
    void entityId;
    void type;
  }, []);

  useEffect(() => {
    if (invoices.length > 0 && !selectedInvoice) {
      setSelectedInvoice(invoices[0]);
    }
  }, [invoices, selectedInvoice]);

  useEffect(() => {
    if (!invoices.length) return;
    const invoiceById = initialInvoiceId ? invoices.find(entry => entry.id === initialInvoiceId) : null;
    const invoiceByNo = initialInvoiceRefNo
      ? invoices.find(entry => String(entry.invoice_no || '').toLowerCase() === initialInvoiceRefNo.toLowerCase())
      : null;
    const invoice = invoiceById || invoiceByNo;
    if (invoice) setSelectedInvoice(invoice);
  }, [initialInvoiceId, initialInvoiceRefNo, invoices]);

  useEffect(() => {
    if (!selectedInvoice?.id) return;
    let active = true;
    getInvoice(selectedInvoice.id)
      .then((detail) => {
        if (!active || !detail) return;
        setSelectedInvoice(detail);
      })
      .catch((err) => {
        console.error('Failed loading selected invoice detail:', err);
      });
    return () => {
      active = false;
    };
  }, [selectedInvoice?.id]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateRange.from, dateRange.to]);

  const selectedCustomer = selectedInvoice ? customerMap.get(selectedInvoice.contact_id) : null;
  const selectedCustomerLabel = selectedCustomer?.company || selectedInvoice?.contact_id || '-';
  const subtotal = selectedInvoice?.items.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const vatAmount = subtotal * VAT_RATE;
  const grandTotal = selectedInvoice?.grand_total || subtotal + vatAmount;
  const canProcessInvoice = isInvoiceAllowedForTransactionType(selectedCustomer?.transactionType);
  const totalQty = selectedInvoice?.items.reduce((sum, item) => sum + item.qty, 0) || 0;

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  const handlePrint = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;
    setPrinting(true);

    const printedAt = new Date().toISOString();
    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, { printed_at: printedAt } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? { ...prev, printed_at: printedAt } : null);

    try {
      const updated = await printInvoice(selectedInvoice.id);
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      await notifyInvoiceEvent('Invoice Printed', `Invoice ${selectedInvoice.invoice_no} printed.`, 'print', 'success', selectedInvoice.id);
      window.print();
    } catch (err) {
      console.error('Error printing invoice:', err);
      await notifyInvoiceEvent('Invoice Print Failed', `Failed to print invoice ${selectedInvoice.invoice_no}.`, 'print', 'failed', selectedInvoice.id, 'error');
      alert('Failed to print invoice');
    } finally {
      setPrinting(false);
      await loadInvoices();
    }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      const updated = await cancelInvoice(selectedInvoice.id, cancelReason.trim());
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      setCancelModalOpen(false);
      setCancelReason('');
      await loadInvoices();
    } catch (err) {
      console.error('Failed to cancel invoice:', err);
      alert('Failed to cancel invoice');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUnpost = async () => {
    if (!selectedInvoice) return;
    setUnpostLoading(true);
    try {
      const updated = await unpostInvoice(selectedInvoice.id);
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      setUnpostModalOpen(false);
      await loadInvoices();
    } catch (err) {
      console.error('Failed to unpost invoice:', err);
      alert('Failed to unpost invoice');
    } finally {
      setUnpostLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    setPage(1);
    setSearchTerm(draftSearchTerm.trim());
    setDebouncedSearch(draftSearchTerm.trim());
    setCustomerFilter(draftCustomerFilter);
    setDraftCustomerSearchTerm('');
    setSearchModalOpen(false);
  };

  const handleSearchModalClose = () => {
    setDraftSearchTerm(searchTerm);
    setDraftCustomerFilter(customerFilter);
    setDraftCustomerSearchTerm('');
    setSearchModalOpen(false);
  };

  const handleSearchModalOpen = () => {
    setDraftSearchTerm(searchTerm);
    setDraftCustomerFilter(customerFilter);
    setDraftCustomerSearchTerm('');
    setSearchModalOpen(true);
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDraftSearchTerm('');
    setDebouncedSearch('');
    setCustomerFilter('');
    setDraftCustomerFilter('');
    setDraftCustomerSearchTerm('');
    setStatusFilter('all');
    setDateRange({ from: '', to: '' });
    setPage(1);
    setSelectedInvoice(null);
  };

  const handleMonthChange = (monthValue: string) => {
    if (!monthValue) {
      setDateRange({ from: '', to: '' });
      return;
    }
    const year = targetMonthYear.year || new Date().getFullYear();
    const month = monthValue.padStart(2, '0');
    setDateRange({ from: `${year}-${month}-01`, to: '' });
  };

  const handleYearChange = (yearValue: string) => {
    if (!yearValue) {
      setDateRange({ from: '', to: '' });
      return;
    }
    const month = String(targetMonthYear.month || new Date().getMonth() + 1).padStart(2, '0');
    setDateRange({ from: `${yearValue}-${month}-01`, to: '' });
  };

  const handleFilterApply = async () => {
    setPage(1);
    await loadInvoices();
  };

  const handleEditInvoiceNumber = async () => {
    if (!selectedInvoice || !editInvoiceNo.trim() || !editReason.trim()) return;
    setEditLoading(true);
    try {
      const updated = await updateInvoiceNumber(selectedInvoice.id, {
        invoice_no: editInvoiceNo.trim(),
        sales_date: editInvoiceDate,
        reason: editReason.trim(),
        tracking_no: editTrackingNo,
      });
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      setEditNumberModalOpen(false);
      await loadInvoices();
    } catch (err) {
      console.error('Failed to update invoice number:', err);
      alert('Failed to update invoice number');
    } finally {
      setEditLoading(false);
    }
  };

  const isOverdue = selectedInvoice && selectedInvoice.due_date && new Date(selectedInvoice.due_date) < new Date() && selectedInvoice.status !== InvoiceStatus.PAID;
  const workflowStage = useMemo<'inquiry' | 'order' | 'document'>(() => {
    if (!selectedInvoice) return 'inquiry';
    return FINAL_DOCUMENT_STATUSES.has(selectedInvoice.status) ? 'document' : 'order';
  }, [selectedInvoice]);
  const workflowDocumentStatus = useMemo(() => {
    if (!selectedInvoice || workflowStage !== 'document') return undefined;
    return documentStatusMeta[selectedInvoice.status];
  }, [selectedInvoice, workflowStage]);

  const activeFilterLabel = useMemo(() => {
    if (!targetMonthYear.month || !targetMonthYear.year) return 'All Records';
    return `${MONTH_OPTIONS[targetMonthYear.month - 1]} ${targetMonthYear.year}`;
  }, [targetMonthYear.month, targetMonthYear.year]);

  const filteredInvoices = useMemo(() => {
    if (!customerFilter) return invoices;
    return invoices.filter(inv => inv.contact_id === customerFilter);
  }, [customerFilter, invoices]);

  const invoiceRowTone = (invoice: Invoice) => {
    if (invoice.status === InvoiceStatus.CANCELLED) return 'text-red-600';
    if (selectedInvoice?.id === invoice.id) return 'text-brand-blue font-semibold';
    return 'text-slate-700 dark:text-slate-200';
  };

  const isCancelled = selectedInvoice?.status === InvoiceStatus.CANCELLED;
  const isPostedOrSent = selectedInvoice?.status === InvoiceStatus.SENT || selectedInvoice?.status === InvoiceStatus.PAID;

  return (
    <div className="w-full flex flex-col bg-white dark:bg-slate-900 p-3 gap-4">
      {/* Step 2: Top filter/action bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSearchModalOpen}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">Filter by Month:</span>
              <select
                value={targetMonthYear.month ? String(targetMonthYear.month) : ''}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <option value="">All</option>
                {MONTH_OPTIONS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={targetMonthYear.year || ''}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-28 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                placeholder="Year"
              />
              <button
                type="button"
                onClick={handleFilterApply}
                className="px-4 py-2 rounded bg-slate-700 text-white dark:bg-slate-700"
              >
                Filter
              </button>
            </div>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Filtered By:</span> {activeFilterLabel}
          </div>
        </div>

        {/* Step 3: Invoice list table */}
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                {INVOICE_LIST_COLUMN_WIDTHS.map((width) => (
                  <col key={width} style={{ width }} />
                ))}
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">SO No.</th>
                  <th className="px-3 py-2 text-left">INV No.</th>
                  <th className="px-3 py-2 text-left">DM No.</th>
                  <th className="px-3 py-2 text-left">Tracking No.</th>
                  <th className="px-3 py-2 text-left">CR No.</th>
                  <th className="px-3 py-2 text-left">Sales Person</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
            </table>
            <div className="max-h-[220px] overflow-y-auto border border-t-0 border-slate-300 dark:border-slate-700">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {INVOICE_LIST_COLUMN_WIDTHS.map((width) => (
                    <col key={width} style={{ width }} />
                  ))}
                </colgroup>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {loading && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Loading invoices...
                        </span>
                      </td>
                    </tr>
                  )}
                  {!loading && filteredInvoices.map((invoice, index) => {
                    const customer = customerMap.get(invoice.contact_id);
                    return (
                      <tr
                        key={invoice.id}
                        onClick={() => setSelectedInvoice(invoice)}
                        className={`cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/60'} hover:bg-slate-100 dark:hover:bg-slate-800 ${invoiceRowTone(invoice)}`}
                      >
                        <td className="px-3 py-2">{formatDate(invoice.sales_date)}</td>
                        <td className="px-3 py-2">{customer?.company || invoice.contact_id}</td>
                        <td className="px-3 py-2">{invoice.order_id || '-'}</td>
                        <td className="px-3 py-2 font-semibold">{invoice.invoice_no}</td>
                        <td className="px-3 py-2">{invoice.reference_no || '-'}</td>
                        <td className="px-3 py-2">{invoice.send_by || '-'}</td>
                        <td className="px-3 py-2">{invoice.customer_reference || '-'}</td>
                        <td className="px-3 py-2">{invoice.sales_person || '-'}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                        No invoices match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded border border-slate-300 disabled:opacity-40 dark:border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded border border-slate-300 disabled:opacity-40 dark:border-slate-700"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedInvoice ? (
        <>
          {/* Step 4: Action bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-base uppercase text-slate-900 dark:text-slate-100">INVOICE</h4>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing || !canProcessInvoice}
                  className="px-3 py-2 rounded bg-slate-500 text-white text-sm disabled:opacity-40 inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print INV'}
                </button>
                {isPostedOrSent && (
                  <button
                    type="button"
                    onClick={() => setUnpostModalOpen(true)}
                    className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                  >
                    UNPOST
                  </button>
                )}
                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                  >
                    Cancel INV
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 rounded bg-brand-blue text-white text-sm inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print PDF
                </button>
              </div>
            </div>

            <div className="p-4 text-sm space-y-4">
              {/* Step 5: Invoice header form */}
              {!canProcessInvoice && selectedCustomer && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                  {selectedCustomer.company} is configured for order slip issuance. Invoice actions are disabled for this customer.
                </div>
              )}
              {isOverdue && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded p-2">
                  This invoice is overdue based on the due date.
                </div>
              )}

              <div className="overflow-x-auto">
                <table width="100%" cellPadding="8" className="tlbcustom text-sm text-slate-700 dark:text-slate-200">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '21%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '21%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '22%' }} />
                  </colgroup>
                  <tbody>
                    {/* Row 1: Invoice No. */}
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap" colSpan={4}></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Invoice No.:</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <input readOnly value={selectedInvoice.invoice_no} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                          <StatusBadge status={selectedInvoice.status} className="text-[10px] px-2 py-0.5" />
                          {isAdminOrOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditInvoiceNo(selectedInvoice.invoice_no);
                                setEditInvoiceDate(selectedInvoice.sales_date);
                                setEditReason('');
                                setEditTrackingNo(selectedInvoice.send_by || '');
                                setEditNumberModalOpen(true);
                              }}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Invoice Number"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          )}
                        </div>
                        {selectedInvoice.order_id && (
                          <span className="text-xs text-slate-500">from SO: {selectedInvoice.order_id}</span>
                        )}
                        {isCancelled && (
                          <span className="text-xs text-red-500 font-bold ml-2">(CANCELLED)</span>
                        )}
                      </td>
                    </tr>
                    {/* Row 2: Sold To, Date, Your Reference */}
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sold To M/S:</td>
                      <td><input readOnly value={selectedCustomerLabel} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Date:</td>
                      <td><input readOnly value={selectedInvoice.sales_date || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Your Reference:</td>
                      <td><input readOnly value={selectedInvoice.customer_reference || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    {/* Row 3: Business Name/TIN, Our Reference, Terms */}
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Business Name/Style:</td>
                      <td><input readOnly value="" className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" placeholder="TIN" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Our Reference:</td>
                      <td><input readOnly value={selectedInvoice.reference_no || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Terms:</td>
                      <td><input readOnly value={selectedInvoice.terms || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    {/* Row 4: OSCA/PWD, Purchase Order No., P.R. No. */}
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">OSCA/PWD ID No.:</td>
                      <td><input readOnly value="" className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" placeholder="TIN" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Purchase Order No.:</td>
                      <td><input readOnly value={selectedInvoice.po_number || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">P.R. No.:</td>
                      <td><input readOnly value="" className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    {/* Row 5: Deliver To, Shipped Via, Salesman */}
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Deliver To:</td>
                      <td><input readOnly value={selectedInvoice.delivery_address || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Shipped Via:</td>
                      <td><input readOnly value={selectedInvoice.send_by || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Salesman:</td>
                      <td><input readOnly value={selectedInvoice.sales_person || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <WorkflowStepper
                currentStage={workflowStage}
                documentLabel="Invoice"
                documentSubStatus={workflowDocumentStatus}
              />

              {/* Step 6: Line items table */}
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse text-sm border border-slate-300 dark:border-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Item Code</th>
                      <th className="px-3 py-2 text-left">Qty</th>
                      <th className="px-3 py-2 text-left">Location</th>
                      <th className="px-3 py-2 text-left">Part No.</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Unit Price</th>
                      <th className="px-3 py-2 text-left">Remark</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-200">
                    {selectedInvoice.items?.map((item, index) => (
                      <tr key={item.id || `${item.item_code}-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/30">
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{index + 1}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.item_code || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.qty}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.location || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.part_no || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.description || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.remark || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="px-3 py-3 border-t border-slate-200 dark:border-slate-700 font-bold">
                        Total Qty: {totalQty}
                      </td>
                      <td colSpan={5} className="px-3 py-3 text-right font-bold border-t border-slate-200 dark:border-slate-700">Grand Total</td>
                      <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-700">
                        <span className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 font-bold text-brand-blue">{formatCurrency(grandTotal)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Step 7: VAT summary panel */}
              <div className="flex justify-end">
                <div className="min-w-[280px] space-y-3">
                  {/* Block 1: VAT Inclusive breakdown */}
                  <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    <div className="flex justify-between"><span>Total Sales (VAT Inclusive)</span><span>₱0.00</span></div>
                    <div className="flex justify-between"><span>Less: VAT</span><span>₱0.00</span></div>
                    <div className="flex justify-between"><span>Total</span><span>₱0.00</span></div>
                    <div className="flex justify-between"><span>Less: SC/PWD Discount</span><span>₱0.00</span></div>
                    <div className="flex justify-between font-semibold"><span>Total Amount Due</span><span>₱0.00</span></div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700"></div>

                  {/* Block 2: VAT computation */}
                  <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                    <div className="flex justify-between"><span>VATable Sales</span><span>{formatCurrency(subtotal / 1.12)}</span></div>
                    <div className="flex justify-between"><span>VAT Zero Rated Sale</span><span>₱0.00</span></div>
                    <div className="flex justify-between"><span>Add: 12% VAT</span><span>{formatCurrency(vatAmount)}</span></div>
                    <div className="flex justify-between"><span>Less: W/H Tax</span><span>₱0.00</span></div>
                    <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span>TOTAL</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-16 text-center text-slate-500">
          Select an invoice from the table above to view its full details.
        </div>
      )}

      {/* Step 8: Search modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Search Invoices</h3>
            <div className="space-y-3">
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Ref No.</span>
                <input
                  type="text"
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Customer</span>
                <input
                  type="text"
                  value={draftCustomerSearchTerm}
                  onChange={(e) => setDraftCustomerSearchTerm(e.target.value)}
                  placeholder="Search customers"
                  className="mb-2 w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
                <select
                  value={draftCustomerFilter}
                  onChange={(e) => setDraftCustomerFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="">All Customers</option>
                  {visibleCustomerOptions.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.company}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleSearchModalClose}
                className="px-3 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="px-4 py-2 text-sm rounded bg-slate-700 text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 9: Cancel Invoice modal */}
      {cancelModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Cancel Invoice</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Are you sure you want to cancel this Invoice? All items will return to stock. This action cannot be undone!
            </div>
            <label className="block text-sm text-slate-700 dark:text-slate-200">
              <span className="block mb-1">Reason to Cancel:</span>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelReason('');
                }}
                className="px-3 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={!cancelReason.trim() || cancelLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {cancelLoading ? 'Processing...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 10: Unpost modal */}
      {unpostModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Unpost Invoice</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Unposting will withdraw the Ledger entry, delete the DR/Invoice attached and open the sales inquiry.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnpostModalOpen(false)}
                className="px-3 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUnpost}
                disabled={unpostLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {unpostLoading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 11: Edit Invoice Number modal */}
      {editNumberModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Edit Invoice Number</h3>
            <div className="space-y-3">
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Invoice Number</span>
                <input
                  type="text"
                  value={editInvoiceNo}
                  onChange={(e) => setEditInvoiceNo(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Invoice Date</span>
                <input
                  type="date"
                  value={editInvoiceDate}
                  onChange={(e) => setEditInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Reason to Change Number</span>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Tracking No.</span>
                <select
                  value={editTrackingNo}
                  onChange={(e) => setEditTrackingNo(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="">Select Tracking No.</option>
                  <option value="Hand Carry">Hand Carry</option>
                  <option value="LBC">LBC</option>
                  <option value="JRS">JRS</option>
                  <option value="AP Cargo">AP Cargo</option>
                  <option value="Others">Others</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditNumberModalOpen(false)}
                className="px-3 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleEditInvoiceNumber}
                disabled={!editInvoiceNo.trim() || !editReason.trim() || editLoading}
                className="px-4 py-2 text-sm rounded bg-brand-blue text-white disabled:opacity-50"
              >
                {editLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceView;
