import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Edit2, Trash2, Filter, Package, AlertCircle, X, Check, Loader2, Save, Eye, EyeOff, Archive, TrendingUp, TrendingDown, Settings, DollarSign, Percent
} from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { Product, UserProfile } from '../types';
import { fetchProducts, createProduct, updateProduct, deleteProduct, bulkUpdateProducts } from '../services/supabaseService';
import { fetchProductMovementClassifications } from '../services/inventoryMovementService';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { applyOptimisticUpdate, applyOptimisticDelete } from '../utils/optimisticUpdates';
import ConfirmModal from './ConfirmModal';
import ValidationSummary from './ValidationSummary';
import FieldHelp from './FieldHelp';
import { validateMinLength, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface ProductDatabaseProps {
  currentUser: UserProfile | null;
}

const ProductDatabase: React.FC<ProductDatabaseProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const isMasterAccess = currentUser?.role === 'Owner' || currentUser?.role === 'Developer';

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState('');

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    variant: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, variant: 'danger', confirmLabel: 'Confirm' });


  // Form State
  const initialFormState: Omit<Product, 'id'> = {
    part_no: '',
    oem_no: '',
    brand: '',
    barcode: '',
    no_of_pieces_per_box: 0,
    item_code: '',
    description: '',
    size: '',
    reorder_quantity: 0,
    status: 'Active',
    category: '',
    descriptive_inquiry: '',
    no_of_holes: '',
    replenish_quantity: 0,
    original_pn_no: '',
    application: '',
    no_of_cylinder: '',

    // Prices
    cost: 0,
    price_aa: 0,
    price_bb: 0,
    price_cc: 0,
    price_dd: 0,
    price_vip1: 0,
    price_vip2: 0,

    // Warehouse Stocks
    stock_wh1: 0,
    stock_wh2: 0,
    stock_wh3: 0,
    stock_wh4: 0,
    stock_wh5: 0,
    stock_wh6: 0
  };

  const [formData, setFormData] = useState<Omit<Product, 'id'>>(initialFormState);

  // Use real-time list hook for products
  const sortByPartNo = (a: Product, b: Product) => {
    return a.part_no.localeCompare(b.part_no);
  };

  const { data: products, isLoading, setData: setProducts } = useRealtimeList<Product>({
    tableName: 'products',
    initialFetchFn: fetchProducts,
    sortFn: sortByPartNo,
  });

  // Movement classification state
  type MovementCategory = 'fast' | 'slow' | 'normal';
  const [movementMap, setMovementMap] = useState<Map<string, MovementCategory>>(new Map());

  useEffect(() => {
    const loadMovementData = async () => {
      try {
        const classifications = await fetchProductMovementClassifications();
        setMovementMap(classifications);
      } catch (error) {
        console.error('Error loading movement classifications:', error);
      }
    };
    loadMovementData();
  }, []);

  const filteredProducts = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return products.filter(p =>
      p.part_no.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery) ||
      p.item_code.toLowerCase().includes(lowerQuery)
    );
  }, [products, searchQuery]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({ ...product });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? It will be moved to the recycle bin.',
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setProducts(prev => applyOptimisticDelete(prev, id));
        try {
          await deleteProduct(id);
          addToast({ 
            type: 'success', 
            title: 'Product deleted',
            description: 'Product has been removed from the database.',
            durationMs: 4000,
          });
        } catch (error) {
          console.error('Error deleting product:', error);
          addToast({ 
            type: 'error', 
            title: 'Unable to delete product',
            description: parseSupabaseError(error, 'product'),
            durationMs: 6000,
          });
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setSubmitCount((prev) => prev + 1);
      return;
    }
    setIsSaving(true);
    setSubmitError('');
    try {
      if (editingProduct) {
        // Optimistic update
        setProducts(prev => applyOptimisticUpdate(prev, editingProduct.id, formData));
        await updateProduct(editingProduct.id, formData);
        addToast({ 
          type: 'success', 
          title: 'Product updated',
          description: 'Product information has been updated successfully.',
          durationMs: 4000,
        });
      } else {
        await createProduct(formData);
        addToast({ 
          type: 'success', 
          title: 'Product created',
          description: 'New product has been added to the database.',
          durationMs: 4000,
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      setSubmitError(parseSupabaseError(error, 'product'));
      addToast({ 
        type: 'error', 
        title: editingProduct ? 'Unable to update product' : 'Unable to create product',
        description: parseSupabaseError(error, 'product'),
        durationMs: 6000,
      });
      // Real-time subscription will correct the state
    } finally {
      setIsSaving(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const partNoCheck = validateRequired(formData.part_no, 'a part number');
    if (!partNoCheck.isValid) errors.part_no = partNoCheck.message;
    const descriptionCheck = validateRequired(formData.description, 'a description');
    if (!descriptionCheck.isValid) errors.description = descriptionCheck.message;
    const descriptionLength = validateMinLength(formData.description, 'description', 3);
    if (!descriptionLength.isValid) errors.description = descriptionLength.message;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: keyof Product, value: unknown) => {
    let message = '';
    if (field === 'part_no') {
      const result = validateRequired(value, 'a part number');
      message = result.isValid ? '' : result.message;
    }
    if (field === 'description') {
      const requiredCheck = validateRequired(value, 'a description');
      message = requiredCheck.isValid ? '' : requiredCheck.message;
      if (!message) {
        const lengthCheck = validateMinLength(value, 'description', 3);
        message = lengthCheck.isValid ? '' : lengthCheck.message;
      }
    }
    setValidationErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFormData.targetPercentage) return;

    const affectedProducts = filteredForBulk.map(p => {
      const cost = p.cost || 0;
      const updates: Partial<Product> = {};
      const percent = bulkFormData.targetPercentage as number;

      bulkFormData.selectedPriceGroups.forEach(group => {
        const field = `price_${group.toLowerCase()}` as keyof Product;
        let newPrice = 0;

        if (bulkFormData.updateMethod === 'markup') {
          // Markup: SP = Cost * (1 + Markup%)
          newPrice = Math.round(cost * (1 + percent / 100));
        } else {
          // GP: SP = Cost / (1 - GP%)
          const margin = 1 - (percent / 100);
          newPrice = margin > 0 ? Math.round(cost / margin) : 0;
        }

        // @ts-ignore
        updates[field] = newPrice;
      });

      return { id: p.id, updates };
    });

    if (affectedProducts.length === 0) {
      alert('No products match the criteria.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Update Prices',
      message: `You are about to update prices for ${affectedProducts.length} products. This action cannot be undone.`,
      variant: 'warning',
      confirmLabel: `Update ${affectedProducts.length} Products`,
      onConfirm: async () => {
        setIsBulkUpdating(true);
        try {
          for (const item of affectedProducts) {
            await updateProduct(item.id, item.updates);
          }
          setIsBulkUpdateModalOpen(false);
          addToast({ 
            type: 'success', 
            title: 'Bulk update completed',
            description: 'Product prices have been updated successfully.',
            durationMs: 4000,
          });
        } catch (error) {
          console.error(error);
          addToast({ 
            type: 'error', 
            title: 'Unable to update products',
            description: parseSupabaseError(error, 'product'),
            durationMs: 6000,
          });
        } finally {
          setIsBulkUpdating(false);
        }
      },
    });
  };

  const [bulkFormData, setBulkFormData] = useState({
    keyword: '',
    minCost: 0,
    maxCost: 1000000,
    selectedPriceGroups: [] as string[],
    updateMethod: 'markup' as 'markup' | 'gp',
    targetPercentage: 0
  });

  const filteredForBulk = useMemo(() => {
    // Normalize: lowercase + remove all whitespace for fuzzy matching
    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');

    return products.filter(p => {
      const description = normalize(p.description || '');
      const keyword = normalize(bulkFormData.keyword);
      const matchesKeyword = !keyword || description.includes(keyword);

      const cost = Number(p.cost) || 0;
      const minCost = bulkFormData.minCost || 0;
      const maxCost = bulkFormData.maxCost || 0;

      // If maxCost is 0, match all products (no upper limit)
      const matchesCost = cost >= minCost && (maxCost <= 0 || cost <= maxCost);

      return matchesKeyword && matchesCost;
    });
  }, [products, bulkFormData.keyword, bulkFormData.minCost, bulkFormData.maxCost]);

  // Count how many filtered products have zero cost (will result in zero price)
  const zeroCostCount = useMemo(() => {
    return filteredForBulk.filter(p => !p.cost || Number(p.cost) === 0).length;
  }, [filteredForBulk]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const formatPrice = (val: number | undefined) => val ? val.toLocaleString() : '0';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 animate-fadeIn">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-blue" />
            Product Database
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage inventory catalog, pricing, and warehouse stocks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMasterAccess && (
            <button
              onClick={() => setIsBulkUpdateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Bulk Price Update
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search part no, brand, description..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:border-brand-blue outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* Product Table */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="h-full overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 w-12 text-center">Status</th>
                <th className="p-4">Product Info</th>
                <th className="p-4 w-64">Pricing Structure</th>
                <th className="p-4 w-64">Warehouse Inventory</th>
                <th className="p-4 text-center w-24">Specs</th>
                <th className="p-4 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 italic">
                    No products found.
                  </td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 text-center align-top pt-5">
                    {product.status === 'Active' ? (
                      <Eye className="w-5 h-5 text-emerald-500 mx-auto" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-slate-400 mx-auto" />
                    )}
                  </td>

                  <td className="p-4 align-top">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 dark:text-white text-base">{product.part_no}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] rounded uppercase font-bold tracking-wider">{product.brand}</span>
                        {/* Movement Classification Badge */}
                        {movementMap.get(product.id) === 'fast' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] rounded uppercase font-bold tracking-wider">
                            <TrendingUp className="w-3 h-3" />
                            Fast
                          </span>
                        )}
                        {movementMap.get(product.id) === 'slow' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] rounded uppercase font-bold tracking-wider">
                            <TrendingDown className="w-3 h-3" />
                            Slow
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{product.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Category: {product.category}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="font-mono">Code: {product.item_code}</span>
                        {product.oem_no && (
                          <>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="font-mono">OEM: {product.oem_no}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-4 align-top">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div className="flex justify-between items-center"><span className="text-slate-500">AA</span> <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{formatPrice(product.price_aa)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-500">BB</span> <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{formatPrice(product.price_bb)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-500">CC</span> <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{formatPrice(product.price_cc)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-500">DD</span> <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{formatPrice(product.price_dd)}</span></div>
                        <div className="flex justify-between items-center col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                          <span className="text-amber-600 dark:text-amber-500 font-bold">VIP1</span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatPrice(product.price_vip1)}</span>
                        </div>
                        <div className="flex justify-between items-center col-span-2">
                          <span className="text-amber-600 dark:text-amber-500 font-bold">VIP2</span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatPrice(product.price_vip2)}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-4 align-top">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[1, 2, 3, 4, 5, 6].map(i => {
                          // @ts-ignore
                          const stock = product[`stock_wh${i}`];
                          const hasStock = stock > 0;
                          return (
                            <div key={i} className={`flex flex-col items-center p-1 rounded ${hasStock ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                              <span className="text-[10px] text-slate-400">WH{i}</span>
                              <span className={`font-mono font-bold ${hasStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}>{stock}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </td>

                  <td className="p-4 align-top text-center">
                    <div className="flex flex-col gap-2 pt-1">
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 rounded">
                        {product.no_of_pieces_per_box} / box
                      </span>
                      {product.size && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{product.size}</span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 align-top text-right pt-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Price Update Modal */}
      {isBulkUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Settings className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Bulk Price Update</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update multiple product prices based on cost and criteria.</p>
                </div>
              </div>
              <button onClick={() => setIsBulkUpdateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkUpdate} className="p-6 space-y-6">
              {/* Step 1: Filter */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-brand-blue" />
                  1. Filter Products
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Description Keyword (e.g. "nozzle")</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-lg px-4 py-2.5 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all shadow-sm"
                      placeholder="Leave empty to include all products in cost range"
                      value={bulkFormData.keyword}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, keyword: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Min Cost</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-lg px-4 py-2.5 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all shadow-sm"
                      value={bulkFormData.minCost === 0 ? '' : bulkFormData.minCost}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, minCost: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Max Cost</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-lg px-4 py-2.5 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all shadow-sm"
                      value={bulkFormData.maxCost === 0 ? '' : bulkFormData.maxCost}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, maxCost: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs font-medium text-brand-blue flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    Currently matches: <strong>{filteredForBulk.length} products</strong>
                  </p>
                </div>
                {zeroCostCount > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-900/30">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" />
                      <strong>Warning:</strong> {zeroCostCount} product(s) have no cost set. These will result in a price of 0. Please set the cost first.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Configuration */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand-blue" />
                  2. Pricing Configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Select Price Groups to Update</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['AA', 'BB', 'CC', 'DD', 'VIP1', 'VIP2'].map(group => (
                        <label key={group} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-brand-blue border-slate-300 focus:ring-brand-blue"
                            checked={bulkFormData.selectedPriceGroups.includes(group)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setBulkFormData(prev => ({
                                ...prev,
                                selectedPriceGroups: checked
                                  ? [...prev.selectedPriceGroups, group]
                                  : prev.selectedPriceGroups.filter(g => g !== group)
                              }));
                            }}
                          />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{group}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2">Calculation Method</label>
                      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setBulkFormData(prev => ({ ...prev, updateMethod: 'markup' }))}
                          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${bulkFormData.updateMethod === 'markup'
                            ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                          Markup %
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkFormData(prev => ({ ...prev, updateMethod: 'gp' }))}
                          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${bulkFormData.updateMethod === 'gp'
                            ? 'bg-white dark:bg-slate-700 text-brand-blue shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                          Gross Profit %
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                        {bulkFormData.updateMethod === 'markup' ? 'Markup Percentage' : 'Gross Profit Percentage'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-lg px-4 py-2.5 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all shadow-sm pr-10"
                          placeholder="e.g. 50"
                          value={bulkFormData.targetPercentage === 0 ? '' : bulkFormData.targetPercentage}
                          onChange={(e) => setBulkFormData(prev => ({ ...prev, targetPercentage: e.target.value === '' ? 0 : Number(e.target.value) }))}
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400 italic">
                        {bulkFormData.updateMethod === 'markup'
                          ? 'Formula: Cost × (1 + Markup%)'
                          : 'Formula: Cost / (1 - GP%) (e.g. 50% GP doubles the price)'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setIsBulkUpdateModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                disabled={isBulkUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={isBulkUpdating || filteredForBulk.length === 0 || bulkFormData.selectedPriceGroups.length === 0}
                className="px-6 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    Apply to {filteredForBulk.length} Products
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
              {submitError && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {submitError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Core Identifiers */}
                <div className="md:col-span-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Package className="w-3 h-3" /> Identification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Part No *</label>
                      <input
                        required
                        name="part_no"
                        value={formData.part_no}
                        onChange={handleInputChange}
                        onBlur={(e) => handleBlur('part_no', e.target.value)}
                        className={`input-field ${validationErrors.part_no ? 'border-rose-400' : ''}`}
                        placeholder="e.g. 123-ABC"
                      />
                      <FieldHelp text="Use the primary manufacturer part number for quick lookup." example="123-ABC" />
                      {validationErrors.part_no && (
                        <p className="mt-1 text-xs text-rose-600">{validationErrors.part_no}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">OEM No</label>
                      <input name="oem_no" value={formData.oem_no} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Original PN</label>
                      <input name="original_pn_no" value={formData.original_pn_no} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Item Code</label>
                      <input name="item_code" value={formData.item_code} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Barcode</label>
                      <input name="barcode" value={formData.barcode} onChange={handleInputChange} className="input-field" />
                    </div>

                    {/* Updated Status Toggle */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Visibility Status</label>
                      <div className="flex items-center gap-2 h-[42px]">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'Active' ? 'Inactive' : 'Active' }))}
                          className={`flex-1 h-full rounded-lg border flex items-center justify-center gap-2 transition-colors ${formData.status === 'Active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-400'
                            : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                            }`}
                        >
                          {formData.status === 'Active' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          <span className="text-sm font-medium">{formData.status === 'Active' ? 'Unhidden (Active)' : 'Hidden (Inactive)'}</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Pricing Configuration */}
                <div className="md:col-span-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Pricing Groups
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {isMasterAccess && (
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">Cost (Internal Only)</label>
                        <input
                          type="number"
                          name="cost"
                          value={formData.cost === 0 ? '' : formData.cost}
                          onChange={handleInputChange}
                          className="input-field bg-rose-50/50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900"
                        />
                      </div>
                    )}
                    <div className={isMasterAccess ? 'md:col-span-1' : ''}>
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Price AA</label>
                      <input
                        type="number"
                        name="price_aa"
                        value={formData.price_aa === 0 ? '' : formData.price_aa}
                        onChange={handleInputChange}
                        className="input-field bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Price BB</label>
                      <input type="number" name="price_bb" value={formData.price_bb === 0 ? '' : formData.price_bb} onChange={handleInputChange} className="input-field bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Price CC</label>
                      <input type="number" name="price_cc" value={formData.price_cc === 0 ? '' : formData.price_cc} onChange={handleInputChange} className="input-field bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Price DD</label>
                      <input type="number" name="price_dd" value={formData.price_dd === 0 ? '' : formData.price_dd} onChange={handleInputChange} className="input-field bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 mb-1">Price VIP1</label>
                      <input type="number" name="price_vip1" value={formData.price_vip1 === 0 ? '' : formData.price_vip1} onChange={handleInputChange} className="input-field bg-amber-50/50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 mb-1">Price VIP2</label>
                      <input type="number" name="price_vip2" value={formData.price_vip2 === 0 ? '' : formData.price_vip2} onChange={handleInputChange} className="input-field bg-amber-50/50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900" />
                    </div>
                  </div>
                </div>

                {/* Warehouse Inventory */}
                <div className="md:col-span-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Warehouse Inventory
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <div key={num}>
                        <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">WH {num}</label>
                        <input
                          type="number"
                          name={`stock_wh${num}`}
                          // @ts-ignore
                          value={formData[`stock_wh${num}`] === 0 ? '' : formData[`stock_wh${num}`]}
                          onChange={handleInputChange}
                          className="input-field bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="md:col-span-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Product Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Description *</label>
                      <input
                        required
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        onBlur={(e) => handleBlur('description', e.target.value)}
                        className={`input-field ${validationErrors.description ? 'border-rose-400' : ''}`}
                      />
                      <FieldHelp text="Describe the product in plain language for easy scanning." example="Brake pad set for Honda Civic" />
                      {validationErrors.description && (
                        <p className="mt-1 text-xs text-rose-600">{validationErrors.description}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Brand</label>
                      <input name="brand" value={formData.brand} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                      <input name="category" value={formData.category} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Application</label>
                      <input name="application" value={formData.application} onChange={handleInputChange} className="input-field" placeholder="Vehicle model, engine, etc." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Descriptive Inquiry</label>
                      <input name="descriptive_inquiry" value={formData.descriptive_inquiry} onChange={handleInputChange} className="input-field" />
                    </div>
                  </div>
                </div>

                {/* Specs */}
                <div className="md:col-span-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Specifications</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Size</label>
                      <input name="size" value={formData.size} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">No. of Holes</label>
                      <input name="no_of_holes" value={formData.no_of_holes} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">No. of Cylinder</label>
                      <input name="no_of_cylinder" value={formData.no_of_cylinder} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Pieces per Box</label>
                      <input type="number" name="no_of_pieces_per_box" value={formData.no_of_pieces_per_box} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Reorder Qty</label>
                      <input type="number" name="reorder_quantity" value={formData.reorder_quantity} onChange={handleInputChange} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Replenish Qty</label>
                      <input type="number" name="replenish_quantity" value={formData.replenish_quantity} onChange={handleInputChange} className="input-field" />
                    </div>
                  </div>
                </div>

              </div>
              <style>{`
                .input-field {
                  width: 100%;
                  background-color: rgb(248 250 252);
                  border: 1px solid rgb(226 232 240);
                  border-radius: 0.5rem;
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: rgb(30 41 59);
                  outline: none;
                  transition: all 0.2s;
                }
                .dark .input-field {
                  background-color: rgb(30 41 59);
                  border-color: rgb(51 65 85);
                  color: white;
                }
                .input-field:focus {
                  border-color: #0F5298;
                  box-shadow: 0 0 0 1px #0F5298;
                }
                
                /* Custom Scrollbar for the table specifically */
                .custom-scrollbar::-webkit-scrollbar {
                  width: 6px;
                  height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background-color: rgba(156, 163, 175, 0.5);
                  border-radius: 20px;
                }
              `}</style>
            </form>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-6 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Product
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmLabel={confirmModal.confirmLabel}
      />
    </div>
  );
};

export default ProductDatabase;
