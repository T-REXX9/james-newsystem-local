import React, { useState, useEffect, useMemo } from 'react';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { PurchaseOrderWithDetails, PurchaseOrderInsert, PurchaseOrderItemInsert, PO_STATUS_COLORS, Product, Supplier } from '../purchaseOrderTypes';
import { Plus, Trash2, Printer, Filter, ListFilter, Search, RefreshCw, ChevronLeft, ChevronRight, Save, CheckCircle, XCircle, ArrowLeft, Pencil } from 'lucide-react';
import StatusBadge from './StatusBadge'; // Assuming this exists or I'll inline the style
import { applyOptimisticUpdate } from '../utils/optimisticUpdates'; // Assuming usage
import ValidationSummary from './ValidationSummary';
import FieldHelp from './FieldHelp';
import ProductAutocomplete from './ProductAutocomplete';
import SearchableFilterSelect from './SearchableFilterSelect';
import SearchableSelect from './SearchableSelect';
import ConfirmModal from './ConfirmModal';
import { validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';
import { getLocalAuthSession } from '../services/localAuthService';
import {
  dispatchWorkflowNotification,
  markNotificationsAsReadByEntityKey,
} from '../services/notificationLocalApiService';
import ModuleRecordLink from './ModuleRecordLink';

// Inline StatusBadge if generic one is not suitable for POs, but I'll use simple spans for now to be safe, or try to use the imported one if generic.
// I'll stick to my own badge logic or reuse if I knew it works. I'll use my own for safety.

const POStatusBadge = ({ status }: { status: string }) => {
  const colorClass = PO_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {status}
    </span>
  );
};

interface PurchaseOrderViewProps {
  initialPOId?: string;
  initialPORefNo?: string;
}

const PAGE_SIZE = 10;
const PURCHASE_ORDER_TAB_ID = 'purchases-transaction-purchase-order';

const PurchaseOrderView: React.FC<PurchaseOrderViewProps> = ({ initialPOId, initialPORefNo }) => {
  const { addToast } = useToast();
  const currentUser = getLocalAuthSession()?.userProfile;
  const canUnpost = ['owner', 'company owner', 'administrator', 'purchasing manager'].includes(String(currentUser?.role || '').trim().toLowerCase()) || String(currentUser?.user_type || '') === '1';
  const today = new Date();
  // List State
  const [orders, setOrders] = useState<PurchaseOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState<number>(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(today.getFullYear());
  const [page, setPage] = useState(0);

  // View/Edit State
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State (New PO)
  const [createForm, setCreateForm] = useState<Partial<PurchaseOrderInsert>>({ status: 'Pending', order_date: new Date().toISOString().split('T')[0] });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [newPONumber, setNewPONumber] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Item Add State
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemId, setNewItemId] = useState('');
  const [selectedNewItemProduct, setSelectedNewItemProduct] = useState<Product | null>(null);
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemEta, setNewItemEta] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemQty, setEditItemQty] = useState(0);
  const [editItemUnitPrice, setEditItemUnitPrice] = useState(0);
  const [editItemEta, setEditItemEta] = useState('');

  const [printMode, setPrintMode] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', message: '', variant: 'info', confirmLabel: 'Confirm', onConfirm: async () => {} });

  const openConfirm = (opts: Omit<typeof confirmModal, 'isOpen'>) => setConfirmModal({ ...opts, isOpen: true });
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const notifyPurchaseOrderEvent = async (
    title: string,
    message: string,
    action: string,
    status: string,
    entityId: string,
    recipients: { targetRoles?: string[]; targetUserIds?: string[] } = {},
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'purchase_order',
      entityId,
      actionUrl: PURCHASE_ORDER_TAB_ID,
      actorId: String(currentUser?.id || '').trim(),
      actorRole: currentUser?.role || 'Unknown',
      targetRoles: recipients.targetRoles,
      targetUserIds: recipients.targetUserIds,
      includeActor: false,
      metadata: {
        refno: `purchase_order:${entityId}`,
        purchase_order_id: entityId,
        action_url: PURCHASE_ORDER_TAB_ID,
      },
    });
  };

  // Fetch initial data
  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchOrders();
  }, [filterMonth, filterYear, filterStatus, debouncedSearch]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await purchaseOrderService.getPurchaseOrders({
        month: filterMonth,
        year: filterYear,
        status: filterStatus || 'all',
        search: debouncedSearch,
      });
      const rows = (data as unknown as PurchaseOrderWithDetails[]) || [];
      setOrders(rows);
      setPage((currentPage) => Math.min(currentPage, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1)));
      if (rows.length === 0) {
        setSelectedPO(null);
      }
    } catch (err) {
      console.error('Failed to load purchase orders', err);
      setOrders([]);
      setSelectedPO(null);
      addToast({
        type: 'error',
        title: 'Unable to load purchase orders',
        description: err instanceof Error ? err.message : 'Please try again.',
        durationMs: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data = await purchaseOrderService.getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers', err);
      addToast({
        type: 'error',
        title: 'Unable to load suppliers',
        description: err instanceof Error ? err.message : 'Please try again.',
        durationMs: 6000,
      });
    }
  };

  // Data is already server-filtered by month/year/status/search.
  const filteredOrders = useMemo(() => orders, [orders]);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('default', { month: 'long' })),
    []
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 11 }, (_, i) => String(today.getFullYear() - 5 + i)),
    [today]
  );
  const statusOptions = useMemo(
    () => Object.keys(PO_STATUS_COLORS).filter((status) => status !== 'Draft'),
    []
  );

  const paginatedOrders = filteredOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);

  const handleSelectPO = async (po: PurchaseOrderWithDetails) => {
    setIsCreating(false);
    setShowAddItem(false);
    setPrintMode(false);
    try {
      const fullPO = await purchaseOrderService.getPurchaseOrderById(po.id);
      setSelectedPO(fullPO as unknown as PurchaseOrderWithDetails);
    } catch (err) {
      console.error('Error loading purchase order details:', err);
      setSelectedPO(po);
    }
  };

  useEffect(() => {
    if (!selectedPO?.id || !currentUser?.id) return;
    void markNotificationsAsReadByEntityKey(String(currentUser.id), {
      entityType: 'purchase_order',
      entityId: selectedPO.id,
    });
  }, [currentUser?.id, selectedPO?.id]);

  // Selection Logic
  useEffect(() => {
    if (orders.length > 0 && !selectedPO) {
      const foundById = initialPOId ? orders.find(o => o.id === initialPOId) : null;
      const foundByRef = initialPORefNo
        ? orders.find(o => String(o.po_number || '').toLowerCase() === initialPORefNo.toLowerCase())
        : null;
      const found = foundById || foundByRef;
      if (found) {
        handleSelectPO(found);
        return;
      }
    }
  }, [orders, initialPOId, initialPORefNo, selectedPO, isCreating]);

  const startCreate = async () => {
    setIsCreating(true);
    setSelectedPO(null);
    setPrintMode(false);
    const nextNum = await purchaseOrderService.generatePONumber();
    setNewPONumber(nextNum);
    setCreateForm({
      order_date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      remarks: '',
      grand_total: 0
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreateForm()) {
      setSubmitCount((prev) => prev + 1);
      return;
    }
    try {
      const newPO = await purchaseOrderService.createPurchaseOrder({
        ...createForm,
        po_number: newPONumber,
        warehouse_id: 'WH-MAIN', // Default
        created_by: '00000000-0000-0000-0000-000000000000' // Placeholder
      } as PurchaseOrderInsert);
      await fetchOrders();
      // Select the new PO
      const fullPO = await purchaseOrderService.getPurchaseOrderById(newPO.id);
      setSelectedPO(fullPO as unknown as PurchaseOrderWithDetails);
      await notifyPurchaseOrderEvent(
        'Purchase Order Created',
        `Purchase order ${newPONumber} has been created and submitted successfully.`,
        'create',
        'created',
        newPO.id,
        { targetRoles: ['Owner', 'Purchasing Manager'] }
      );
      setIsCreating(false);
      addToast({
        type: 'success',
        title: 'Purchase order created',
        description: 'Purchase order has been submitted successfully.',
        durationMs: 4000,
      });
    } catch (err: any) {
      setSubmitError(parseSupabaseError(err, 'purchase order'));
      addToast({
        type: 'error',
        title: 'Unable to create purchase order',
        description: parseSupabaseError(err, 'purchase order'),
        durationMs: 6000,
      });
    }
  };

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    const dateCheck = validateRequired(createForm.order_date, 'an order date');
    if (!dateCheck.isValid) errors.order_date = dateCheck.message;
    const supplierCheck = validateRequired(createForm.supplier_id, 'a supplier');
    if (!supplierCheck.isValid) errors.supplier_id = supplierCheck.message;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateBlur = (field: string, value: unknown) => {
    let message = '';
    if (field === 'order_date') {
      const result = validateRequired(value, 'an order date');
      message = result.isValid ? '' : result.message;
    }
    if (field === 'supplier_id') {
      const result = validateRequired(value, 'a supplier');
      message = result.isValid ? '' : result.message;
    }
    setValidationErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleStatusChange = (newStatus: string) => {
    if (!selectedPO) return;
    const variant = newStatus === 'Cancelled' ? 'danger' : newStatus === 'Posted' ? 'success' : 'warning';
    const confirmLabel = newStatus === 'Posted' ? 'Post' : newStatus === 'Cancelled' ? 'Cancel PO' : 'Confirm';
    openConfirm({
      title: `${newStatus === 'Cancelled' ? 'Cancel' : 'Post'} Purchase Order`,
      message: `Are you sure you want to change the status of ${selectedPO.po_number} to "${newStatus}"? This action cannot be undone.`,
      variant,
      confirmLabel,
      onConfirm: async () => {
        await purchaseOrderService.updatePurchaseOrder(selectedPO.id, { status: newStatus });
        const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
        setSelectedPO(updated as unknown as PurchaseOrderWithDetails);
        await notifyPurchaseOrderEvent(
          newStatus === 'Posted' ? 'Purchase Order Posted' : 'Purchase Order Cancelled',
          newStatus === 'Posted'
            ? `Purchase order ${selectedPO.po_number} has been posted for processing.`
            : `Purchase order ${selectedPO.po_number} has been cancelled.`,
          newStatus === 'Posted' ? 'post' : 'cancel',
          newStatus === 'Posted' ? 'posted' : 'cancelled',
          selectedPO.id,
          {
            targetRoles: newStatus === 'Posted'
              ? ['Owner', 'Purchasing Manager', 'Warehouse', 'Warehouse Staff']
              : ['Owner', 'Purchasing Manager'],
          }
        );
        fetchOrders();
        addToast({ type: 'success', title: `Status updated to ${newStatus}`, durationMs: 4000 });
      },
    });
  };

  const handleUnpost = () => {
    if (!selectedPO || !canUnpost) return;
    openConfirm({
      title: 'Unpost Purchase Order',
      message: `Unpost ${selectedPO.po_number}? This is allowed only when no Receiving Report depends on it.`,
      variant: 'warning',
      confirmLabel: 'Unpost',
      onConfirm: async () => {
        try {
          const updated = await purchaseOrderService.unpostPurchaseOrder(selectedPO.id);
          setSelectedPO(updated);
          await fetchOrders();
          addToast({ type: 'success', title: 'Purchase order unposted', description: `${selectedPO.po_number} is pending again.` });
        } catch (error: any) {
          addToast({ type: 'error', title: 'Unable to unpost purchase order', description: error.message });
        }
      },
    });
  };

  const addItem = async () => {
    if (!selectedPO || !newItemId) return;
    try {
      await purchaseOrderService.addPurchaseOrderItem({
        po_id: selectedPO.id,
        item_id: newItemId,
        qty: newItemQty,
        eta_date: newItemEta || null,
        unit_price: 0,
        amount: 0,
        quantity_received: 0
      });
      const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
      setSelectedPO(updated as unknown as PurchaseOrderWithDetails);
      setShowAddItem(false);
      setNewItemId('');
      setSelectedNewItemProduct(null);
      setNewItemQty(1);
      setNewItemEta('');
    } catch (err: any) {
      alert('Error adding item: ' + err.message);
    }
  };

  const deleteItem = (itemId: string) => {
    if (!selectedPO) return;
    openConfirm({
      title: 'Remove Item',
      message: 'Are you sure you want to remove this item from the purchase order?',
      variant: 'danger',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await purchaseOrderService.deletePurchaseOrderItem(itemId);
        const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
        setSelectedPO(updated as unknown as PurchaseOrderWithDetails);
        addToast({ type: 'success', title: 'Item removed', durationMs: 3000 });
      },
    });
  };

  const startEditItem = (item: PurchaseOrderWithDetails['items'][number]) => {
    setEditingItemId(item.id);
    setEditItemQty(Number(item.qty || 0));
    setEditItemUnitPrice(Number(item.unit_price || 0));
    setEditItemEta(item.eta_date || '');
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditItemQty(0);
    setEditItemUnitPrice(0);
    setEditItemEta('');
  };

  const saveEditItem = async () => {
    if (!selectedPO || !editingItemId) return;
    if (!Number.isFinite(editItemQty) || editItemQty <= 0) {
      addToast({ type: 'error', title: 'Quantity must be greater than zero', durationMs: 4000 });
      return;
    }
    if (!Number.isFinite(editItemUnitPrice) || editItemUnitPrice < 0) {
      addToast({ type: 'error', title: 'COGS cannot be negative', durationMs: 4000 });
      return;
    }
    try {
      await purchaseOrderService.updatePurchaseOrderItem(editingItemId, {
        qty: editItemQty,
        unit_price: editItemUnitPrice,
        eta_date: editItemEta || null,
      });
      const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
      setSelectedPO(updated);
      cancelEditItem();
      addToast({ type: 'success', title: 'Purchase-order item updated', durationMs: 3000 });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Unable to update purchase-order item',
        description: err instanceof Error ? err.message : 'Please try again.',
        durationMs: 6000,
      });
    }
  };

  // Print View Component
  const PrintView = ({ po }: { po: PurchaseOrderWithDetails }) => (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-lg relative">
      <button onClick={() => setPrintMode(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 print:hidden"><XCircle size={24} /></button>
      <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-bold uppercase">Purchase Order</h1>
          <p className="mt-1 font-mono text-lg">{po.po_number}</p>
          <p>Date: {new Date(po.order_date).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">TND OPC</h2>
          <p>Taguig City</p>
        </div>
      </div>
      {/* ... Print content similar to before ... */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Vendor</h3>
          <p className="font-bold">{po.supplier?.company}</p>
          <p className="text-sm">{po.supplier?.address}</p>
        </div>
        <div>
          <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Ship To</h3>
          <p className="font-bold">Main Warehouse</p>
          <p className="text-sm">Ref: {po.pr_reference || 'N/A'}</p>
        </div>
      </div>
      <table className="w-full text-sm border-collapse mb-8">
        <thead><tr className="border-b-2 border-black"><th className="text-left py-1">Qty</th><th className="text-left py-1">Description</th><th className="text-right py-1">Unit Price</th><th className="text-right py-1">Total</th></tr></thead>
        <tbody>
          {po.items?.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">{item.qty}</td>
              <td className="py-2"><span className="font-bold block">{item.product?.part_no}</span>{item.product?.description}</td>
              <td className="py-2 text-right">{item.unit_price ? item.unit_price.toFixed(2) : '-'}</td>
              <td className="py-2 text-right">{(item.unit_price && item.qty) ? (item.unit_price * item.qty).toFixed(2) : '-'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black"><td colSpan={3} className="text-right py-2 font-bold">Grand Total</td><td className="text-right py-2 font-bold">{po.grand_total?.toFixed(2)}</td></tr>
        </tfoot>
      </table>
      <div className="mt-12 grid grid-cols-2 gap-16 text-sm">
        <div><p className="mb-8 font-bold">Prepared By:</p><div className="border-b border-black"></div></div>
        <div><p className="mb-8 font-bold">Posted By:</p><div className="border-b border-black"></div></div>
      </div>
      <div className="mt-8 flex justify-center print:hidden">
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700"><Printer size={18} /> Print Now</button>
      </div>
    </div>
  );

  if (printMode && selectedPO) {
    return <div className="p-4 bg-gray-500/50 fixed inset-0 z-50 overflow-y-auto"><PrintView po={selectedPO} /></div>;
  }

  return (
    <div className="flex h-full flex-col bg-[#f7f9fc] text-slate-900 xl:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-[#f8fafb] xl:w-[320px] xl:border-b-0 xl:border-r">
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Purchase Orders</h2>
          <button onClick={startCreate} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0e4fb7]">
            <Plus className="h-4 w-4" /> Generate Purchase Order
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search PO No. or PR No. or Supplier..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Month</label>
              <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm">
                {monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Year</label>
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm">
                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm">
              <option value="">All Statuses</option>
              {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="max-h-[calc(100vh-320px)] overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No records found.</div>
          ) : (
            <div className="space-y-2">
              {paginatedOrders.map(po => {
                const isSelected = selectedPO?.id === po.id;
                const etaDate = po.first_eta_date || po.items?.[0]?.eta_date || null;
                const statusColor = po.status === 'Draft' || po.status === 'Pending' ? 'bg-slate-100 text-slate-700'
                  : po.status === 'Posted' ? 'bg-blue-100 text-blue-700'
                  : po.status === 'Waiting Approval' ? 'bg-orange-100 text-orange-700'
                  : po.status === 'Completed' ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-700';

                return (
                  <button
                    key={po.id}
                    onClick={() => handleSelectPO(po)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isSelected ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#175fd3]">{po.po_number}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>{po.status}</span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{po.pr_reference || '-'}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-600">Supplier: <span className="font-semibold">{po.supplier?.company || '-'}</span></span>
                      <span className="font-semibold text-slate-700">{po.item_count ?? po.items?.length ?? 0} Items</span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      ETA: {etaDate ? new Date(etaDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
              <span>Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}</span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"><ChevronLeft className="h-3 w-3" /></button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"><ChevronRight className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 lg:p-8">
        {isCreating ? (
          <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleCreateSubmit}>
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setIsCreating(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">New Purchase Order</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-500">PO No:</span>
                  <input value={newPONumber} disabled className="w-32 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700" />
                </div>
              </div>
              <div className="p-6">
                <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                {submitError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{submitError}</div>}

                <div className="mb-6 grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Order Date</label>
                    <input type="date" value={createForm.order_date} onChange={e => setCreateForm({ ...createForm, order_date: e.target.value })} onBlur={e => handleCreateBlur('order_date', e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#175fd3] focus:ring-1 focus:ring-blue-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Supplier</label>
                    <SearchableSelect value={createForm.supplier_id || ''} options={suppliers.map(s => ({ value: s.id, label: s.company || s.id }))} onChange={value => setCreateForm({ ...createForm, supplier_id: value })} placeholder="Select Supplier" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Remarks</label>
                  <textarea value={createForm.remarks || ''} onChange={e => setCreateForm({ ...createForm, remarks: e.target.value })} placeholder="Add any notes for this purchase order..." rows={3} className="w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-[#175fd3] focus:ring-1 focus:ring-blue-100" />
                </div>

                <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
                  <button type="submit" className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Create Purchase Order</button>
                </div>
              </div>
            </form>
          </section>
        ) : selectedPO ? (
          <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#173c83]">Purchase Order</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-500">PO No:</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-700">{selectedPO.po_number}</span>
                <button onClick={() => setPrintMode(true)} className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Print</button>
                {selectedPO.status === 'Pending' && <button onClick={() => handleStatusChange('Posted')} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700">Post</button>}
                {selectedPO.status === 'Posted' && canUnpost && <button onClick={handleUnpost} className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-bold text-white hover:bg-amber-600">Unpost</button>}
                {['Draft', 'Pending'].includes(selectedPO.status) && <button onClick={() => handleStatusChange('Cancelled')} className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-rose-700">Cancel</button>}
              </div>
            </div>

            <div className="p-6">
              <div className="mb-8 grid grid-cols-4 gap-6 border-b border-slate-100 pb-6">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">PR No.</p>
                  <p className="font-semibold text-[#175fd3]">{selectedPO.pr_reference || '-'}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Supplier</p>
                  <p className="font-semibold text-[#175fd3]">{selectedPO.supplier?.company || '-'}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{selectedPO.status}</span>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Created On</p>
                  <p className="font-semibold text-slate-700">{new Date(selectedPO.order_date).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase text-slate-700">Items</h3>
                {['Draft', 'Pending'].includes(selectedPO.status) && !showAddItem && (
                  <button onClick={() => setShowAddItem(true)} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700">Add PO</button>
                )}
              </div>

              {showAddItem && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-[1fr_90px_160px_auto_auto] items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-600">Product</label>
                      <ProductAutocomplete onSelect={product => { setNewItemId(product.id); setSelectedNewItemProduct(product as Product); }} placeholder="Search product..." />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-600">Quantity</label>
                      <input aria-label="Quantity" type="number" min="1" value={newItemQty} onChange={e => setNewItemQty(Number(e.target.value))} className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-[#175fd3]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-600">ETA</label>
                      <input aria-label="ETA" type="date" value={newItemEta} onChange={e => setNewItemEta(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-[#175fd3]" />
                    </div>
                    <button onClick={addItem} disabled={!newItemId} className="h-10 rounded-md bg-[#175fd3] px-4 font-bold text-white hover:bg-[#0e4fb7] disabled:opacity-50">Add</button>
                    <button onClick={() => setShowAddItem(false)} className="h-10 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[1000px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 text-center">#</th>
                      <th className="px-4 py-3 text-center">Quantity</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">ETA</th>
                      <th className="px-4 py-3">Original P/N</th>
                      <th className="px-4 py-3">Part No.</th>
                      <th className="px-4 py-3">Item Code</th>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">COGS</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedPO.items?.length ? (
                      <tr><td colSpan={11} className="py-12 text-center text-sm text-slate-500">No items added yet.</td></tr>
                    ) : selectedPO.items.map((item, index) => {
                      const isEditing = editingItemId === item.id;
                      return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-center font-semibold text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{isEditing ? <input aria-label={`Edit quantity ${index + 1}`} type="number" min="1" value={editItemQty} onChange={event => setEditItemQty(Number(event.target.value))} className="h-8 w-20 rounded border border-slate-300 px-2 text-center" /> : item.qty}</td>
                        <td className="px-4 py-3 font-semibold">{selectedPO.supplier?.company || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{isEditing ? <input aria-label={`Edit ETA ${index + 1}`} type="date" value={editItemEta} onChange={event => setEditItemEta(event.target.value)} className="h-8 w-36 rounded border border-slate-300 px-2" /> : item.eta_date ? new Date(item.eta_date).toLocaleDateString('en-GB') : '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">-</td>
                        <td className="px-4 py-3 font-semibold text-[#173c83]">{item.product?.part_no || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{item.product?.item_code || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{item.product?.brand || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{item.product?.description || '-'}</td>
                        <td className="px-4 py-3 text-right font-bold">{isEditing ? <input aria-label={`Edit COGS ${index + 1}`} type="number" min="0" step="0.01" value={editItemUnitPrice} onChange={event => setEditItemUnitPrice(Number(event.target.value))} className="h-8 w-28 rounded border border-slate-300 px-2 text-right" /> : item.unit_price ? item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                        <td className="px-4 py-3 text-center">
                              {['Draft', 'Pending'].includes(selectedPO.status) && (
                            isEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <button type="button" onClick={saveEditItem} className="text-emerald-600 hover:text-emerald-800" title="Save item"><Save size={16} /></button>
                                <button type="button" onClick={cancelEditItem} className="text-slate-400 hover:text-slate-700" title="Cancel edit"><XCircle size={16} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <button type="button" onClick={() => startEditItem(item)} className="text-[#175fd3] hover:text-[#0e4fb7]" title="Edit item"><Pencil size={16} /></button>
                                <button type="button" onClick={() => deleteItem(item.id)} className="text-rose-500 hover:text-rose-700" title="Remove item"><Trash2 size={16} /></button>
                              </div>
                            )
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  {selectedPO.items?.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                        <td colSpan={2} className="px-4 py-4 text-left">Total Items: {selectedPO.items.length}</td>
                        <td colSpan={7} className="px-4 py-4 text-right">Total Quantity: {selectedPO.items.reduce((sum, item) => sum + (item.qty || 0), 0)}</td>
                        <td colSpan={2} className="px-4 py-4 text-right">Total Amount: ₱{selectedPO.grand_total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </section>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ListFilter size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Select a Purchase Order</h3>
              <p className="mt-1 text-sm text-slate-500">Choose an order from the list or create a new one.</p>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmLabel={confirmModal.confirmLabel}
      />
    </div>
  );
};

export default PurchaseOrderView;
