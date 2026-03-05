import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileCheck,
  ListFilter,
  Search,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
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

const OLD_SYSTEM_STATUSES = ['Pending', 'Submitted', 'Approved', 'Posted', 'Cancelled'];

const normalizeStatus = (status: unknown): string => String(status || '').trim().toLowerCase();

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
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

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
  }, [setOrders]);

  const openDocumentFromLink = useCallback((link: { type: 'orderslip' | 'invoice'; id: string }) => {
    if (link.type === 'orderslip') {
      navigateToModule('orderslip', { orderSlipId: link.id });
      return;
    }
    navigateToModule('invoice', { invoiceId: link.id });
  }, [navigateToModule]);

  // Auto-select first order when list page changes.
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
  }, [statusFilter, searchTerm, dateRange.from, dateRange.to]);

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

    // Optimistic update
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
      // Real-time subscription will correct the state
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
      // Real-time subscription will update the state
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
      // Real-time subscription will correct the state
    } finally {
      setConversionLoading(false);
      await loadOrders();
    }
  };

  const workflowStage = normalizeStatus(selectedOrder?.status) === 'posted' ? 'document' : 'order';
  const selectedOrderStatus = normalizeStatus(selectedOrder?.status);
  const canConfirm = selectedOrderStatus === 'pending' || (selectedOrderStatus === 'submitted' && Boolean(selectedOrder?.can_approve));
  const confirmLabel = selectedOrderStatus === 'pending' ? 'Submit SO' : 'Approve SO';
  const canConvert = selectedOrderStatus === 'approved' || selectedOrderStatus === 'posted';

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
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                className="flex-1 text-xs bg-transparent outline-none"
                placeholder="Search order or customer"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <ListFilter className="w-3 h-3" /> Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | string)}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800"
              >
                <option value="all">All</option>
                {OLD_SYSTEM_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> From</span>
                <input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-white dark:bg-slate-800" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> To</span>
                <input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-white dark:bg-slate-800" />
              </label>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading orders...
              </div>
            )}
            {!loading && orders.map(order => {
              const customer = customerMap.get(order.contact_id);
              const isActive = selectedOrder?.id === order.id;
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left p-3 space-y-1 ${isActive ? 'bg-brand-blue/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{order.order_no}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-slate-500">{getCustomerLabel(order, customer)}</p>
                  <p className="text-[11px] text-slate-400">{new Date(order.sales_date).toLocaleDateString()}</p>
                </button>
              );
            })}
            {!loading && orders.length === 0 && (
              <div className="p-4 text-xs text-slate-500">No orders match the current filters.</div>
            )}
          </div>
          <div className="p-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
        <section className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedOrder ? (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Sales Order</p>
                    <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{selectedOrder.order_no}</h2>
                    <p className="text-xs text-slate-500">{new Date(selectedOrder.sales_date).toLocaleDateString()} · {getCustomerLabel(selectedOrder, selectedCustomer)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedOrder.status} />
                    <button
                      type="button"
                      onClick={handleConfirmOrder}
                      disabled={!canConfirm || confirming}
                      className="px-4 py-2 rounded bg-slate-900 text-white text-xs disabled:opacity-40"
                    >
                      {confirming ? 'Processing...' : confirmLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversionModalOpen(true)}
                      disabled={!canConvert}
                      className="px-4 py-2 rounded bg-brand-blue text-white text-xs disabled:opacity-40"
                    >
                      Convert to {documentSuggestion}
                    </button>
                  </div>
                </div>
                <WorkflowStepper currentStage={workflowStage} documentLabel="Order Slip / Invoice" />
                {selectedOrderStatus === 'submitted' && !selectedOrder?.can_approve && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                    This sales order is waiting for an assigned approver account.
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-500">Sales Person</p>
                    <p>{selectedOrder.sales_person || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Transaction Type</p>
                    <p>{selectedCustomer?.transactionType || 'Invoice'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Approved By</p>
                    <p>{selectedOrder.approved_by || 'Pending'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Approved At</p>
                    <p>{selectedOrder.approved_at ? new Date(selectedOrder.approved_at).toLocaleString() : 'Pending'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">Item</th>
                        <th className="py-2">Qty</th>
                        <th className="py-2">Unit Price</th>
                        <th className="py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map(item => (
                        <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-2">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">{item.description}</div>
                            <div className="text-[10px] text-slate-500">{item.item_code}</div>
                          </td>
                          <td className="py-2">{item.qty}</td>
                          <td className="py-2">₱{Number(item.unit_price || 0).toLocaleString()}</td>
                          <td className="py-2 font-semibold">₱{Number(item.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end text-sm font-semibold text-slate-700 dark:text-slate-200 mt-3">
                  Total: ₱{Number(selectedOrder.grand_total || 0).toLocaleString()}
                </div>
              </div>
              {documentMessage && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg p-3 text-xs flex items-center justify-between">
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
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Select an order from the left to view workflow details.
            </div>
          )}
        </section>
      </div>

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
