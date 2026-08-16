import React, { useState, useEffect, useMemo } from 'react';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { PurchaseOrderWithDetails, PurchaseOrderInsert, PurchaseOrderItemInsert, PO_STATUS_COLORS, Product, Supplier } from '../purchaseOrderTypes';
import { Plus, Trash2, Printer, Filter, ListFilter, Search, RefreshCw, ChevronLeft, ChevronRight, Save, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
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
      if (rows.length === 0) {
        setSelectedPO(null);
      }
    } catch (err) {
      console.error(err);
      setOrders([]);
      setSelectedPO(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    const data = await purchaseOrderService.getSuppliers();
    setSuppliers(data || []);
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

  const updateItem = async (itemId: string, field: string, value: any) => {
    if (!selectedPO) return;
    try {
      await purchaseOrderService.updatePurchaseOrderItem(itemId, { [field]: value });
      // Debounce or just refresh? For now simplicity:
      const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
      setSelectedPO(updated as unknown as PurchaseOrderWithDetails);
    } catch (err) {
      console.error(err);
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
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
      <div className="mx-auto max-w-[1380px] space-y-5">
        <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ddd] px-5 py-4">
            <button onClick={startCreate} className="inline-flex items-center gap-1 rounded border border-[#4f9e43] bg-[#70b865] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5daa52]">
              <Plus size={16} /> Create New
            </button>
            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="po-month" className="font-semibold">Filter by Month:</label>
              <select id="po-month" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="w-48 rounded border border-[#ccc] bg-white px-3 py-2">
                {monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
              <input aria-label="Filter year" type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="w-24 rounded border border-[#ccc] px-3 py-2" />
            </div>
          </div>
          <div className="max-h-[260px] overflow-auto px-5 py-4">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b-2 border-[#ddd] text-left">
                  <th className="px-2 py-3">Date</th><th className="px-2 py-3">PO No.</th><th className="px-2 py-3">PR No.</th><th className="px-2 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="py-8 text-center text-gray-500">Loading...</td></tr> :
                  filteredOrders.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-gray-500">No records found.</td></tr> :
                  filteredOrders.map(po => (
                    <tr key={po.id} onClick={() => handleSelectPO(po)} className={`cursor-pointer border-b border-[#e5e5e5] hover:bg-[#f5f5f5] ${selectedPO?.id === po.id ? 'bg-[#eef6fb]' : ''}`}>
                      <td className="px-2 py-3">{new Date(po.order_date).toLocaleDateString()}</td>
                      <td className="px-2 py-3 font-semibold text-[#337ab7]">
                        <ModuleRecordLink
                          tab="warehouse-purchasing-purchase-order"
                          payload={{ poId: po.id, poRefNo: po.po_number }}
                          onOpen={() => handleSelectPO(po)}
                        >
                          {po.po_number}
                        </ModuleRecordLink>
                      </td>
                      <td className="px-2 py-3">{po.pr_reference || '-'}</td>
                      <td className="px-2 py-3"><POStatusBadge status={po.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {isCreating && (
          <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
            <form onSubmit={handleCreateSubmit}>
              <div className="flex items-center justify-between border-b border-[#ddd] px-5 py-4">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsCreating(false)} className="rounded border border-[#ccc] bg-[#f5f5f5] px-3 py-2 text-sm">← Back</button>
                  <h2 className="font-serif text-xl font-bold uppercase">Purchase Order</h2>
                </div>
                <label className="flex items-center gap-3 font-bold">PO No. <input value={newPONumber} disabled className="w-32 rounded border border-[#ccc] bg-[#eee] px-3 py-2 font-normal" /></label>
              </div>
              <div className="p-5">
                <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                {submitError && <div className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>}
                <div className="grid grid-cols-[130px_230px_150px_1fr] gap-3 border-b-2 border-[#ddd] pb-3 text-sm font-bold">
                  <span>Quantity</span><span>Supplier</span><span>ETA</span><span>Original P/N &nbsp;&nbsp; Part No. &nbsp;&nbsp; Item Code &nbsp;&nbsp; Brand &nbsp;&nbsp; Description &nbsp;&nbsp; COGS</span>
                </div>
                <div className="grid grid-cols-[130px_230px_150px_1fr] gap-3 py-3">
                  <input value="1" disabled className="rounded border border-[#ccc] bg-[#eee] px-3 py-2" />
                  <SearchableSelect value={createForm.supplier_id || ''} options={suppliers.map(s => ({ value: s.id, label: s.company || s.id }))} onChange={value => setCreateForm({ ...createForm, supplier_id: value })} placeholder="Select Supplier" />
                  <input type="date" className="rounded border border-[#ccc] px-3 py-2" />
                  <div className="rounded border border-[#ddd] bg-[#fafafa] px-3 py-2 text-sm text-gray-500">Items may be added after the purchase order is created.</div>
                </div>
                <textarea value={createForm.remarks || ''} onChange={e => setCreateForm({ ...createForm, remarks: e.target.value })} placeholder="Remark" rows={3} className="mt-2 w-1/2 rounded border border-[#ccc] p-3" />
                <div className="mt-4"><button type="submit" className="rounded border border-[#4f9e43] bg-[#70b865] px-4 py-2 text-sm font-semibold text-white">Add PO</button></div>
              </div>
            </form>
          </section>
        )}

        {!isCreating && selectedPO && (
          <section className="rounded border border-[#d5d5d5] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd] px-5 py-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedPO(null)} className="rounded border border-[#ccc] bg-[#f5f5f5] px-3 py-2 text-sm">← Back</button>
                <h2 className="font-serif text-xl font-bold uppercase">Purchase Order</h2>
                <POStatusBadge status={selectedPO.status} />
              </div>
              <div className="flex items-center gap-2">
                <strong>PO No. {selectedPO.po_number}</strong>
                <button onClick={() => setPrintMode(true)} className="rounded border border-[#ccc] px-3 py-2 text-sm">Print</button>
                {selectedPO.status === 'Pending' && <button onClick={() => handleStatusChange('Posted')} className="rounded bg-[#70b865] px-3 py-2 text-sm font-semibold text-white">Post</button>}
                {selectedPO.status === 'Posted' && canUnpost && <button onClick={handleUnpost} className="rounded bg-[#d9534f] px-3 py-2 text-sm font-semibold text-white">Unpost</button>}
                {['Draft', 'Pending'].includes(selectedPO.status) && <button onClick={() => handleStatusChange('Cancelled')} className="rounded bg-[#d9534f] px-3 py-2 text-sm font-semibold text-white">Cancel</button>}
              </div>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-3 gap-5 text-sm">
                <div><b>Supplier:</b> {selectedPO.supplier?.company || '-'}</div><div><b>PR No.:</b> {selectedPO.pr_reference || '-'}</div><div><b>Date:</b> {new Date(selectedPO.order_date).toLocaleDateString()}</div>
              </div>
              {showAddItem && (
                <div className="mb-4 grid grid-cols-[1fr_90px_160px_auto_auto] items-end gap-2 border border-[#ddd] bg-[#f7f7f7] p-3">
                  <ProductAutocomplete onSelect={product => { setNewItemId(product.id); setSelectedNewItemProduct(product as Product); }} placeholder="Search product..." />
                  <input aria-label="Quantity" type="number" min="1" value={newItemQty} onChange={e => setNewItemQty(Number(e.target.value))} className="rounded border border-[#ccc] px-2 py-2" />
                  <input aria-label="ETA" type="date" value={newItemEta} onChange={e => setNewItemEta(e.target.value)} className="rounded border border-[#ccc] px-2 py-2" />
                  <button onClick={addItem} disabled={!newItemId} className="rounded bg-[#337ab7] px-3 py-2 text-white disabled:opacity-50">Add</button>
                  <button onClick={() => setShowAddItem(false)} className="rounded border border-[#ccc] bg-white px-3 py-2">Cancel</button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead><tr className="border-b-2 border-[#ddd] text-left">
                    <th className="px-2 py-3"></th><th className="px-2 py-3">Quantity</th><th className="px-2 py-3">Supplier</th><th className="px-2 py-3">ETA</th><th className="px-2 py-3">Original P/N</th><th className="px-2 py-3">Part No.</th><th className="px-2 py-3">Item Code</th><th className="px-2 py-3">Brand</th><th className="px-2 py-3">Description</th><th className="px-2 py-3">COGS</th><th className="px-2 py-3">RR No.</th><th className="px-2 py-3">Received Qty</th>
                  </tr></thead>
                  <tbody>
                    {!selectedPO.items?.length ? <tr><td colSpan={12} className="py-8 text-center text-gray-500">No items.</td></tr> : selectedPO.items.map(item => (
                      <tr key={item.id} className="border-b border-[#e5e5e5]">
                        <td className="px-2 py-3">{['Draft','Pending'].includes(selectedPO.status) && <button onClick={() => deleteItem(item.id)} className="text-red-600"><Trash2 size={15}/></button>}</td>
                        <td className="px-2 py-3">{item.qty}</td><td className="px-2 py-3">{selectedPO.supplier?.company || '-'}</td><td className="px-2 py-3">{item.eta_date ? new Date(item.eta_date).toLocaleDateString() : '-'}</td><td className="px-2 py-3">-</td><td className="px-2 py-3">{item.product?.part_no || '-'}</td><td className="px-2 py-3">{item.product?.item_code || '-'}</td><td className="px-2 py-3">{item.product?.brand || '-'}</td><td className="px-2 py-3">{item.product?.description || '-'}</td><td className="px-2 py-3">{item.unit_price?.toLocaleString() || '-'}</td><td className="px-2 py-3">-</td><td className="px-2 py-3">{item.quantity_received || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {['Draft','Pending'].includes(selectedPO.status) && !showAddItem && <button onClick={() => setShowAddItem(true)} className="mt-4 rounded bg-[#337ab7] px-4 py-2 text-sm font-semibold text-white">Add Item</button>}
            </div>
          </section>
        )}
      </div>

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
