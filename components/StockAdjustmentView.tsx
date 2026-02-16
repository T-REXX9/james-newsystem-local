import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Scale, ListFilter, Search, RefreshCw, Plus, Package,
  CheckCircle2, AlertTriangle, XCircle, Calendar, MapPin,
  FileText, Trash2, Save, ArrowUp, ArrowDown, AlertCircle
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  createStockAdjustment,
  getAllStockAdjustments,
  finalizeAdjustment,
} from '../services/stockAdjustmentService';
import { dispatchWorkflowNotification, fetchProducts } from '../services/supabaseService';
import {
  Product,
  StockAdjustment,
  StockAdjustmentDTO,
  StockAdjustmentItem,
  StockAdjustmentType
} from '../types';
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';

interface StockAdjustmentViewProps {
  initialAdjustmentId?: string;
}

const WAREHOUSES = ['WH1', 'WH2', 'WH3', 'WH4', 'WH5', 'WH6'];

type StockAdjustmentStatus = 'draft' | 'finalized';

const FINAL_DOCUMENT_STATUSES = new Set<StockAdjustmentStatus>([
  'finalized'
]);

const documentStatusMeta: Record<StockAdjustmentStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  'draft': { label: 'Draft', tone: 'neutral' },
  'finalized': { label: 'Finalized', tone: 'success' },
};

const StockAdjustmentView: React.FC<StockAdjustmentViewProps> = ({ initialAdjustmentId }) => {
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | StockAdjustmentStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [adjustmentNo, setAdjustmentNo] = useState('');
  const [warehouseId, setWarehouseId] = useState('WH1');
  const [adjustmentType, setAdjustmentType] = useState<StockAdjustmentType>(StockAdjustmentType.PHYSICAL_COUNT);
  const [adjustmentDate, setAdjustmentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{
    item_id: string;
    system_qty: number;
    physical_qty: number;
    reason?: string;
  }>>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Use real-time list for products
  const { data: products } = useRealtimeList<Product>({
    tableName: 'products',
    initialFetchFn: fetchProducts,
  });

  // Use real-time nested list for stock adjustments with items
  const sortByCreatedAt = (a: StockAdjustment, b: StockAdjustment) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const {
    data: stockAdjustments,
    isLoading: loading,
    setData: setStockAdjustments,
  } = useRealtimeNestedList<StockAdjustment, StockAdjustmentItem>({
    parentTableName: 'stock_adjustments',
    childTableName: 'stock_adjustment_items',
    parentFetchFn: getAllStockAdjustments,
    childParentIdField: 'adjustment_id',
    childrenField: 'items',
    sortParentFn: sortByCreatedAt,
  });

  const productMap = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);

  const notifyStockAdjustmentEvent = useCallback(async (
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
      entityType: 'stock_adjustment',
      entityId,
      actionUrl: `/stock-adjustment?adjustmentId=${entityId}`,
      targetRoles: ['Owner', 'Manager', 'Support'],
      includeActor: true,
    });
  }, []);

  // Auto-select first adjustment when adjustments change
  useEffect(() => {
    if (stockAdjustments.length > 0 && !selectedAdjustment) {
      setSelectedAdjustment(stockAdjustments[0]);
    }
  }, [stockAdjustments, selectedAdjustment]);

  useEffect(() => {
    if (!initialAdjustmentId || !stockAdjustments.length) return;
    const adjustment = stockAdjustments.find(entry => entry.id === initialAdjustmentId);
    if (adjustment) setSelectedAdjustment(adjustment);
  }, [initialAdjustmentId, stockAdjustments]);

  const filteredAdjustments = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return stockAdjustments.filter(adj => {
      const matchesStatus = statusFilter === 'all' || adj.status === statusFilter;
      const matchesSearch =
        !query ||
        adj.adjustment_no.toLowerCase().includes(query) ||
        adj.warehouse_id.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [stockAdjustments, searchTerm, statusFilter]);

  const workflowStage = useMemo<'inquiry' | 'order' | 'document'>(() => {
    if (!selectedAdjustment) return 'inquiry';
    return FINAL_DOCUMENT_STATUSES.has(selectedAdjustment.status) ? 'document' : 'order';
  }, [selectedAdjustment]);
  const workflowDocumentStatus = useMemo(() => {
    if (!selectedAdjustment || workflowStage !== 'document') return undefined;
    return documentStatusMeta[selectedAdjustment.status];
  }, [selectedAdjustment, workflowStage]);

  // Filter products for autocomplete
  const filteredProducts = useMemo(() => {
    if (!itemSearch) return products.slice(0, 50);
    const query = itemSearch.toLowerCase();
    return products.filter(p =>
      p.part_no.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.item_code.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [products, itemSearch]);

  const getProductStock = (productId: string, warehouse: string): number => {
    const product = productMap.get(productId);
    if (!product) return 0;
    switch (warehouse) {
      case 'WH1': return product.stock_wh1;
      case 'WH2': return product.stock_wh2;
      case 'WH3': return product.stock_wh3;
      case 'WH4': return product.stock_wh4;
      case 'WH5': return product.stock_wh5;
      case 'WH6': return product.stock_wh6;
      default: return 0;
    }
  };

  const handleFinalize = async () => {
    if (!selectedAdjustment) return;
    setFinalizing(true);

    // Optimistic update
    setStockAdjustments(prev => applyOptimisticUpdate(prev, selectedAdjustment.id, {
      status: 'finalized'
    } as Partial<StockAdjustment>));
    setSelectedAdjustment(prev => prev ? { ...prev, status: 'finalized' } : null);

    try {
      await finalizeAdjustment(selectedAdjustment.id);
      await notifyStockAdjustmentEvent(
        'Stock Adjustment Finalized',
        `Adjustment ${selectedAdjustment.adjustment_no} has been finalized. Inventory updated.`,
        'finalize',
        'success',
        selectedAdjustment.id
      );
      setShowFinalizeConfirm(false);
    } catch (err) {
      console.error('Error finalizing adjustment:', err);
      await notifyStockAdjustmentEvent(
        'Stock Adjustment Finalization Failed',
        `Failed to finalize adjustment ${selectedAdjustment.adjustment_no}.`,
        'finalize',
        'failed',
        selectedAdjustment.id,
        'error'
      );
      alert('Failed to finalize adjustment');
      // Real-time subscription will correct state
    } finally {
      setFinalizing(false);
    }
  };

  const handleCreateAdjustment = async () => {
    if (!adjustmentNo || !adjustmentDate || items.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setCreating(true);
    const adjustmentData: StockAdjustmentDTO = {
      adjustment_no: adjustmentNo,
      adjustment_date: adjustmentDate,
      warehouse_id: warehouseId,
      adjustment_type: adjustmentType,
      notes: notes || undefined,
      items: items,
    };

    try {
      const newAdjustment = await createStockAdjustment(adjustmentData);
      await notifyStockAdjustmentEvent(
        'Stock Adjustment Created',
        `Adjustment ${adjustmentNo} has been created successfully.`,
        'create',
        'success',
        newAdjustment.id
      );
      setShowCreateForm(false);
      // Reset form
      setAdjustmentNo('');
      setWarehouseId('WH1');
      setAdjustmentType(StockAdjustmentType.PHYSICAL_COUNT);
      setAdjustmentDate('');
      setNotes('');
      setItems([]);
      setItemSearch('');
    } catch (err) {
      console.error('Error creating adjustment:', err);
      await notifyStockAdjustmentEvent(
        'Stock Adjustment Creation Failed',
        `Failed to create adjustment ${adjustmentNo || 'n/a'}.`,
        'create',
        'failed',
        adjustmentNo || 'pending',
        'error'
      );
      alert('Failed to create stock adjustment');
    } finally {
      setCreating(false);
    }
  };

  const handleAddItem = (product: Product) => {
    const systemQty = getProductStock(product.id, warehouseId);
    const existingItemIndex = items.findIndex(item => item.item_id === product.id);
    if (existingItemIndex >= 0) {
      // Update existing item
      const newItems = [...items];
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        system_qty: systemQty,
      };
      setItems(newItems);
    } else {
      // Add new item
      setItems([...items, {
        item_id: product.id,
        system_qty: systemQty,
        physical_qty: systemQty,
      }]);
    }
    setItemSearch('');
    setShowItemDropdown(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: 'physical_qty' | 'reason', value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const getInventoryImpactPreview = () => {
    if (!selectedAdjustment) return { stockIn: [], stockOut: [] };
    const stockIn: Array<{ part_no: string; qty: number; warehouse: string }> = [];
    const stockOut: Array<{ part_no: string; qty: number; warehouse: string }> = [];

    selectedAdjustment.items?.forEach(item => {
      const product = productMap.get(item.item_id);
      if (!product) return;
      if (item.difference > 0) {
        stockIn.push({
          part_no: product.part_no,
          qty: item.difference,
          warehouse: selectedAdjustment.warehouse_id,
        });
      } else if (item.difference < 0) {
        stockOut.push({
          part_no: product.part_no,
          qty: Math.abs(item.difference),
          warehouse: selectedAdjustment.warehouse_id,
        });
      }
    });

    return { stockIn, stockOut };
  };

  const { stockIn, stockOut } = useMemo(() => getInventoryImpactPreview(), [selectedAdjustment, productMap]);

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded bg-white/10"><Scale className="w-5 h-5" /></span>
          <div>
            <h1 className="text-lg font-semibold">Stock Adjustments</h1>
            <p className="text-xs text-slate-300">Physical count reconciliation and inventory corrections</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>New Adjustment</span>
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                className="flex-1 text-xs bg-transparent outline-none"
                placeholder="Search adjustment..."
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
                onChange={(e) => setStatusFilter(e.target.value as 'all' | StockAdjustmentStatus)}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800"
              >
                <option value="all">All</option>
                {(['draft', 'finalized'] as StockAdjustmentStatus[]).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading adjustments...
              </div>
            )}
            {!loading && filteredAdjustments.map(adj => {
              const isActive = selectedAdjustment?.id === adj.id;
              return (
                <button
                  key={adj.id}
                  onClick={() => setSelectedAdjustment(adj)}
                  className={`w-full text-left p-3 space-y-1 ${isActive ? 'bg-brand-blue/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{adj.adjustment_no}</span>
                    <StatusBadge status={adj.status} />
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {adj.warehouse_id}
                  </p>
                  <p className="text-[11px] text-slate-400">{new Date(adj.adjustment_date).toLocaleDateString()}</p>
                </button>
              );
            })}
            {!loading && filteredAdjustments.length === 0 && (
              <div className="p-4 text-xs text-slate-500">No stock adjustments found.</div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 overflow-y-auto p-4">
          {selectedAdjustment ? (
            <div className="space-y-4">
              {/* Adjustment Header Card */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Stock Adjustment</p>
                    <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{selectedAdjustment.adjustment_no}</h2>
                    <p className="text-xs text-slate-500">{new Date(selectedAdjustment.adjustment_date).toLocaleDateString()} · {selectedAdjustment.warehouse_id}</p>
                  </div>
                  <StatusBadge status={selectedAdjustment.status} />
                </div>
                <WorkflowStepper currentStage={workflowStage} documentLabel="Stock Adjustment" documentSubStatus={workflowDocumentStatus} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-500">Adjustment Type</p>
                    <p className="capitalize">{selectedAdjustment.adjustment_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Warehouse</p>
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedAdjustment.warehouse_id}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Date</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(selectedAdjustment.adjustment_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedAdjustment.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => setShowFinalizeConfirm(true)}
                      disabled={finalizing}
                      className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-40 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {finalizing ? 'Processing...' : 'Finalize Adjustment'}
                    </button>
                  )}
                </div>
              </div>

              {/* Adjustment Details Card */}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Adjustment Details
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2">Item</th>
                        <th className="py-2 text-right">System Qty</th>
                        <th className="py-2 text-right">Physical Qty</th>
                        <th className="py-2 text-right">Difference</th>
                        <th className="py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAdjustment.items?.map(item => {
                        const product = productMap.get(item.item_id);
                        const difference = item.physical_qty - item.system_qty;
                        return (
                          <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="py-2">
                              <div className="font-semibold text-slate-700 dark:text-slate-200">{product?.part_no || item.item_id}</div>
                              <div className="text-[10px] text-slate-500">{product?.description || ''}</div>
                            </td>
                            <td className="py-2 text-right">{item.system_qty}</td>
                            <td className="py-2 text-right">{item.physical_qty}</td>
                            <td className="py-2 text-right">
                              <span className={`flex items-center justify-end gap-1 ${difference > 0 ? 'text-emerald-600' : difference < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                {difference > 0 && <ArrowUp className="w-3 h-3" />}
                                {difference < 0 && <ArrowDown className="w-3 h-3" />}
                                {difference > 0 ? '+' : ''}{difference}
                              </span>
                            </td>
                            <td className="py-2 text-slate-500">{item.reason || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Impact Preview */}
              {selectedAdjustment.status === 'draft' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Inventory Impact Preview
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                    When finalized, the following inventory changes will occur:
                  </p>
                  {stockIn.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Stock In:</p>
                      {stockIn.map((item, idx) => (
                        <div key={idx} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" />
                          {item.part_no}: +{item.qty} at {item.warehouse}
                        </div>
                      ))}
                    </div>
                  )}
                  {stockOut.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Stock Out:</p>
                      {stockOut.map((item, idx) => (
                        <div key={idx} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <XCircle className="w-3 h-3" />
                          {item.part_no}: -{item.qty} at {item.warehouse}
                        </div>
                      ))}
                    </div>
                  )}
                  {stockIn.length === 0 && stockOut.length === 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">No inventory changes will occur.</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedAdjustment.notes && (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{selectedAdjustment.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Select a stock adjustment to view details.
            </div>
          )}
        </section>
      </div>

      {/* Finalize Confirmation Modal */}
      {showFinalizeConfirm && selectedAdjustment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Confirm Finalization</h3>
                <p className="text-sm text-slate-500">Adjustment {selectedAdjustment.adjustment_no}</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 text-xs max-h-48 overflow-y-auto">
              <p className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Inventory Impact:</p>
              {stockIn.map((item, idx) => (
                <div key={`in-${idx}`} className="text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {item.part_no}: +{item.qty} at {item.warehouse}
                </div>
              ))}
              {stockOut.map((item, idx) => (
                <div key={`out-${idx}`} className="text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-1">
                  <XCircle className="w-3 h-3" />
                  {item.part_no}: -{item.qty} at {item.warehouse}
                </div>
              ))}
              {stockIn.length === 0 && stockOut.length === 0 && (
                <p className="text-amber-700 dark:text-amber-300">No inventory changes will occur.</p>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This action will update inventory levels and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFinalizeConfirm(false)}
                className="px-4 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={finalizing}
                className="px-4 py-2 text-sm rounded bg-emerald-600 text-white disabled:opacity-40"
              >
                {finalizing ? 'Processing...' : 'Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Adjustment Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-4xl w-full my-8 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Create Stock Adjustment</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Adjustment Number *</label>
                  <input
                    type="text"
                    value={adjustmentNo}
                    onChange={(e) => setAdjustmentNo(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800"
                    placeholder="ADJ-XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Adjustment Type *</label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as StockAdjustmentType)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800"
                  >
                    <option value={StockAdjustmentType.PHYSICAL_COUNT}>Physical Count</option>
                    <option value={StockAdjustmentType.DAMAGE}>Damage</option>
                    <option value={StockAdjustmentType.CORRECTION}>Correction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Warehouse *</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800"
                  >
                    {WAREHOUSES.map(wh => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Adjustment Date *</label>
                  <input
                    type="date"
                    value={adjustmentDate}
                    onChange={(e) => setAdjustmentDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800"
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>

              {/* Items Section */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Items *</label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 bg-white dark:bg-slate-800"
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                  />
                  {showItemDropdown && filteredProducts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredProducts.map(product => (
                        <button
                          key={product.id}
                          onClick={() => handleAddItem(product)}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-white text-sm">{product.part_no}</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] rounded uppercase font-bold">{product.brand}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items Table */}
                {items.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-right">System Qty</th>
                          <th className="px-3 py-2 text-right">Physical Qty</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const product = productMap.get(item.item_id);
                          const difference = item.physical_qty - item.system_qty;
                          return (
                            <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                              <td className="px-3 py-2">
                                <div className="font-semibold">{product?.part_no || item.item_id}</div>
                                <div className="text-[10px] text-slate-500">{product?.description || ''}</div>
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">{item.system_qty}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={item.physical_qty}
                                  onChange={(e) => handleUpdateItem(idx, 'physical_qty', parseInt(e.target.value) || 0)}
                                  className="w-20 text-right border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.reason || ''}
                                  onChange={(e) => handleUpdateItem(idx, 'reason', e.target.value)}
                                  className="w-full border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800"
                                  placeholder="Reason..."
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800">
                      <p className="text-xs text-slate-500">
                        {items.reduce((sum, item) => {
                          const diff = item.physical_qty - item.system_qty;
                          return diff > 0 ? sum + diff : sum;
                        }, 0)} items will be added,{' '}
                        {items.reduce((sum, item) => {
                          const diff = item.physical_qty - item.system_qty;
                          return diff < 0 ? sum + Math.abs(diff) : sum;
                        }, 0)} items will be removed
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAdjustment}
                disabled={creating || !adjustmentNo || !adjustmentDate || items.length === 0}
                className="px-4 py-2 text-sm rounded bg-emerald-600 text-white disabled:opacity-40 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {creating ? 'Creating...' : 'Create Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAdjustmentView;
