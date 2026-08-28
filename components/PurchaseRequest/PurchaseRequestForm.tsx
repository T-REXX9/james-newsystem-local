import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Info, MessageSquare, Plus, Send, Trash2, X } from 'lucide-react';
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

type ProductWithMetadata = SearchProduct & {
  original_pn?: string;
  original_part_no?: string;
  brand?: string;
};

type DraftItem = CreatePRItemPayload & {
  original_part_no?: string;
  brand?: string;
  sr_cases?: number;
  ir_cases?: number;
};

const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PurchaseRequestForm: React.FC<PurchaseRequestFormProps> = ({ onCancel, onSubmit, suppliers, initialPRNumber }) => {
  const { addToast } = useToast();
  const [notes, setNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithMetadata | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const selectedSupplier = suppliers.find(supplier => supplier.id === selectedSupplierId);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0);

  const buildItem = (): DraftItem | null => {
    const errors: Record<string, string> = {};
    const productValidation = validateRequired(selectedProductId, 'a product');
    if (!productValidation.isValid) errors.selectedProductId = productValidation.message;
    const quantityValidation = validateNumeric(quantity, 'quantity', 1);
    if (!quantityValidation.isValid) errors.quantity = quantityValidation.message;
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return null;
    }

    const product = selectedProduct;
    return {
      item_id: selectedProductId,
      item_code: product?.item_code,
      part_number: product?.part_no,
      original_part_no: product?.original_part_no || product?.original_pn,
      brand: product?.brand,
      description: product?.description,
      quantity,
      unit: 'PCS',
      unit_cost: Number(product?.cost || 0),
      supplier_id: selectedSupplierId || undefined,
      supplier_name: selectedSupplier?.company,
      eta_date: etaDate || undefined,
      sr_cases: 0,
      ir_cases: 0,
      recommendation: 'Good',
    };
  };

  const clearEditor = () => {
    setSelectedProductId('');
    setSelectedProduct(null);
    setQuantity(1);
    setSelectedSupplierId('');
    setEtaDate('');
    setValidationErrors({});
  };

  const handleAddItem = () => {
    const item = buildItem();
    if (!item) return;
    setItems(current => [...current, item]);
    clearEditor();
  };

  const handleRemoveItem = (index: number) => setItems(current => current.filter((_, itemIndex) => itemIndex !== index));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status: 'Draft' | 'Pending' = submitter?.value === 'Draft' ? 'Draft' : 'Pending';
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
        status,
        items: submittedItems,
      });
      addToast({
        type: 'success',
        title: 'Purchase request created',
        description: status === 'Draft' ? `PR ${initialPRNumber} was saved as draft.` : `PR ${initialPRNumber} has been submitted successfully.`,
        durationMs: 4000,
      });
    } catch (error) {
      const message = parseSupabaseError(error, 'purchase request');
      setSubmitError(message);
      addToast({ type: 'error', title: 'Unable to create purchase request', description: message, durationMs: 6000 });
      setIsSubmitting(false);
    }
  };

  const previewItems = useMemo(() => {
    if (items.length > 0) return items;
    const pendingItem = selectedProduct ? buildItem() : null;
    return pendingItem ? [pendingItem] : [];
  }, [items, selectedProduct, quantity, selectedSupplierId, etaDate]);

  return (
    <div className="min-h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <form onSubmit={handleSubmit} className="min-h-full">
        <header className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <button type="button" onClick={onCancel} aria-label="Back to purchase request list" className="mt-1 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><ArrowLeft className="h-5 w-5" /></button>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400"><span>Purchasing</span><span>›</span><span>Purchase Request</span><span>›</span><span className="text-slate-700">Create PR</span></div>
                <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Create Purchase Request</h1><span className="rounded-md bg-blue-50 px-2.5 py-1 text-sm font-extrabold text-[#175fd3]">PR No. {initialPRNumber || 'Pending'}</span></div>
                <p className="mt-1 text-sm text-slate-500">Create a new Purchase Request by adding items from different sources.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button type="submit" value="Draft" disabled={isSubmitting} className="rounded-md border border-[#175fd3] bg-white px-4 py-2.5 text-sm font-bold text-[#175fd3] transition hover:bg-blue-50 disabled:opacity-50">Save as Draft</button>
              <button type="button" onClick={() => setShowPreview(true)} className="rounded-md border border-[#175fd3] bg-white px-4 py-2.5 text-sm font-bold text-[#175fd3] transition hover:bg-blue-50">Preview PR</button>
              <button type="submit" value="Pending" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0e4fb7] disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Submit PR'} <Send className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-5 lg:p-8">
          <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
          {submitError && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><strong>Unable to save: </strong>{submitError}</div>}

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-base font-extrabold uppercase tracking-wide text-[#173c83]">Items for Purchase Request</h2><p className="mt-1 text-xs text-slate-500">Add items from Reorder Report, Suggested Stock, or Product Database.</p></div>
              <button type="button" onClick={() => document.getElementById('purchase-request-item-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Plus className="h-4 w-4" /> Create New Item</button>
            </div>
            <div className="mx-5 my-4 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs text-blue-700"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>Items from Reorder Report are existing items in the system that require replenishment.</span></div>

            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-xs">
                <thead><tr className="bg-[#102f76] text-left text-[11px] font-bold uppercase tracking-wide text-white">
                  <th className="w-9 px-3 py-3 text-center">#</th><th className="px-3 py-3">Item Code<br /><span className="font-normal normal-case opacity-80">(Auto)</span></th><th className="px-3 py-3">Part No.</th><th className="px-3 py-3">Description</th><th className="px-3 py-3 text-center">Required Qty<br />(PCS)</th><th className="px-3 py-3">Unit</th><th className="min-w-[180px] px-3 py-3">Preferred Supplier<br />(Lowest Price)</th><th className="px-3 py-3 text-right">Unit Price<br />(PHP)</th><th className="px-3 py-3 text-right">Amount<br />(PHP)</th><th className="px-3 py-3 text-center">SR Cases<br />(12 Months)</th><th className="px-3 py-3 text-center">IR Cases<br />(12 Months)</th><th className="px-3 py-3">Recommendation</th><th className="px-3 py-3 text-center">Action</th>
                </tr></thead>
                <tbody>
                  <tr id="purchase-request-item-picker" className="border-b border-blue-100 bg-blue-50/40 align-top">
                    <td className="px-3 py-3 text-center text-slate-400">+</td>
                    <td colSpan={3} className="px-3 py-3"><ProductAutocomplete onSelect={product => { setSelectedProduct(product as ProductWithMetadata); setSelectedProductId(product.id); setValidationErrors(current => ({ ...current, selectedProductId: '' })); }} placeholder="Select product by part no. or item code" className={validationErrors.selectedProductId ? 'ring-1 ring-rose-500' : ''} /><p className="mt-1 text-[11px] text-slate-500">{selectedProduct ? `${selectedProduct.part_no || '-'} • ${selectedProduct.description || '-'}` : 'Search and select a product before adding.'}</p><label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">Expected ETA<input aria-label="Line item ETA" type="date" value={etaDate} onChange={event => setEtaDate(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 font-normal text-slate-700 outline-none focus:border-[#175fd3]" /></label></td>
                    <td className="px-3 py-3"><input aria-label="Line item quantity" type="number" min={1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="h-9 w-20 rounded border border-slate-300 px-2 text-center outline-none focus:border-[#175fd3]" /></td>
                    <td className="px-3 py-3 font-semibold text-slate-500">PCS</td>
                    <td className="px-3 py-3"><select aria-label="Line item supplier" value={selectedSupplierId} onChange={event => setSelectedSupplierId(event.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white px-2 outline-none focus:border-[#175fd3]"><option value="">Select Supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.company}</option>)}</select></td>
                    <td className="px-3 py-3 text-right font-semibold">{money(Number(selectedProduct?.cost || 0))}</td>
                    <td className="px-3 py-3 text-right font-semibold">{money(Number(quantity || 0) * Number(selectedProduct?.cost || 0))}</td>
                    <td className="px-3 py-3 text-center text-emerald-700">0</td><td className="px-3 py-3 text-center text-emerald-700">0</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Good</span></td>
                    <td className="px-3 py-3 text-center"><button type="button" aria-label="Add line item" onClick={handleAddItem} className="rounded-md bg-[#175fd3] p-2 text-white transition hover:bg-[#0e4fb7]"><Plus className="h-4 w-4" /></button></td>
                  </tr>
                  {items.map((item, index) => <tr key={`${item.item_id}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-3 py-3 font-semibold text-slate-700">{item.item_code || '-'}</td><td className="whitespace-nowrap px-3 py-3 font-semibold text-[#173c83]">{item.part_number || '-'}</td><td className="px-3 py-3 font-semibold">{item.description || '-'}</td><td className="px-3 py-3 text-center font-semibold">{item.quantity}</td><td className="px-3 py-3">{item.unit || 'PCS'}</td><td className="px-3 py-3">{item.supplier_name || '-'}</td><td className="px-3 py-3 text-right">{money(Number(item.unit_cost || 0))}</td><td className="px-3 py-3 text-right font-semibold">{money(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</td><td className="px-3 py-3 text-center text-emerald-700">{item.sr_cases || 0}</td><td className="px-3 py-3 text-center text-emerald-700">{item.ir_cases || 0}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {item.recommendation || 'Good'}</span></td><td className="px-3 py-3 text-center"><button type="button" aria-label={`Remove ${item.part_number || 'item'}`} onClick={() => handleRemoveItem(index)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>)}
                </tbody>
                <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-[#173c83]"><td colSpan={4} className="px-3 py-4 text-right uppercase">Total</td><td className="px-3 py-4 text-center">{totalQuantity} PCS</td><td colSpan={3}></td><td className="px-3 py-4 text-right text-sm">{money(totalAmount)}</td><td colSpan={4}></td></tr></tfoot>
              </table>
            </div>

            <div className="border-t border-slate-200 px-5 py-4"><label htmlFor="purchase-request-remark" className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><MessageSquare className="h-4 w-4" /> Remark</label><textarea id="purchase-request-remark" value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Add a note for the purchasing team..." className="w-full max-w-2xl rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100" /></div>
          </section>
        </main>
      </form>

      {showPreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-label="Purchase request preview" className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Preview</p><h2 className="text-2xl font-extrabold text-[#173c83]">Purchase Request Preview — {initialPRNumber}</h2></div><button type="button" aria-label="Close preview" onClick={() => setShowPreview(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 overflow-x-auto"><table aria-label="Purchase request preview items" className="w-full min-w-[680px] table-fixed text-sm"><colgroup><col className="w-1/5" /><col className="w-1/5" /><col className="w-1/5" /><col className="w-1/5" /><col className="w-1/5" /></colgroup><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Part No.</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody>{previewItems.map((item, index) => <tr key={`${item.item_id}-${index}`} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{item.part_number || '-'}</td><td className="break-words px-3 py-3">{item.description || '-'}</td><td className="px-3 py-3 text-right">{item.quantity}</td><td className="break-words px-3 py-3">{item.supplier_name || '-'}</td><td className="px-3 py-3 text-right">{money(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><button type="button" onClick={() => setShowPreview(false)} className="rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white">Done</button></div></section></div>}
    </div>
  );
};

export default PurchaseRequestForm;
