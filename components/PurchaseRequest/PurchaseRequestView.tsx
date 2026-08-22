import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, CheckCircle2, FileOutput, Info, MessageSquare, Package2, Plus, Printer, Trash2, X, XCircle } from 'lucide-react';
import type { Contact, Product, PurchaseRequestItem, PurchaseRequestWithItems, PRStatus } from '../../purchaseRequest.types';
import ConfirmModal from '../ConfirmModal';
import ProductAutocomplete from '../ProductAutocomplete';
import type { Product as SearchProduct } from '../../types';

interface PurchaseRequestViewProps {
  request: PurchaseRequestWithItems;
  onBack: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onUpdateItem: (itemId: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onAddItem: (item: Record<string, unknown>) => Promise<void>;
  onConvert: () => void;
  onPrint: () => void;
  products: Product[];
  suppliers: Contact[];
  isApprover?: boolean;
}

type EnrichedItem = PurchaseRequestItem & {
  original_part_no?: string;
  brand?: string;
  unit?: string;
  sr_cases?: number;
  ir_cases?: number;
  preferred_supplier_name?: string;
  preferred_supplier_price?: number;
  recommendation?: string;
};

type ProductWithMetadata = SearchProduct & { original_pn?: string; original_part_no?: string; brand?: string };

const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const recommendationClass = (item: EnrichedItem) => (Number(item.sr_cases || 0) + Number(item.ir_cases || 0)) === 0 ? 'text-emerald-700' : 'text-amber-600';

const PurchaseRequestView: React.FC<PurchaseRequestViewProps> = ({ request, onBack, onUpdate, onUpdateItem, onDeleteItem, onAddItem, onConvert, onPrint, products, suppliers, isApprover = true }) => {
  const [showAddItem, setShowAddItem] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning' | 'info' | 'success'; onConfirm: (() => Promise<void>) | null }>({ isOpen: false, title: '', message: '', confirmLabel: 'Confirm', variant: 'warning', onConfirm: null });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithMetadata | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [etaDate, setEtaDate] = useState('');

  const items = (request.items || []) as EnrichedItem[];
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || item.preferred_supplier_price || 0), 0);

  const closeConfirm = () => setConfirmModal(previous => ({ ...previous, isOpen: false, onConfirm: null }));
  const handleStatusChange = (newStatus: PRStatus) => setConfirmModal({ isOpen: true, title: `${newStatus} Purchase Request`, message: `Are you sure you want to change the status of ${request.pr_number} to ${newStatus}?`, confirmLabel: newStatus === 'Approved' ? 'Approve' : 'Confirm', variant: newStatus === 'Cancelled' ? 'danger' : 'warning', onConfirm: async () => onUpdate(request.id, { status: newStatus }) });
  const handleDeleteItemRequest = (itemId: string, partNumber?: string) => setConfirmModal({ isOpen: true, title: 'Delete Item', message: `Are you sure you want to delete ${partNumber || 'this item'} from ${request.pr_number}?`, confirmLabel: 'Delete', variant: 'danger', onConfirm: async () => onDeleteItem(itemId) });
  const handleConvertRequest = () => setConfirmModal({ isOpen: true, title: 'Generate Purchase Order', message: `Create a new Purchase Order from ${request.pr_number}? This will carry over the current request items.`, confirmLabel: 'Generate PO', variant: 'info', onConfirm: async () => onConvert() });
  const resetAddItem = () => { setShowAddItem(false); setSelectedProductId(''); setSelectedProduct(null); setQuantity(1); setSelectedSupplierId(''); setEtaDate(''); };

  const handleAddItem = async () => {
    if (!selectedProductId || quantity <= 0) return;
    const product = selectedProduct || products.find(item => item.id === selectedProductId);
    const supplier = suppliers.find(item => item.id === selectedSupplierId);
    await onAddItem({ item_id: selectedProductId, item_code: product?.item_code, part_number: product?.part_no, original_part_no: (product as ProductWithMetadata | undefined)?.original_part_no || (product as ProductWithMetadata | undefined)?.original_pn, brand: (product as ProductWithMetadata | undefined)?.brand, description: product?.description, quantity, unit: 'PCS', unit_cost: Number(product?.cost || 0), supplier_id: selectedSupplierId || null, supplier_name: supplier?.company || null, eta_date: etaDate || null });
    resetAddItem();
  };

  return (
    <div className="min-h-full overflow-y-auto bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-5 p-5 lg:p-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between"><div><button onClick={onBack} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Back to List</button><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#173c83]">Purchase Request <span className="text-base font-semibold normal-case">PR No. {request.pr_number}</span></h1><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{request.status}</span></div><p className="mt-2 text-sm text-slate-500">Created {request.request_date || '-'} {request.created_by_name ? `by ${request.created_by_name}` : ''}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><button onClick={onPrint} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button>{request.status === 'Pending' && isApprover && <button onClick={() => handleStatusChange('Approved')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"><CheckCircle className="h-4 w-4" /> Approve</button>}{request.status === 'Approved' && <button onClick={handleConvertRequest} className="inline-flex items-center gap-2 rounded-md bg-[#175fd3] px-3 py-2 text-sm font-bold text-white hover:bg-[#0e4fb7]"><FileOutput className="h-4 w-4" /> Generate Purchase Order</button>}{['Pending', 'Approved'].includes(request.status || '') && <button onClick={() => handleStatusChange('Cancelled')} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"><XCircle className="h-4 w-4" /> Cancel</button>}</div></div>
          <div className="mt-5 grid gap-4 text-sm md:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Request Details</p><p className="mt-2">Reference: {request.reference_no || '-'}</p><p>Items: {items.length}</p><p>Total Quantity: {totalQuantity} PCS</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes</p><p className="mt-2 text-slate-600">{request.notes || 'No notes provided.'}</p></div><div className="rounded-md border border-blue-100 bg-blue-50/50 p-4"><div className="flex items-center gap-3"><Package2 className="h-5 w-5 text-[#175fd3]" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated Amount</p><p className="text-xl font-extrabold text-[#173c83]">{money(totalAmount)}</p></div></div></div></div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-extrabold uppercase tracking-wide text-[#173c83]">Items for Purchase Request</h2><p className="mt-1 text-xs text-slate-500">Supplier prices and case history are calculated from existing procurement records.</p></div>{request.status === 'Pending' && <button onClick={() => setShowAddItem(true)} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Plus className="h-4 w-4" /> Add Item</button>}</div>{showAddItem && <div className="border-b border-blue-100 bg-blue-50/50 p-4"><div className="grid gap-3 lg:grid-cols-[minmax(260px,2fr)_110px_minmax(180px,1fr)_150px_auto_auto] lg:items-end"><div><label className="mb-1 block text-xs font-bold text-slate-600">Product</label><ProductAutocomplete onSelect={product => { setSelectedProduct(product as ProductWithMetadata); setSelectedProductId(product.id); }} placeholder="Part no. or item code" /><p className="mt-1 text-[11px] text-slate-500">{selectedProduct ? `${selectedProduct.part_no} • ${selectedProduct.description}` : 'Select an item to add.'}</p></div><div><label className="mb-1 block text-xs font-bold text-slate-600">Qty</label><input aria-label="Add item quantity" type="number" min={1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="h-10 w-full rounded border border-slate-300 px-2" /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">Supplier</label><select aria-label="Add item supplier" value={selectedSupplierId} onChange={event => setSelectedSupplierId(event.target.value)} className="h-10 w-full rounded border border-slate-300 bg-white px-2"><option value="">Select supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.company}</option>)}</select></div><div><label className="mb-1 block text-xs font-bold text-slate-600">Expected ETA</label><input aria-label="Add item ETA" type="date" value={etaDate} onChange={event => setEtaDate(event.target.value)} className="h-10 w-full rounded border border-slate-300 px-2" /></div><button onClick={handleAddItem} aria-label="Confirm add item" className="inline-flex h-10 items-center justify-center rounded bg-[#175fd3] px-3 text-white hover:bg-[#0e4fb7]"><Plus className="h-4 w-4" /></button><button onClick={resetAddItem} aria-label="Close add item" className="inline-flex h-10 items-center justify-center rounded border border-slate-300 bg-white px-3 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button></div></div>}
          <div className="mx-5 my-4 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs text-blue-700"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span>SR and IR cases show distinct posted return documents during the previous 12 months. “Review Supplier” flags items with return history.</span></div>
          <div className="overflow-x-auto"><table className="min-w-[1420px] w-full border-collapse text-xs"><thead><tr className="bg-[#102f76] text-left text-[11px] font-bold uppercase tracking-wide text-white"><th className="w-9 px-3 py-3 text-center">#</th><th className="px-3 py-3">Item Code<br /><span className="font-normal normal-case opacity-80">(Auto)</span></th><th className="px-3 py-3">Part No.</th><th className="px-3 py-3">Description</th><th className="px-3 py-3 text-center">Required Qty<br />(PCS)</th><th className="px-3 py-3">Unit</th><th className="min-w-[190px] px-3 py-3">Preferred Supplier<br />(Lowest Price)</th><th className="px-3 py-3 text-right">Unit Price<br />(PHP)</th><th className="px-3 py-3 text-right">Amount<br />(PHP)</th><th className="px-3 py-3 text-center">SR Cases<br />(12 Months)</th><th className="px-3 py-3 text-center">IR Cases<br />(12 Months)</th><th className="px-3 py-3">Recommendation</th><th className="px-3 py-3 text-center">Action</th></tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-500">No items have been added to this request.</td></tr> : items.map((item, index) => { const supplierName = item.supplier_name || item.preferred_supplier_name || '-'; const unitPrice = Number(item.unit_cost || item.preferred_supplier_price || 0); const review = Number(item.sr_cases || 0) + Number(item.ir_cases || 0) > 0; return <tr key={item.id || `${item.item_code}-${index}`} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-3 py-3 font-semibold text-slate-700">{item.item_code || '-'}</td><td className="whitespace-nowrap px-3 py-3 font-semibold text-[#173c83]">{item.part_number || '-'}</td><td className="px-3 py-3 font-semibold">{item.description || '-'}</td><td className="px-3 py-3 text-center">{request.status === 'Pending' ? <input aria-label={`Quantity ${item.part_number || index + 1}`} type="number" min={1} value={item.quantity} onChange={event => onUpdateItem(item.id, { quantity: Number(event.target.value) })} className="h-8 w-20 rounded border border-slate-300 px-2 text-center" /> : item.quantity}</td><td className="px-3 py-3">{item.unit || 'PCS'}</td><td className="px-3 py-3"><span className="font-semibold">{supplierName}</span>{item.preferred_supplier_price ? <span className="ml-1 text-[11px] text-slate-500">({money(Number(item.preferred_supplier_price))})</span> : null}</td><td className="px-3 py-3 text-right">{money(unitPrice)}</td><td className="px-3 py-3 text-right font-semibold">{money(Number(item.quantity || 0) * unitPrice)}</td><td className={`px-3 py-3 text-center font-semibold ${review ? 'text-amber-600' : 'text-emerald-700'}`}>{item.sr_cases || 0}</td><td className={`px-3 py-3 text-center font-semibold ${review ? 'text-amber-600' : 'text-emerald-700'}`}>{item.ir_cases || 0}</td><td className={`px-3 py-3 font-bold ${recommendationClass(item)}`}><span className="inline-flex items-center gap-1 whitespace-nowrap">{review ? <Info className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {review ? 'Review Supplier' : 'Good'}</span></td><td className="px-3 py-3 text-center">{item.notes ? <button type="button" title={item.notes} aria-label={`View note for ${item.part_number || 'item'}`} className="mr-2 text-slate-500 hover:text-[#175fd3]"><MessageSquare className="inline h-4 w-4" /></button> : null}{request.status === 'Pending' && <button type="button" aria-label={`Delete ${item.part_number || 'item'}`} onClick={() => handleDeleteItemRequest(item.id, item.part_number)} className="text-slate-400 hover:text-rose-600"><Trash2 className="inline h-4 w-4" /></button>}</td></tr>; })}</tbody><tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-[#173c83]"><td colSpan={4} className="px-3 py-4 text-right uppercase">Total</td><td className="px-3 py-4 text-center">{totalQuantity} PCS</td><td colSpan={3}></td><td className="px-3 py-4 text-right text-sm">{money(totalAmount)}</td><td colSpan={4}></td></tr></tfoot></table></div>
        </section>
      </div>
      <ConfirmModal isOpen={confirmModal.isOpen} onClose={closeConfirm} onConfirm={async () => { if (confirmModal.onConfirm) await confirmModal.onConfirm(); closeConfirm(); }} title={confirmModal.title} message={confirmModal.message} confirmLabel={confirmModal.confirmLabel} variant={confirmModal.variant} />
    </div>
  );
};

export default PurchaseRequestView;
