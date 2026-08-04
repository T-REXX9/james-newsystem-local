import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Contact, CreatePRItemPayload, CreatePRPayload } from '../../purchaseRequest.types';
import type { Product as SearchProduct } from '../../types';
import { parseSupabaseError } from '../../utils/errorHandler';
import { validateNumeric, validateRequired } from '../../utils/formValidation';
import ProductAutocomplete from '../ProductAutocomplete';
import ValidationSummary from '../ValidationSummary';
import { useToast } from '../ToastProvider';

interface PurchaseRequestFormProps {
  onCancel: () => void;
  onSubmit: (payload: CreatePRPayload) => Promise<void>;
  suppliers: Contact[];
  initialPRNumber: string;
}

const PurchaseRequestForm: React.FC<PurchaseRequestFormProps> = ({
  onCancel,
  onSubmit,
  suppliers,
  initialPRNumber,
}) => {
  const { addToast } = useToast();
  const [notes, setNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [items, setItems] = useState<CreatePRItemPayload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState('');

  const buildItem = (): CreatePRItemPayload | null => {
    const errors: Record<string, string> = {};
    const productValidation = validateRequired(selectedProductId, 'a product');
    if (!productValidation.isValid) errors.selectedProductId = productValidation.message;
    const quantityValidation = validateNumeric(quantity, 'quantity', 1);
    if (!quantityValidation.isValid) errors.quantity = quantityValidation.message;
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return null;
    }

    const supplier = suppliers.find(item => item.id === selectedSupplierId);
    return {
      item_id: selectedProductId,
      item_code: selectedProduct?.item_code,
      part_number: selectedProduct?.part_no,
      description: selectedProduct?.description,
      quantity,
      unit_cost: selectedProduct?.cost || 0,
      supplier_id: selectedSupplierId || undefined,
      supplier_name: supplier?.company,
      eta_date: etaDate || undefined,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const pendingItem = items.length === 0 ? buildItem() : null;
    const submittedItems = items.length > 0 ? items : pendingItem ? [pendingItem] : [];
    if (submittedItems.length === 0) {
      setSubmitCount(current => current + 1);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        pr_number: initialPRNumber,
        request_date: new Date().toISOString().slice(0, 10),
        notes,
        reference_no: '',
        items: submittedItems,
      });
      addToast({
        type: 'success',
        title: 'Purchase request created',
        description: `PR ${initialPRNumber} has been submitted successfully.`,
        durationMs: 4000,
      });
    } catch (error) {
      const message = parseSupabaseError(error, 'purchase request');
      setSubmitError(message);
      addToast({
        type: 'error',
        title: 'Unable to create purchase request',
        description: message,
        durationMs: 6000,
      });
      setIsSubmitting(false);
    }
  };

  const handleAddItem = () => {
    const item = buildItem();
    if (!item) return;
    setItems(current => [...current, item]);
    setSelectedProductId('');
    setSelectedProduct(null);
    setQuantity(1);
    setSelectedSupplierId('');
    setEtaDate('');
  };

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-4 py-10 text-[#333]">
      <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <form onSubmit={handleSubmit}>
          <header className="flex min-h-[64px] items-center justify-between border-b border-[#e5e5e5] px-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1 rounded-[3px] border border-[#ccc] bg-white px-[10px] py-[5px] text-[12px] font-semibold hover:bg-[#ebebeb]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <h1 className="border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase leading-none text-[#315574]">
                Purchase Request
              </h1>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <label htmlFor="new-pr-number" className="text-[16px] font-semibold">PR No:</label>
              <input
                id="new-pr-number"
                readOnly
                value={initialPRNumber}
                className="h-[34px] w-[110px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3 shadow-inner"
              />
            </div>
          </header>

          <main className="p-5">
            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
            {submitError && (
              <div className="mb-4 rounded-[3px] border border-[#ebccd1] bg-[#f2dede] px-4 py-3 text-[13px] text-[#a94442]">
                <strong>Oops! </strong>{submitError}
              </div>
            )}

            <div className="overflow-visible">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-[#ddd] text-left">
                    <th className="w-[12%] px-2 py-2">Quantity</th>
                    <th className="w-[18%] px-2 py-2">Supplier</th>
                    <th className="w-[13%] px-2 py-2">Original P/N</th>
                    <th className="w-[13%] px-2 py-2">Part No.</th>
                    <th className="w-[11%] px-2 py-2">Item Code</th>
                    <th className="w-[10%] px-2 py-2">Brand</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="w-[9%] px-2 py-2 text-right">COST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    <td className="px-2 py-3">
                      <input
                        aria-label="Line item quantity"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={event => setQuantity(Number(event.target.value))}
                        className="h-[34px] w-full rounded-[3px] border border-[#ccc] px-3 shadow-inner"
                        placeholder="Input Quantity"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <select
                        aria-label="Line item supplier"
                        value={selectedSupplierId}
                        onChange={event => setSelectedSupplierId(event.target.value)}
                        className="h-[34px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner"
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>{supplier.company}</option>
                        ))}
                      </select>
                    </td>
                    <td colSpan={6} className="px-2 py-3">
                      <ProductAutocomplete
                        onSelect={product => {
                          setSelectedProduct(product);
                          setSelectedProductId(product.id);
                          setValidationErrors(current => ({ ...current, selectedProductId: '' }));
                        }}
                        placeholder="Select Product"
                        className={validationErrors.selectedProductId ? 'ring-1 ring-[#d9534f]' : ''}
                      />
                      {selectedProduct && (
                        <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_1fr_2fr_1fr] gap-3 text-[12px] text-[#555]">
                          <span>{(selectedProduct as any).opn_number || '-'}</span>
                          <span>{selectedProduct.part_no || '-'}</span>
                          <span>{selectedProduct.item_code || '-'}</span>
                          <span>{selectedProduct.brand || '-'}</span>
                          <span>{selectedProduct.description || '-'}</span>
                          <span className="text-right">{Number(selectedProduct.cost || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          aria-label="Line item ETA"
                          type="date"
                          value={etaDate}
                          onChange={event => setEtaDate(event.target.value)}
                          className="h-[34px] rounded-[3px] border border-[#ccc] px-3 shadow-inner"
                        />
                        <button
                          type="button"
                          aria-label="Add line item"
                          onClick={handleAddItem}
                          className="rounded-[3px] border border-[#2e6da4] bg-[#337ab7] px-3 py-[7px] font-semibold text-white hover:bg-[#286090]"
                        >
                          Add Item
                        </button>
                      </div>
                    </td>
                  </tr>
                  {items.map((item, index) => (
                    <tr key={`${item.item_id}-${index}`} className="border-t border-[#eee] text-[12px]">
                      <td className="px-2 py-2">{item.quantity}</td>
                      <td className="px-2 py-2">{item.supplier_name || '-'}</td>
                      <td className="px-2 py-2">-</td>
                      <td className="px-2 py-2">{item.part_number || '-'}</td>
                      <td className="px-2 py-2">{item.item_code || '-'}</td>
                      <td className="px-2 py-2">-</td>
                      <td className="px-2 py-2">{item.description || '-'}</td>
                      <td className="px-2 py-2 text-right">{Number(item.unit_cost || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8} className="px-2 pb-3">
                      <textarea
                        value={notes}
                        onChange={event => setNotes(event.target.value)}
                        rows={3}
                        placeholder="Remark"
                        className="w-[420px] rounded-[3px] border border-[#ccc] px-3 py-2 shadow-inner"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={8} className="px-2 pt-1">
                      <button
                        type="submit"
                        aria-label="Create request"
                        disabled={isSubmitting}
                        className="rounded-[3px] border border-[#398439] bg-[#5cb85c] px-3 py-[7px] font-semibold text-white hover:bg-[#47a447] disabled:bg-[#999]"
                      >
                        {isSubmitting ? 'Saving...' : 'Create PR'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </main>
        </form>
      </div>
    </div>
  );
};

export default PurchaseRequestForm;
