import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
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
  getSalesOrdersPage,
  syncDocumentPolicyState,
} from '../services/salesOrderLocalApiService';
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';

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

const normalizeStatus = (status: unknown): string => String(status || '').trim().toLowerCase();

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [customerFilter, setCustomerFilter] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

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
      console.error('Failed loading sales order contacts:', err);
      setContacts([]);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSalesOrdersPage({
        month: targetMonthYear.month,
        year: targetMonthYear.year,
        status: statusFilter === 'all' ? 'all' : statusFilter,
        search: debouncedSearch,
        page,
        perPage: 50,
      });
      setOrders(result.items);
      setTotalPages(Math.max(1, result.meta.total_pages || 1));
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

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);

  const notifySalesOrderEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: 'success' | 'failed',
    entityId: string,
    actionUrl: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    void title;
    void message;
    void action;
    void status;
    void entityId;
    void actionUrl;
    void type;
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

  const openDocumentFromLink = useCallback((link: { type: 'orderslip' | 'invoice'; id: string }) => {
    if (link.type === 'orderslip') {
      navigateToModule('orderslip', { orderSlipId: link.id });
      return;
    }
    navigateToModule('invoice', { invoiceId: link.id });
  }, [navigateToModule]);

  useEffect(() => {
    if (orders.length > 0 && !selectedOrder) {
      setSelectedOrder(orders[0]);
    }
  }, [orders, selectedOrder]);

  useEffect(() => {
    if (!initialOrderId || !orders.length) return;
    const initial = orders.find(order => order.id === initialOrderId);
    if (initial) {
      setSelectedOrder(initial);
    }
  }, [initialOrderId, orders]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!selectedOrder?.id) return;
    let active = true;
    getSalesOrder(selectedOrder.id)
      .then((detail) => {
        if (!active || !detail) return;
        setSelectedOrder(detail);
      })
      .catch((err) => {
        console.error('Failed loading selected sales order detail:', err);
      });
    return () => {
      active = false;
    };
  }, [selectedOrder?.id]);

  const selectedCustomer = selectedOrder ? customerMap.get(selectedOrder.contact_id) : null;
  const selectedCustomerLabel = selectedOrder ? getCustomerLabel(selectedOrder, selectedCustomer) : '-';
  const documentSuggestion = selectedCustomer?.transactionType || 'Invoice';

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    setConfirming(true);

    const currentStatus = normalizeStatus(selectedOrder.status);
    const isApprover = Boolean(selectedOrder.can_approve);
    if (currentStatus === 'submitted' && !isApprover) {
      alert('Only approver accounts can approve this sales order.');
      setConfirming(false);
      return;
    }
    const optimisticNextStatus = currentStatus === 'pending' ? 'Submitted' : 'Approved';

    applyOptimisticStatusUpdate(selectedOrder.id, optimisticNextStatus);

    try {
      const refreshed = await confirmSalesOrder(selectedOrder.id);
      const successStatus = refreshed?.status || optimisticNextStatus;
      const successLabel = normalizeStatus(successStatus) === 'submitted' ? 'submitted' : 'approved';
      if (refreshed) {
        setOrders(prev => prev.map(row => row.id === refreshed.id ? refreshed : row));
        setSelectedOrder(refreshed);
      }
      await notifySalesOrderEvent(
        successLabel === 'submitted' ? 'Sales Order Submitted' : 'Sales Order Approved',
        successLabel === 'submitted'
          ? `Order ${selectedOrder.order_no} was submitted for approval.`
          : `Order ${selectedOrder.order_no} has been approved.`,
        'confirm',
        'success',
        selectedOrder.id,
        `/salesorder?orderId=${selectedOrder.id}`
      );
    } catch (err) {
      console.error('Error confirming sales order:', err);
      await notifySalesOrderEvent(
        'Sales Order Confirmation Failed',
        `Failed to confirm order ${selectedOrder.order_no}.`,
        'confirm',
        'failed',
        selectedOrder.id,
        `/salesorder?orderId=${selectedOrder.id}`,
        'error'
      );
      alert('Failed to confirm order');
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
      const isOrderSlip = (document as OrderSlip).slip_no !== undefined;
      if (isOrderSlip) {
        const slip = document as OrderSlip;
        setDocumentMessage(`Created Order Slip ${slip.slip_no}`);
        setDocumentLink({ type: 'orderslip', id: slip.id, label: slip.slip_no });
        await notifySalesOrderEvent(
          'Order Slip Created',
          `Order ${selectedOrder.order_no} converted to ${slip.slip_no}.`,
          'convert_to_order_slip',
          'success',
          slip.id,
          `/orderslip?orderSlipId=${slip.id}`
        );
      } else {
        const invoice = document as Invoice;
        setDocumentMessage(`Created Invoice ${invoice.invoice_no}`);
        setDocumentLink({ type: 'invoice', id: invoice.id, label: invoice.invoice_no });
        await notifySalesOrderEvent(
          'Invoice Created',
          `Order ${selectedOrder.order_no} converted to ${invoice.invoice_no}.`,
          'convert_to_invoice',
          'success',
          invoice.id,
          `/invoice?invoiceId=${invoice.id}`
        );
      }
      setConversionModalOpen(false);
    } catch (err) {
      console.error('Error converting sales order:', err);
      await notifySalesOrderEvent(
        'Sales Order Conversion Failed',
        `Failed to convert order ${selectedOrder.order_no} to a document.`,
        'convert_to_document',
        'failed',
        selectedOrder.id,
        `/salesorder?orderId=${selectedOrder.id}`,
        'error'
      );
      alert('Failed to convert order to document');
    } finally {
      setConversionLoading(false);
      await loadOrders();
    }
  };

  const handleSearchSubmit = () => {
    setPage(1);
    setDebouncedSearch(searchTerm.trim());
    setSearchModalOpen(false);
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setCustomerFilter('');
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
    try {
      const response = await fetch(
        `${API_BASE_URL}/sales-orders/${encodeURIComponent(selectedOrder.id)}/actions/cancel`,
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

      const refreshed = await getSalesOrder(selectedOrder.id);
      if (refreshed) {
        setSelectedOrder(refreshed);
        setOrders(prev => prev.map(row => row.id === refreshed.id ? refreshed : row));
      }
      setCancelModalOpen(false);
      setCancelReason('');
      await loadOrders();
    } catch (err) {
      console.error('Failed to cancel sales order:', err);
      alert('Failed to cancel sales order');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUnpost = () => {
    alert('Unpost action is not available in the current sales order API.');
  };

  const workflowStage = normalizeStatus(selectedOrder?.status) === 'posted' ? 'document' : 'order';
  const selectedOrderStatus = normalizeStatus(selectedOrder?.status);
  const canConfirm = selectedOrderStatus === 'pending' || (selectedOrderStatus === 'submitted' && Boolean(selectedOrder?.can_approve));
  const confirmLabel = selectedOrderStatus === 'pending' ? 'Approve SO' : 'Approve SO';
  const canGenerate = selectedOrderStatus === 'approved';

  const filteredOrders = useMemo(() => {
    if (!customerFilter) return orders;
    return orders.filter(order => order.contact_id === customerFilter);
  }, [customerFilter, orders]);

  const activeFilterLabel = useMemo(() => {
    if (!targetMonthYear.month || !targetMonthYear.year) return 'All Records';
    return `${MONTH_OPTIONS[targetMonthYear.month - 1]} ${targetMonthYear.year}`;
  }, [targetMonthYear.month, targetMonthYear.year]);

  const summaryRows = [
    { label: 'Since', value: selectedCustomer?.customerSince || '-' },
    { label: 'Class Code', value: selectedCustomer?.codeText || selectedCustomer?.priceGroup || '-' },
    { label: 'Quota', value: selectedCustomer?.dealershipQuota?.toLocaleString() || '-' },
    { label: 'Terms', value: selectedCustomer?.terms || selectedOrder?.terms || '-' },
    { label: 'Balance', value: formatCurrency(selectedCustomer?.balance || 0) },
  ];

  const infoRows: Array<[string, string, string, string]> = [
    ['CUSTOMER', selectedCustomerLabel, 'ORDERED BY', selectedOrder?.created_by || '-'],
    ['DATE', formatDate(selectedOrder?.sales_date), 'ADDRESS', selectedCustomer?.address || '-'],
    ['Remarks', selectedOrder?.remarks || '-', '', ''],
    ['TERMS', selectedOrder?.terms || '-', 'TIN', selectedCustomer?.tin || '-'],
    ['DELIVERY ADDRESS', selectedOrder?.delivery_address || selectedCustomer?.deliveryAddress || '-', 'SEND BY', selectedOrder?.send_by || '-'],
    ['REFERRED BY', selectedCustomer?.referBy || selectedOrder?.sales_person || '-', '', ''],
  ];

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded bg-white/10">
            <FileCheck className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Sales Orders</h1>
            <p className="text-xs text-slate-300">Track conversions from inquiries through document generation</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="border border-slate-200 rounded bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
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

          <div className="px-4 pt-3 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Filtered By:</span> {activeFilterLabel}
          </div>

          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-300 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
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
                  {!loading && filteredOrders.map((order, index) => {
                    const customer = customerMap.get(order.contact_id);
                    const isSelected = selectedOrder?.id === order.id;
                    const isCancelled = normalizeStatus(order.status) === 'cancelled';
                    const rowTone = isCancelled
                      ? 'text-red-600'
                      : isSelected
                        ? 'text-blue-600'
                        : 'text-slate-700 dark:text-slate-200';
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/60'} hover:bg-slate-100 dark:hover:bg-slate-800 ${rowTone}`}
                      >
                        <td className="px-3 py-2">{formatDate(order.sales_date)}</td>
                        <td className="px-3 py-2">{getCustomerLabel(order, customer)}</td>
                        <td className="px-3 py-2">{order.inquiry_id || '-'}</td>
                        <td className="px-3 py-2 font-semibold">{order.order_no}</td>
                        <td className="px-3 py-2">{order.reference_no || order.customer_reference || '-'}</td>
                        <td className="px-3 py-2">{order.sales_person || '-'}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        No orders match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
            <div className="border border-slate-200 rounded bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800">
              <div className="border-b border-slate-200 px-4 py-2 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/60 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-white">SALES ORDER</h4>
                </div>
                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">SO No.:</span> {selectedOrder.order_no}
                    {selectedOrderStatus === 'cancelled' && <span className="ml-2 text-red-600 font-semibold">(CANCELLED)</span>}
                    {selectedOrder.inquiry_id && <span className="ml-2">From: {selectedOrder.inquiry_id}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                    {canGenerate && selectedOrderStatus !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => setConversionModalOpen(true)}
                        className="px-3 py-2 rounded bg-green-600 text-white text-sm"
                      >
                        Generate Sales Transaction
                      </button>
                    )}
                    {canGenerate && selectedOrderStatus !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-2 rounded bg-slate-500 text-white text-sm"
                      >
                        Print SO
                      </button>
                    )}
                    {canGenerate && selectedOrderStatus !== 'cancelled' && (
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
                        onClick={handleUnpost}
                        className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                      >
                        Unpost
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 text-sm space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border border-slate-300 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr className="text-left text-slate-700 dark:text-slate-200">
                        {summaryRows.map(row => (
                          <th key={row.label} className="px-3 py-2 font-semibold">{row.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-700 dark:text-slate-200">
                        {summaryRows.map(row => (
                          <td key={row.label} className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">
                            {row.value}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {selectedOrderStatus === 'submitted' && !selectedOrder?.can_approve && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                    This sales order is waiting for an assigned approver account.
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border border-slate-300 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                    <tbody className="text-slate-700 dark:text-slate-200">
                      {infoRows.map(([leftLabel, leftValue, rightLabel, rightValue], index) => (
                        <tr key={`${leftLabel}-${index}`}>
                          <td className="w-1/6 px-3 py-2 font-semibold bg-slate-50 dark:bg-slate-800/60">{leftLabel}</td>
                          <td className="w-2/6 px-3 py-2">{leftValue}</td>
                          <td className="w-1/6 px-3 py-2 font-semibold bg-slate-50 dark:bg-slate-800/60">{rightLabel || ''}</td>
                          <td className="w-2/6 px-3 py-2">{rightValue || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <WorkflowStepper currentStage={workflowStage} documentLabel="Order Slip / Invoice" />

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-300 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left w-[1%]">NO.</th>
                        <th className="px-3 py-2 text-left w-[15%]">PARTNO</th>
                        <th className="px-3 py-2 text-left w-[10%]">CODE</th>
                        <th className="px-3 py-2 text-left w-[10%]">LOC</th>
                        <th className="px-3 py-2 text-left w-[30%]">DESCRIPTION</th>
                        <th className="px-3 py-2 text-left w-[10%]">QTY</th>
                        <th className="px-3 py-2 text-left w-[15%]">UNIT PRICE</th>
                        <th className="px-3 py-2 text-left w-[15%]">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                      {selectedOrder.items?.map((item, index) => (
                        <tr key={item.id || `${item.item_code}-${index}`}>
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2">{item.part_no || '-'}</td>
                          <td className="px-3 py-2">{item.item_code || '-'}</td>
                          <td className="px-3 py-2">{item.location || '-'}</td>
                          <td className="px-3 py-2">{item.description || '-'}</td>
                          <td className="px-3 py-2">{item.qty}</td>
                          <td className="px-3 py-2">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100">
                      <tr>
                        <td colSpan={7} className="px-3 py-2 text-right font-semibold">
                          Total =&gt;
                        </td>
                        <td className="px-3 py-2 font-semibold">{formatCurrency(selectedOrder.grand_total)}</td>
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
          <div className="border border-slate-200 rounded bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 px-6 py-16 text-center text-slate-500">
            Select a sales order from the table above to view its full details.
          </div>
        )}
      </div>

      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Search Sales Orders</h3>
            <div className="space-y-3">
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Ref No.</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-200">
                <span className="block mb-1">Customer</span>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="">All Customers</option>
                  {contacts.map(contact => (
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
                onClick={() => setSearchModalOpen(false)}
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
    </div>
  );
};

export default SalesOrderView;
