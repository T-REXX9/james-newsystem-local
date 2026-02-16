import React, { useState, useMemo } from 'react';
import { Trash2, RefreshCw, AlertTriangle, X, CheckCircle, Clock } from 'lucide-react';
import {
  getAllRecycleBinItems,
  getRecycleBinStats,
  restoreItem,
  permanentlyDeleteItem
} from '../services/recycleBinService';
import { RecycleBinItem, RecycleBinItemType } from '../types';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate, applyOptimisticDelete } from '../utils/optimisticUpdates';

const RecycleBinView: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<RecycleBinItemType | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<RecycleBinItem | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Use real-time list hook for recycle bin items
  const sortByDeletedAt = (a: RecycleBinItem, b: RecycleBinItem) => {
    return new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime();
  };

  const { data: items, isLoading: loading, setData: setItems, refetch } = useRealtimeList<RecycleBinItem>({
    tableName: 'recycle_bin_items',
    initialFetchFn: getAllRecycleBinItems,
    sortFn: sortByDeletedAt,
  });

  // Calculate stats from real-time data
  const stats = useMemo(() => {
    const by_type: Record<RecycleBinItemType, number> = {
      [RecycleBinItemType.CONTACT]: 0,
      [RecycleBinItemType.PRODUCT]: 0,
      [RecycleBinItemType.TASK]: 0,
      [RecycleBinItemType.DEAL]: 0,
      [RecycleBinItemType.SALES_INQUIRY]: 0,
      [RecycleBinItemType.SALES_ORDER]: 0,
      [RecycleBinItemType.ORDER_SLIP]: 0,
      [RecycleBinItemType.INVOICE]: 0,
    };

    items.forEach(item => {
      if (item.item_type in by_type) {
        by_type[item.item_type]++;
      }
    });

    return {
      total: items.length,
      by_type,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return filterType === 'all'
      ? items
      : items.filter(item => item.item_type === filterType);
  }, [items, filterType]);

  const handleRestore = async (item: RecycleBinItem) => {
    setSelectedItem(item);
    setShowRestoreConfirm(true);
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
  };

  const confirmRestore = async () => {
    if (!selectedItem) return;
    setProcessing(`restore-${selectedItem.id}`);

    // Optimistic update - mark as restored
    setItems(prev => applyOptimisticUpdate(prev, selectedItem.id, { is_restored: true }));

    try {
      await restoreItem(selectedItem.item_type, selectedItem.item_id);
      setShowRestoreConfirm(false);
    } catch (err: any) {
      console.error('Error restoring item:', err);
      setError(err.message || 'Failed to restore item');
      // Real-time subscription will correct the state
    } finally {
      setProcessing(null);
      setSelectedItem(null);
    }
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;
    setProcessing(`delete-${selectedItem.id}`);

    // Optimistic delete
    setItems(prev => applyOptimisticDelete(prev, selectedItem.id));

    try {
      await permanentlyDeleteItem(selectedItem.item_type, selectedItem.item_id);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Error permanently deleting item:', err);
      setError(err.message || 'Failed to permanently delete item');
      // Real-time subscription will correct the state
    } finally {
      setProcessing(null);
      setSelectedItem(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getItemTypeLabel = (type: RecycleBinItemType) => {
    switch (type) {
      case RecycleBinItemType.CONTACT: return 'Contact';
      case RecycleBinItemType.INQUIRY: return 'Sales Inquiry';
      case RecycleBinItemType.ORDER: return 'Sales Order';
      case RecycleBinItemType.ORDERSLIP: return 'Order Slip';
      case RecycleBinItemType.INVOICE: return 'Invoice';
      case RecycleBinItemType.TASK: return 'Task';
      case RecycleBinItemType.PRODUCT: return 'Product';
      case RecycleBinItemType.TEAM_MESSAGE: return 'Team Message';
      case RecycleBinItemType.NOTIFICATION: return 'Notification';
      default: return type;
    }
  };

  const getItemPreview = (item: RecycleBinItem) => {
    const data: any = item.original_data;
    if (item.item_type === RecycleBinItemType.CONTACT) {
      return data.company || data.name || 'Contact';
    }
    if (item.item_type === RecycleBinItemType.INQUIRY) {
      return data.inquiry_no || `Inquiry ${item.item_id.slice(0, 8)}`;
    }
    if (item.item_type === RecycleBinItemType.ORDER) {
      return data.order_no || `Order ${item.item_id.slice(0, 8)}`;
    }
    if (item.item_type === RecycleBinItemType.ORDERSLIP) {
      return data.slip_no || `Order Slip ${item.item_id.slice(0, 8)}`;
    }
    if (item.item_type === RecycleBinItemType.INVOICE) {
      return data.invoice_no || `Invoice ${item.item_id.slice(0, 8)}`;
    }
    if (item.item_type === RecycleBinItemType.TASK) {
      return data.title || `Task ${item.item_id.slice(0, 8)}`;
    }
    if (item.item_type === RecycleBinItemType.PRODUCT) {
      return data.description || data.part_no || `Product ${item.item_id.slice(0, 8)}`;
    }
    if (item.item_type === RecycleBinItemType.TEAM_MESSAGE) {
      return data.message ? data.message.substring(0, 50) + '...' : 'Team Message';
    }
    if (item.item_type === RecycleBinItemType.NOTIFICATION) {
      return data.title || 'Notification';
    }
    return JSON.stringify(data).substring(0, 80);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-brand-blue animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading recycle bin...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Access Denied</h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-md">{error}</p>
              <p className="text-slate-500 dark:text-slate-500 text-sm mt-4">Only Owner or Developer roles can access the Recycle Bin.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Recycle Bin</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Deleted items are kept for 90 days. Only Owner and Developer can restore or permanently delete items.
              </p>
            </div>
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Items</p>
                  <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-lg">
                  <Trash2 className="w-6 h-6 text-brand-blue" />
                </div>
              </div>
            </div>
            {Object.entries(stats.by_type).map(([type, count]) => (
              <div key={type} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{getItemTypeLabel(type as RecycleBinItemType)}</p>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{count}</p>
                  </div>
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <Clock className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${filterType === 'all' ? 'bg-brand-blue text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700'}`}
            >
              All Items
            </button>
            {Object.values(RecycleBinItemType).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${filterType === type ? 'bg-brand-blue text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700'}`}
              >
                {getItemTypeLabel(type)} ({stats?.by_type[type] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                  <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Item Type</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Item Preview</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Deleted By</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Deleted At</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
                      <Trash2 className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-700" />
                      <p className="text-lg font-medium">No deleted items found</p>
                      <p className="text-sm">Items in the recycle bin will appear here</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${item.item_type === RecycleBinItemType.CONTACT ? 'bg-emerald-500/10 text-emerald-500' :
                            item.item_type === RecycleBinItemType.INQUIRY ? 'bg-blue-500/10 text-blue-500' :
                            item.item_type === RecycleBinItemType.ORDER ? 'bg-amber-500/10 text-amber-500' :
                            item.item_type === RecycleBinItemType.ORDERSLIP ? 'bg-purple-500/10 text-purple-500' :
                            item.item_type === RecycleBinItemType.INVOICE ? 'bg-rose-500/10 text-rose-500' :
                            'bg-slate-500/10 text-slate-500'
                            }`}>
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{getItemTypeLabel(item.item_type)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-xs">
                          <p className="text-slate-800 dark:text-slate-200 font-medium truncate">{getItemPreview(item)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">ID: {item.item_id}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 dark:text-slate-200">{item.deleted_by}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 dark:text-slate-200">{formatDate(item.deleted_at)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {Math.floor((new Date(item.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days until permanent deletion
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestore(item)}
                            disabled={processing === `restore-${item.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {processing === `restore-${item.id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(item)}
                            disabled={processing === `delete-${item.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {processing === `delete-${item.id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Delete Permanently
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Restore Confirmation Modal */}
        {showRestoreConfirm && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Restore Item</h2>
                <button onClick={() => setShowRestoreConfirm(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                  Are you sure you want to restore this {getItemTypeLabel(selectedItem.item_type).toLowerCase()}?
                </p>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-6">
                  <p className="font-medium text-slate-800 dark:text-white">{getItemPreview(selectedItem)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {selectedItem.item_id}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Deleted on {formatDate(selectedItem.deleted_at)}</p>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowRestoreConfirm(false)}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRestore}
                    disabled={processing === `restore-${selectedItem.id}`}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing === `restore-${selectedItem.id}` && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Restore Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permanent Delete Confirmation Modal */}
        {showDeleteConfirm && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Permanently Delete Item</h2>
                <button onClick={() => setShowDeleteConfirm(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-rose-500/10 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">This action cannot be undone</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">This will permanently delete the item from the database.</p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-6">
                  <p className="font-medium text-slate-800 dark:text-white">{getItemPreview(selectedItem)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {selectedItem.item_id}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Type: {getItemTypeLabel(selectedItem.item_type)}</p>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={processing === `delete-${selectedItem.id}`}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing === `delete-${selectedItem.id}` && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecycleBinView;