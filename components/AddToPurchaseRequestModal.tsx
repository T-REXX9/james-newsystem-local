import React, { useState, useEffect } from 'react';
import { X, Loader2, ShoppingCart, Plus, Check } from 'lucide-react';
import { UserProfile } from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import {
  fetchSuppliers,
  fetchPurchaseOrders,
  addItemToPurchaseOrder,
  createPurchaseOrderWithItem,
  SupplierOption,
  PurchaseOrderOption,
  SuggestedStockItem,
} from '../services/suggestedStockService';
import ValidationSummary from './ValidationSummary';
import FieldHelp from './FieldHelp';
import { validateNumeric, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface AddToPurchaseRequestModalProps {
  item: SuggestedStockItem;
  onClose: () => void;
  currentUser?: UserProfile | null;
}

const WAREHOUSES = [
  { id: 'WH1', name: 'Warehouse 1' },
  { id: 'WH2', name: 'Warehouse 2' },
  { id: 'WH3', name: 'Warehouse 3' },
  { id: 'WH4', name: 'Warehouse 4' },
  { id: 'WH5', name: 'Warehouse 5' },
  { id: 'WH6', name: 'Warehouse 6' },
];

const AddToPurchaseRequestModal: React.FC<AddToPurchaseRequestModalProps> = ({
  item,
  onClose,
  currentUser,
}) => {
  const { addToast } = useToast();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);

  const [selectedPO, setSelectedPO] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('WH1');
  const [qty, setQty] = useState<number>(item.totalQty || 1);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    setIsLoadingOptions(true);
    try {
      const [suppliersData, posData] = await Promise.all([
        fetchSuppliers(),
        fetchPurchaseOrders(),
      ]);
      setSuppliers(suppliersData);
      setPurchaseOrders(posData);
      if (posData.length > 0) {
        setSelectedPO(posData[0].id);
      }
      if (suppliersData.length > 0) {
        setSelectedSupplier(suppliersData[0].id);
      }
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setSubmitCount((prev) => prev + 1);
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const itemData = {
        partNo: item.partNo,
        itemCode: item.itemCode,
        description: item.description,
        qty,
        unitPrice,
      };

      let result: boolean | string | null;

      if (mode === 'existing' && selectedPO) {
        result = await addItemToPurchaseOrder(selectedPO, itemData);
      } else if (mode === 'new' && selectedSupplier && currentUser?.id) {
        result = await createPurchaseOrderWithItem(
          selectedSupplier,
          selectedWarehouse,
          itemData,
          currentUser.id
        );
      } else {
        throw new Error('Please select required options');
      }

      if (result) {
        addToast({ 
          type: 'success', 
          title: 'Items added to purchase request',
          description: 'The items have been added successfully.',
          durationMs: 4000,
        });
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error('Failed to add item to purchase order');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      addToast({ 
        type: 'error', 
        title: 'Unable to add items',
        description: parseSupabaseError(err, 'purchase request'),
        durationMs: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (mode === 'existing') {
      const result = validateRequired(selectedPO, 'a purchase order');
      if (!result.isValid) errors.selectedPO = result.message;
    }
    if (mode === 'new') {
      const supplierResult = validateRequired(selectedSupplier, 'a supplier');
      if (!supplierResult.isValid) errors.selectedSupplier = supplierResult.message;
    }
    const qtyResult = validateNumeric(qty, 'quantity', 1);
    if (!qtyResult.isValid) errors.qty = qtyResult.message;
    const priceResult = validateNumeric(unitPrice, 'unit price', 0);
    if (!priceResult.isValid) errors.unitPrice = priceResult.message;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: string, value: unknown) => {
    let message = '';
    if (field === 'selectedPO') {
      const result = validateRequired(value, 'a purchase order');
      message = result.isValid ? '' : result.message;
    }
    if (field === 'selectedSupplier') {
      const result = validateRequired(value, 'a supplier');
      message = result.isValid ? '' : result.message;
    }
    if (field === 'qty') {
      const result = validateNumeric(value, 'quantity', 1);
      message = result.isValid ? '' : result.message;
    }
    if (field === 'unitPrice') {
      const result = validateNumeric(value, 'unit price', 0);
      message = result.isValid ? '' : result.message;
    }
    setValidationErrors((prev) => ({ ...prev, [field]: message }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl animate-slideInUp">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-brand-blue dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Add to Purchase Request
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Successfully Added!
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              The item has been added to the purchase order.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6">
              <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2">
                  Item Details
                </p>
                <div className="space-y-1">
                  <p className="font-medium text-slate-800 dark:text-white">
                    {item.partNo || item.itemCode || 'Unlisted Item'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
                  <p className="text-xs text-slate-500">
                    Requested {item.inquiryCount} time(s) by {item.customerCount} customer(s)
                  </p>
                </div>
              </div>

              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === 'existing'
                      ? 'bg-brand-blue text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Add to Existing PO
                </button>
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === 'new'
                      ? 'bg-brand-blue text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Create New PO
                </button>
              </div>

              {isLoadingOptions ? (
                <div className="flex items-center justify-center py-8">
                  <CustomLoadingSpinner label="Loading" />
                </div>
              ) : mode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Purchase Order
                  </label>
                  {purchaseOrders.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                      No active purchase orders found. Create a new one instead.
                    </p>
                  ) : (
                    <select
                      value={selectedPO}
                      onChange={(e) => setSelectedPO(e.target.value)}
                      onBlur={(e) => handleBlur('selectedPO', e.target.value)}
                      className={`w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                        validationErrors.selectedPO ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      required
                    >
                      {purchaseOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.poNo} - {po.supplierName} ({po.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Select Supplier
                    </label>
                    {suppliers.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                        No suppliers found. Please add suppliers first.
                      </p>
                    ) : (
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      onBlur={(e) => handleBlur('selectedSupplier', e.target.value)}
                      className={`w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                        validationErrors.selectedSupplier ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      required
                    >
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.company}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Destination Warehouse
                    </label>
                    <select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                      required
                    >
                      {WAREHOUSES.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    onBlur={(e) => handleBlur('qty', e.target.value)}
                    className={`w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                      validationErrors.qty ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    required
                  />
                  {validationErrors.qty && (
                    <p className="mt-1 text-xs text-rose-600">{validationErrors.qty}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Unit Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    onBlur={(e) => handleBlur('unitPrice', e.target.value)}
                    className={`w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border rounded-xl text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent ${
                      validationErrors.unitPrice ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="0.00"
                  />
                  <FieldHelp text="Use the latest quoted unit price if available." example="1250.50" />
                  {validationErrors.unitPrice && (
                    <p className="mt-1 text-xs text-rose-600">{validationErrors.unitPrice}</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg">
                  <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (mode === 'existing' && purchaseOrders.length === 0) || (mode === 'new' && suppliers.length === 0)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-blue to-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    {mode === 'existing' ? 'Add to PO' : 'Create PO'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddToPurchaseRequestModal;
