import React, { useState } from 'react';
import { CreatePRPayload, CreatePRItemPayload, Product, Contact } from '../../purchaseRequest.types';
import { Save, Plus, Trash2, X } from 'lucide-react';
import ValidationSummary from '../ValidationSummary';
import FieldHelp from '../FieldHelp';
import { validateNumeric, validateRequired } from '../../utils/formValidation';
import { parseSupabaseError } from '../../utils/errorHandler';
import { useToast } from '../ToastProvider';

interface PurchaseRequestFormProps {
    onCancel: () => void;
    onSubmit: (payload: CreatePRPayload) => Promise<void>;
    products: Product[];
    suppliers: Contact[];
    initialPRNumber: string;
}

const PurchaseRequestForm: React.FC<PurchaseRequestFormProps> = ({
    onCancel,
    onSubmit,
    products,
    suppliers,
    initialPRNumber
}) => {
    const { addToast } = useToast();
    const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [items, setItems] = useState<CreatePRItemPayload[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [submitCount, setSubmitCount] = useState(0);
    const [submitError, setSubmitError] = useState('');

    // Item Entry State
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [etaDate, setEtaDate] = useState('');

    const handleAddItem = () => {
        const errors: Record<string, string> = {};
        const productValidation = validateRequired(selectedProductId, 'a product');
        if (!productValidation.isValid) errors.selectedProductId = productValidation.message;
        const quantityValidation = validateNumeric(quantity, 'quantity', 1);
        if (!quantityValidation.isValid) errors.quantity = quantityValidation.message;
        if (Object.keys(errors).length > 0) {
            setValidationErrors((prev) => ({ ...prev, ...errors }));
            return;
        }

        const product = products.find(p => p.id === selectedProductId);
        const supplier = suppliers.find(s => s.id === selectedSupplierId);

        const newItem: CreatePRItemPayload = {
            item_id: selectedProductId,
            item_code: product?.item_code,
            part_number: product?.part_number,
            description: product?.description || product?.name,
            quantity: quantity,
            unit_cost: product?.cost || 0, // Default to product cost
            supplier_id: selectedSupplierId || undefined,
            supplier_name: supplier?.company,
            eta_date: etaDate || undefined
        };

        setItems([...items, newItem]);

        // Reset entry fields
        setSelectedProductId('');
        setQuantity(1);
        // Keep supplier? maybe user adds multiple from same
        // setEtaDate(''); 
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            setValidationErrors((prev) => ({
                ...prev,
                items: 'Please add at least one item before submitting the request.'
            }));
            setSubmitCount((prev) => prev + 1);
            return;
        }
        setIsSubmitting(true);
        setSubmitError('');
        try {
            await onSubmit({
                pr_number: initialPRNumber,
                request_date: requestDate,
                notes,
                reference_no: referenceNo, // Added reference_no
                items
            });
            addToast({ 
                type: 'success', 
                title: 'Purchase request created',
                description: `PR ${initialPRNumber} has been submitted successfully.`,
                durationMs: 4000,
            });
        } catch (err: any) {
            setSubmitError(parseSupabaseError(err, 'purchase request'));
            addToast({ 
                type: 'error', 
                title: 'Unable to create purchase request',
                description: parseSupabaseError(err, 'purchase request'),
                durationMs: 6000,
            });
            setIsSubmitting(false);
        }
    };

    const handleBlur = (field: string, value: unknown) => {
        let message = '';
        if (field === 'selectedProductId') {
            const result = validateRequired(value, 'a product');
            message = result.isValid ? '' : result.message;
        }
        if (field === 'quantity') {
            const result = validateNumeric(value, 'quantity', 1);
            message = result.isValid ? '' : result.message;
        }
        setValidationErrors((prev) => ({ ...prev, [field]: message }));
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-950 p-4 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-lg shadow border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">New Purchase Request</h2>
                    <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                    {submitError && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {submitError}
                        </div>
                    )}
                    {/* Header Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">PR Number</label>
                            <input type="text" value={initialPRNumber} disabled className="w-full bg-slate-100 border border-slate-300 rounded p-2 text-slate-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Request Date</label>
                            <input type="date" required value={requestDate} onChange={e => setRequestDate(e.target.value)} className="w-full border border-slate-300 rounded p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Reference No.</label>
                            <input type="text" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="w-full border border-slate-300 rounded p-2" placeholder="Optional external ref" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Notes</label>
                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-300 rounded p-2" placeholder="Purpose of request..." />
                        </div>
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800" />

                    {/* Add Item Section */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded border border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-bold mb-3 uppercase text-slate-500">Add Line Item</h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                            <div className="md:col-span-4">
                                <label className="text-xs font-semibold block mb-1">Product</label>
                                <select
                                    value={selectedProductId}
                                    onChange={e => setSelectedProductId(e.target.value)}
                                    onBlur={(e) => handleBlur('selectedProductId', e.target.value)}
                                    className={`w-full text-sm rounded border p-2 ${
                                        validationErrors.selectedProductId ? 'border-rose-400' : 'border-gray-300'
                                    }`}
                                >
                                    <option value="">Select Item...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.part_number} - {p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold block mb-1">Qty</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={e => setQuantity(Number(e.target.value))}
                                    onBlur={(e) => handleBlur('quantity', e.target.value)}
                                    className={`w-full text-sm rounded border p-2 ${
                                        validationErrors.quantity ? 'border-rose-400' : 'border-gray-300'
                                    }`}
                                />
                                {validationErrors.quantity && (
                                    <p className="mt-1 text-xs text-rose-600">{validationErrors.quantity}</p>
                                )}
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-xs font-semibold block mb-1">Supplier (Optional)</label>
                                <select
                                    value={selectedSupplierId}
                                    onChange={e => setSelectedSupplierId(e.target.value)}
                                    className="w-full text-sm rounded border-gray-300 p-2"
                                >
                                    <option value="">Preferred Supplier...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.company}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold block mb-1">ETA (Optional)</label>
                                <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} className="w-full text-sm rounded border-gray-300 p-2" />
                                <FieldHelp text="Set an expected arrival date if the supplier provided one." example="2026-02-05" />
                            </div>
                            <div className="md:col-span-1">
                                <button type="button" onClick={handleAddItem} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex justify-center">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    {validationErrors.items && (
                        <div className="text-xs text-rose-600">{validationErrors.items}</div>
                    )}
                    <div className="overflow-x-auto border border-slate-200 rounded">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold">
                                <tr>
                                    <th className="p-2">Part No</th>
                                    <th className="p-2">Description</th>
                                    <th className="p-2 text-center">Qty</th>
                                    <th className="p-2">Supplier</th>
                                    <th className="p-2">ETA</th>
                                    <th className="p-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">No items added yet.</td></tr>}
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2">{item.part_number}</td>
                                        <td className="p-2">{item.description}</td>
                                        <td className="p-2 text-center">{item.quantity}</td>
                                        <td className="p-2 truncate max-w-[150px]">{item.supplier_name || '-'}</td>
                                        <td className="p-2">{item.eta_date || '-'}</td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                            {isSubmitting ? 'Saving...' : <><Save size={18} /> Create Request</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PurchaseRequestForm;
