import React, { useState, useEffect } from 'react';
import { ReceivingReportInsert, ReceivingReportItemInsert, Supplier } from '../../receiving.types';
import { receivingService } from '../../services/receivingService';
import { useToast } from '../ToastProvider';
import { ArrowLeft, Save, Plus, Trash2, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import ProductAutocomplete from '../ProductAutocomplete';
import { Product } from '../../types'; // Import from main types for compatibility with ProductAutocomplete
import ValidationSummary from '../ValidationSummary';
import FieldHelp from '../FieldHelp';
import { validateNumeric, validateRequired } from '../../utils/formValidation';

interface ReceivingFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface LineItem extends Omit<ReceivingReportItemInsert, 'rr_id'> {
    tempId: string;
    product?: Product | null;
}

const ReceivingForm: React.FC<ReceivingFormProps> = ({ onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);

    // Form State
    const [rrNumber, setRrNumber] = useState('');
    const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [poNo, setPoNo] = useState('');
    const [remarks, setRemarks] = useState('');
    const [warehouseId, setWarehouseId] = useState('WH1'); // Default to WH1

    // Data Sources
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Line Items
    const [items, setItems] = useState<LineItem[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [submitCount, setSubmitCount] = useState(0);

    useEffect(() => {
        const init = async () => {
            try {
                // Fetch Suppliers
                const suppliersData = await receivingService.getSuppliers();
                setSuppliers(suppliersData);
            } catch (error) {
                console.error("Error initializing form:", error);
                addToast({ type: 'error', message: 'Failed to initialize form' });
            } finally {
                setInitializing(false);
            }
        };
        init();
    }, []);

    const handleAddItem = (product: Product) => {
        const newItem: LineItem = {
            tempId: Math.random().toString(36).substr(2, 9),
            item_id: product.id,
            item_code: product.item_code || '',
            part_no: product.part_no || '',
            description: product.description || '',
            qty_received: 1,
            unit_cost: product.cost || 0,
            total_amount: (product.cost || 0) * 1,
            qty_ordered: 0,
            qty_returned: 0,
            product: product
        };
        setItems([...items, newItem]);
    };

    const updateItem = (id: string, field: keyof LineItem, value: any) => {
        setItems(items.map(item => {
            if (item.tempId === id) {
                const updated = { ...item, [field]: value };
                // Recalculate total if qty or cost changes
                if (field === 'qty_received' || field === 'unit_cost') {
                    updated.total_amount = (updated.qty_received || 0) * (updated.unit_cost || 0);
                }
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.tempId !== id));
    };

    const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSupplierId(id);
        const supplier = suppliers.find(s => s.id === id);
        setSupplierName(supplier?.company || '');
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};
        const supplierValidation = validateRequired(supplierId, 'a supplier');
        if (!supplierValidation.isValid) errors.supplierId = supplierValidation.message;
        if (items.length === 0) {
            errors.items = 'Please add at least one item to the receiving report.';
        }
        items.forEach((item, index) => {
            const qtyCheck = validateNumeric(item.qty_received, `quantity for line ${index + 1}`, 1);
            if (!qtyCheck.isValid) errors[`item-${item.tempId}-qty`] = qtyCheck.message;
        });
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            setSubmitCount((prev) => prev + 1);
            return;
        }

        setLoading(true);
        try {
            const rrData: Omit<ReceivingReportInsert, 'rr_no' | 'grand_total' | 'status'> & {
                rr_no?: string | null;
                status?: string;
            } = {
                rr_no: rrNumber.trim() || null,
                receive_date: receiveDate,
                supplier_id: supplierId,
                supplier_name: supplierName,
                po_no: poNo || null,
                remarks: remarks || null,
                warehouse_id: warehouseId,
                status: 'Draft'
            };

            const itemsPayload: Omit<ReceivingReportItemInsert, 'rr_id'>[] = items.map((item) => ({
                    item_id: item.item_id,
                    item_code: item.item_code,
                    part_no: item.part_no,
                    description: item.description,
                    qty_received: item.qty_received,
                    unit_cost: item.unit_cost,
                    total_amount: item.total_amount,
                    qty_ordered: 0,
                    qty_returned: 0
                }));

            const created = await receivingService.createReceivingReportWithItems(rrData, itemsPayload);
            setRrNumber(created.rr_no);

            addToast({ type: 'success', title: 'Receiving report created', description: 'The receiving report was saved successfully.' });
            onSuccess();

        } catch (error: any) {
            console.error("Error saving RR:", error);
            addToast({ type: 'error', title: 'Unable to save report', description: error.message || 'Failed to save Receiving Report' });
        } finally {
            setLoading(false);
        }
    };

    const handleBlur = (field: string, value: unknown) => {
        let message = '';
        if (field === 'supplierId') {
            const result = validateRequired(value, 'a supplier');
            message = result.isValid ? '' : result.message;
        }
        setValidationErrors((prev) => ({ ...prev, [field]: message }));
    };

    if (initializing) {
        return (
            <div className="flex flex-col items-center justify-center p-20">
                <div className="mb-4">
                    <CustomLoadingSpinner label="Loading" />
                </div>
                <p className="text-slate-500">Initializing form...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">New Receiving Report</h1>
                        <p className="text-xs text-slate-500">Draft</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Service Report
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Main Form */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        Report Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                RR Number
                            </label>
                            <input
                                type="text"
                                value={rrNumber}
                                onChange={(e) => setRrNumber(e.target.value)}
                                onBlur={(e) => handleBlur('rrNumber', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                                    validationErrors.rrNumber ? 'border-rose-400' : 'border-slate-300 dark:border-slate-600'
                                }`}
                                placeholder="Auto-generated on save (optional override)"
                            />
                            <FieldHelp text="Use the RR number printed on the supplier delivery receipt." example="RR-2026-00124" />
                            {validationErrors.rrNumber && (
                                <p className="mt-1 text-xs text-rose-600">{validationErrors.rrNumber}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Date Received <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="date"
                                    value={receiveDate}
                                    onChange={(e) => setReceiveDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Supplier <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={supplierId}
                                onChange={handleSupplierChange}
                                onBlur={(e) => handleBlur('supplierId', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${
                                    validationErrors.supplierId ? 'border-rose-400' : 'border-slate-300 dark:border-slate-600'
                                }`}
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.company || s.name || s.id}</option>
                                ))}
                            </select>
                            {validationErrors.supplierId && (
                                <p className="mt-1 text-xs text-rose-600">{validationErrors.supplierId}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                PO Reference
                            </label>
                            <input
                                type="text"
                                value={poNo}
                                onChange={(e) => setPoNo(e.target.value)}
                                placeholder="Optional"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="lg:col-span-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Remarks
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Line Items</h2>
                        <div className="w-96">
                            <ProductAutocomplete
                                onSelect={handleAddItem}
                                placeholder="Scan or search item to add..."
                                autoFocus={false}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[200px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="pl-4 py-3 rounded-l-lg">Item</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 w-32">Qty Recv</th>
                                    <th className="px-4 py-3 w-40">Unit Cost</th>
                                    <th className="px-4 py-3 w-40 text-right">Total</th>
                                    <th className="px-4 py-3 w-16 rounded-r-lg"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400">
                                            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No items added yet</p>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => (
                                        <tr key={item.tempId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="pl-4 py-3">
                                                <div className="font-medium text-slate-900 dark:text-white">{item.part_no}</div>
                                                <div className="text-xs text-slate-500">{item.item_code}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {item.description}
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty_received || ''}
                                                    onChange={(e) => updateItem(item.tempId, 'qty_received', parseFloat(e.target.value) || 0)}
                                                    className={`w-24 px-2 py-1 border rounded bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none ${
                                                        validationErrors[`item-${item.tempId}-qty`] ? 'border-rose-400' : 'border-slate-300 dark:border-slate-600'
                                                    }`}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-slate-400">₱</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.unit_cost || ''}
                                                        onChange={(e) => updateItem(item.tempId, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                        className="w-full pl-6 pr-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-white">
                                                ₱{(item.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => removeItem(item.tempId)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-100 dark:border-slate-700">
                                <tr>
                                    <td colSpan={4} className="text-right py-4 px-4 font-bold text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">
                                        Grand Total
                                    </td>
                                    <td className="text-right py-4 px-4 font-bold text-xl text-blue-600 dark:text-blue-400">
                                        ₱{items.reduce((sum, i) => sum + (i.total_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Start of helper Package Icon reuse 
function Package(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m7.5 4.27 9 5.15" />
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22v-9" />
        </svg>
    )
}

export default ReceivingForm;
