import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Receipt, ListFilter, Search, RefreshCw, DollarSign, Printer } from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  getAllInvoices,
  sendInvoice,
  recordPayment,
  markOverdue,
  printInvoice,
} from '../services/invoiceService';
import { dispatchWorkflowNotification, fetchContacts } from '../services/supabaseService';
import { isInvoiceAllowedForTransactionType, syncDocumentPolicyState } from '../services/salesOrderService';
import { Contact, Invoice, InvoiceItem, InvoiceStatus } from '../types';
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';

interface InvoiceViewProps {
  initialInvoiceId?: string;
}

const VAT_RATE = 0.12;

const FINAL_DOCUMENT_STATUSES = new Set<InvoiceStatus>([InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED]);

const documentStatusMeta: Record<InvoiceStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  [InvoiceStatus.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [InvoiceStatus.SENT]: { label: 'Sent', tone: 'info' },
  [InvoiceStatus.PAID]: { label: 'Paid', tone: 'success' },
  [InvoiceStatus.OVERDUE]: { label: 'Overdue', tone: 'warning' },
  [InvoiceStatus.CANCELLED]: { label: 'Cancelled', tone: 'danger' },
};

const InvoiceView: React.FC<InvoiceViewProps> = ({ initialInvoiceId }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [markingOverdue, setMarkingOverdue] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Use real-time list for contacts
  const { data: contacts } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
  });

  // Use real-time nested list for invoices with items
  const sortByCreatedAt = (a: Invoice, b: Invoice) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const {
    data: invoices,
    isLoading: loading,
    setData: setInvoices,
  } = useRealtimeNestedList<Invoice, InvoiceItem>({
    parentTableName: 'invoices',
    childTableName: 'invoice_items',
    parentFetchFn: getAllInvoices,
    childParentIdField: 'invoice_id',
    childrenField: 'items',
    sortParentFn: sortByCreatedAt,
  });

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);

  const notifyInvoiceEvent = useCallback(async (
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
      entityType: 'invoice',
      entityId,
      actionUrl: `/invoice?invoiceId=${entityId}`,
      targetRoles: ['Owner', 'Manager', 'Support'],
      includeActor: true,
    });
  }, []);

  // Auto-select first invoice when invoices change
  useEffect(() => {
    if (invoices.length > 0 && !selectedInvoice) {
      setSelectedInvoice(invoices[0]);
    }
  }, [invoices, selectedInvoice]);

  useEffect(() => {
    if (!initialInvoiceId || !invoices.length) return;
    const invoice = invoices.find(entry => entry.id === initialInvoiceId);
    if (invoice) setSelectedInvoice(invoice);
  }, [initialInvoiceId, invoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return invoices.filter(invoice => {
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      const matchesSearch =
        !query ||
        invoice.invoice_no.toLowerCase().includes(query) ||
        (customerMap.get(invoice.contact_id)?.company || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [customerMap, invoices, searchTerm, statusFilter]);

  const selectedCustomer = selectedInvoice ? customerMap.get(selectedInvoice.contact_id) : null;
  const subtotal = selectedInvoice?.items.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const vatAmount = subtotal * VAT_RATE;
  const grandTotal = selectedInvoice?.grand_total || subtotal + vatAmount;
  const canProcessInvoice = isInvoiceAllowedForTransactionType(selectedCustomer?.transactionType);

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  const handleSend = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;
    setSending(true);

    // Optimistic update
    const sentAt = new Date().toISOString();
    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, {
      status: InvoiceStatus.SENT,
      sent_at: sentAt
    } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? { ...prev, status: InvoiceStatus.SENT, sent_at: sentAt } : null);

    try {
      await sendInvoice(selectedInvoice.id);
      await notifyInvoiceEvent('Invoice Sent', `Invoice ${selectedInvoice.invoice_no} sent to customer.`, 'send', 'success', selectedInvoice.id);
    } catch (err) {
      console.error('Error sending invoice:', err);
      await notifyInvoiceEvent('Invoice Send Failed', `Failed to send invoice ${selectedInvoice.invoice_no}.`, 'send', 'failed', selectedInvoice.id, 'error');
      alert('Failed to send invoice');
      // Real-time subscription will correct the state
    } finally {
      setSending(false);
    }
  };

  const handleMarkOverdue = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;
    setMarkingOverdue(true);

    // Optimistic update
    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, { status: InvoiceStatus.OVERDUE } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? { ...prev, status: InvoiceStatus.OVERDUE } : null);

    try {
      await markOverdue(selectedInvoice.id);
      await notifyInvoiceEvent('Invoice Overdue', `Invoice ${selectedInvoice.invoice_no} marked as overdue.`, 'mark_overdue', 'success', selectedInvoice.id, 'warning');
    } catch (err) {
      console.error('Error marking overdue:', err);
      await notifyInvoiceEvent('Invoice Overdue Update Failed', `Failed to mark invoice ${selectedInvoice.invoice_no} as overdue.`, 'mark_overdue', 'failed', selectedInvoice.id, 'error');
      alert('Failed to mark invoice overdue');
      // Real-time subscription will correct the state
    } finally {
      setMarkingOverdue(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;

    // Optimistic update
    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, {
      status: InvoiceStatus.PAID,
      payment_date: paymentDate,
      payment_method: paymentMethod
    } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? {
      ...prev,
      status: InvoiceStatus.PAID,
      payment_date: paymentDate,
      payment_method: paymentMethod
    } : null);

    try {
      await recordPayment(selectedInvoice.id, {
        payment_date: paymentDate,
        payment_method: paymentMethod,
      });
      await notifyInvoiceEvent('Payment Recorded', `Invoice ${selectedInvoice.invoice_no} marked as paid (${paymentAmount || 'Full amount'}).`, 'record_payment', 'success', selectedInvoice.id);
      setPaymentModalOpen(false);
      setPaymentDate('');
      setPaymentMethod('Cash');
      setPaymentAmount('');
    } catch (err) {
      console.error('Error recording payment:', err);
      await notifyInvoiceEvent('Payment Recording Failed', `Failed to record payment for invoice ${selectedInvoice.invoice_no}.`, 'record_payment', 'failed', selectedInvoice.id, 'error');
      alert('Failed to record payment');
      // Real-time subscription will correct the state
    }
  };

  const handlePrint = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;
    setPrinting(true);

    // Optimistic update
    const printedAt = new Date().toISOString();
    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, { printed_at: printedAt } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? { ...prev, printed_at: printedAt } : null);

    try {
      await printInvoice(selectedInvoice.id);
      await notifyInvoiceEvent('Invoice Printed', `Invoice ${selectedInvoice.invoice_no} printed.`, 'print', 'success', selectedInvoice.id);
      window.print();
    } catch (err) {
      console.error('Error printing invoice:', err);
      await notifyInvoiceEvent('Invoice Print Failed', `Failed to print invoice ${selectedInvoice.invoice_no}.`, 'print', 'failed', selectedInvoice.id, 'error');
      alert('Failed to print invoice');
      // Real-time subscription will correct the state
    } finally {
      setPrinting(false);
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

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center gap-3">
        <span className="p-2 rounded bg-white/10"><Receipt className="w-5 h-5" /></span>
        <div>
          <h1 className="text-lg font-semibold">Invoices</h1>
          <p className="text-xs text-slate-300">Monitor billing, payments, and overdue accounts</p>
        </div>

      </div>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input className="flex-1 text-xs bg-transparent outline-none" placeholder="Search invoice or customer" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <ListFilter className="w-3 h-3" /> Status
              </label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | InvoiceStatus)} className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800">
                <option value="all">All</option>
                {Object.values(InvoiceStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading invoices...
              </div>
            )}
            {!loading && filteredInvoices.map(invoice => {
              const customer = customerMap.get(invoice.contact_id);
              const isActive = selectedInvoice?.id === invoice.id;
              return (
                <button
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={`w-full text-left p-3 space-y-1 ${isActive ? 'bg-brand-blue/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{invoice.invoice_no}</span>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <p className="text-xs text-slate-500">{customer?.company || invoice.contact_id}</p>
                  <p className="text-[11px] text-slate-400">{new Date(invoice.sales_date).toLocaleDateString()}</p>
                </button>
              );
            })}
            {!loading && filteredInvoices.length === 0 && (
              <div className="p-4 text-xs text-slate-500">No invoices match current filters.</div>
            )}
          </div>
        </aside>
        <section className="flex-1 overflow-y-auto p-4">
          {selectedInvoice ? (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Invoice</p>
                    <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{selectedInvoice.invoice_no}</h2>
                    <p className="text-xs text-slate-500">{new Date(selectedInvoice.sales_date).toLocaleDateString()} · {selectedCustomer?.company || selectedInvoice.contact_id}</p>
                  </div>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
                <WorkflowStepper currentStage={workflowStage} documentLabel="Invoice" documentSubStatus={workflowDocumentStatus} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-500">Due Date</p>
                    <p className={isOverdue ? 'text-rose-600 font-semibold' : ''}>{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Payment Method</p>
                    <p>{selectedInvoice.payment_method || 'Pending'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Sent At</p>
                    <p>{selectedInvoice.sent_at ? new Date(selectedInvoice.sent_at).toLocaleString() : 'Not sent'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Printed At</p>
                    <p>{selectedInvoice.printed_at ? new Date(selectedInvoice.printed_at).toLocaleString() : 'Not printed'}</p>
                  </div>
                </div>
                {!canProcessInvoice && selectedCustomer && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                    {selectedCustomer.company} is configured for Order Slip issuance only. Invoice actions are disabled for this customer.
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={selectedInvoice.status !== InvoiceStatus.DRAFT || sending || !canProcessInvoice}
                    title={!canProcessInvoice ? 'Customer is not permitted to send invoices.' : undefined}
                    className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-40"
                  >
                    {sending ? 'Sending...' : 'Send Invoice'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(true)}
                    disabled={selectedInvoice.status === InvoiceStatus.PAID || !canProcessInvoice}
                    title={!canProcessInvoice ? 'Customer is not permitted to record invoice payments.' : undefined}
                    className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-40 flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" /> Record Payment
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkOverdue}
                    disabled={selectedInvoice.status !== InvoiceStatus.SENT || markingOverdue || !canProcessInvoice}
                    title={!canProcessInvoice ? 'Customer is not permitted to manage invoice status.' : undefined}
                    className="px-4 py-2 rounded bg-amber-500 text-white disabled:opacity-40"
                  >
                    {markingOverdue ? 'Marking...' : 'Mark Overdue'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={printing || !canProcessInvoice}
                    title={!canProcessInvoice ? 'Customer is not permitted to print invoices.' : undefined}
                    className="px-4 py-2 rounded bg-brand-blue text-white disabled:opacity-40 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print'}
                  </button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 print:p-6">
                <div className="flex justify-between mb-4 print:flex-col print:gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Billing To</h3>
                    <p className="text-xs text-slate-500">{selectedCustomer?.company || 'N/A'}</p>
                    <p className="text-xs text-slate-500">{selectedInvoice.delivery_address || 'No address on file'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Invoice #: {selectedInvoice.invoice_no}</p>
                    <p>Order #: {selectedInvoice.order_id}</p>
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
                      {selectedInvoice.items?.map(item => (
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
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₱{subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-600"><span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span><span>₱{vatAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-slate-800 dark:text-white text-base"><span>Grand Total</span><span>₱{Number(grandTotal).toLocaleString()}</span></div>
                </div>
              </div>
              {(selectedInvoice.payment_date || selectedInvoice.status === InvoiceStatus.PAID) && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-700">
                  Paid on {selectedInvoice.payment_date ? new Date(selectedInvoice.payment_date).toLocaleDateString() : 'recorded'} via {selectedInvoice.payment_method || 'N/A'}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Select an invoice to view billing details.
            </div>
          )}
        </section>
      </div>

      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Record Payment</h3>
            <div className="space-y-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-slate-500">Payment Date</span>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-500">Payment Method</span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800">
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-500">Amount Received (optional)</span>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800" placeholder="₱" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-3 py-1 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Cancel
              </button>
              <button type="button" onClick={handleRecordPayment} disabled={!paymentDate} className="px-4 py-1 text-sm rounded bg-emerald-600 text-white disabled:opacity-40">
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceView;
