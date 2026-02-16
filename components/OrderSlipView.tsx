import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileOutput, ListFilter, Search, RefreshCw, Printer, CheckCircle2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  finalizeOrderSlip,
  getAllOrderSlips,
  printOrderSlip,
} from '../services/orderSlipService';
import { dispatchWorkflowNotification, fetchContacts } from '../services/supabaseService';
import { isOrderSlipAllowedForTransactionType, syncDocumentPolicyState } from '../services/salesOrderService';
import { Contact, OrderSlip, OrderSlipItem, OrderSlipStatus } from '../types';
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';

interface OrderSlipViewProps {
  initialSlipId?: string;
}

const OrderSlipView: React.FC<OrderSlipViewProps> = ({ initialSlipId }) => {
  const [selectedSlip, setSelectedSlip] = useState<OrderSlip | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderSlipStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Use real-time list for contacts
  const { data: contacts } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
  });

  // Use real-time nested list for order slips with items
  const sortByCreatedAt = (a: OrderSlip, b: OrderSlip) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const {
    data: orderSlips,
    isLoading: loading,
    setData: setOrderSlips,
  } = useRealtimeNestedList<OrderSlip, OrderSlipItem>({
    parentTableName: 'order_slips',
    childTableName: 'order_slip_items',
    parentFetchFn: getAllOrderSlips,
    childParentIdField: 'order_slip_id',
    childrenField: 'items',
    sortParentFn: sortByCreatedAt,
  });

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);

  const notifyOrderSlipEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: 'success' | 'failed',
    entityId: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'order_slip',
      entityId,
      actionUrl: `/orderslip?orderSlipId=${entityId}`,
      targetRoles: ['Owner', 'Manager', 'Support'],
      includeActor: true,
    });
  }, []);

  const navigateToModule = useCallback((tab: string, payload?: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab, payload } }));
  }, []);

  // Auto-select first slip when slips change
  useEffect(() => {
    if (orderSlips.length > 0 && !selectedSlip) {
      setSelectedSlip(orderSlips[0]);
    }
  }, [orderSlips, selectedSlip]);

  useEffect(() => {
    if (!initialSlipId || !orderSlips.length) return;
    const slip = orderSlips.find(entry => entry.id === initialSlipId);
    if (slip) setSelectedSlip(slip);
  }, [initialSlipId, orderSlips]);

  const filteredSlips = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return orderSlips.filter(slip => {
      const matchesStatus = statusFilter === 'all' || slip.status === statusFilter;
      const matchesSearch =
        !query ||
        slip.slip_no.toLowerCase().includes(query) ||
        (customerMap.get(slip.contact_id)?.company || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [customerMap, orderSlips, searchTerm, statusFilter]);

  const selectedCustomer = selectedSlip ? customerMap.get(selectedSlip.contact_id) : null;
  const canProcessOrderSlip = isOrderSlipAllowedForTransactionType(selectedCustomer?.transactionType);

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  const handleFinalize = async () => {
    if (!selectedSlip || !canProcessOrderSlip) return;
    setFinalizing(true);

    // Optimistic update
    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: OrderSlipStatus.FINALIZED } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, status: OrderSlipStatus.FINALIZED } : null);

    try {
      await finalizeOrderSlip(selectedSlip.id);
      await notifyOrderSlipEvent('Order Slip Finalized', `Order Slip ${selectedSlip.slip_no} marked as finalized.`, 'finalize', 'success', selectedSlip.id);
    } catch (err) {
      console.error('Error finalizing order slip:', err);
      await notifyOrderSlipEvent('Order Slip Finalization Failed', `Failed to finalize order slip ${selectedSlip.slip_no}.`, 'finalize', 'failed', selectedSlip.id, 'error');
      alert('Failed to finalize order slip');
      // Real-time subscription will correct the state
    } finally {
      setFinalizing(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedSlip || !canProcessOrderSlip) return;
    setPrinting(true);

    // Optimistic update
    const printedAt = new Date().toISOString();
    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { printed_at: printedAt } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, printed_at: printedAt } : null);

    try {
      await printOrderSlip(selectedSlip.id);
      await notifyOrderSlipEvent('Order Slip Printed', `Order Slip ${selectedSlip.slip_no} was printed.`, 'print', 'success', selectedSlip.id);
      window.print();
    } catch (err) {
      console.error('Error printing order slip:', err);
      await notifyOrderSlipEvent('Order Slip Print Failed', `Failed to print order slip ${selectedSlip.slip_no}.`, 'print', 'failed', selectedSlip.id, 'error');
      alert('Failed to mark order slip as printed');
      // Real-time subscription will correct the state
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center gap-3">
        <span className="p-2 rounded bg-white/10"><FileOutput className="w-5 h-5" /></span>
        <div>
          <h1 className="text-lg font-semibold">Order Slips</h1>
          <p className="text-xs text-slate-300">Track document issuance and print status</p>
        </div>

      </div>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                className="flex-1 text-xs bg-transparent outline-none"
                placeholder="Search slip or customer"
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
                onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderSlipStatus)}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800"
              >
                <option value="all">All</option>
                {Object.values(OrderSlipStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading slips...
              </div>
            )}
            {!loading && filteredSlips.map(slip => {
              const customer = customerMap.get(slip.contact_id);
              const isActive = selectedSlip?.id === slip.id;
              return (
                <button
                  key={slip.id}
                  onClick={() => setSelectedSlip(slip)}
                  className={`w-full text-left p-3 space-y-1 ${isActive ? 'bg-brand-blue/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{slip.slip_no}</span>
                    <StatusBadge status={slip.status} />
                  </div>
                  <p className="text-xs text-slate-500">{customer?.company || slip.contact_id}</p>
                  <p className="text-[11px] text-slate-400">{new Date(slip.sales_date).toLocaleDateString()}</p>
                </button>
              );
            })}
            {!loading && filteredSlips.length === 0 && (
              <div className="p-4 text-xs text-slate-500">No order slips found.</div>
            )}
          </div>
        </aside>
        <section className="flex-1 overflow-y-auto p-4">
          {selectedSlip ? (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Order Slip</p>
                    <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{selectedSlip.slip_no}</h2>
                    <p className="text-xs text-slate-500">{new Date(selectedSlip.sales_date).toLocaleDateString()} · {selectedCustomer?.company || selectedSlip.contact_id}</p>
                  </div>
                  <StatusBadge status={selectedSlip.status} />
                </div>
                <WorkflowStepper currentStage="document" documentLabel="Order Slip" />
                {!canProcessOrderSlip && selectedCustomer && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                    {selectedCustomer.company} is configured for invoice issuance. Order slip actions are disabled for this customer.
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={selectedSlip.status !== OrderSlipStatus.DRAFT || finalizing || !canProcessOrderSlip}
                    title={!canProcessOrderSlip ? 'Customer is not permitted to finalize order slips.' : undefined}
                    className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-40"
                  >
                    {finalizing ? 'Finalizing...' : 'Finalize'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={printing || !canProcessOrderSlip}
                    title={!canProcessOrderSlip ? 'Customer is not permitted to print order slips.' : undefined}
                    className="px-4 py-2 rounded bg-brand-blue text-white disabled:opacity-40 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print Slip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToModule('salesorder', { orderId: selectedSlip.order_id })}
                    className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    View Sales Order
                  </button>
                </div>
                {selectedSlip.printed_at && (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Printed {new Date(selectedSlip.printed_at).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 print:p-6 print:border-0">
                <div className="flex justify-between items-center mb-4 print:flex-col print:items-start print:gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Delivery Details</h3>
                    <p className="text-xs text-slate-500">{selectedSlip.delivery_address || 'No delivery address specified'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Reference: {selectedSlip.reference_no || 'N/A'}</p>
                    <p>PO Number: {selectedSlip.po_number || 'N/A'}</p>
                  </div>
                </div>
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
                      {selectedSlip.items?.map(item => (
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
                  Total: ₱{Number(selectedSlip.grand_total || 0).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Select an order slip to view details.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default OrderSlipView;
