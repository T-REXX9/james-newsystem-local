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
  SalesOrderItem,
  SalesOrderStatus,
} from '../types';
import {
  confirmSalesOrder,
  convertToDocument,
  getAllSalesOrders,
  syncDocumentPolicyState,
} from '../services/salesOrderService';
import { dispatchWorkflowNotification, fetchContacts } from '../services/supabaseService';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';

interface SalesOrderViewProps {
  initialOrderId?: string;
}

const pageSize = 8;

const SalesOrderView: React.FC<SalesOrderViewProps> = ({ initialOrderId }) => {
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SalesOrderStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [confirming, setConfirming] = useState(false);
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');
  const [documentLink, setDocumentLink] = useState<{ type: 'orderslip' | 'invoice'; id: string; label: string } | null>(null);
  const [page, setPage] = useState(0);

  // Use real-time list for contacts
  const { data: contacts } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
  });

  // Use real-time nested list for sales orders with items
  const sortByCreatedAt = (a: SalesOrder, b: SalesOrder) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const {
    data: orders,
    isLoading: loading,
    setData: setOrders,
  } = useRealtimeNestedList<SalesOrder, SalesOrderItem>({
    parentTableName: 'sales_orders',
    childTableName: 'sales_order_items',
    parentFetchFn: getAllSalesOrders,
    childParentIdField: 'order_id',
    childrenField: 'items',
    sortParentFn: sortByCreatedAt,
  });

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
    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'sales_order',
      entityId,
      actionUrl,
      targetRoles: ['Owner', 'Manager'],
      includeActor: true,
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

  const applyOptimisticStatusUpdate = useCallback((orderId: string, status: SalesOrderStatus) => {
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

  // Auto-select first order when orders change
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
    setPage(0);
  }, [statusFilter, searchTerm, dateRange.from, dateRange.to]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return orders.filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch =
        !query ||
        order.order_no.toLowerCase().includes(query) ||
        (customerMap.get(order.contact_id)?.company || '').toLowerCase().includes(query);
      const orderDate = new Date(order.sales_date).getTime();
      const from = dateRange.from ? new Date(dateRange.from).getTime() : null;
      const to = dateRange.to ? new Date(dateRange.to).getTime() : null;
      const matchesDate = (!from || orderDate >= from) && (!to || orderDate <= to);
      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [customerMap, dateRange.from, dateRange.to, orders, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = filteredOrders.slice(page * pageSize, page * pageSize + pageSize);

  const selectedCustomer = selectedOrder ? customerMap.get(selectedOrder.contact_id) : null;
  const documentSuggestion = selectedCustomer?.transactionType || 'Invoice';

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    setConfirming(true);

    // Optimistic update
    applyOptimisticStatusUpdate(selectedOrder.id, SalesOrderStatus.CONFIRMED);

    try {
      await confirmSalesOrder(selectedOrder.id);
      await notifySalesOrderEvent(
        'Sales Order Confirmed',
        `Order ${selectedOrder.order_no} has been approved.`,
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
    }
  };

  const handleConversion = async () => {
    if (!selectedOrder) return;
    setConversionLoading(true);

    // Optimistic update
    applyOptimisticStatusUpdate(selectedOrder.id, SalesOrderStatus.CONVERTED_TO_DOCUMENT);

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
    }
  };

  const workflowStage = selectedOrder?.status === SalesOrderStatus.CONVERTED_TO_DOCUMENT ? 'document' : 'order';

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
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SalesOrderStatus)}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800"
              >
                <option value="all">All</option>
                {Object.values(SalesOrderStatus).map(status => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
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
            {!loading && paginatedOrders.map(order => {
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
            {!loading && paginatedOrders.length === 0 && (
              <div className="p-4 text-xs text-slate-500">No orders match the current filters.</div>
            )}
          </div>
          <div className="p-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
            <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="p-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page + 1} / {totalPages}</span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="p-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40">
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
                      disabled={selectedOrder.status !== SalesOrderStatus.PENDING || confirming}
                      className="px-4 py-2 rounded bg-slate-900 text-white text-xs disabled:opacity-40"
                    >
                      {confirming ? 'Confirming...' : 'Confirm Order'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversionModalOpen(true)}
                      disabled={selectedOrder.status !== SalesOrderStatus.CONFIRMED}
                      className="px-4 py-2 rounded bg-brand-blue text-white text-xs disabled:opacity-40"
                    >
                      Convert to {documentSuggestion}
                    </button>
                  </div>
                </div>
                <WorkflowStepper currentStage={workflowStage} documentLabel="Order Slip / Invoice" />
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
