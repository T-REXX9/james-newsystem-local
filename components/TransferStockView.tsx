import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft, ListFilter, Search, RefreshCw, Plus, Package,
  CheckCircle2, AlertTriangle, XCircle, Calendar, MapPin,
  FileText, Trash2, Save, Send, Check, X
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  createTransferStock,
  fetchTransferStocks,
  submitTransferStock,
  approveTransferStock,
  deleteTransferStock,
  generateTransferNo,
  addTransferStockItem,
  deleteTransferStockItem,
  getAvailableStock,
} from '../services/transferStockService';
import { dispatchWorkflowNotification, fetchProducts } from '../services/supabaseService';
import { supabase } from '../lib/supabaseClient';
import {
  Product,
  TransferStock,
  TransferStockDTO,
  TransferStockItem,
  TransferStockStatus,
  UserProfile
} from '../types';
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

const WAREHOUSES = [
  { id: '1', name: 'WH1' },
  { id: '2', name: 'WH2' },
  { id: '3', name: 'WH3' },
  { id: '4', name: 'WH4' },
  { id: '5', name: 'WH5' },
  { id: '6', name: 'WH6' },
];

type TransferStatusType = 'pending' | 'submitted' | 'approved' | 'deleted';

const statusMeta: Record<TransferStatusType, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  'pending': { label: 'Pending', tone: 'neutral' },
  'submitted': { label: 'Submitted', tone: 'info' },
  'approved': { label: 'Approved', tone: 'success' },
  'deleted': { label: 'Deleted', tone: 'danger' },
};

const TransferStockView: React.FC = () => {
  const { addToast } = useToast();
  const [selectedTransfer, setSelectedTransfer] = useState<TransferStock | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatusType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  // Form state
  const [transferNo, setTransferNo] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{
    item_id: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    transfer_qty: number;
    notes?: string;
  }>>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Use real-time list for products
  const { data: products } = useRealtimeList<Product>({
    tableName: 'products',
    initialFetchFn: fetchProducts,
  });

  // Use real-time nested list for transfer stocks with items
  const sortByCreatedAt = (a: TransferStock, b: TransferStock) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const {
    data: transferStocks,
    isLoading: loading,
    setData: setTransferStocks,
  } = useRealtimeNestedList<TransferStock, TransferStockItem>({
    parentTableName: 'branch_inventory_transfers',
    childTableName: 'branch_inventory_transfer_items',
    parentFetchFn: fetchTransferStocks,
    childParentIdField: 'transfer_id',
    childrenField: 'items',
    sortParentFn: sortByCreatedAt,
  });

  const productMap = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setCurrentUser(profile as UserProfile);
        }
      }
    };
    fetchUser();
  }, []);

  const notifyTransferEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: 'success' | 'failed',
    entityId: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
    targetRoles: string[] = []
  ) => {
    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'stock_transfer',
      entityId,
      actionUrl: `/transfer-stock?transferId=${entityId}`,
      actorId: currentUser?.id,
      actorRole: currentUser?.role,
      targetRoles,
      includeActor: true,
    });
  }, [currentUser?.id, currentUser?.role]);

  // Auto-select first transfer when transfers change
  useEffect(() => {
    if (transferStocks.length > 0 && !selectedTransfer) {
      setSelectedTransfer(transferStocks[0]);
    }
  }, [transferStocks, selectedTransfer]);

  const filteredTransfers = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return transferStocks.filter(transfer => {
      const matchesStatus = statusFilter === 'all' || transfer.status === statusFilter;
      const matchesSearch =
        !query ||
        transfer.transfer_no.toLowerCase().includes(query) ||
        (transfer.notes && transfer.notes.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [transferStocks, searchTerm, statusFilter]);

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

  const resetForm = () => {
    setTransferNo('');
    setTransferDate('');
    setNotes('');
    setItems([]);
    setItemSearch('');
    setShowItemDropdown(false);
  };

  const handleCreateTransfer = async () => {
    try {
      setCreating(true);

      // Validate form
      if (!transferNo || !transferDate || items.length === 0) {
        await notifyTransferEvent(
          'Validation Error',
          'Please fill in all required fields and add at least one item.',
          'create',
          'failed',
          transferNo || 'pending',
          'error'
        );
        return;
      }

      // Validate each item
      for (const item of items) {
        if (!item.item_id || !item.from_warehouse_id || !item.to_warehouse_id || item.transfer_qty <= 0) {
          await notifyTransferEvent(
            'Validation Error',
            'Please ensure all items have valid warehouse selections and quantities.',
            'create',
            'failed',
            transferNo || 'pending',
            'error'
          );
          return;
        }

        if (item.from_warehouse_id === item.to_warehouse_id) {
          await notifyTransferEvent(
            'Validation Error',
            'Source and destination warehouses must be different.',
            'create',
            'failed',
            transferNo || 'pending',
            'error'
          );
          return;
        }

        // Check stock availability
        const availableStock = await getAvailableStock(item.item_id, item.from_warehouse_id);
        if (availableStock < item.transfer_qty) {
          const product = productMap.get(item.item_id);
          await notifyTransferEvent(
            'Insufficient Stock',
            `Insufficient stock for ${product?.part_no || 'item'}. Available: ${availableStock}, Required: ${item.transfer_qty}`,
            'create',
            'failed',
            transferNo || 'pending',
            'error'
          );
          return;
        }
      }

      const transferData: TransferStockDTO = {
        transfer_no: transferNo,
        transfer_date: transferDate,
        notes: notes || undefined,
        items: items,
      };

      const newTransfer = await createTransferStock(transferData);
      setTransferStocks(prev => [newTransfer, ...prev]);
      setSelectedTransfer(newTransfer);
      
      await notifyTransferEvent(
        'Transfer Created',
        `Transfer ${transferNo} has been created successfully.`,
        'create',
        'success',
        newTransfer.id,
        'success',
        ['Owner', 'Manager', 'Support']
      );

      resetForm();
      setShowCreateForm(false);
    } catch (error: any) {
      console.error('Error creating transfer:', error);
      await notifyTransferEvent(
        'Error Creating Transfer',
        error.message || 'An unexpected error occurred.',
        'create',
        'failed',
        transferNo || 'pending',
        'error',
        ['Owner', 'Manager', 'Support']
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitTransfer = async () => {
    if (!selectedTransfer) return;

    try {
      setSubmitting(true);
      const updatedTransfer = await submitTransferStock(selectedTransfer.id);
      
      if (updatedTransfer) {
        setTransferStocks(prev =>
          prev.map(t => t.id === updatedTransfer.id ? updatedTransfer : t)
        );
        setSelectedTransfer(updatedTransfer);
        
        await notifyTransferEvent(
          'Transfer Submitted',
          `Transfer ${selectedTransfer.transfer_no} has been submitted for approval.`,
          'submit',
          'success',
          selectedTransfer.id,
          'success',
          ['Owner', 'Manager', 'Support']
        );
        addToast({ 
          type: 'success', 
          title: 'Transfer submitted',
          description: 'Stock transfer has been submitted for approval.',
          durationMs: 4000,
        });
      }
      
      setShowSubmitConfirm(false);
    } catch (error: any) {
      console.error('Error submitting transfer:', error);
      await notifyTransferEvent(
        'Error Submitting Transfer',
        error.message || 'An unexpected error occurred.',
        'submit',
        'failed',
        selectedTransfer.id,
        'error',
        ['Owner', 'Manager', 'Support']
      );
      addToast({ 
        type: 'error', 
        title: 'Unable to submit transfer',
        description: parseSupabaseError(error, 'stock transfer'),
        durationMs: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveTransfer = async () => {
    if (!selectedTransfer) return;

    try {
      setApproving(true);
      const updatedTransfer = await approveTransferStock(selectedTransfer.id);
      
      if (updatedTransfer) {
        setTransferStocks(prev =>
          prev.map(t => t.id === updatedTransfer.id ? updatedTransfer : t)
        );
        setSelectedTransfer(updatedTransfer);
        
        await notifyTransferEvent(
          'Transfer Approved',
          `Transfer ${selectedTransfer.transfer_no} has been approved and inventory updated.`,
          'approve',
          'success',
          selectedTransfer.id,
          'success',
          ['Owner', 'Manager', 'Support']
        );
      }
      
      setShowApproveConfirm(false);
    } catch (error: any) {
      console.error('Error approving transfer:', error);
      await notifyTransferEvent(
        'Error Approving Transfer',
        error.message || 'An unexpected error occurred. Check stock availability.',
        'approve',
        'failed',
        selectedTransfer.id,
        'error',
        ['Owner', 'Manager', 'Support']
      );
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteTransfer = async () => {
    if (!selectedTransfer) return;

    try {
      await deleteTransferStock(selectedTransfer.id);
      setTransferStocks(prev => prev.filter(t => t.id !== selectedTransfer.id));
      setSelectedTransfer(null);
      
      await notifyTransferEvent(
        'Transfer Deleted',
        `Transfer ${selectedTransfer.transfer_no} has been deleted.`,
        'delete',
        'success',
        selectedTransfer.id,
        'success',
        ['Owner', 'Manager', 'Support']
      );
      
      setShowDeleteConfirm(false);
    } catch (error: any) {
      console.error('Error deleting transfer:', error);
      await notifyTransferEvent(
        'Error Deleting Transfer',
        error.message || 'An unexpected error occurred.',
        'delete',
        'failed',
        selectedTransfer.id,
        'error',
        ['Owner', 'Manager', 'Support']
      );
    }
  };

  const handleGenerateTransferNo = async () => {
    try {
      const generatedNo = await generateTransferNo();
      setTransferNo(generatedNo);
    } catch (error) {
      console.error('Error generating transfer number:', error);
      await notifyTransferEvent(
        'Error',
        'Failed to generate transfer number.',
        'generate_transfer_no',
        'failed',
        transferNo || 'pending',
        'error'
      );
    }
  };

  const handleAddItem = (product: Product) => {
    // Check if product already in list
    if (items.some(item => item.item_id === product.id)) {
      notifyTransferEvent(
        'Item Already Added',
        'This item is already in the transfer list.',
        'add_item',
        'failed',
        transferNo || 'pending',
        'warning'
      );
      return;
    }

    setItems([...items, {
      item_id: product.id,
      from_warehouse_id: '1',
      to_warehouse_id: '2',
      transfer_qty: 1,
      notes: '',
    }]);
    setItemSearch('');
    setShowItemDropdown(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const canApprove = currentUser?.role === 'Owner' || currentUser?.role === 'Developer';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <ArrowRightLeft className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Transfer Stock</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Loading...' : `${filteredTransfers.length} transfer${filteredTransfers.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowCreateForm(true);
            handleGenerateTransferNo();
            setTransferDate(new Date().toISOString().split('T')[0]);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Transfer List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transfers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {/* Transfer List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTransfers.map((transfer) => (
              <div
                key={transfer.id}
                onClick={() => setSelectedTransfer(transfer)}
                className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                  selectedTransfer?.id === transfer.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {transfer.transfer_no}
                  </div>
                  <StatusBadge
                    status={transfer.status}
                    label={statusMeta[transfer.status].label}
                    tone={statusMeta[transfer.status].tone}
                  />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {new Date(transfer.transfer_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3" />
                    {transfer.items?.length || 0} item{transfer.items?.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Transfer Detail */}
        <div className="flex-1 overflow-y-auto">
          {selectedTransfer ? (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedTransfer.transfer_no}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created on {new Date(selectedTransfer.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge
                  status={selectedTransfer.status}
                  label={statusMeta[selectedTransfer.status].label}
                  tone={statusMeta[selectedTransfer.status].tone}
                />
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Transfer Date</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(selectedTransfer.transfer_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Items</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedTransfer.items?.length || 0}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedTransfer.notes && (
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedTransfer.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transfer Items</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">From</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">To</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedTransfer.items?.map((item) => {
                        const product = productMap.get(item.item_id);
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {product?.part_no || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {product?.description || ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              WH{item.from_warehouse_id}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              WH{item.to_warehouse_id}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                              {item.transfer_qty}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {selectedTransfer.status === 'pending' && (
                  <>
                    <button
                      onClick={() => setShowSubmitConfirm(true)}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}

                {selectedTransfer.status === 'submitted' && canApprove && (
                  <>
                    <button
                      onClick={() => setShowApproveConfirm(true)}
                      disabled={approving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {approving ? 'Approving...' : 'Approve Transfer'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a transfer to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">New Transfer Request</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transfer No.
                  </label>
                  <input
                    type="text"
                    value={transferNo}
                    onChange={(e) => setTransferNo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="TR-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transfer Date
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>

              {/* Add Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Items
                </label>
                
                {/* Item Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products to add..."
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {/* Dropdown */}
                  {showItemDropdown && itemSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleAddItem(product)}
                          className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="font-medium text-sm text-gray-900 dark:text-white">
                            {product.part_no}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {product.description} - {product.brand}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items List */}
                {items.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Item</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">From</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">To</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Qty</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Stock</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {items.map((item, index) => {
                          const product = productMap.get(item.item_id);
                          const stockColumn = `stock_wh${item.from_warehouse_id}` as keyof Product;
                          const availableStock = product?.[stockColumn] || 0;
                          
                          return (
                            <tr key={index}>
                              <td className="px-3 py-2">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {product?.part_no}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {product?.description}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={item.from_warehouse_id}
                                  onChange={(e) => handleUpdateItem(index, 'from_warehouse_id', e.target.value)}
                                  className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm"
                                >
                                  {WAREHOUSES.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={item.to_warehouse_id}
                                  onChange={(e) => handleUpdateItem(index, 'to_warehouse_id', e.target.value)}
                                  className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm"
                                >
                                  {WAREHOUSES.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.transfer_qty}
                                  onChange={(e) => handleUpdateItem(index, 'transfer_qty', parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {availableStock}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleRemoveItem(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTransfer}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Submit Transfer?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will submit the transfer for approval. You will not be able to edit it after submission.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTransfer}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Approve Transfer?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will approve the transfer and update inventory levels. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveTransfer}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Transfer?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete the transfer. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTransfer}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferStockView;
