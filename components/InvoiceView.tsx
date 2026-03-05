import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Receipt, ListFilter, Search, RefreshCw, DollarSign, Printer, Calendar } from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  getInvoice,
  getInvoicesPage,
  sendInvoice,
  recordPayment,
  markOverdue,
  printInvoice,
} from '../services/invoiceLocalApiService';
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

const documentStatusMeta: Record<InvoiceStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  [InvoiceStatus.DRAFT]: { label: 'Draft', tone: 'neutral' },
  [InvoiceStatus.SENT]: { label: 'Sent', tone: 'info' },
  [InvoiceStatus.PAID]: { label: 'Paid', tone: 'success' },
  [InvoiceStatus.OVERDUE]: { label: 'Overdue', tone: 'warning' },
  [InvoiceStatus.CANCELLED]: { label: 'Cancelled', tone: 'danger' },
};

const InvoiceView: React.FC<InvoiceViewProps> = ({ initialInvoiceId, initialInvoiceRefNo }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [markingOverdue, setMarkingOverdue] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

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
        status: statusFilter === 'all' ? 'all' : statusFilter,
        search: debouncedSearch,
        dateFrom: dateRange.from || undefined,
        dateTo: dateRange.to || undefined,
        page: 1,
        perPage: 100,
      });
      setInvoices(result.items);
    } catch (err) {
      console.error('Failed loading invoices:', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);

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

    const sentAt = new Date().toISOString();
    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, {
      status: InvoiceStatus.SENT,
      sent_at: sentAt,
    } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? { ...prev, status: InvoiceStatus.SENT, sent_at: sentAt } : null);

    try {
      const updated = await sendInvoice(selectedInvoice.id);
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      await notifyInvoiceEvent('Invoice Sent', `Invoice ${selectedInvoice.invoice_no} sent to customer.`, 'send', 'success', selectedInvoice.id);
    } catch (err) {
      console.error('Error sending invoice:', err);
      await notifyInvoiceEvent('Invoice Send Failed', `Failed to send invoice ${selectedInvoice.invoice_no}.`, 'send', 'failed', selectedInvoice.id, 'error');
      alert('Failed to send invoice');
    } finally {
      setSending(false);
      await loadInvoices();
    }
  };

  const handleMarkOverdue = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;
    setMarkingOverdue(true);

    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, { status: InvoiceStatus.OVERDUE } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? { ...prev, status: InvoiceStatus.OVERDUE } : null);

    try {
      const updated = await markOverdue(selectedInvoice.id);
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      await notifyInvoiceEvent('Invoice Overdue', `Invoice ${selectedInvoice.invoice_no} marked as overdue.`, 'mark_overdue', 'success', selectedInvoice.id, 'warning');
    } catch (err) {
      console.error('Error marking overdue:', err);
      await notifyInvoiceEvent('Invoice Overdue Update Failed', `Failed to mark invoice ${selectedInvoice.invoice_no} as overdue.`, 'mark_overdue', 'failed', selectedInvoice.id, 'error');
      alert('Failed to mark invoice overdue');
    } finally {
      setMarkingOverdue(false);
      await loadInvoices();
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice || !canProcessInvoice) return;

    setInvoices(prev => applyOptimisticUpdate(prev, selectedInvoice.id, {
      status: InvoiceStatus.PAID,
      payment_date: paymentDate,
      payment_method: paymentMethod,
    } as Partial<Invoice>));
    setSelectedInvoice(prev => prev ? {
      ...prev,
      status: InvoiceStatus.PAID,
      payment_date: paymentDate,
      payment_method: paymentMethod,
    } : null);

    try {
      const updated = await recordPayment(selectedInvoice.id, {
        payment_date: paymentDate,
        payment_method: paymentMethod,
      });
      if (updated) {
        setInvoices(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedInvoice(updated);
      }
      await notifyInvoiceEvent('Payment Recorded', `Invoice ${selectedInvoice.invoice_no} marked as paid (${paymentAmount || 'Full amount'}).`, 'record_payment', 'success', selectedInvoice.id);
      setPaymentModalOpen(false);
      setPaymentDate('');
      setPaymentMethod('Cash');
      setPaymentAmount('');
    } catch (err) {
      console.error('Error recording payment:', err);
      await notifyInvoiceEvent('Payment Recording Failed', `Failed to record payment for invoice ${selectedInvoice.invoice_no}.`, 'record_payment', 'failed', selectedInvoice.id, 'error');
      alert('Failed to record payment');
    }
  };

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
              <input
                className="flex-1 text-xs bg-transparent outline-none"
                placeholder="Search invoice or customer"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> From</span>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-white dark:bg-slate-800"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> To</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-white dark:bg-slate-800"
                />
              </label>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading invoices...
              </div>
            )}
            {!loading && invoices.map(invoice => {
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
            {!loading && invoices.length === 0 && (
              <div className="p-4 text-xs text-slate-500">No invoices found.</div>
            )}
          </div>
        </aside>
        <section className="flex-1 overflow-y-auto p-4">
          {selectedInvoice ? (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Invoice</p>
                    <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{selectedInvoice.invoice_no}</h2>
                    <p className="text-xs text-slate-500">{new Date(selectedInvoice.sales_date).toLocaleDateString()} · {selectedCustomer?.company || selectedInvoice.contact_id}</p>
                  </div>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
                <WorkflowStepper
                  currentStage={workflowStage}
                  documentLabel="Invoice"
                  documentStatus={workflowDocumentStatus}
                />
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
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={selectedInvoice.status !== InvoiceStatus.DRAFT || sending || !canProcessInvoice}
                    title={!canProcessInvoice ? 'Customer is not permitted to issue invoices.' : undefined}
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
                    title={!canProcessInvoice ? 'Customer is not permitted to mark invoices overdue.' : undefined}
                    className="px-4 py-2 rounded bg-rose-600 text-white disabled:opacity-40"
                  >
                    {markingOverdue ? 'Updating...' : 'Mark Overdue'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={printing || !canProcessInvoice}
                    title={!canProcessInvoice ? 'Customer is not permitted to print invoices.' : undefined}
                    className="px-4 py-2 rounded bg-brand-blue text-white disabled:opacity-40 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print Invoice'}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 print:p-6 print:border-0">
                <div className="flex justify-between items-center mb-4 print:flex-col print:items-start print:gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Billing Details</h3>
                    <p className="text-xs text-slate-500">{selectedInvoice.delivery_address || 'No billing address specified'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Reference: {selectedInvoice.reference_no || 'N/A'}</p>
                    <p>PO Number: {selectedInvoice.po_number || 'N/A'}</p>
                    <p>Terms: {selectedInvoice.terms || 'N/A'}</p>
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
                <div className="flex justify-end mt-3">
                  <div className="text-sm text-slate-700 dark:text-slate-200 space-y-1 min-w-[220px]">
                    <div className="flex justify-between"><span>Subtotal</span><span>₱{subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>VAT (12%)</span><span>₱{vatAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between font-semibold text-base pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span>Total</span>
                      <span>₱{Number(grandTotal || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Select an invoice to view details.
            </div>
          )}
        </section>
      </div>

      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Record Payment</h3>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Payment Date
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800" />
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Payment Method
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="GCash">GCash</option>
              </select>
            </label>
            <label className="text-xs text-slate-500 flex flex-col gap-1">
              Amount
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder={String(grandTotal || '')} className="border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-3 py-2 text-xs rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Cancel
              </button>
              <button type="button" onClick={handleRecordPayment} disabled={!paymentDate} className="px-3 py-2 text-xs rounded bg-emerald-600 text-white disabled:opacity-40">
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
