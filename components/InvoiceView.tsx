import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Search, Printer, Pencil, ReceiptText } from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import InvoicePrintPreview from './InvoicePrintPreview';
import {
  getInvoice,
  getAllInvoices,
  printInvoice,
  cancelInvoice,
  updateInvoiceNumber,
} from '../services/invoiceLocalApiService';
import { getLocalAuthSession } from '../services/localAuthService';
import { fetchContactById, fetchContacts } from '../services/customerDatabaseLocalApiService';
import { isInvoiceAllowedForTransactionType, syncDocumentPolicyState, unpostSalesOrder } from '../services/salesOrderLocalApiService';
import { Contact, Invoice, InvoiceStatus } from '../types';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';
import { useToast } from './ToastProvider';
import {
  dispatchWorkflowNotification,
  markNotificationsAsReadByEntityKey,
  resolveNotificationUserId,
} from '../services/notificationLocalApiService';
import { PageHeader, RecordTrustStrip, WorkflowGuidance } from './common/PageScaffold';

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
const INVOICE_TAB_ID = 'sales-transaction-invoice';
const INVOICE_LIST_COLUMN_WIDTHS = [
  '10%',
  '20%',
  '10%',
  '10%',
  '10%',
  '10%',
  '10%',
  '10%',
  '10%',
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
  const { addToast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [printing, setPrinting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
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
  const [showSearchModal, setShowSearchModal] = useState(false);

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
      const allInvoices = await getAllInvoices();

      // Client-side filtering
      let filtered = allInvoices;

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter((invoice) => invoice.status === statusFilter);
      }

      // Filter by month/year
      if (targetMonthYear.month !== undefined && targetMonthYear.year !== undefined) {
        filtered = filtered.filter((invoice) => {
          const invoiceDate = new Date(invoice.created_at || '');
          if (Number.isNaN(invoiceDate.getTime())) return false;
          return (
            invoiceDate.getMonth() + 1 === targetMonthYear.month &&
            invoiceDate.getFullYear() === targetMonthYear.year
          );
        });
      }

      // Client-side smart search filtering
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const isRefNoLike = /[\d-]/g.test(query); // Contains numbers or dashes

        filtered = filtered.filter((invoice) => {
          // Always search invoice_no, reference_no, and remarks
          const refMatch = (invoice.invoice_no || '').toLowerCase().includes(query) ||
                          (invoice.reference_no || '').toLowerCase().includes(query) ||
                          (invoice.remarks || '').toLowerCase().includes(query);

          if (refMatch) return true;

          // For text-based searches, also match customer names
          if (!isRefNoLike) {
            const customerMatch = contacts.some(
              contact => contact.id === invoice.contact_id &&
                         (contact.company || '').toLowerCase().includes(query)
            );
            if (customerMatch) return true;
          }

          return false;
        });
      }

      // Client-side pagination
      const perPage = 100;
      const totalFiltered = filtered.length;
      const computedTotalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
      const start = (page - 1) * perPage;
      const paged = filtered.slice(start, start + perPage);

      setInvoices(paged);
      setTotalPages(computedTotalPages);
    } catch (err) {
      console.error('Failed loading invoices:', err);
      setInvoices([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, statusFilter, targetMonthYear.month, targetMonthYear.year, contacts]);

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
  const notifyInvoiceEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: 'success' | 'failed',
    entityId: string,
    recipients: { targetRoles?: string[]; targetUserIds?: string[] } = {},
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    const session = getLocalAuthSession();
    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'invoice',
      entityId,
      actionUrl: INVOICE_TAB_ID,
      actorId: String(session?.userProfile?.id || '').trim(),
      actorRole: session?.userProfile?.role || 'Unknown',
      targetRoles: recipients.targetRoles,
      targetUserIds: recipients.targetUserIds,
      includeActor: false,
      metadata: {
        refno: `invoice:${entityId}`,
        invoice_id: entityId,
        action_url: INVOICE_TAB_ID,
      },
    });
  }, []);

  const selectInvoice = useCallback(async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    try {
      const detail = await getInvoice(invoice.id);
      if (detail) {
        setSelectedInvoice(detail);
      }
    } catch (err) {
      console.error('Failed loading selected invoice detail:', err);
    }
  }, []);

  useEffect(() => {
    if (!invoices.length) return;
    const invoiceById = initialInvoiceId ? invoices.find(entry => entry.id === initialInvoiceId) : null;
    const invoiceByNo = initialInvoiceRefNo
      ? invoices.find(entry => String(entry.invoice_no || '').toLowerCase() === initialInvoiceRefNo.toLowerCase())
      : null;
    const invoice = invoiceById || invoiceByNo;
    if (invoice) void selectInvoice(invoice);
  }, [initialInvoiceId, initialInvoiceRefNo, invoices, selectInvoice]);

  useEffect(() => {
    if (!selectedInvoice?.contact_id) {
      setSelectedCustomerDetail(null);
      return;
    }
    let active = true;
    fetchContactById(selectedInvoice.contact_id)
      .then((detail) => {
        if (!active) return;
        setSelectedCustomerDetail(detail);
      })
      .catch((err) => {
        console.error('Failed loading selected invoice customer detail:', err);
        if (!active) return;
        setSelectedCustomerDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selectedInvoice?.contact_id]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateRange.from, dateRange.to]);

  const selectedCustomer = selectedCustomerDetail || (selectedInvoice ? customerMap.get(selectedInvoice.contact_id) : null);
  const selectedCustomerLabel = selectedCustomer?.company || selectedInvoice?.contact_id || '-';
  const subtotal = selectedInvoice?.items.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const vatAmount = subtotal * VAT_RATE;
  const grandTotal = selectedInvoice?.grand_total || subtotal + vatAmount;
  const canProcessInvoice = isInvoiceAllowedForTransactionType(selectedCustomer?.transactionType);
  const totalQty = selectedInvoice?.items.reduce((sum, item) => sum + item.qty, 0) || 0;

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  useEffect(() => {
    const userId = String(getLocalAuthSession()?.userProfile?.id || '').trim();
    if (!selectedInvoice?.id || !userId) return;
    void markNotificationsAsReadByEntityKey(userId, {
      entityType: 'invoice',
      entityId: selectedInvoice.id,
    });
  }, [selectedInvoice?.id]);

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
      setShowPrintPreview(true);
      window.setTimeout(() => window.print(), 150);
    } catch (err) {
      console.error('Error printing invoice:', err);
      await notifyInvoiceEvent(
        'Invoice Print Failed',
        `Failed to print invoice ${selectedInvoice.invoice_no}.`,
        'print',
        'failed',
        selectedInvoice.id,
        {},
        'error'
      );
      addToast({
        type: 'error',
        title: 'Failed to print invoice',
        description: 'We could not generate the invoice printout.',
        durationMs: 5000,
      });
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
      const salesOwnerUserId = await resolveNotificationUserId(selectedInvoice.created_by, selectedInvoice.sales_person);
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      await notifyInvoiceEvent(
        'Invoice Cancelled',
        `Invoice ${selectedInvoice.invoice_no} has been cancelled.`,
        'cancel',
        'success',
        selectedInvoice.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: salesOwnerUserId ? [salesOwnerUserId] : [],
        }
      );
      setCancelModalOpen(false);
      setCancelReason('');
      await loadInvoices();
    } catch (err) {
      console.error('Failed to cancel invoice:', err);
      await notifyInvoiceEvent(
        'Invoice Cancel Failed',
        `Failed to cancel invoice ${selectedInvoice.invoice_no}.`,
        'cancel',
        'failed',
        selectedInvoice.id,
        { targetRoles: ['Owner', 'Manager'] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Failed to cancel invoice',
        description: 'The invoice could not be cancelled.',
        durationMs: 5000,
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUnpost = async () => {
    if (!selectedInvoice) return;
    setUnpostLoading(true);
    try {
      const salesOrderId = String(selectedInvoice.order_id || '').trim();
      if (!salesOrderId) {
        throw new Error('This invoice is not linked to a sales order.');
      }

      await unpostSalesOrder(salesOrderId);
      const salesOwnerUserId = await resolveNotificationUserId(selectedInvoice.created_by, selectedInvoice.sales_person);
      await notifyInvoiceEvent(
        'Invoice Unposted',
        `Invoice ${selectedInvoice.invoice_no} has been unposted.`,
        'unpost',
        'success',
        selectedInvoice.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: salesOwnerUserId ? [salesOwnerUserId] : [],
        }
      );
      setUnpostModalOpen(false);
      await loadInvoices();
      window.dispatchEvent(new CustomEvent('workflow:navigate', {
        detail: { tab: 'sales-transaction-sales-order', payload: { orderId: salesOrderId } },
      }));
    } catch (err) {
      console.error('Failed to unpost invoice:', err);
      await notifyInvoiceEvent(
        'Invoice Unpost Failed',
        `Failed to unpost invoice ${selectedInvoice.invoice_no}.`,
        'unpost',
        'failed',
        selectedInvoice.id,
        { targetRoles: ['Owner', 'Manager'] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Failed to unpost invoice',
        description: err instanceof Error ? err.message : 'The invoice could not be unposted.',
        durationMs: 5000,
      });
    } finally {
      setUnpostLoading(false);
    }
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setDateRange({ from: '', to: '' });
    setPage(1);
    setSelectedInvoice(null);
  };

  // Debounce search term changes to prevent lag
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedSearch = searchTerm.trim();
      // Only update if search value actually changed
      if (trimmedSearch !== debouncedSearch) {
        setPage(1);
        setDebouncedSearch(trimmedSearch);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

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
      addToast({
        type: 'error',
        title: 'Failed to update invoice number',
        description: 'The invoice number changes could not be saved.',
        durationMs: 5000,
      });
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

  const invoiceRowTone = (invoice: Invoice) => {
    if (invoice.status === InvoiceStatus.CANCELLED) return 'text-red-600';
    if (selectedInvoice?.id === invoice.id) return 'text-brand-blue font-semibold';
    return 'text-slate-700 dark:text-slate-200';
  };

  const isCancelled = selectedInvoice?.status === InvoiceStatus.CANCELLED;
  const isPostedOrSent = selectedInvoice?.status === InvoiceStatus.SENT || selectedInvoice?.status === InvoiceStatus.PAID;
  const invoiceGuidance = (() => {
    if (!selectedInvoice) {
      return {
        title: 'Select an invoice',
        description: 'Choose an invoice to review customer details, payment status, and print/unpost actions.',
        tone: 'default' as const,
      };
    }
    if (!canProcessInvoice && selectedCustomer) {
      return {
        title: 'Invoice action disabled by customer policy',
        description: 'This customer is not currently configured for invoice processing.',
        tone: 'warning' as const,
      };
    }
    if (selectedInvoice.status === InvoiceStatus.SENT) {
      return {
        title: 'Next step: collect payment',
        description: 'This invoice is active. Review receivables or record collection when payment is received.',
        tone: 'info' as const,
      };
    }
    if (selectedInvoice.status === InvoiceStatus.PAID) {
      return {
        title: 'Paid invoice',
        description: 'This invoice is complete and preserved for customer history.',
        tone: 'success' as const,
      };
    }
    if (selectedInvoice.status === InvoiceStatus.OVERDUE || isOverdue) {
      return {
        title: 'Needs collection follow-up',
        description: 'This invoice is overdue. Review customer balance and collection status.',
        tone: 'warning' as const,
      };
    }
    if (selectedInvoice.status === InvoiceStatus.CANCELLED) {
      return {
        title: 'Cancelled invoice',
        description: 'This record is preserved for reference. New actions are disabled.',
        tone: 'danger' as const,
      };
    }
    return {
      title: 'Review invoice',
      description: 'Check details and continue with the next valid billing action.',
      tone: 'info' as const,
    };
  })();

  const legacyInputClass = 'h-[35px] w-full rounded-[4px] border border-[#c9c9c9] bg-white px-3 text-[13px] text-[#333] outline-none';
  const legacyLabelClass = 'scale-x-75 whitespace-nowrap text-center text-[16px] font-semibold text-[#29475f]';
  const legacyToday = new Date();
  const legacyMonth = targetMonthYear.month || legacyToday.getMonth() + 1;
  const legacyYear = targetMonthYear.year || legacyToday.getFullYear();
  const legacyListDate = (value?: string | null) => {
    if (!value) return '';
    const normalized = String(value).split('T')[0];
    const [dateYear, dateMonth, dateDay] = normalized.split('-');
    return dateYear && dateMonth && dateDay ? `${dateMonth}/${dateDay}/${dateYear}` : formatDate(value);
  };
  const filteredByLabel = targetMonthYear.month && targetMonthYear.year
    ? `Year: ${targetMonthYear.year} Month: ${MONTH_OPTIONS[targetMonthYear.month - 1].slice(0, 3)},`
    : 'All Records';
  const displayInvoiceStatus = (status: InvoiceStatus) => status === InvoiceStatus.CANCELLED ? 'Cancelled' : status === InvoiceStatus.DRAFT ? 'Unposted' : 'Posted';
  const legacyItems = (selectedInvoice?.items || []) as Array<Invoice['items'][number] & { brand?: string }>;

  const legacyLayout = (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] px-5 py-10 text-[#202020] dark:bg-[#f4f4f4] dark:text-[#202020]" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mx-auto w-full max-w-[1140px] space-y-[26px]">
        <section className="overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex min-h-[83px] flex-col gap-5 border-b border-[#d7d7d7] px-[35px] py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-[5px]"><button type="button" onClick={() => setShowSearchModal(true)} className="rounded-[4px] bg-[#5d82a2] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#50738f]">Search</button><button type="button" onClick={handleRefresh} className="rounded-[4px] bg-[#4caf50] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#43a047]">Refresh</button></div>
            <div className="flex flex-wrap items-center justify-end"><span className="mr-[30px] text-[20px] font-semibold text-[#29475f]">Filter by Month:</span><select value={String(legacyMonth)} onChange={(event) => handleMonthChange(event.target.value)} className="h-[34px] w-[200px] rounded-l-[4px] border border-[#cfcfcf] bg-white px-4 text-[13px] outline-none" aria-label="Filter month">{MONTH_OPTIONS.map((monthName, index) => <option key={monthName} value={String(index + 1)}>{monthName}</option>)}</select><input type="number" value={legacyYear} onChange={(event) => handleYearChange(event.target.value)} className="ml-[16px] h-[34px] w-[87px] border border-[#cfcfcf] bg-white px-3 text-[13px] outline-none" aria-label="Filter year" /><button type="button" onClick={() => void handleFilterApply()} className="h-[34px] rounded-r-[4px] bg-[#4caf50] px-[13px] text-[14px] text-white hover:bg-[#43a047]">Filter</button></div>
          </div>

          <div className="h-[207px] px-[25px] py-[25px]">
            <div className="mb-[10px] text-[13px]"><strong>Filtered By:</strong> {filteredByLabel}</div>
            <table className="w-full table-fixed border-collapse text-[12px]"><colgroup>{INVOICE_LIST_COLUMN_WIDTHS.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup><thead><tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold"><th className="px-2 pb-2">Date</th><th className="px-2 pb-2">Customer</th><th className="px-2 pb-2">SO No.</th><th className="px-2 pb-2">INV No.</th><th className="px-2 pb-2">DM No.</th><th className="px-2 pb-2">Tracking No.</th><th className="px-2 pb-2">CR No.</th><th className="px-2 pb-2">Sales Person</th><th className="px-2 pb-2">Status</th></tr></thead></table>
            <div className="max-h-[104px] overflow-y-auto"><table className="w-full table-fixed border-collapse text-[13px]"><colgroup>{INVOICE_LIST_COLUMN_WIDTHS.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup><tbody>
              {loading ? <tr><td colSpan={9} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">Loading invoices...</td></tr> : invoices.length === 0 ? <tr><td colSpan={9} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">No invoices found.</td></tr> : invoices.map((invoice) => { const customer = customerMap.get(invoice.contact_id); const selected = selectedInvoice?.id === invoice.id; const rowColor = invoice.status === InvoiceStatus.CANCELLED ? 'text-[#d33]' : selected ? 'text-[#245d91]' : 'text-[#202020]'; return <tr key={invoice.id} onClick={() => void selectInvoice(invoice)} className={`cursor-pointer hover:bg-[#f7f7f7] ${rowColor}`}><td className="border border-[#d7d7d7] px-2 py-[9px]">{legacyListDate(invoice.sales_date)}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px]" title={customer?.company || ''}>{customer?.company || ''}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px] underline">{invoice.order_id || ''}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px] underline">{invoice.invoice_no || ''}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{invoice.debit_memo_no || ''}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{invoice.tracking_no || ''}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{invoice.customer_reference || ''}</td><td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{invoice.sales_person || ''}</td><td className="border border-[#d7d7d7] px-2 py-[9px]">{displayInvoiceStatus(invoice.status)}</td></tr>; })}
            </tbody></table></div>
          </div>
        </section>

        <section className="min-h-[517px] overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex h-[64px] items-center border-b border-[#d7d7d7] px-5"><div className="relative flex h-full items-center text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[89px] after:bg-[#6a92b3]">INVOICE</div></div>
          <div className="px-[25px] pb-[28px] pt-[31px]">
            <div className="space-y-[17px]">
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center"><div className="col-span-4"></div><label className={legacyLabelClass}>Invoice No:</label><div><input readOnly value={selectedInvoice?.invoice_no || ''} aria-label="Invoice number" className={`${legacyInputClass} !bg-[#eeeeee]`} /></div></div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center"><label className={legacyLabelClass}>Sold to :</label><div className="relative"><select disabled value={selectedInvoice ? selectedCustomerLabel : ''} className={`${legacyInputClass} disabled:bg-white disabled:text-[#333]`} aria-label="Customer"><option value="">Select Customer</option>{selectedInvoice && <option value={selectedCustomerLabel}>{selectedCustomerLabel}</option>}</select><span className="pointer-events-none absolute right-[34px] top-1/2 -translate-y-1/2 text-[16px] text-[#999]">×</span></div><label className={legacyLabelClass}>Date :</label><div className="pl-2"><input readOnly value={legacyListDate(selectedInvoice?.sales_date || legacyToday.toISOString())} className={legacyInputClass} /></div><label className={legacyLabelClass}>Terms Strictly:</label><div><input readOnly value={selectedInvoice?.terms || ''} className={legacyInputClass} /></div></div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center"><div className="col-span-2 pl-[25px] pr-[7px]"><input readOnly value={selectedInvoice?.delivery_address || ''} className={legacyInputClass} /></div><label className={legacyLabelClass}>Reference No.:</label><div className="pl-2"><input readOnly value={selectedInvoice?.reference_no || ''} className={legacyInputClass} /></div><label className={legacyLabelClass}>Salesperson:</label><div className="relative"><select disabled value={selectedInvoice?.sales_person || ''} className={`${legacyInputClass} disabled:bg-white disabled:text-[#333]`} aria-label="Sales person"><option value="">Select Sales Person</option>{selectedInvoice?.sales_person && <option value={selectedInvoice.sales_person}>{selectedInvoice.sales_person}</option>}</select><span className="pointer-events-none absolute right-[34px] top-1/2 -translate-y-1/2 text-[16px] text-[#999]">×</span></div></div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center"><label className={legacyLabelClass}>Shipped Via:</label><div className="pl-[19px] pr-[3px]"><input readOnly value={selectedInvoice?.send_by || ''} className={legacyInputClass} /></div><div className="col-span-2"></div><label className={legacyLabelClass}>Prod Type:</label><div><input readOnly value={selectedInvoice?.inquiry_type || ''} className={legacyInputClass} /></div></div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center"><div className="col-span-2"></div><label className={legacyLabelClass}>Del. to:</label><div className="pl-2"><input readOnly value="" className={legacyInputClass} /></div><label className={legacyLabelClass}>PO No.:</label><div><input readOnly value={selectedInvoice?.po_number || ''} className={legacyInputClass} /></div></div>
            </div>

            <div className="mt-[39px] border-t border-[#e5e5e5] pt-[29px] overflow-x-auto"><table className="w-full min-w-[950px] table-fixed border-collapse text-[12px]"><thead><tr className="border-b-2 border-[#d5d5d5] text-center text-[14px] font-semibold"><th className="px-2 pb-2">Item Code</th><th className="px-2 pb-2">Quantity</th><th className="px-2 pb-2">Location.</th><th className="px-2 pb-2">Part No.</th><th className="px-2 pb-2">Brand</th><th className="px-2 pb-2">Description</th><th className="px-2 pb-2">Unit price</th><th className="px-2 pb-2">Remark</th><th className="px-2 pb-2">Amount</th></tr></thead><tbody>{legacyItems.map((item, index) => <tr key={item.id || `${item.item_code}-${index}`} className="border-b border-[#e1e1e1] text-center"><td className="px-2 py-2">{item.item_code || ''}</td><td className="px-2 py-2">{item.qty}</td><td className="px-2 py-2">{item.location || ''}</td><td className="px-2 py-2">{item.part_no || ''}</td><td className="px-2 py-2">{item.brand || ''}</td><td className="px-2 py-2 text-left">{item.description || ''}</td><td className="px-2 py-2 text-right">{Number(item.unit_price || 0).toFixed(2)}</td><td className="px-2 py-2">{item.remark || ''}</td><td className="px-2 py-2 text-right">{Number(item.amount || 0).toFixed(2)}</td></tr>)}</tbody><tfoot><tr><td className="px-2 py-[9px] text-right font-bold">Total Qty:</td><td className="px-2 py-[9px]"><span className="rounded-full bg-[#6f91af] px-2 py-[2px] font-bold text-white">{totalQty}</span></td><td colSpan={5}></td><td className="px-2 py-[9px] text-right font-bold">Grand Total:</td><td className="px-2 py-[9px]"><span className="rounded-full bg-[#ef4b4b] px-2 py-[2px] font-bold text-white">{Number(selectedInvoice?.grand_total || 0).toFixed(2)}</span></td></tr></tfoot></table></div>

            {selectedInvoice && <div className="mt-2 flex flex-wrap justify-end gap-[5px] border-t border-[#e3e3e3] pt-3 print:hidden"><button type="button" onClick={() => void handlePrint()} disabled={printing || !canProcessInvoice} className="rounded-[4px] bg-[#5d82a2] px-[15px] py-[9px] text-[13px] text-white disabled:opacity-50">{printing ? 'Printing...' : 'Print INV'}</button>{isPostedOrSent && <button type="button" onClick={() => setUnpostModalOpen(true)} className="rounded-[4px] bg-[#d64b47] px-[15px] py-[9px] text-[13px] text-white">UNPOST</button>}{!isCancelled && <button type="button" onClick={() => setCancelModalOpen(true)} className="rounded-[4px] bg-[#d64b47] px-[15px] py-[9px] text-[13px] text-white">Cancel INV</button>}<button type="button" onClick={() => setShowPrintPreview(true)} className="rounded-[4px] bg-[#5d82a2] px-[15px] py-[9px] text-[13px] text-white">Preview Layout</button>{isAdminOrOwner && <button type="button" onClick={() => { setEditInvoiceNo(selectedInvoice.invoice_no); setEditInvoiceDate(selectedInvoice.sales_date); setEditReason(''); setEditTrackingNo(selectedInvoice.send_by || ''); setEditNumberModalOpen(true); }} className="rounded-[4px] border border-[#ccc] px-[15px] py-[8px] text-[13px]">Edit Number</button>}</div>}
          </div>
        </section>
      </div>

      {showSearchModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-[560px] rounded-[5px] bg-white shadow-xl"><div className="border-b border-[#ddd] px-5 py-4 text-[20px] font-semibold text-[#333]">Search Options</div><div className="space-y-4 px-6 py-5"><label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Ref No.</span><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Input Ref No." className={legacyInputClass} /></label><label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Customer</span><select onChange={(event) => setSearchTerm(event.target.value)} className={legacyInputClass} defaultValue=""><option value="">Select Customer</option>{sortedContacts.map((contact) => <option key={contact.id} value={contact.company}>{contact.company}</option>)}</select></label><label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={legacyInputClass}><option value="all">All Statuses</option>{Object.values(InvoiceStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div><div className="flex justify-end gap-2 border-t border-[#ddd] px-5 py-4"><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] bg-[#4caf50] px-4 py-2 text-[13px] text-white">Submit</button></div></div></div>}
      {showPrintPreview && selectedInvoice && <InvoicePrintPreview invoice={selectedInvoice} customer={selectedCustomer} onClose={() => setShowPrintPreview(false)} />}
      {cancelModalOpen && selectedInvoice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-lg rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">Cancel Invoice</h3><p className="mb-3 text-[13px] text-[#a33]">Are you sure you want to cancel this Invoice? All items will return to stock. This action cannot be undone!</p><label className="block text-[13px]"><span className="mb-1 block">Reason to Cancel:</span><input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={legacyInputClass} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setCancelModalOpen(false); setCancelReason(''); }} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => void handleCancelInvoice()} disabled={!cancelReason.trim() || cancelLoading} className="rounded bg-[#337ab7] px-4 py-2 text-[13px] text-white disabled:opacity-50">{cancelLoading ? 'Processing...' : 'Save'}</button></div></div></div>}
      {unpostModalOpen && selectedInvoice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-lg rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">Unpost Invoice</h3><p className="mb-4 rounded border border-[#e7bbbb] bg-[#fff1f1] px-3 py-2 text-[13px] text-[#a33]">Unposting will withdraw the Ledger entry, delete the DR/Invoice attached and open the sales inquiry.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setUnpostModalOpen(false)} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => void handleUnpost()} disabled={unpostLoading} className="rounded bg-[#d64b47] px-4 py-2 text-[13px] text-white disabled:opacity-50">{unpostLoading ? 'Processing...' : 'Submit'}</button></div></div></div>}
      {editNumberModalOpen && selectedInvoice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-lg rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-4 text-[18px] font-semibold">Edit Invoice Number</h3><div className="space-y-3"><label className="block text-[13px]"><span className="mb-1 block">Invoice Number</span><input value={editInvoiceNo} onChange={(event) => setEditInvoiceNo(event.target.value)} className={legacyInputClass} /></label><label className="block text-[13px]"><span className="mb-1 block">Invoice Date</span><input type="date" value={editInvoiceDate} onChange={(event) => setEditInvoiceDate(event.target.value)} className={legacyInputClass} /></label><label className="block text-[13px]"><span className="mb-1 block">Reason to Change Number</span><input value={editReason} onChange={(event) => setEditReason(event.target.value)} className={legacyInputClass} /></label><label className="block text-[13px]"><span className="mb-1 block">Tracking No.</span><select value={editTrackingNo} onChange={(event) => setEditTrackingNo(event.target.value)} className={legacyInputClass}><option value="">Select Tracking No.</option><option value="Hand Carry">Hand Carry</option><option value="LBC">LBC</option><option value="JRS">JRS</option><option value="AP Cargo">AP Cargo</option><option value="Others">Others</option></select></label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditNumberModalOpen(false)} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => void handleEditInvoiceNumber()} disabled={!editInvoiceNo.trim() || !editReason.trim() || editLoading} className="rounded bg-[#337ab7] px-4 py-2 text-[13px] text-white disabled:opacity-50">{editLoading ? 'Updating...' : 'Update'}</button></div></div></div>}
    </div>
  );

  return legacyLayout;

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-950 p-3 gap-4">
      <PageHeader
        eyebrow="Sales Transaction"
        title="Invoice"
        subtitle="Review invoices, print documents, track payment status, and connect billing to collections."
        icon={<ReceiptText className="h-6 w-6 text-brand-blue" />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {invoices.length.toLocaleString()} invoices on page
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {activeFilterLabel}
            </span>
          </div>
        }
      />
      {/* Step 2: Top filter/action bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between text-sm">
            <div className="flex flex-wrap items-center gap-2 flex-grow">
              <div className="relative flex-grow max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by ref no. or customer name..."
                  className="w-full pl-9 pr-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
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
                {INVOICE_LIST_COLUMN_WIDTHS.map((width, index) => (
                  <col key={`invoice-header-col-${index}`} style={{ width }} />
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
                  {INVOICE_LIST_COLUMN_WIDTHS.map((width, index) => (
                    <col key={`invoice-body-col-${index}`} style={{ width }} />
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
                  {!loading && invoices.map((invoice, index) => {
                    const customer = customerMap.get(invoice.contact_id);
                    return (
                      <tr
                        key={invoice.id}
                        onClick={() => void selectInvoice(invoice)}
                        className={`cursor-pointer align-top ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/60'} hover:bg-slate-100 dark:hover:bg-slate-800 ${invoiceRowTone(invoice)}`}
                      >
                        <td className="px-3 py-2">{formatDate(invoice.sales_date)}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={customer?.company || invoice.contact_id}>
                            {customer?.company || invoice.contact_id}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 truncate leading-4" title={invoice.order_id || '-'}>
                            {invoice.order_id || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 truncate font-semibold leading-4" title={invoice.invoice_no || '-'}>
                            {invoice.invoice_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 truncate leading-4" title={invoice.debit_memo_no || '-'}>
                            {invoice.debit_memo_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 truncate leading-4" title={invoice.tracking_no || '-'}>
                            {invoice.tracking_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 truncate leading-4" title={invoice.customer_reference || '-'}>
                            {invoice.customer_reference || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={invoice.sales_person || '-'}>
                            {invoice.sales_person || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && invoices.length === 0 && (
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
                  onClick={() => setShowPrintPreview(true)}
                  className="px-3 py-2 rounded bg-brand-blue text-white text-sm inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Preview Layout
                </button>
              </div>
            </div>

            <div className="p-4 text-sm space-y-4">
              <WorkflowGuidance
                title={invoiceGuidance.title}
                description={invoiceGuidance.description}
                tone={invoiceGuidance.tone}
              />
              <RecordTrustStrip
                items={[
                  { label: 'Document No.', value: selectedInvoice.invoice_no || selectedInvoice.reference_no },
                  { label: 'Status', value: <StatusBadge status={selectedInvoice.status} /> },
                  { label: 'Created By', value: selectedInvoice.created_by || selectedInvoice.sales_person },
                  { label: 'Created Date', value: formatDate(selectedInvoice.created_at || selectedInvoice.sales_date) },
                ]}
              />
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

      {showPrintPreview && selectedInvoice && (
        <InvoicePrintPreview
          invoice={selectedInvoice}
          customer={selectedCustomer}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* Step 8: Search modal */}
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
