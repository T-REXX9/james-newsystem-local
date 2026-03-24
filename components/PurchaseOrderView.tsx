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
import { validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

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

const PurchaseOrderView: React.FC<PurchaseOrderViewProps> = ({ initialPOId, initialPORefNo }) => {
  const { addToast } = useToast();
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
    if (orders.length > 0 && !selectedPO && !isCreating) {
      // Optional: Auto-select first?
      handleSelectPO(orders[0]);
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

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedPO) return;
    if (!confirm(`Change status to ${newStatus}?`)) return;
    try {
      await purchaseOrderService.updatePurchaseOrder(selectedPO.id, { status: newStatus });
      // Refresh
      const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
      setSelectedPO(updated as unknown as PurchaseOrderWithDetails);
      fetchOrders(); // Update list
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
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

  const deleteItem = async (itemId: string) => {
    if (!selectedPO || !confirm('Remove item?')) return;
    try {
      await purchaseOrderService.deletePurchaseOrderItem(itemId);
      const updated = await purchaseOrderService.getPurchaseOrderById(selectedPO.id);
      setSelectedPO(updated as unknown as PurchaseOrderWithDetails);
    } catch (err: any) {
      alert('Error removing item: ' + err.message);
    }
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
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Layout matching SalesOrderView */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded bg-white/10"><ListFilter className="w-5 h-5" /></span>
          <div>
            <h1 className="text-lg font-semibold">Purchase Orders</h1>
            <p className="text-xs text-slate-300">Procurement and supplier management</p>
          </div>
        </div>
        <button onClick={startCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors">
          <Plus size={16} /> New PO
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 px-2 py-1 round border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input className="flex-1 text-xs bg-transparent outline-none" placeholder="Search PO # or Supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SearchableFilterSelect
                value={monthOptions[filterMonth - 1]}
                options={monthOptions}
                placeholder="Search month"
                allLabel="Month"
                className="min-w-0"
                onChange={(value) => {
                  const nextIndex = monthOptions.indexOf(value || '');
                  if (nextIndex >= 0) setFilterMonth(nextIndex + 1);
                }}
              />
              <SearchableFilterSelect
                value={String(filterYear)}
                options={yearOptions}
                placeholder="Search year"
                allLabel="Year"
                className="min-w-0"
                onChange={(value) => {
                  const nextYear = Number(value);
                  if (Number.isFinite(nextYear) && nextYear > 0) setFilterYear(nextYear);
                }}
              />
            </div>
            <SearchableFilterSelect
              value={filterStatus || undefined}
              options={statusOptions}
              placeholder="Search status"
              allLabel="All Statuses"
              className="min-w-0"
              onChange={(value) => setFilterStatus(value || '')}
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && <div className="p-4 text-center text-xs text-slate-500"><RefreshCw className="animate-spin inline mr-2" /> Loading...</div>}
            {!loading && paginatedOrders.map(po => (
              <button key={po.id} onClick={() => handleSelectPO(po)} className={`w-full text-left p-3 space-y-1 ${selectedPO?.id === po.id ? 'bg-blue-50 dark:bg-slate-800/50 border-l-4 border-blue-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{po.po_number}</span>
                  <POStatusBadge status={po.status} />
                </div>
                <p className="text-xs text-slate-500">{po.supplier?.company || 'Unknown Supplier'}</p>
                <p className="text-[11px] text-slate-400">{new Date(po.order_date).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950">
          {isCreating ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Create New Purchase Order</h2>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                {submitError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1">PO Number</label>
                  <input type="text" value={newPONumber} disabled className="w-full bg-slate-100 border border-slate-300 rounded p-2 text-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Order Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.order_date}
                    onChange={e => setCreateForm({ ...createForm, order_date: e.target.value })}
                    onBlur={e => handleCreateBlur('order_date', e.target.value)}
                    className={`w-full border rounded p-2 ${validationErrors.order_date ? 'border-rose-400' : 'border-slate-300'}`}
                  />
                  {validationErrors.order_date && (
                    <p className="mt-1 text-xs text-rose-600">{validationErrors.order_date}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Supplier</label>
                  <select
                    required
                    value={createForm.supplier_id || ''}
                    onChange={e => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                    onBlur={e => handleCreateBlur('supplier_id', e.target.value)}
                    className={`w-full border rounded p-2 ${validationErrors.supplier_id ? 'border-rose-400' : 'border-slate-300'}`}
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                  </select>
                  {validationErrors.supplier_id && (
                    <p className="mt-1 text-xs text-rose-600">{validationErrors.supplier_id}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Remarks</label>
                  <textarea value={createForm.remarks || ''} onChange={e => setCreateForm({ ...createForm, remarks: e.target.value })} className="w-full border border-slate-300 rounded p-2 rows-3"></textarea>
                  <FieldHelp text="Add any delivery or payment notes needed for the supplier." example="Deliver to WH2, payment terms net 30." />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Save size={16} /> Create PO</button>
                </div>
              </form>
            </div>
          ) : selectedPO ? (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                      {selectedPO.po_number}
                      <POStatusBadge status={selectedPO.status} />
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Created {new Date(selectedPO.order_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Total</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">₱{selectedPO.grand_total?.toLocaleString() || '0.00'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <p className="font-semibold text-slate-500 uppercase text-xs mb-1">Supplier</p>
                    <p className="font-medium text-lg text-slate-800 dark:text-white">{selectedPO.supplier?.company}</p>
                    <p className="text-slate-500">{selectedPO.supplier?.address}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 uppercase text-xs mb-1">Details</p>
                    <p>PR Ref: {selectedPO.pr_reference || '-'}</p>
                    <p>Warehouse: {selectedPO.warehouse_id}</p>
                  </div>
                  <div className="flex flex-col gap-2 justify-center items-end">
                    <button onClick={() => setPrintMode(true)} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"><Printer size={16} /> Print</button>
                    {selectedPO.status === 'Pending' && <button onClick={() => handleStatusChange('Posted')} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"><CheckCircle size={16} /> Post</button>}
                    {['Draft', 'Pending'].includes(selectedPO.status) && <button onClick={() => handleStatusChange('Cancelled')} className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"><XCircle size={16} /> Cancel</button>}
                  </div>
                </div>
              </div>

              {/* Items Card */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-slate-800 dark:text-white">Items</h3>
                  {['Draft', 'Pending'].includes(selectedPO.status) && <button onClick={() => {
                    setShowAddItem(true);
                    setNewItemId('');
                    setSelectedNewItemProduct(null);
                    setNewItemQty(1);
                    setNewItemEta('');
                  }} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1"><Plus size={14} /> Add Item</button>}
                </div>
                {showAddItem && (
                  <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs font-semibold">Product</label>
                        <ProductAutocomplete
                          onSelect={(product) => {
                            setNewItemId(product.id);
                            setSelectedNewItemProduct(product as Product);
                          }}
                          className="mt-1"
                          placeholder="Search by part no, item code, or description..."
                        />
                      </div>
                      <div className="w-20"><label className="text-xs font-semibold">Qty</label><input type="number" min="1" value={newItemQty} onChange={e => setNewItemQty(Number(e.target.value))} className="w-full text-sm rounded border-gray-300" /></div>
                      <div className="w-32"><label className="text-xs font-semibold">ETA</label><input type="date" value={newItemEta} onChange={e => setNewItemEta(e.target.value)} className="w-full text-sm rounded border-gray-300" /></div>
                      <button onClick={addItem} disabled={!newItemId} className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">Add</button>
                      <button onClick={() => {
                        setShowAddItem(false);
                        setNewItemId('');
                        setSelectedNewItemProduct(null);
                        setNewItemQty(1);
                        setNewItemEta('');
                      }} className="px-3 py-2 bg-white border rounded text-sm">Cancel</button>
                    </div>
                    {selectedNewItemProduct && (
                      <div className="mt-3 rounded border border-blue-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">{selectedNewItemProduct.part_no}</div>
                        <div>{selectedNewItemProduct.description || 'No description available.'}</div>
                        {selectedNewItemProduct.item_code && (
                          <div className="text-xs text-slate-500">Item Code: {selectedNewItemProduct.item_code}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs"><th className="px-6 py-3">#</th><th className="px-6 py-3">Product</th><th className="px-6 py-3 text-center">Qty</th><th className="px-6 py-3 text-right">Price</th><th className="px-6 py-3 text-right">Total</th><th className="px-6 py-3">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedPO.items?.length === 0 ? <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No items.</td></tr> : selectedPO.items?.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 text-slate-500">{idx + 1}</td>
                          <td className="px-6 py-3">
                            <div className="font-medium text-slate-800 dark:text-white">{item.product?.part_no}</div>
                            <div className="text-xs text-slate-500">{item.product?.description}</div>
                          </td>
                          <td className="px-6 py-3 text-center">
                            {['Draft', 'Pending'].includes(selectedPO.status) ? <input type="number" className="w-16 text-center border rounded p-1 text-xs" value={item.qty || 0} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} /> : item.qty}
                          </td>
                          <td className="px-6 py-3 text-right">₱{item.unit_price?.toLocaleString() || '-'}</td>
                          <td className="px-6 py-3 text-right font-medium">₱{item.amount?.toLocaleString() || '-'}</td>
                          <td className="px-6 py-3">
                            {['Draft', 'Pending'].includes(selectedPO.status) && <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ListFilter size={48} className="mb-4 opacity-20" />
              <p>Select a Purchase Order to view details or create a new one.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PurchaseOrderView;
