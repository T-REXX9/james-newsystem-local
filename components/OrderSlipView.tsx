import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Printer,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  cancelOrderSlip,
  finalizeOrderSlip,
  getOrderSlip,
  getAllOrderSlips,
  printOrderSlip,
  updateOrderSlip,
} from '../services/orderSlipLocalApiService';
import { fetchContactById, fetchContacts } from '../services/customerDatabaseLocalApiService';
import { isOrderSlipAllowedForTransactionType, syncDocumentPolicyState, unpostSalesOrder } from '../services/salesOrderLocalApiService';
import { Contact, OrderSlip, OrderSlipStatus } from '../types';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';
import { getLocalAuthSession } from '../services/localAuthService';
import { normalizePriceGroup } from '../constants/pricingGroups';
import OrderSlipPrintPreview from './OrderSlipPrintPreview';
import {
  dispatchWorkflowNotification,
  markNotificationsAsReadByEntityKey,
  resolveNotificationUserId,
} from '../services/notificationLocalApiService';
import { useToast } from './ToastProvider';
import { PageHeader, RecordTrustStrip, WorkflowGuidance } from './common/PageScaffold';

interface OrderSlipViewProps {
  initialSlipId?: string;
  initialSlipRefNo?: string;
}

const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ORDER_SLIP_LIST_COLUMN_WIDTHS = [
  '10%',
  '22%',
  '11%',
  '11%',
  '11%',
  '13%',
  '12%',
  '10%',
];
const ORDER_SLIP_TAB_ID = 'sales-transaction-order-slip';

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

const OrderSlipView: React.FC<OrderSlipViewProps> = ({ initialSlipId, initialSlipRefNo }) => {
  const { addToast } = useToast();
  const [selectedSlip, setSelectedSlip] = useState<OrderSlip | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderSlipStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [finalizing, setFinalizing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [orderSlips, setOrderSlips] = useState<OrderSlip[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [unpostModalOpen, setUnpostModalOpen] = useState(false);
  const [unpostLoading, setUnpostLoading] = useState(false);
  const [trackingNoDraft, setTrackingNoDraft] = useState('');
  const [trackingSaveLoading, setTrackingSaveLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const isAdmin = useMemo(() => {
    const session = getLocalAuthSession();
    const userType = String(session?.context?.user?.type || session?.context?.user_type || '').toLowerCase();
    return userType === 'admin' || userType === 'administrator';
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const contactsData = await fetchContacts();
      setContacts(contactsData);
    } catch (err) {
      console.error('Failed loading order slip contacts:', err);
      setContacts([]);
    }
  }, []);

  const loadOrderSlips = useCallback(async () => {
    setLoading(true);
    try {
      const allSlips = await getAllOrderSlips();

      // Client-side filtering
      let filtered = allSlips;

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter((slip) => slip.status === statusFilter);
      }

      // Filter by month/year
      if (month !== undefined && year !== undefined) {
        filtered = filtered.filter((slip) => {
          const slipDate = new Date(slip.created_at || '');
          if (Number.isNaN(slipDate.getTime())) return false;
          return (
            slipDate.getMonth() + 1 === month &&
            slipDate.getFullYear() === year
          );
        });
      }

      // Client-side smart search filtering
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const isRefNoLike = /[\d-]/g.test(query); // Contains numbers or dashes

        filtered = filtered.filter((slip) => {
          // Always search slip_no, reference_no, and remarks
          const refMatch = (slip.slip_no || '').toLowerCase().includes(query) ||
                          (slip.reference_no || '').toLowerCase().includes(query) ||
                          (slip.remarks || '').toLowerCase().includes(query);

          if (refMatch) return true;

          // For text-based searches, also match customer names
          if (!isRefNoLike) {
            const customerMatch = contacts.some(
              contact => contact.id === slip.contact_id &&
                         (contact.company || '').toLowerCase().includes(query)
            );
            if (customerMatch) return true;
          }

          return false;
        });
      }

      // Client-side pagination
      const perPage = 50;
      const totalFiltered = filtered.length;
      const computedTotalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
      const start = (page - 1) * perPage;
      const paged = filtered.slice(start, start + perPage);

      setOrderSlips(paged);
      setTotalPages(computedTotalPages);
    } catch (err) {
      console.error('Failed loading order slips:', err);
      setOrderSlips([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [month, year, debouncedSearch, statusFilter, page, contacts]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmedSearch = searchTerm.trim();
      // Only update if search value actually changed
      if (trimmedSearch !== debouncedSearch) {
        setPage(1);
        setDebouncedSearch(trimmedSearch);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    loadOrderSlips();
  }, [loadOrderSlips]);

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => String(a.company || '').localeCompare(String(b.company || ''), undefined, { sensitivity: 'base' })),
    [contacts]
  );

  const notifyOrderSlipEvent = useCallback(async (
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
      entityType: 'order_slip',
      entityId,
      actionUrl: ORDER_SLIP_TAB_ID,
      actorId: String(session?.userProfile?.id || '').trim(),
      actorRole: session?.userProfile?.role || 'Unknown',
      targetRoles: recipients.targetRoles,
      targetUserIds: recipients.targetUserIds,
      includeActor: false,
      metadata: {
        refno: `order_slip:${entityId}`,
        order_slip_id: entityId,
        action_url: ORDER_SLIP_TAB_ID,
      },
    });
  }, []);

  const navigateToModule = useCallback((tab: string, payload?: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab, payload } }));
  }, []);

  const selectSlip = useCallback(async (slip: OrderSlip) => {
    setSelectedSlip(slip);
    try {
      const detail = await getOrderSlip(slip.id);
      if (detail) {
        setSelectedSlip(detail);
        setTrackingNoDraft(detail.tracking_no || '');
      }
    } catch (err) {
      console.error('Failed loading selected order slip detail:', err);
    }
  }, []);

  useEffect(() => {
    if (!orderSlips.length) return;
    const slipById = initialSlipId ? orderSlips.find(entry => entry.id === initialSlipId) : null;
    const slipByNo = initialSlipRefNo
      ? orderSlips.find(entry => String(entry.slip_no || '').toLowerCase() === initialSlipRefNo.toLowerCase())
      : null;
    const slip = slipById || slipByNo;
    if (slip) void selectSlip(slip);
  }, [initialSlipId, initialSlipRefNo, orderSlips, selectSlip]);

  useEffect(() => {
    if (!selectedSlip?.contact_id) {
      setSelectedCustomerDetail(null);
      return;
    }
    let active = true;
    fetchContactById(selectedSlip.contact_id)
      .then((detail) => {
        if (!active) return;
        setSelectedCustomerDetail(detail);
      })
      .catch((err) => {
        console.error('Failed loading selected order slip customer detail:', err);
        if (!active) return;
        setSelectedCustomerDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selectedSlip?.contact_id]);

  useEffect(() => {
    setTrackingNoDraft(selectedSlip?.tracking_no || '');
  }, [selectedSlip?.id, selectedSlip?.tracking_no]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, month, year]);

  const selectedCustomer = selectedCustomerDetail || (selectedSlip ? customerMap.get(selectedSlip.contact_id) : null);
  const selectedCustomerLabel = selectedCustomer?.company || selectedSlip?.customer_name || selectedSlip?.contact_id || '-';
  const selectedSlipPriceGroupDisplay = normalizePriceGroup(selectedSlip?.price_group || '');
  const canProcessOrderSlip = isOrderSlipAllowedForTransactionType(selectedCustomer?.transactionType);

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  useEffect(() => {
    const userId = String(getLocalAuthSession()?.userProfile?.id || '').trim();
    if (!selectedSlip?.id || !userId) return;
    void markNotificationsAsReadByEntityKey(userId, {
      entityType: 'order_slip',
      entityId: selectedSlip.id,
    });
  }, [selectedSlip?.id]);

  const activeFilterLabel = useMemo(() => {
    if (!month || !year) return 'All Records';
    return `${MONTH_OPTIONS[month - 1]} ${year}`;
  }, [month, year]);

  const orderRowTone = (slip: OrderSlip) => {
    if (slip.status === OrderSlipStatus.CANCELLED) return 'text-red-600';
    if (selectedSlip?.id === slip.id) return 'text-brand-blue';
    return 'text-slate-700 dark:text-slate-200';
  };

  const orderSlipGuidance = (() => {
    if (!selectedSlip) {
      return {
        title: 'Select an order slip',
        description: 'Choose an order slip to review fulfillment details, print status, and linked sales order actions.',
        tone: 'default' as const,
      };
    }
    if (!canProcessOrderSlip && selectedCustomer) {
      return {
        title: 'Invoice-only customer policy',
        description: 'This customer is configured for invoice processing, so order slip actions are disabled.',
        tone: 'warning' as const,
      };
    }
    if (selectedSlip.status === OrderSlipStatus.DRAFT) {
      return {
        title: 'Next step: finalize order slip',
        description: 'Review items and customer details before marking this slip ready for warehouse handling.',
        tone: 'info' as const,
      };
    }
    if (selectedSlip.status === OrderSlipStatus.FINALIZED) {
      return {
        title: 'Next step: print or track fulfillment',
        description: 'This order slip is finalized. Print the document or update tracking details when available.',
        tone: 'success' as const,
      };
    }
    if (selectedSlip.status === OrderSlipStatus.CANCELLED) {
      return {
        title: 'Cancelled order slip',
        description: 'This record is preserved for reference. New fulfillment actions are disabled.',
        tone: 'danger' as const,
      };
    }
    return {
      title: 'Review order slip',
      description: 'Check the document details and continue with the next valid action.',
      tone: 'info' as const,
    };
  })();

  const handleMonthChange = (monthValue: string) => {
    if (!monthValue) {
      setMonth(undefined);
      return;
    }
    setMonth(Number(monthValue));
    if (!year) setYear(new Date().getFullYear());
  };

  const handleYearChange = (yearValue: string) => {
    if (!yearValue) {
      setYear(undefined);
      return;
    }
    setYear(Number(yearValue));
    if (!month) setMonth(new Date().getMonth() + 1);
  };

  const handleFilterApply = async () => {
    setPage(1);
    await loadOrderSlips();
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setMonth(undefined);
    setYear(undefined);
    setPage(1);
    setSelectedSlip(null);
  };

  const handleFinalize = async () => {
    if (!selectedSlip || !canProcessOrderSlip) return;
    setFinalizing(true);

    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: OrderSlipStatus.FINALIZED } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, status: OrderSlipStatus.FINALIZED } : null);

    try {
      const creatorUserId = await resolveNotificationUserId(selectedSlip.created_by);
      const updated = await finalizeOrderSlip(selectedSlip.id);
      if (updated) {
        setOrderSlips(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedSlip(updated);
      }
      await notifyOrderSlipEvent(
        'Order Slip Finalized',
        `Order Slip ${selectedSlip.slip_no} marked as finalized.`,
        'finalize',
        'success',
        selectedSlip.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: creatorUserId ? [creatorUserId] : [],
        }
      );
      addToast({
        type: 'success',
        title: 'Order slip finalized',
        description: `${selectedSlip.slip_no} is ready for warehouse handling.`,
      });
    } catch (err) {
      console.error('Error finalizing order slip:', err);
      await notifyOrderSlipEvent(
        'Order Slip Finalization Failed',
        `Failed to finalize order slip ${selectedSlip.slip_no}.`,
        'finalize',
        'failed',
        selectedSlip.id,
        { targetRoles: ['Owner', 'Manager'] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Unable to finalize order slip',
        description: err instanceof Error ? err.message : 'Failed to finalize order slip.',
      });
    } finally {
      setFinalizing(false);
      await loadOrderSlips();
    }
  };

  const handlePrint = async () => {
    if (!selectedSlip || !canProcessOrderSlip) return;
    setPrinting(true);

    const printedAt = new Date().toISOString();
    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { printed_at: printedAt } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, printed_at: printedAt } : null);

    try {
      const creatorUserId = await resolveNotificationUserId(selectedSlip.created_by);
      const updated = await printOrderSlip(selectedSlip.id);
      if (updated) {
        setOrderSlips(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedSlip(updated);
      }
      await notifyOrderSlipEvent(
        'Order Slip Printed',
        `Order Slip ${selectedSlip.slip_no} was printed.`,
        'print',
        'success',
        selectedSlip.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: creatorUserId ? [creatorUserId] : [],
        }
      );
      setShowPrintPreview(true);
      addToast({
        type: 'success',
        title: 'Order slip marked printed',
        description: `${selectedSlip.slip_no} is ready to print.`,
      });
      window.setTimeout(() => window.print(), 150);
    } catch (err) {
      console.error('Error printing order slip:', err);
      await notifyOrderSlipEvent(
        'Order Slip Print Failed',
        `Failed to print order slip ${selectedSlip.slip_no}.`,
        'print',
        'failed',
        selectedSlip.id,
        { targetRoles: ['Owner', 'Manager'] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Unable to print order slip',
        description: err instanceof Error ? err.message : 'Failed to mark order slip as printed.',
      });
    } finally {
      setPrinting(false);
      await loadOrderSlips();
    }
  };

  const handleCancelOrderSlip = async () => {
    if (!selectedSlip || !cancelReason.trim()) return;
    setCancelLoading(true);

    const previousStatus = selectedSlip.status;
    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: OrderSlipStatus.CANCELLED } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, status: OrderSlipStatus.CANCELLED } : null);

    try {
      const creatorUserId = await resolveNotificationUserId(selectedSlip.created_by);
      await cancelOrderSlip(selectedSlip.id, cancelReason.trim());
      await notifyOrderSlipEvent(
        'Order Slip Cancelled',
        `Order Slip ${selectedSlip.slip_no} has been cancelled.`,
        'cancel',
        'success',
        selectedSlip.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: creatorUserId ? [creatorUserId] : [],
        }
      );
      setCancelModalOpen(false);
      setCancelReason('');
      addToast({
        type: 'success',
        title: 'Order slip cancelled',
        description: 'The document was cancelled and preserved for reference.',
      });
      await loadOrderSlips();
    } catch (err) {
      console.error('Failed to cancel order slip:', err);
      await notifyOrderSlipEvent(
        'Order Slip Cancel Failed',
        `Failed to cancel order slip ${selectedSlip.slip_no}.`,
        'cancel',
        'failed',
        selectedSlip.id,
        { targetRoles: ['Owner', 'Manager'] },
        'error'
      );
      setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: previousStatus } as Partial<OrderSlip>));
      setSelectedSlip(prev => prev ? { ...prev, status: previousStatus } : null);
      addToast({
        type: 'error',
        title: 'Unable to cancel order slip',
        description: err instanceof Error ? err.message : 'Failed to cancel order slip.',
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUnpostOrderSlip = async () => {
    if (!selectedSlip) return;
    setUnpostLoading(true);

    try {
      const salesOrderId = String(selectedSlip.order_id || '').trim();
      if (!salesOrderId) {
        throw new Error('This order slip is not linked to a sales order.');
      }

      await unpostSalesOrder(salesOrderId);
      const creatorUserId = await resolveNotificationUserId(selectedSlip.created_by);
      await notifyOrderSlipEvent(
        'Order Slip Unposted',
        `Order Slip ${selectedSlip.slip_no} has been unposted.`,
        'unpost',
        'success',
        selectedSlip.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: creatorUserId ? [creatorUserId] : [],
        }
      );
      setUnpostModalOpen(false);
      addToast({
        type: 'success',
        title: 'Order slip unposted',
        description: 'Returning to the linked sales order for correction.',
      });
      await loadOrderSlips();
      navigateToModule('salesorder', { orderId: salesOrderId });
    } catch (err) {
      console.error('Failed to unpost order slip:', err);
      await notifyOrderSlipEvent(
        'Order Slip Unpost Failed',
        `Failed to unpost order slip ${selectedSlip.slip_no}.`,
        'unpost',
        'failed',
        selectedSlip.id,
        { targetRoles: ['Owner', 'Manager'] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Unable to unpost order slip',
        description: err instanceof Error ? err.message : 'Failed to unpost order slip.',
      });
    } finally {
      setUnpostLoading(false);
    }
  };

  const handleSaveTrackingNo = async () => {
    if (!selectedSlip) return;
    setTrackingSaveLoading(true);
    try {
      const updated = await updateOrderSlip(selectedSlip.id, {
        tracking_no: trackingNoDraft.trim(),
      });
      if (updated) {
        setSelectedSlip(updated);
        setOrderSlips(prev => prev.map(row => row.id === updated.id ? { ...row, tracking_no: updated.tracking_no } : row));
      }
      addToast({
        type: 'success',
        title: 'Tracking updated',
        description: 'The order slip tracking number was saved.',
      });
      await loadOrderSlips();
    } catch (err) {
      console.error('Failed to update order slip tracking number:', err);
      addToast({
        type: 'error',
        title: 'Unable to update tracking',
        description: err instanceof Error ? err.message : 'Failed to update tracking number.',
      });
    } finally {
      setTrackingSaveLoading(false);
    }
  };

  const legacyInputClass = 'h-[35px] w-full rounded-[4px] border border-[#c9c9c9] bg-white px-3 text-[13px] text-[#333] outline-none';
  const legacyLabelClass = 'whitespace-nowrap text-center text-[16px] font-semibold text-[#29475f]';
  const legacyToday = new Date();
  const legacyMonth = month || legacyToday.getMonth() + 1;
  const legacyYear = year || legacyToday.getFullYear();
  const legacyListDate = (value?: string | null, shortYear = false) => {
    if (!value) return '';
    const normalized = String(value).split('T')[0];
    const [dateYear, dateMonth, dateDay] = normalized.split('-');
    if (!dateYear || !dateMonth || !dateDay) return formatDate(value);
    return `${dateMonth}/${dateDay}/${shortYear ? dateYear.slice(-2) : dateYear}`;
  };
  const filteredByLabel = month && year ? `Year: ${year} Month: ${MONTH_OPTIONS[month - 1].slice(0, 3)},` : 'All Records';
  const displayOrderSlipStatus = (status: OrderSlipStatus) => {
    if (status === OrderSlipStatus.CANCELLED) return 'Cancelled';
    if (status === OrderSlipStatus.FINALIZED) return 'Posted';
    return 'Unposted';
  };
  const selectedItems = selectedSlip?.items || [];

  const legacyLayout = (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] px-5 py-10 text-[#202020] dark:bg-[#f4f4f4] dark:text-[#202020]" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mx-auto w-full max-w-[1140px] space-y-[26px]">
        <section className="overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex min-h-[83px] flex-col gap-5 border-b border-[#d7d7d7] px-[35px] py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-[5px]">
              <button type="button" onClick={() => setShowSearchModal(true)} className="rounded-[4px] bg-[#5d82a2] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#50738f]">Search</button>
              <button type="button" onClick={handleRefresh} className="rounded-[4px] bg-[#4caf50] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#43a047]">Refresh</button>
            </div>
            <div className="flex flex-wrap items-center justify-end">
              <span className="mr-[30px] text-[20px] font-semibold text-[#29475f]">Filter by Month:</span>
              <select value={String(legacyMonth)} onChange={(event) => handleMonthChange(event.target.value)} className="h-[34px] w-[200px] rounded-l-[4px] border border-[#cfcfcf] bg-white px-4 text-[13px] outline-none" aria-label="Filter month">
                {MONTH_OPTIONS.map((monthName, index) => <option key={monthName} value={String(index + 1)}>{monthName}</option>)}
              </select>
              <input type="number" value={legacyYear} onChange={(event) => handleYearChange(event.target.value)} className="ml-[16px] h-[34px] w-[87px] border border-[#cfcfcf] bg-white px-3 text-[13px] outline-none" aria-label="Filter year" />
              <button type="button" onClick={() => void handleFilterApply()} className="h-[34px] rounded-r-[4px] bg-[#4caf50] px-[13px] text-[14px] text-white hover:bg-[#43a047]">Filter</button>
            </div>
          </div>

          <div className="h-[207px] px-[25px] py-[25px]">
            <div className="mb-[10px] text-[13px]"><strong>Filtered By:</strong> {filteredByLabel}</div>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <colgroup>{ORDER_SLIP_LIST_COLUMN_WIDTHS.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
              <thead><tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold">
                <th className="px-2 pb-2">Date</th><th className="px-2 pb-2">Customer</th><th className="px-2 pb-2">SO No.</th><th className="px-2 pb-2">OS No.</th><th className="px-2 pb-2">DM No.</th><th className="px-2 pb-2">Tracking No.</th><th className="px-2 pb-2">Sales Person</th><th className="px-2 pb-2">Status</th>
              </tr></thead>
            </table>
            <div className="max-h-[104px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>{ORDER_SLIP_LIST_COLUMN_WIDTHS.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
                <tbody>
                  {loading ? <tr><td colSpan={8} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">Loading order slips...</td></tr> : orderSlips.length === 0 ? <tr><td colSpan={8} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">No order slips found.</td></tr> : orderSlips.map((slip) => {
                    const customer = customerMap.get(slip.contact_id);
                    const selected = selectedSlip?.id === slip.id;
                    const rowColor = slip.status === OrderSlipStatus.CANCELLED ? 'text-[#d33]' : selected ? 'text-[#245d91]' : 'text-[#202020]';
                    return <tr key={slip.id} onClick={() => void selectSlip(slip)} className={`cursor-pointer hover:bg-[#f7f7f7] ${rowColor}`}>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{legacyListDate(slip.sales_date)}</td>
                      <td className="truncate border border-[#d7d7d7] px-2 py-[9px]" title={customer?.company || slip.customer_name || ''}>{customer?.company || slip.customer_name || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{slip.sales_no || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{slip.slip_no || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{slip.debit_memo_no || ''}</td>
                      <td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{slip.tracking_no || ''}</td>
                      <td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{slip.sales_person || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{displayOrderSlipStatus(slip.status)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-h-[456px] overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex h-[64px] items-center justify-between border-b border-[#d7d7d7] px-5">
            <div className="relative flex h-full items-center text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[113px] after:bg-[#6a92b3]">ORDER SLIP</div>
            <div className="flex items-center gap-[40px]"><span className="text-[21px] font-semibold text-[#29475f]">Order No. :</span><input readOnly value={selectedSlip?.slip_no || ''} aria-label="Order number" className="h-[35px] w-[100px] rounded-[4px] border border-[#c9c9c9] bg-white px-3 text-[12px] text-[#444]" /></div>
          </div>

          <div className="px-[25px] pb-[28px] pt-[29px]">
            <div className="space-y-[17px]">
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center">
                <label className={legacyLabelClass}>Sold to :</label><div><input readOnly value={selectedSlip ? selectedCustomerLabel : ''} placeholder="Select Customer" className={`${legacyInputClass} text-left`} /></div>
                <label className={legacyLabelClass}>Date :</label><div className="text-center text-[16px] font-semibold text-[#29475f]">{legacyListDate(selectedSlip?.sales_date || legacyToday.toISOString(), true)}</div>
                <label className={legacyLabelClass}>Terms Strictly:</label><div><input readOnly value={selectedSlip?.terms || ''} className={legacyInputClass} /></div>
              </div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center">
                <label className={legacyLabelClass}>Address :</label><div className="pl-[19px] pr-[3px]"><input readOnly value={selectedSlip?.delivery_address || ''} className={legacyInputClass} /></div>
                <label className={legacyLabelClass}>Reference No.:</label><div className="pl-2"><input readOnly value={selectedSlip?.reference_no || ''} className={legacyInputClass} /></div>
                <label className={legacyLabelClass}>Salesperson:</label><div><input readOnly value={selectedSlip?.sales_person || ''} className={legacyInputClass} /></div>
              </div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center">
                <label className={legacyLabelClass}>Shipped Via:</label><div className="pl-[19px] pr-[3px]"><input readOnly value={selectedSlip?.send_by || ''} className={legacyInputClass} /></div>
                <div className="col-span-2"></div><label className={legacyLabelClass}>Prod Type:</label><div><input readOnly value={selectedSlip?.product_type || ''} className={legacyInputClass} /></div>
              </div>
              <div className="grid grid-cols-[7%_38%_10%_18%_9%_18%] items-center">
                <div className="col-span-2"></div><label className={legacyLabelClass}>Del. to:</label><div className="pl-2"><input readOnly value={selectedSlip?.delivered_to || ''} className={legacyInputClass} /></div><label className={legacyLabelClass}>PO No.:</label><div><input readOnly value={selectedSlip?.po_number || ''} className={legacyInputClass} /></div>
              </div>
            </div>

            <div className="mt-[9px] overflow-x-auto">
              <table className="w-[97%] min-w-[900px] table-fixed border-collapse text-[12px]">
                <colgroup><col className="w-[17.5%]" /><col className="w-[44.5%]" /><col className="w-[20.5%]" /><col className="w-[17.5%]" /></colgroup>
                <thead><tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold"><th className="px-2 pb-2">Quantity</th><th className="px-2 pb-2">Description</th><th className="px-2 pb-2">Unit Price</th><th className="px-2 pb-2">Amount</th></tr></thead>
                <tbody>{selectedItems.length > 0 ? selectedItems.map((item, index) => <tr key={item.id || `${item.item_code}-${index}`} className="bg-[#fafafa]">
                  <td className="px-2 py-[9px]"><input readOnly value={item.qty} className="h-[35px] w-[70px] rounded border border-[#ccc] bg-white px-2" /></td><td className="px-2 py-[9px]"><input readOnly value={item.description || ''} className={legacyInputClass} /></td><td className="px-2 py-[9px]"><select disabled value={String(item.unit_price || 0)} className={`${legacyInputClass} disabled:bg-white disabled:text-[#333]`}><option value={String(item.unit_price || 0)}>{Number(item.unit_price || 0).toFixed(2)}</option></select></td><td className="px-2 py-[9px]"><input readOnly value={Number(item.amount || 0).toFixed(2)} className="h-[35px] w-[70px] rounded border border-[#ccc] bg-white px-2" /></td>
                </tr>) : <tr className="bg-[#fafafa]"><td className="px-2 py-[9px]"><input readOnly className="h-[35px] w-[70px] rounded border border-[#ccc] bg-white px-2" /></td><td className="px-2 py-[9px]"><input readOnly className={legacyInputClass} /></td><td className="px-2 py-[9px]"><select disabled className={`${legacyInputClass} disabled:bg-white`}><option /></select></td><td className="px-2 py-[9px]"><input readOnly className="h-[35px] w-[70px] rounded border border-[#ccc] bg-white px-2" /></td></tr>}</tbody>
                <tfoot><tr><td colSpan={4} className="px-2 py-[9px] text-right font-bold">Total: <span className="rounded-full bg-[#6f91af] px-2 py-[2px] font-bold text-white">{Number(selectedSlip?.grand_total || 0).toFixed(2)}</span></td></tr></tfoot>
              </table>
            </div>

            {selectedSlip && <div className="mt-2 flex flex-wrap items-center justify-end gap-[5px] border-t border-[#e3e3e3] pt-3 print:hidden">
              <select value={trackingNoDraft} onChange={(event) => setTrackingNoDraft(event.target.value)} aria-label="Tracking number" className="h-[34px] rounded border border-[#ccc] bg-white px-3 text-[13px]"><option value="">Select Tracking</option>{selectedSlip.tracking_no && !selectedSlip.tracking_options?.includes(selectedSlip.tracking_no) && <option value={selectedSlip.tracking_no}>{selectedSlip.tracking_no}</option>}{(selectedSlip.tracking_options || []).map((trackingNo) => <option key={trackingNo} value={trackingNo}>{trackingNo}</option>)}</select>
              <button type="button" onClick={() => void handleSaveTrackingNo()} disabled={trackingSaveLoading || trackingNoDraft === (selectedSlip.tracking_no || '')} className="rounded-[4px] bg-[#5d82a2] px-[15px] py-[9px] text-[13px] text-white disabled:opacity-50">{trackingSaveLoading ? 'Saving...' : 'Update Tracking'}</button>
              {selectedSlip.status === OrderSlipStatus.DRAFT && canProcessOrderSlip && <button type="button" onClick={() => void handleFinalize()} disabled={finalizing} className="rounded-[4px] bg-[#4caf50] px-[15px] py-[9px] text-[13px] text-white disabled:opacity-50">{finalizing ? 'Finalizing...' : 'Finalize'}</button>}
              {(!selectedSlip.printed_at || isAdmin) && canProcessOrderSlip && <button type="button" onClick={() => void handlePrint()} disabled={printing} className="rounded-[4px] bg-[#5d82a2] px-[15px] py-[9px] text-[13px] text-white disabled:opacity-50">{printing ? 'Printing...' : 'Print'}</button>}
              {selectedSlip.status !== OrderSlipStatus.CANCELLED && canProcessOrderSlip && <button type="button" onClick={() => setCancelModalOpen(true)} className="rounded-[4px] bg-[#d64b47] px-[15px] py-[9px] text-[13px] text-white">Cancel</button>}
              {selectedSlip.status === OrderSlipStatus.FINALIZED && <button type="button" onClick={() => setUnpostModalOpen(true)} className="rounded-[4px] bg-[#d64b47] px-[15px] py-[9px] text-[13px] text-white">UNPOST</button>}
              <button type="button" onClick={() => navigateToModule('salesorder', { orderId: selectedSlip.order_id })} className="rounded-[4px] border border-[#ccc] px-[15px] py-[8px] text-[13px]">View Sales Order</button>
            </div>}
          </div>
        </section>
      </div>

      {showSearchModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-[560px] rounded-[5px] bg-white shadow-xl"><div className="border-b border-[#ddd] px-5 py-4 text-[20px] font-semibold text-[#333]">Search Options</div><div className="space-y-4 px-6 py-5"><label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Ref No.</span><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Input Ref No." className={legacyInputClass} /></label><label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Customer</span><select onChange={(event) => setSearchTerm(event.target.value)} className={legacyInputClass} defaultValue=""><option value="">Select Customer</option>{sortedContacts.map((contact) => <option key={contact.id} value={contact.company}>{contact.company}</option>)}</select></label><label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderSlipStatus)} className={legacyInputClass}><option value="all">All Statuses</option>{Object.values(OrderSlipStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div><div className="flex justify-end gap-2 border-t border-[#ddd] px-5 py-4"><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] bg-[#4caf50] px-4 py-2 text-[13px] text-white">Submit</button></div></div>
      </div>}

      {cancelModalOpen && selectedSlip && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-lg rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">Cancel Order Slip</h3><p className="mb-3 text-[13px] text-[#a33]">Are you sure you want to cancel this Order Slip? This cannot be undone.</p><label className="block text-[13px]"><span className="mb-1 block">Reason to Cancel:</span><input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={legacyInputClass} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setCancelModalOpen(false); setCancelReason(''); }} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => void handleCancelOrderSlip()} disabled={!cancelReason.trim() || cancelLoading} className="rounded bg-[#337ab7] px-4 py-2 text-[13px] text-white disabled:opacity-50">{cancelLoading ? 'Processing...' : 'Proceed'}</button></div></div></div>}
      {showPrintPreview && selectedSlip && <OrderSlipPrintPreview orderSlip={selectedSlip} customer={selectedCustomer} onClose={() => setShowPrintPreview(false)} />}
      {unpostModalOpen && selectedSlip && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-lg rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">Unposting</h3><p className="mb-4 rounded border border-[#e7bbbb] bg-[#fff1f1] px-3 py-2 text-[13px] text-[#a33]">NOTE: Unposting will withdraw the Ledger entry, delete the DR/Invoice attached and open the sales inquiry.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setUnpostModalOpen(false)} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => void handleUnpostOrderSlip()} disabled={unpostLoading} className="rounded bg-[#d64b47] px-4 py-2 text-[13px] text-white disabled:opacity-50">{unpostLoading ? 'Processing...' : 'Submit'}</button></div></div></div>}
    </div>
  );

  return legacyLayout;

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-950 p-3 gap-4">
      <PageHeader
        eyebrow="Sales Transaction"
        title="Order Slip"
        subtitle="Finalize, print, track, or unpost order slips tied to approved sales orders."
        icon={<ClipboardList className="h-6 w-6 text-brand-blue" />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {orderSlips.length.toLocaleString()} slips on page
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {activeFilterLabel}
            </span>
          </div>
        }
      />
      {/* Filter bar + List table card */}
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderSlipStatus)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                {Object.values(OrderSlipStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">Filter by Month:</span>
              <select
                value={month !== undefined ? String(month) : ''}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <option value="">All</option>
                {MONTH_OPTIONS.map((m, index) => (
                  <option key={m} value={index + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year || ''}
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

        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                {ORDER_SLIP_LIST_COLUMN_WIDTHS.map((width, index) => (
                  <col key={`order-slip-header-col-${index}`} style={{ width }} />
                ))}
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">SO No.</th>
                  <th className="px-3 py-2 text-left">OS No.</th>
                  <th className="px-3 py-2 text-left">DM No.</th>
                  <th className="px-3 py-2 text-left">Tracking No.</th>
                  <th className="px-3 py-2 text-left">Sales Person</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
            </table>
            <div className="max-h-[220px] overflow-y-auto border border-t-0 border-slate-300 dark:border-slate-700">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {ORDER_SLIP_LIST_COLUMN_WIDTHS.map((width, index) => (
                    <col key={`order-slip-body-col-${index}`} style={{ width }} />
                  ))}
                </colgroup>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Loading slips...
                        </span>
                      </td>
                    </tr>
                  )}
                  {!loading && orderSlips.map((slip, index) => {
                    const customer = customerMap.get(slip.contact_id);
                    return (
                      <tr
                        key={slip.id}
                        onClick={() => void selectSlip(slip)}
                        className={`cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/60'} hover:bg-slate-100 dark:hover:bg-slate-800 ${orderRowTone(slip)}`}
                      >
                        <td className="px-3 py-2">{formatDate(slip.sales_date)}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={customer?.company || slip.contact_id}>
                            {customer?.company || slip.customer_name || slip.contact_id}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all leading-5" title={slip.sales_no || slip.order_id || '-'}>
                            {slip.sales_no || slip.order_id || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all font-semibold leading-5" title={slip.slip_no || '-'}>
                            {slip.slip_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">{slip.debit_memo_no || '-'}</td>
                        <td className="px-3 py-2">{slip.tracking_no || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={slip.sales_person || '-'}>
                            {slip.sales_person || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={slip.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && orderSlips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                        No order slips match the current filters.
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

      {/* Detail section */}
      {selectedSlip ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-base uppercase text-slate-900 dark:text-slate-100">ORDER SLIP</h4>
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">OS No.:</span>
              <input readOnly value={selectedSlip.slip_no} className="w-40 inline-block px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200" />
              <StatusBadge status={selectedSlip.status} className="text-[10px] px-2 py-0.5" />
            </div>
          </div>

          <div className="p-4 text-sm space-y-4">
            <WorkflowGuidance
              title={orderSlipGuidance.title}
              description={orderSlipGuidance.description}
              tone={orderSlipGuidance.tone}
            />
            <RecordTrustStrip
              items={[
                { label: 'Document No.', value: selectedSlip.slip_no || selectedSlip.reference_no },
                { label: 'Status', value: <StatusBadge status={selectedSlip.status} /> },
                { label: 'Created By', value: selectedSlip.created_by || selectedSlip.sales_person },
                { label: 'Created Date', value: formatDate(selectedSlip.created_at || selectedSlip.sales_date) },
              ]}
            />
            {/* Header info table */}
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
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sold to:</td>
                    <td><input readOnly value={selectedCustomerLabel} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Date:</td>
                    <td><input readOnly value={selectedSlip.sales_date || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Terms Strictly:</td>
                    <td><input readOnly value={selectedSlip.terms || 'N/A'} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Address:</td>
                    <td><input readOnly value={selectedSlip.delivery_address || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Reference No.:</td>
                    <td><input readOnly value={selectedSlip.reference_no || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Salesperson:</td>
                    <td><input readOnly value={selectedSlip.sales_person || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Shipped Via:</td>
                    <td><input readOnly value={selectedSlip.send_by || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Prod Type:</td>
                    <td><input readOnly value={selectedSlip.product_type || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap"></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Del. to:</td>
                    <td><input readOnly value={selectedSlip.delivered_to || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">PO No.:</td>
                    <td><input readOnly value={selectedSlip.po_number || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap"></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Tracking No.:</td>
                    <td>
                      <select
                        value={trackingNoDraft}
                        onChange={(e) => setTrackingNoDraft(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm"
                      >
                        <option value="">Select Tracking</option>
                        {selectedSlip.tracking_no && !selectedSlip.tracking_options?.includes(selectedSlip.tracking_no) ? (
                          <option value={selectedSlip.tracking_no}>{selectedSlip.tracking_no}</option>
                        ) : null}
                        {(selectedSlip.tracking_options || []).map((trackingNo) => (
                          <option key={trackingNo} value={trackingNo}>
                            {trackingNo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td colSpan={4}>
                      <button
                        type="button"
                        onClick={handleSaveTrackingNo}
                        disabled={trackingSaveLoading || trackingNoDraft === (selectedSlip.tracking_no || '')}
                        className="px-3 py-2 rounded bg-slate-700 text-white text-sm disabled:opacity-50"
                      >
                        {trackingSaveLoading ? 'Saving...' : 'Update Tracking'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <WorkflowStepper currentStage="document" documentLabel="Order Slip" />

            {!canProcessOrderSlip && selectedCustomer && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                {selectedCustomer.company} is configured for invoice issuance. Order slip actions are disabled for this customer.
              </div>
            )}

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-sm border border-slate-300 dark:border-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Part No.</th>
                    <th className="px-3 py-2 text-left">Item Code</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Qty</th>
                    <th className="px-3 py-2 text-left">Unit Price</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {selectedSlip.items?.map((item, index) => (
                    <tr key={item.id || `${item.item_code}-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/30">
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{index + 1}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.part_no || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.item_code || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.location || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.description || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.qty}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-right font-bold border-t border-slate-200 dark:border-slate-700">Grand Total</td>
                    <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-700">
                      <span className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 font-bold text-brand-blue">{formatCurrency(selectedSlip.grand_total)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedSlip.printed_at && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Printed {new Date(selectedSlip.printed_at).toLocaleString()}
              </div>
            )}

            {/* Action buttons bar (footbar) */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
              {selectedSlip.status === OrderSlipStatus.DRAFT && canProcessOrderSlip && (
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
                >
                  {finalizing ? 'Finalizing...' : 'Finalize'}
                </button>
              )}
              {(!selectedSlip.printed_at || isAdmin) && canProcessOrderSlip && (
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing}
                  className="px-3 py-2 rounded bg-slate-500 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print'}
                </button>
              )}
              {selectedSlip.status !== OrderSlipStatus.CANCELLED && canProcessOrderSlip && (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="px-3 py-2 rounded bg-slate-500 text-white text-sm"
                >
                  Cancel
                </button>
              )}
              {selectedSlip.status === OrderSlipStatus.FINALIZED && (
                <button
                  type="button"
                  onClick={() => setUnpostModalOpen(true)}
                  className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                >
                  UNPOST
                </button>
              )}
              <button
                type="button"
                onClick={() => navigateToModule('salesorder', { orderId: selectedSlip.order_id })}
                className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm"
              >
                View Sales Order
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-16 text-center text-slate-500">
          Select an order slip from the table above to view its full details.
        </div>
      )}

      {/* Search modal */}
      {/* Cancel modal */}
      {cancelModalOpen && selectedSlip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Cancel Order Slip</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Are you sure you want to cancel this Order Slip? This cannot be undone.
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
                onClick={handleCancelOrderSlip}
                disabled={!cancelReason.trim() || cancelLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {cancelLoading ? 'Processing...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && selectedSlip && (
        <OrderSlipPrintPreview
          orderSlip={selectedSlip}
          customer={selectedCustomer}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* Unpost modal */}
      {unpostModalOpen && selectedSlip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Unposting</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              NOTE: Unposting will withdraw the Ledger entry, delete the DR/Invoice attached and open the sales inquiry.
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
                onClick={handleUnpostOrderSlip}
                disabled={unpostLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {unpostLoading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSlipView;
