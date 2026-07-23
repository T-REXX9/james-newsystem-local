import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
} from 'lucide-react';
import {
  Contact,
  Invoice,
  OrderSlip,
  SalesOrder,
} from '../types';
import {
  confirmSalesOrder,
  convertToDocument,
  getSalesOrder,
  syncDocumentPolicyState,
  getAllSalesOrders,
  unpostSalesOrder,
} from '../services/salesOrderLocalApiService';
import { fetchContactById, fetchContacts } from '../services/customerDatabaseLocalApiService';
import { getLocalAuthSession } from '../services/localAuthService';
import {
  dispatchWorkflowNotification,
  markNotificationsAsReadByEntityKey,
  resolveNotificationUserId,
} from '../services/notificationLocalApiService';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import ConfirmModal from './ConfirmModal';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';
import { normalizePriceGroup } from '../constants/pricingGroups';
import { useToast } from './ToastProvider';
import { PageHeader, RecordTrustStrip, WorkflowGuidance } from './common/PageScaffold';

interface SalesOrderViewProps {
  initialOrderId?: string;
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
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const API_MAIN_ID = Number((import.meta as any)?.env?.VITE_MAIN_ID || 1);
const SALES_ORDER_TAB_ID = 'sales-transaction-sales-order';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SALES_ORDER_LIST_COLUMN_WIDTHS = [
  '7rem',
  '16%',
  '18rem',
  '11rem',
  '13rem',
  '14%',
  '9rem',
];

const normalizeStatus = (status: unknown): string => String(status || '').trim().toLowerCase();
const isUuid = (value?: string | null): value is string => UUID_PATTERN.test(String(value || '').trim());

const getOrderSortTime = (order: SalesOrder): number => {
  const value = order.sales_date || order.created_at || '';
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortByLatestOrder = (a: SalesOrder, b: SalesOrder): number => {
  const dateDiff = getOrderSortTime(b) - getOrderSortTime(a);
  if (dateDiff !== 0) return dateDiff;
  return (b.order_no || '').localeCompare(a.order_no || '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
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

const SalesOrderView: React.FC<SalesOrderViewProps> = ({ initialOrderId }) => {
  const { addToast } = useToast();
  const userId = String(getLocalAuthSession()?.userProfile?.id || '').trim();
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [confirming, setConfirming] = useState(false);
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');
  const [documentLink, setDocumentLink] = useState<{ type: 'orderslip' | 'invoice'; id: string; label: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Contact | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [unpostModalOpen, setUnpostModalOpen] = useState(false);
  const [unpostLoading, setUnpostLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

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

  const loadContacts = useCallback(async () => {
    try {
      const contactsData = await fetchContacts();
      setContacts(contactsData);
    } catch (err) {
      console.error('Failed loading sales order contacts:', err);
      setContacts([]);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const allOrders = await getAllSalesOrders(
        statusParam ? { status: statusParam as any } : {}
      );

      // Client-side date filtering based on created_at (defaults to current month)
      let filtered = allOrders;
      if (targetMonthYear.month !== undefined && targetMonthYear.year !== undefined) {
        filtered = allOrders.filter((order) => {
          const createdAt = new Date(order.created_at || '');
          if (Number.isNaN(createdAt.getTime())) return false;
          return (
            createdAt.getMonth() + 1 === targetMonthYear.month &&
            createdAt.getFullYear() === targetMonthYear.year
          );
        });
      }

      // Client-side smart search filtering with auto-detection
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();

        // Detect search type: reference_no (usually contains numbers/patterns) vs customer name
        const isRefNoLike = /[\d-]/g.test(query); // Contains numbers or dashes

        filtered = filtered.filter((order) => {
          // Always search reference_no, order_no, and remarks
          const refMatch = (order.reference_no || '').toLowerCase().includes(query) ||
                          (order.order_no || '').toLowerCase().includes(query) ||
                          (order.remarks || '').toLowerCase().includes(query);

          if (refMatch) return true;

          // For text-based searches, also match customer names
          if (!isRefNoLike) {
            const customerMatch = contacts.some(
              contact => contact.id === order.contact_id &&
                         (contact.company || '').toLowerCase().includes(query)
            );
            if (customerMatch) return true;
          }

          // Also always match by contact_id if it matches
          if ((order.contact_id || '').toLowerCase().includes(query)) return true;

          return false;
        });
      }

      filtered = filtered.slice().sort(sortByLatestOrder);

      // Client-side pagination
      const perPage = 50;
      const totalFiltered = filtered.length;
      const computedTotalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
      const start = (page - 1) * perPage;
      const paged = filtered.slice(start, start + perPage);

      setOrders(paged);
      setTotalPages(computedTotalPages);
    } catch (err) {
      console.error('Failed loading sales order list:', err);
      setOrders([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, statusFilter, targetMonthYear.month, targetMonthYear.year]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const handleSalesOrderCreated = () => {
      loadOrders();
    };
    window.addEventListener('salesorder:created', handleSalesOrderCreated);
    return () => {
      window.removeEventListener('salesorder:created', handleSalesOrderCreated);
    };
  }, [loadOrders]);

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => String(a.company || '').localeCompare(String(b.company || ''), undefined, { sensitivity: 'base' })),
    [contacts]
  );

  const notifySalesOrderEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: string,
    entityId: string,
    recipientConfig: { targetRoles?: string[]; targetUserIds?: string[] },
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    const session = getLocalAuthSession();
    const actorId = session?.userProfile?.id;
    const actorRole = session?.userProfile?.role || 'Unknown';

    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'sales_order',
      entityId,
      actionUrl: SALES_ORDER_TAB_ID,
      actorId,
      actorRole,
      targetRoles: recipientConfig.targetRoles,
      targetUserIds: recipientConfig.targetUserIds,
      includeActor: false,
      metadata: {
        sales_order_id: entityId,
        action_url: SALES_ORDER_TAB_ID,
      },
    });
  }, []);

  const navigateToModule = useCallback((tab: string, payload?: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab, payload } }));
  }, []);

  const getCustomerLabel = useCallback(
    (order: SalesOrder, fallbackCustomer?: Contact | null) =>
      fallbackCustomer?.company || customerMap.get(order.contact_id)?.company || order.contact_id,
    [customerMap]
  );

  const applyOptimisticStatusUpdate = useCallback((orderId: string, status: string) => {
    setOrders(prev => applyOptimisticUpdate(prev, orderId, { status } as Partial<SalesOrder>));
    setSelectedOrder(prev => prev ? { ...prev, status } : null);
  }, []);

  const resolveSubmitterProfileId = useCallback(async (order: SalesOrder): Promise<string | null> => (
    resolveNotificationUserId(
      order.submitter_profile_id,
      order.submitter_legacy_user_id,
      order.created_by
    )
  ), []);

  const openDocumentFromLink = useCallback((link: { type: 'orderslip' | 'invoice'; id: string }) => {
    if (link.type === 'orderslip') {
      navigateToModule('orderslip', { orderSlipId: link.id });
      return;
    }
    navigateToModule('invoice', { invoiceId: link.id });
  }, [navigateToModule]);

  const selectOrder = useCallback(async (order: SalesOrder) => {
    setSelectedOrder(order);
    try {
      const detail = await getSalesOrder(order.id);
      if (detail) {
        setSelectedOrder(detail);
      }
    } catch (err) {
      console.error('Failed loading selected sales order detail:', err);
    }
  }, []);

  useEffect(() => {
    if (!initialOrderId) return;

    const initial = orders.find(order => order.id === initialOrderId);
    if (initial) {
      void selectOrder(initial);
      return;
    }

    let active = true;
    getSalesOrder(initialOrderId)
      .then((detail) => {
        if (!active || !detail) return;

        setSelectedOrder(detail);
        setOrders((prev) => (prev.some((order) => order.id === detail.id) ? prev : [detail, ...prev].sort(sortByLatestOrder)));

        const salesDate = new Date(detail.sales_date);
        if (!Number.isNaN(salesDate.getTime())) {
          const month = String(salesDate.getMonth() + 1).padStart(2, '0');
          const year = salesDate.getFullYear();
          setDateRange((prev) => {
            const nextFrom = `${year}-${month}-01`;
            return prev.from === nextFrom ? prev : { from: nextFrom, to: '' };
          });
        }
      })
      .catch((err) => {
        console.error('Failed loading initial sales order detail:', err);
      });

    return () => {
      active = false;
    };
  }, [initialOrderId, orders]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!selectedOrder?.contact_id) {
      setSelectedCustomerDetail(null);
      return;
    }
    let active = true;
    fetchContactById(selectedOrder.contact_id)
      .then((detail) => {
        if (!active) return;
        setSelectedCustomerDetail(detail);
      })
      .catch((err) => {
        console.error('Failed loading selected sales order customer detail:', err);
        if (!active) return;
        setSelectedCustomerDetail(null);
      });
    return () => {
      active = false;
    };
  }, [selectedOrder?.contact_id]);

  const selectedCustomer = selectedCustomerDetail || (selectedOrder ? customerMap.get(selectedOrder.contact_id) : null);
  const selectedCustomerLabel = selectedOrder ? getCustomerLabel(selectedOrder, selectedCustomer) : '-';
  const selectedOrderPriceGroupDisplay = normalizePriceGroup(
    selectedOrder?.price_group || selectedCustomer?.priceGroup || ''
  );
  const documentSuggestion = selectedCustomer?.transactionType || 'Invoice';

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  useEffect(() => {
    if (!selectedOrder?.id || !userId) return;
    void markNotificationsAsReadByEntityKey(userId, {
      entityType: 'sales_order',
      entityId: selectedOrder.id,
    });
  }, [selectedOrder?.id, userId]);

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    setConfirming(true);

    const currentStatus = normalizeStatus(selectedOrder.status);
    const isApprover = Boolean(selectedOrder.can_approve);
    if (currentStatus === 'submitted' && !isApprover) {
      addToast({
        type: 'warning',
        title: 'Approval needed',
        description: 'Only approver accounts can approve this sales order.',
      });
      setConfirming(false);
      return;
    }
    const optimisticNextStatus = currentStatus === 'pending' ? 'Submitted' : 'Approved';

    applyOptimisticStatusUpdate(selectedOrder.id, optimisticNextStatus);

    try {
      const refreshed = await confirmSalesOrder(selectedOrder.id);
      const successStatus = refreshed?.status || optimisticNextStatus;
      const successLabel = normalizeStatus(successStatus) === 'submitted' ? 'submitted' : 'approved';
      const notificationTargetUserId = successLabel === 'approved'
        ? await resolveSubmitterProfileId(refreshed || selectedOrder)
        : null;
      if (refreshed) {
        setOrders(prev => prev.map(row => row.id === refreshed.id ? refreshed : row));
        setSelectedOrder(refreshed);
      }
      await notifySalesOrderEvent(
        successLabel === 'submitted' ? 'Sales Order Submitted' : 'Sales Order Approved',
        successLabel === 'submitted'
          ? `SO ${selectedOrder.reference_no || selectedOrder.order_no} is submitted and waiting for your approval.`
          : `SO ${selectedOrder.reference_no || selectedOrder.order_no} has been approved.`,
        'confirm',
        successLabel === 'submitted' ? 'submitted' : 'approved',
        selectedOrder.id,
        successLabel === 'submitted'
          ? { targetRoles: ['Owner'] }
          : { targetUserIds: notificationTargetUserId ? [notificationTargetUserId] : [] }
      );
      addToast({
        type: 'success',
        title: successLabel === 'submitted' ? 'Sales order submitted' : 'Sales order approved',
        description:
          successLabel === 'submitted'
            ? 'This order is now waiting for approval.'
            : 'You can now generate the next document for this order.',
      });
    } catch (err) {
      console.error('Error confirming sales order:', err);
      await notifySalesOrderEvent(
        'Sales Order Confirmation Failed',
        `Failed to confirm order ${selectedOrder.order_no}.`,
        'confirm',
        'failed',
        selectedOrder.id,
        { targetRoles: ['Owner'] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Unable to update sales order',
        description: err instanceof Error ? err.message : 'Failed to confirm order.',
      });
    } finally {
      setConfirming(false);
      await loadOrders();
    }
  };

  const handleConversion = async () => {
    if (!selectedOrder) return;
    setConversionLoading(true);

    try {
      const document = await convertToDocument(selectedOrder.id);
      const submitterProfileId = await resolveSubmitterProfileId(selectedOrder);
      const isOrderSlip = (document as OrderSlip).slip_no !== undefined;
      if (isOrderSlip) {
        const slip = document as OrderSlip;
        setDocumentMessage(`Created Order Slip ${slip.slip_no}`);
        setDocumentLink({ type: 'orderslip', id: slip.id, label: slip.slip_no });
        addToast({
          type: 'success',
          title: 'Order slip created',
          description: `${slip.slip_no} is now linked to this sales order.`,
        });
        await notifySalesOrderEvent(
          'Order Slip Created',
          `Order ${selectedOrder.order_no} converted to ${slip.slip_no}.`,
          'convert_to_order_slip',
          'success',
          slip.id,
          { targetUserIds: submitterProfileId ? [submitterProfileId] : [] }
        );
      } else {
        const invoice = document as Invoice;
        setDocumentMessage(`Created Invoice ${invoice.invoice_no}`);
        setDocumentLink({ type: 'invoice', id: invoice.id, label: invoice.invoice_no });
        addToast({
          type: 'success',
          title: 'Invoice created',
          description: `${invoice.invoice_no} is now linked to this sales order.`,
        });
        await notifySalesOrderEvent(
          'Invoice Created',
          `Order ${selectedOrder.order_no} converted to ${invoice.invoice_no}.`,
          'convert_to_invoice',
          'success',
          invoice.id,
          { targetUserIds: submitterProfileId ? [submitterProfileId] : [] }
        );
      }
      setConversionModalOpen(false);
    } catch (err) {
      console.error('Error converting sales order:', err);
      const submitterProfileId = await resolveSubmitterProfileId(selectedOrder);
      await notifySalesOrderEvent(
        'Sales Order Conversion Failed',
        `Failed to convert order ${selectedOrder.order_no} to a document.`,
        'convert_to_document',
        'failed',
        selectedOrder.id,
        { targetUserIds: submitterProfileId ? [submitterProfileId] : [] },
        'error'
      );
      addToast({
        type: 'error',
        title: 'Unable to create document',
        description: err instanceof Error ? err.message : 'Failed to convert order to a document.',
      });
    } finally {
      setConversionLoading(false);
      await loadOrders();
    }
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setDateRange({ from: '', to: '' });
    setPage(1);
    setSelectedOrder(null);
    setDocumentMessage('');
    setDocumentLink(null);
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
    await loadOrders();
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim()) {
      return;
    }

    setCancelLoading(true);
    const orderToCancel = selectedOrder;
    try {
      const response = await fetch(
        `${API_BASE_URL}/sales-orders/${encodeURIComponent(orderToCancel.id)}/actions/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            main_id: API_MAIN_ID,
            reason: cancelReason.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Cancel failed (${response.status})`);
      }

      const refreshed = await getSalesOrder(orderToCancel.id);
      const submitterProfileId = await resolveSubmitterProfileId(refreshed || orderToCancel);
      await notifySalesOrderEvent(
        'Sales Order Cancelled',
        `SO ${orderToCancel.reference_no || orderToCancel.order_no} has been cancelled.`,
        'cancel',
        'cancelled',
        orderToCancel.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: submitterProfileId ? [submitterProfileId] : [],
        }
      );
      if (refreshed) {
        setSelectedOrder(refreshed);
        setOrders(prev => prev.map(row => row.id === refreshed.id ? refreshed : row));
      }
      setCancelModalOpen(false);
      setCancelReason('');
      addToast({
        type: 'success',
        title: 'Sales order cancelled',
        description: 'The record was cancelled and the list has been refreshed.',
      });
      await loadOrders();
    } catch (err) {
      console.error('Failed to cancel sales order:', err);
      addToast({
        type: 'error',
        title: 'Unable to cancel sales order',
        description: err instanceof Error ? err.message : 'Failed to cancel sales order.',
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUnpost = async () => {
    if (!selectedOrder) return;

    setUnpostLoading(true);
    const orderToUnpost = selectedOrder;
    try {
      const refreshed = await unpostSalesOrder(orderToUnpost.id);
      const submitterProfileId = await resolveSubmitterProfileId(refreshed || orderToUnpost);
      await notifySalesOrderEvent(
        'Sales Order Unposted',
        `SO ${orderToUnpost.reference_no || orderToUnpost.order_no} has been unposted.`,
        'unpost',
        'unposted',
        orderToUnpost.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: submitterProfileId ? [submitterProfileId] : [],
        }
      );
      if (refreshed) {
        setSelectedOrder(refreshed);
        setOrders(prev => prev.map(row => row.id === refreshed.id ? refreshed : row));
      }
      setDocumentMessage('');
      setDocumentLink(null);
      setUnpostModalOpen(false);
      addToast({
        type: 'success',
        title: 'Sales order unposted',
        description: 'The order is available for correction again.',
      });
      await loadOrders();
    } catch (err) {
      console.error('Failed to unpost sales order:', err);
      addToast({
        type: 'error',
        title: 'Unable to unpost sales order',
        description: err instanceof Error ? err.message : 'Failed to unpost sales order.',
      });
    } finally {
      setUnpostLoading(false);
    }
  };

  const workflowStage = normalizeStatus(selectedOrder?.status) === 'posted' ? 'document' : 'order';
  const selectedOrderStatus = normalizeStatus(selectedOrder?.status);
  const canConfirm = selectedOrderStatus === 'pending' || (selectedOrderStatus === 'submitted' && Boolean(selectedOrder?.can_approve));
  const confirmLabel = selectedOrderStatus === 'pending' ? 'Approve SO' : 'Approve SO';
  const canGenerate = selectedOrderStatus === 'approved';
  const nextStepGuidance = (() => {
    if (!selectedOrder) {
      return {
        title: 'Select a sales order',
        description: 'Choose an order from the list to review status, customer details, line items, and next steps.',
        tone: 'default' as const,
      };
    }
    if (selectedOrderStatus === 'pending') {
      return {
        title: 'Next step: submit for approval',
        description: 'Review customer, credit, and item details before moving this order forward.',
        tone: 'warning' as const,
      };
    }
    if (selectedOrderStatus === 'submitted') {
      return {
        title: selectedOrder?.can_approve ? 'Next step: approve sales order' : 'Waiting for assigned approver',
        description: selectedOrder?.can_approve
          ? 'This order is ready for approval.'
          : 'Only assigned approver accounts can approve this sales order.',
        tone: selectedOrder?.can_approve ? 'info' as const : 'warning' as const,
      };
    }
    if (selectedOrderStatus === 'approved') {
      return {
        title: 'Next step: generate order slip or invoice',
        description: `Customer policy suggests ${documentSuggestion}. Generate the next document when the order is ready.`,
        tone: 'success' as const,
      };
    }
    if (selectedOrderStatus === 'posted') {
      return {
        title: 'Document generated',
        description: 'This sales order already has a linked order slip or invoice. Use related document links for the next action.',
        tone: 'success' as const,
      };
    }
    if (selectedOrderStatus === 'cancelled') {
      return {
        title: 'Cancelled sales order',
        description: 'This record is preserved for reference. New actions are disabled.',
        tone: 'danger' as const,
      };
    }
    return {
      title: 'Review sales order',
      description: 'Check record details and continue with the next valid action.',
      tone: 'info' as const,
    };
  })();

  const activeFilterLabel = useMemo(() => {
    if (!targetMonthYear.month || !targetMonthYear.year) return 'All Records';
    return `${MONTH_OPTIONS[targetMonthYear.month - 1]} ${targetMonthYear.year}`;
  }, [targetMonthYear.month, targetMonthYear.year]);

  const currentMonthLabel = new Date(selectedOrder?.sales_date || Date.now()).toLocaleDateString('en-PH', { month: 'long' });
  const summaryCustomer = selectedCustomer as (Contact & {
    dealershipSales?: number;
    monthlySales?: number;
    since?: string;
    classCode?: string;
    quota?: number;
  }) | null;
  const selectedOrderCreditLimit = Number(selectedOrder?.credit_limit || selectedCustomer?.creditLimit || 0);
  const selectedOrderBalance = Number(summaryCustomer?.balance || 0);
  const exceedsCreditLimit = selectedOrderCreditLimit > 0 && selectedOrderBalance > selectedOrderCreditLimit;
  const displayMetricValue = (value: number | string | undefined | null, isCurrency = false) => {
    if (value === '' || value === null || value === undefined) return '—';
    if (typeof value === 'number') return isCurrency ? formatCurrency(value) : String(value);
    const numericValue = Number(value);
    if (isCurrency && Number.isFinite(numericValue)) return formatCurrency(numericValue);
    return String(value).trim() || '—';
  };
  const orderRowTone = (order: SalesOrder) => {
    const normalizedStatus = normalizeStatus(order.status);
    if (normalizedStatus === 'cancelled') return 'text-red-600';
    if (selectedOrder?.id === order.id) return 'text-brand-blue';
    return 'text-slate-700 dark:text-slate-200';
  };

  const legacyInputClass = 'h-[35px] w-full rounded-[4px] border border-[#c9c9c9] bg-white px-3 text-[13px] text-[#333] outline-none';
  const legacyLabelClass = 'whitespace-nowrap text-right text-[16px] font-semibold text-[#29475f]';
  const legacyToday = new Date();
  const legacyMonth = targetMonthYear.month || legacyToday.getMonth() + 1;
  const legacyYear = targetMonthYear.year || legacyToday.getFullYear();
  const legacyOrder = selectedOrder as (SalesOrder & {
    tracking_no?: string;
    delivered_to?: string;
    delivery_to?: string;
    sales_type?: string;
    product_type?: string;
  }) | null;
  const legacyItems = (selectedOrder?.items || []) as Array<SalesOrder['items'][number] & { brand?: string }>;
  const totalQuantity = legacyItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const legacyListDate = (value?: string | null) => {
    if (!value) return '';
    const normalized = String(value).split('T')[0];
    const [year, month, day] = normalized.split('-');
    return year && month && day ? `${month}/${day}/${year}` : formatDate(value);
  };
  const legacyStatus = (status?: string | null) => {
    const normalized = normalizeStatus(status);
    if (normalized === 'cancelled') return 'Cancelled';
    if (normalized === 'posted') return 'Posted';
    return 'Unposted';
  };
  const legacyMetric = (value: number | string | undefined | null, currency = false) => {
    if (value === undefined || value === null || value === '') return '';
    if (currency) return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(value);
  };
  const filteredByLabel = targetMonthYear.month && targetMonthYear.year
    ? `Year: ${targetMonthYear.year} Month: ${MONTH_OPTIONS[targetMonthYear.month - 1].slice(0, 3)},`
    : 'All Records';
  const nextOrderNumber = useMemo(() => {
    const latestNumber = orders
      .map((order) => order.order_no || '')
      .map((orderNo) => {
        const match = orderNo.match(/^(.*?)(\d+)$/);
        return match ? { prefix: match[1], digits: match[2], value: Number(match[2]) } : null;
      })
      .filter((value): value is { prefix: string; digits: string; value: number } => Boolean(value))
      .sort((a, b) => b.value - a.value)[0];
    if (!latestNumber) return '';
    return `${latestNumber.prefix}${String(latestNumber.value + 1).padStart(latestNumber.digits.length, '0')}`;
  }, [orders]);

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
                {MONTH_OPTIONS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}
              </select>
              <input type="number" value={legacyYear} onChange={(event) => handleYearChange(event.target.value)} className="ml-[16px] h-[34px] w-[87px] border border-[#cfcfcf] bg-white px-3 text-[13px] outline-none" aria-label="Filter year" />
              <button type="button" onClick={() => void handleFilterApply()} className="h-[34px] rounded-r-[4px] bg-[#4caf50] px-[13px] text-[14px] text-white hover:bg-[#43a047]">Filter</button>
            </div>
          </div>

          <div className="h-[207px] px-[25px] py-[25px]">
            <div className="mb-[10px] text-[13px]"><strong>Filtered By:</strong> {filteredByLabel}</div>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <colgroup>{SALES_ORDER_LIST_COLUMN_WIDTHS.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
              <thead><tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold">
                <th className="px-2 pb-2">Date</th><th className="px-2 pb-2">Customer</th><th className="px-2 pb-2">SI No.</th><th className="px-2 pb-2">SO No.</th><th className="px-2 pb-2">Transaction No.</th><th className="px-2 pb-2">Sales Person</th><th className="px-2 pb-2">Status</th>
              </tr></thead>
            </table>
            <div className="max-h-[104px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>{SALES_ORDER_LIST_COLUMN_WIDTHS.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
                <tbody>
                  {loading ? <tr><td colSpan={7} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">Loading sales orders...</td></tr> : orders.length === 0 ? <tr><td colSpan={7} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">No sales orders found.</td></tr> : orders.map((order) => {
                    const customer = customerMap.get(order.contact_id);
                    const selected = selectedOrder?.id === order.id;
                    const rowColor = normalizeStatus(order.status) === 'cancelled' ? 'text-[#d33]' : selected ? 'text-[#245d91]' : 'text-[#202020]';
                    return <tr key={order.id} onClick={() => void selectOrder(order)} className={`cursor-pointer hover:bg-[#f7f7f7] ${rowColor}`}>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{legacyListDate(order.sales_date)}</td>
                      <td className="truncate border border-[#d7d7d7] px-2 py-[9px]" title={customer?.company || ''}>{customer?.company || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{order.inquiry_no || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{order.order_no || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{order.invoice_no || order.order_slip_no || ''}</td>
                      <td className="truncate border border-[#d7d7d7] px-2 py-[9px]">{order.sales_person || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{legacyStatus(order.status)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-h-[576px] overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex h-[64px] items-center justify-between border-b border-[#d7d7d7] px-5">
            <div className="relative flex h-full items-center text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[135px] after:bg-[#6a92b3]">SALES ORDER</div>
            <div className="text-[23px] font-semibold text-[#29475f]">SO No. : {selectedOrder?.order_no || nextOrderNumber}</div>
            {selectedOrder && <input readOnly value={selectedOrder.order_no} aria-label="Sales order number" className="sr-only" />}
          </div>

          <div className="px-[25px] pb-[28px] pt-[31px]">
            <div className="mb-[18px] overflow-x-auto">
              <table className="w-full min-w-[800px] table-fixed border-collapse text-center text-[13px]">
                <thead><tr>{['Since', 'Class Code', 'Quota', 'Terms', 'Balance'].map((label) => <th key={label} className="border border-[#d7d7d7] px-2 py-[9px] font-normal">{label}</th>)}</tr></thead>
                <tbody><tr>
                  <td className="border border-[#d7d7d7] px-2 py-2">{legacyMetric(summaryCustomer?.since || summaryCustomer?.customerSince)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{legacyMetric(summaryCustomer?.classCode)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{legacyMetric(summaryCustomer?.quota ?? summaryCustomer?.dealershipQuota)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{legacyMetric(selectedOrder?.terms || selectedCustomer?.terms)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{legacyMetric(summaryCustomer?.balance, true)}</td>
                </tr></tbody>
              </table>
            </div>

            {exceedsCreditLimit && <div className="mb-2 text-center text-[12px] text-[#b06b00]">Balance exceeds credit limit. This warning does not block the sales order flow.</div>}

            <div className="space-y-[9px]">
              <div className="grid grid-cols-[5%_38%_11%_18%_10%_18%] items-center">
                <label className={legacyLabelClass}>Sold to :</label><div className="pl-3"><input readOnly value={selectedOrder ? selectedCustomerLabel : ''} placeholder="Select Customer" className={`${legacyInputClass} text-center`} /></div>
                <label className={legacyLabelClass}>Date :</label><div className="pl-2"><input readOnly value={legacyListDate(selectedOrder?.sales_date)} className={legacyInputClass} /></div>
                <label className={legacyLabelClass}>Terms Strictly:</label><div className="pl-2"><input readOnly value={selectedOrder?.terms || selectedCustomer?.terms || ''} className={legacyInputClass} /></div>
              </div>
              <div className="grid grid-cols-[7%_36%_11%_18%_10%_18%] items-center">
                <label className={legacyLabelClass}>Address :</label><div className="pl-3"><input readOnly value={selectedOrder?.delivery_address || selectedCustomer?.deliveryAddress || ''} className={legacyInputClass} /></div>
                <label className={legacyLabelClass}>Reference No.:</label><div className="pl-2"><input readOnly value={selectedOrder?.reference_no || ''} className={legacyInputClass} /></div>
                <label className={legacyLabelClass}>Salesperson:</label><div className="pl-2"><input readOnly value={selectedOrder?.sales_person || ''} className={legacyInputClass} /></div>
              </div>
              <div className="grid grid-cols-[7%_36%_11%_18%_10%_18%] items-center">
                <label className={legacyLabelClass}>Send By:</label><div className="pl-3"><input readOnly value={selectedOrder?.send_by || ''} className={`${legacyInputClass} text-center`} /></div>
                <label className={legacyLabelClass}>Tracking No.:</label><div className="pl-2"><input readOnly value={legacyOrder?.tracking_no || ''} className={legacyInputClass} /></div>
                <label className={legacyLabelClass}>Del. to:</label><div className="pl-2"><input readOnly value={legacyOrder?.delivered_to || legacyOrder?.delivery_to || ''} className={legacyInputClass} /></div>
              </div>
              <div className="grid grid-cols-[7%_36%_11%_18%_10%_18%] items-center">
                <label className={legacyLabelClass}>PO No.:</label><div className="pl-3"><input readOnly value={selectedOrder?.po_number || ''} className={legacyInputClass} /></div>
                <div></div><div></div><label className={legacyLabelClass}>Sales Type :</label><div className="pl-2 text-center text-[14px]">{legacyOrder?.sales_type || 'Regular SO'}</div>
              </div>
            </div>

            <div className="mt-[75px] border-t border-[#e5e5e5] pt-[29px]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] border-collapse text-[12px]">
                  <thead><tr className="border-b-2 border-[#d5d5d5] text-center text-[14px] font-semibold">
                    <th className="px-2 pb-2">Item Code</th><th className="px-2 pb-2">Quantity</th><th className="px-2 pb-2">Location.</th><th className="px-2 pb-2">Part No.</th><th className="px-2 pb-2">Brand</th><th className="px-2 pb-2">Description</th><th className="px-2 pb-2">Unit price</th><th className="px-2 pb-2">Remark</th><th className="px-2 pb-2">Amount</th>
                  </tr></thead>
                  <tbody>{legacyItems.map((item, index) => <tr key={item.id || `${item.item_code}-${index}`} className="border-b border-[#e1e1e1] text-center">
                    <td className="px-2 py-2">{item.item_code || ''}</td><td className="px-2 py-2">{item.qty}</td><td className="px-2 py-2">{item.location || ''}</td><td className="px-2 py-2">{item.part_no || ''}</td><td className="px-2 py-2">{item.brand || ''}</td><td className="px-2 py-2 text-left">{item.description || ''}</td><td className="px-2 py-2 text-right">{Number(item.unit_price || 0).toFixed(2)}</td><td className="px-2 py-2">{item.remark || item.approval_status || ''}</td><td className="px-2 py-2 text-right">{Number(item.amount || 0).toFixed(2)}</td>
                  </tr>)}</tbody>
                  <tfoot><tr>
                    <td className="px-2 py-3 text-right font-bold">Total Qty:</td><td className="px-2 py-3"><span className="rounded-full bg-[#6f91af] px-2 py-[2px] font-bold text-white">{totalQuantity.toFixed(2)}</span></td><td colSpan={5}></td><td className="px-2 py-3 text-right font-bold">Grand Total:</td><td className="px-2 py-3"><span className="rounded-full bg-[#ef4b4b] px-2 py-[2px] font-bold text-white">{Number(selectedOrder?.grand_total || 0).toFixed(2)}</span></td>
                  </tr></tfoot>
                </table>
              </div>

              {selectedOrder && <div className="mt-3 flex flex-wrap justify-end gap-[5px] border-t border-[#e3e3e3] pt-4 print:hidden">
                {canConfirm && <button type="button" onClick={() => void handleConfirmOrder()} disabled={confirming} className="rounded-[4px] bg-[#4caf50] px-[18px] py-[9px] text-[13px] text-white disabled:opacity-50">{confirming ? 'Processing...' : confirmLabel}</button>}
                {canGenerate && <button type="button" onClick={() => setConversionModalOpen(true)} className="rounded-[4px] bg-[#4caf50] px-[18px] py-[9px] text-[13px] text-white">Generate Sales Transaction</button>}
                {canGenerate && <button type="button" onClick={() => window.print()} className="rounded-[4px] bg-[#5d82a2] px-[18px] py-[9px] text-[13px] text-white">Print SO</button>}
                {canGenerate && <button type="button" onClick={() => setCancelModalOpen(true)} className="rounded-[4px] bg-[#d64b47] px-[18px] py-[9px] text-[13px] text-white">Cancel SO</button>}
                {selectedOrderStatus === 'posted' && <button type="button" onClick={() => setUnpostModalOpen(true)} disabled={unpostLoading} className="rounded-[4px] bg-[#d64b47] px-[18px] py-[9px] text-[13px] text-white disabled:opacity-50">{unpostLoading ? 'Unposting...' : 'Unpost'}</button>}
              </div>}
            </div>
          </div>
        </section>

        {documentMessage && <div className="flex items-center justify-between rounded-[5px] border border-[#b7dfbf] bg-[#edf9ef] p-3 text-[13px] text-[#367342]"><span>{documentMessage}</span>{documentLink && <button type="button" onClick={() => openDocumentFromLink(documentLink)} className="rounded bg-[#4caf50] px-3 py-1 text-white">View {documentLink.type === 'orderslip' ? 'Order Slip' : 'Invoice'}</button>}</div>}
      </div>

      {showSearchModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-[560px] rounded-[5px] bg-white shadow-xl">
          <div className="border-b border-[#ddd] px-5 py-4 text-[20px] font-semibold text-[#333]">Search Options</div>
          <div className="space-y-4 px-6 py-5">
            <label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Ref No.</span><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Input Ref No." className={legacyInputClass} /></label>
            <label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={legacyInputClass}><option value="all">All Statuses</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="posted">Posted</option><option value="cancelled">Cancelled</option></select></label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#ddd] px-5 py-4"><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] bg-[#4caf50] px-4 py-2 text-[13px] text-white">Submit</button></div>
        </div>
      </div>}

      {cancelModalOpen && selectedOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-lg rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">Cancel Sales Order</h3><p className="mb-3 text-[13px] text-[#a33]">Are you sure you want to cancel this Sales Order? This cannot be undone.</p><label className="block text-[13px]"><span className="mb-1 block">Reason to Cancel:</span><input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={legacyInputClass} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setCancelModalOpen(false); setCancelReason(''); }} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => void handleCancelOrder()} disabled={!cancelReason.trim() || cancelLoading} className="rounded bg-[#337ab7] px-4 py-2 text-[13px] text-white disabled:opacity-50">{cancelLoading ? 'Processing...' : 'Proceed'}</button></div></div></div>}

      {conversionModalOpen && selectedOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-md rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">Convert to Document</h3><p className="text-[13px] text-[#555]">This order will be converted based on the customer&apos;s transaction type. Suggested document: <strong>{documentSuggestion}</strong>.</p><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setConversionModalOpen(false)} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Cancel</button><button type="button" onClick={() => void handleConversion()} disabled={conversionLoading} className="rounded bg-[#337ab7] px-4 py-2 text-[13px] text-white disabled:opacity-50">{conversionLoading ? 'Converting...' : 'Convert'}</button></div></div></div>}

      <ConfirmModal isOpen={unpostModalOpen && Boolean(selectedOrder)} onClose={() => { if (!unpostLoading) setUnpostModalOpen(false); }} onConfirm={handleUnpost} title="Unpost Sales Order" message={`Unpost Sales Order ${selectedOrder?.order_no || selectedOrder?.reference_no || selectedOrder?.id || ''}? This will remove its linked invoice or order slip and return the sales order to pending.`} confirmLabel={unpostLoading ? 'Unposting...' : 'Unpost'} cancelLabel="Cancel" variant="warning" />
    </div>
  );

  return legacyLayout;

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-950 p-3 gap-4">
      <PageHeader
        eyebrow="Sales Transaction"
        title="Sales Order"
        subtitle="Review approved customer orders, control status changes, and generate the next sales document."
        icon={<FileText className="h-6 w-6 text-brand-blue" />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {orders.length.toLocaleString()} orders on page
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {activeFilterLabel}
            </span>
          </div>
        }
      />
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
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="posted">Posted</option>
                <option value="cancelled">Cancelled</option>
              </select>
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

        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                {SALES_ORDER_LIST_COLUMN_WIDTHS.map((width) => (
                  <col key={width} style={{ width }} />
                ))}
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">SI No.</th>
                  <th className="px-3 py-2 text-left">SO No.</th>
                  <th className="px-3 py-2 text-left">Transaction No.</th>
                  <th className="px-3 py-2 text-left">Sales Person</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
            </table>
            <div className="max-h-[220px] overflow-y-auto border border-t-0 border-slate-300 dark:border-slate-700">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {SALES_ORDER_LIST_COLUMN_WIDTHS.map((width) => (
                    <col key={width} style={{ width }} />
                  ))}
                </colgroup>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Loading orders...
                        </span>
                      </td>
                    </tr>
                  )}
                  {!loading && orders.map((order, index) => {
                    const customer = customerMap.get(order.contact_id);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => void selectOrder(order)}
                        className={`cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/60'} hover:bg-slate-100 dark:hover:bg-slate-800 ${orderRowTone(order)}`}
                      >
                        <td className="px-3 py-2">{formatDate(order.sales_date)}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={getCustomerLabel(order, customer)}>
                            {getCustomerLabel(order, customer)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all leading-5" title={order.inquiry_no || '-'}>
                            {order.inquiry_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all font-semibold leading-5" title={order.order_no || '-'}>
                            {order.order_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all leading-5" title={order.order_slip_no || order.invoice_no || '-'}>
                            {order.order_slip_no || order.invoice_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={order.sales_person || '-'}>
                            {order.sales_person || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        No orders match the current filters.
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

      {selectedOrder ? (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-base uppercase text-slate-900 dark:text-slate-100">SALES ORDER</h4>
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">SO No.:</span>
                <input readOnly value={selectedOrder.order_no} className="w-40 inline-block px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200" />
                <StatusBadge status={selectedOrder.status} className="text-[10px] px-2 py-0.5" />
              </div>
            </div>

            <div className="p-4 text-sm space-y-4">
              <WorkflowGuidance
                title={nextStepGuidance.title}
                description={nextStepGuidance.description}
                tone={nextStepGuidance.tone}
              />
              <RecordTrustStrip
                items={[
                  { label: 'Document No.', value: selectedOrder.order_no || selectedOrder.reference_no },
                  { label: 'Status', value: <StatusBadge status={selectedOrder.status} /> },
                  { label: 'Created By', value: selectedOrder.created_by || selectedOrder.sales_person },
                  { label: 'Created Date', value: formatDate(selectedOrder.created_at || selectedOrder.sales_date) },
                ]}
              />
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border border-slate-200 dark:border-slate-800 text-sm text-center">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Dealership Since</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Dealership Sales</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Dealership Quota</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Total Sales for {currentMonthLabel}</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Customer Since</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Credit Limit</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Terms</th>
                      <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-700 dark:text-slate-200">
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.dealershipSince)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.dealershipSales, true)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.dealershipQuota, true)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.monthlySales, true)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.since || summaryCustomer?.customerSince)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(selectedOrder.credit_limit || selectedCustomer?.creditLimit, true)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(selectedOrder.terms || selectedCustomer?.terms)}</td>
                      <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.balance, true)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {selectedOrderStatus === 'submitted' && !selectedOrder?.can_approve && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                  This sales order is waiting for an assigned approver account.
                </div>
              )}

              {exceedsCreditLimit && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                  Balance exceeds credit limit. The old system keeps this as an informational warning and does not block the sales order flow.
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
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sold to:</td>
                      <td><input readOnly value={selectedCustomerLabel} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Date:</td>
                      <td><input readOnly value={selectedOrder.sales_date || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sales Person:</td>
                      <td><input readOnly value={selectedOrder.sales_person || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Delivery Address:</td>
                      <td><input readOnly value={selectedOrder.delivery_address || selectedCustomer?.deliveryAddress || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Our Reference:</td>
                      <td><input readOnly value={selectedOrder.reference_no || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Your Reference:</td>
                      <td><input readOnly value={selectedOrder.customer_reference || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Price Group:</td>
                      <td><input readOnly value={selectedOrderPriceGroupDisplay} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Credit Limit:</td>
                      <td><input readOnly value={formatCurrency(selectedOrder.credit_limit || selectedCustomer?.creditLimit || 0)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Terms Strictly:</td>
                      <td><input readOnly value={selectedOrder.terms || selectedCustomer?.terms || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Promise to Pay:</td>
                      <td colSpan={3}><input readOnly value={selectedOrder.promise_to_pay || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">PO No.:</td>
                      <td><input readOnly value={selectedOrder.po_number || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Remarks:</td>
                      <td colSpan={3}><input readOnly value={selectedOrder.remarks || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Inquiry Type:</td>
                      <td><input readOnly value={selectedOrder.inquiry_type || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                    <tr>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Send By:</td>
                      <td><input readOnly value={selectedOrder.send_by || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap text-red-600">Urgency/Type:</td>
                      <td><input readOnly value={selectedOrder.urgency || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                      <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap text-red-600">Urgency/Date:</td>
                      <td><input readOnly value={selectedOrder.urgency_date || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <WorkflowStepper currentStage={workflowStage} documentLabel="Order Slip / Invoice" />

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
                      <th className="px-3 py-2 text-left">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-200">
                    {selectedOrder.items?.map((item, index) => (
                      <tr key={item.id || `${item.item_code}-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/30">
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{index + 1}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.part_no || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.item_code || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.location || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.description || '-'}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.qty}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.amount)}</td>
                        <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.remark || item.approval_status || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="px-3 py-3 text-right font-bold border-t border-slate-200 dark:border-slate-700">Grand Total</td>
                      <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-700">
                        <span className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 font-bold text-brand-blue">{formatCurrency(selectedOrder.grand_total)}</span>
                      </td>
                      <td className="border-t border-slate-200 dark:border-slate-700"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-300 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left">Balance</th>
                      <th className="px-3 py-2 text-left">Last Payment</th>
                      <th className="px-3 py-2 text-left">Promise to Pay</th>
                      <th className="px-3 py-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2">{formatCurrency(selectedCustomer?.balance || 0)}</td>
                      <td className="px-3 py-2">{selectedOrder.approved_at ? formatDate(selectedOrder.approved_at) : '-'}</td>
                      <td className="px-3 py-2">{selectedOrder.promise_to_pay || '-'}</td>
                      <td className="px-3 py-2">{selectedOrder.remarks || selectedOrder.reference_no || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-300 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left">BD ISSUED BY/DATE</th>
                      <th className="px-3 py-2 text-left">REF. BILL NO.</th>
                      <th className="px-3 py-2 text-left">Security Checked</th>
                      <th className="px-3 py-2 text-left">WH S.O Received</th>
                      <th className="px-3 py-2 text-left">WH GOODS Issue</th>
                      <th className="px-3 py-2 text-left">APPROVED BY</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2">{selectedOrder.created_by || '-'} / {formatDate(selectedOrder.created_at)}</td>
                      <td className="px-3 py-2">{selectedOrder.po_number || '-'}</td>
                      <td className="px-3 py-2">{selectedOrder.send_by || '-'}</td>
                      <td className="px-3 py-2">{selectedOrder.reference_no || '-'}</td>
                      <td className="px-3 py-2">{selectedOrder.sales_person || '-'}</td>
                      <td className="px-3 py-2">{selectedOrder.approved_by || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                {canConfirm && (
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    disabled={confirming}
                    className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
                  >
                    {confirming ? 'Processing...' : confirmLabel}
                  </button>
                )}
                {canGenerate && (
                  <button
                    type="button"
                    onClick={() => setConversionModalOpen(true)}
                    className="px-3 py-2 rounded bg-green-600 text-white text-sm"
                  >
                    Generate Sales Transaction
                  </button>
                )}
                {canGenerate && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 rounded bg-slate-500 text-white text-sm"
                  >
                    Print SO
                  </button>
                )}
                {canGenerate && (
                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="px-3 py-2 rounded bg-slate-500 text-white text-sm"
                  >
                    Cancel SO
                  </button>
                )}
                {selectedOrderStatus === 'posted' && (
                  <button
                    type="button"
                    onClick={() => setUnpostModalOpen(true)}
                    disabled={unpostLoading}
                    className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                  >
                    {unpostLoading ? 'Unposting...' : 'Unpost'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {documentMessage && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg p-3 text-sm flex items-center justify-between">
              <span>{documentMessage}</span>
              {documentLink && (
                <button
                  type="button"
                  onClick={() => openDocumentFromLink(documentLink)}
                  className="px-3 py-1 rounded bg-emerald-600 text-white"
                >
                  View {documentLink.type === 'orderslip' ? 'Order Slip' : 'Invoice'}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-16 text-center text-slate-500">
          Select a sales order from the table above to view its full details.
        </div>
      )}

      {cancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Cancel Sales Order</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Are you sure you want to cancel Sales Order? This cannot be undone.
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
                onClick={handleCancelOrder}
                disabled={!cancelReason.trim() || cancelLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {cancelLoading ? 'Processing...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {conversionModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Convert to Document</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This order will be converted based on the customer&apos;s transaction type. Suggested document: <strong>{documentSuggestion}</strong>.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded p-3 text-xs text-slate-500 dark:text-slate-300 space-y-1">
              <p>Order: {selectedOrder.order_no}</p>
              <p>Customer: {getCustomerLabel(selectedOrder, selectedCustomer)}</p>
              <p>Transaction Type: {documentSuggestion}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConversionModalOpen(false)}
                className="px-3 py-1 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConversion}
                disabled={conversionLoading}
                className="px-4 py-1 text-sm rounded bg-brand-blue text-white disabled:opacity-50"
              >
                {conversionLoading ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={unpostModalOpen && Boolean(selectedOrder)}
        onClose={() => {
          if (!unpostLoading) {
            setUnpostModalOpen(false);
          }
        }}
        onConfirm={handleUnpost}
        title="Unpost Sales Order"
        message={`Unpost Sales Order ${selectedOrder?.order_no || selectedOrder?.reference_no || selectedOrder?.id || ''}? This will remove its linked invoice or order slip and return the sales order to pending.`}
        confirmLabel={unpostLoading ? 'Unposting...' : 'Unpost'}
        cancelLabel="Cancel"
        variant="warning"
      />
    </div>
  );
};

export default SalesOrderView;
