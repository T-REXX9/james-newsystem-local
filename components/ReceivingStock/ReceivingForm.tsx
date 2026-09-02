import React, { useState, useEffect } from 'react';
import { ReceivingReport, ReceivingReportInsert, ReceivingReportItemInsert, Supplier } from '../../receiving.types';
import { EligiblePurchaseOrder, receivingService } from '../../services/receivingService';
import { useToast } from '../ToastProvider';
import { ArrowLeft, Save, Plus, Trash2, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import CustomLoadingSpinner from '../CustomLoadingSpinner';
import SearchableSelect from '../SearchableSelect';
import { Product } from '../../types'; // Import from main types for compatibility with ProductAutocomplete
import ValidationSummary from '../ValidationSummary';
import FieldHelp from '../FieldHelp';
import { validateNumeric, validateRequired } from '../../utils/formValidation';

interface ReceivingFormProps {
    onClose: () => void;
    onSuccess: (report: ReceivingReport) => void;
}

interface LineItem extends Omit<ReceivingReportItemInsert, 'rr_id'> {
    tempId: string;
    product?: Product | null;
    po_item_id: number;
    qty_ordered: number;
    qty_already_received: number;
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
    const [poRefno, setPoRefno] = useState('');
    const [remarks, setRemarks] = useState('');
    const warehouseId = 'CENTRALIZED';

    // Data Sources
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [eligiblePurchaseOrders, setEligiblePurchaseOrders] = useState<EligiblePurchaseOrder[]>([]);

    // Line Items
    const [items, setItems] = useState<LineItem[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [submitCount, setSubmitCount] = useState(0);

    useEffect(() => {
        const init = async () => {
            try {
                // Fetch Suppliers
                const [suppliersData, purchaseOrders] = await Promise.all([
                    receivingService.getSuppliers(),
                    receivingService.getEligiblePurchaseOrders(),
                ]);
                setSuppliers(suppliersData);
                setEligiblePurchaseOrders(purchaseOrders);
            } catch (error) {
                console.error("Error initializing form:", error);
                addToast({ type: 'error', message: 'Failed to initialize form' });
            } finally {
                setInitializing(false);
            }
        };
        init();
    }, []);

    const handlePurchaseOrderChange = async (id: string) => {
        setPoRefno(id);
        const selected = eligiblePurchaseOrders.find((po) => po.id === id);
        setPoNo(selected?.poNumber || '');
        setSupplierId(selected?.supplierId || '');
        setSupplierName(selected?.supplierName || '');
        setItems([]);
        if (!id) return;
        try {
            const details = await receivingService.getEligiblePurchaseOrderDetails(id);
            setItems((details.items || []).flatMap((line: any) => {
                const ordered = Number(line.qty || 0);
                const received = Number(line.quantity_received || 0);
                const remaining = Math.max(0, ordered - received);
                if (remaining <= 0) return [];
                return [{
                    tempId: `po-${line.id}`,
                    po_item_id: Number(line.id),
                    item_id: line.item_id,
                    item_code: line.product?.item_code || '',
                    part_no: line.product?.part_no || '',
                    description: line.product?.description || '',
                    qty_received: remaining,
                    unit_cost: Number(line.unit_price || 0),
                    total_amount: remaining * Number(line.unit_price || 0),
                    qty_ordered: ordered,
                    qty_already_received: received,
                    qty_returned: 0,
                    product: line.product,
                } as LineItem];
            }));
        } catch (error: any) {
            addToast({ type: 'error', title: 'Unable to load purchase order', description: error.message });
        }
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

    const handleSupplierChange = (id: string) => {
        setSupplierId(id);
        const supplier = suppliers.find(s => s.id === id);
        setSupplierName(supplier?.company || '');
        handleBlur('supplierId', id);
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};
        if (!poRefno) errors.poRefno = 'Select a posted purchase order created from a purchase request.';
        const supplierValidation = validateRequired(supplierId, 'a supplier');
        if (!supplierValidation.isValid) errors.supplierId = supplierValidation.message;
        if (items.length === 0) {
            errors.items = 'Please add at least one item to the receiving report.';
        }
        items.forEach((item, index) => {
            const qtyCheck = validateNumeric(item.qty_received, `quantity for line ${index + 1}`, 1);
            if (!qtyCheck.isValid) errors[`item-${item.tempId}-qty`] = qtyCheck.message;
            const remaining = item.qty_ordered - item.qty_already_received;
            if (Number(item.qty_received) > remaining) errors[`item-${item.tempId}-qty`] = `Quantity cannot exceed the remaining PO quantity (${remaining}).`;
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
                po_refno: poRefno,
                remarks: remarks || null,
                warehouse_id: warehouseId,
                status: 'Draft'
            };

            const itemsPayload: Omit<ReceivingReportItemInsert, 'rr_id'>[] = items.map((item) => ({
                    item_id: item.item_id,
                    po_item_id: item.po_item_id,
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
            onSuccess(created);

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
        <div className="min-h-full overflow-y-auto bg-[#f4f4f4] p-5 text-[#333]">
            {/* Header */}
            <div className="flex w-full items-center justify-between rounded-t border border-[#d5d5d5] bg-white px-5 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="font-serif text-xl font-bold uppercase">Receiving Stock</h1>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 rounded border border-[#4f9e43] bg-[#70b865] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Add Receiving
                </button>
            </div>

            <div className="w-full space-y-5 rounded-b border-x border-b border-[#d5d5d5] bg-white p-5">
                {/* Main Form */}
                <div className="border-b border-[#ddd] bg-white p-2 pb-5">
                    <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        Receiving Details
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
                            <input value={supplierName} readOnly className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700" placeholder="Set by purchase order" />
                            {validationErrors.supplierId && (
                                <p className="mt-1 text-xs text-rose-600">{validationErrors.supplierId}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Posted PO Reference <span className="text-red-500">*</span>
                            </label>
                            <SearchableSelect
                                value={poRefno}
                                options={eligiblePurchaseOrders.map((po) => ({ value: po.id, label: `${po.poNumber} • ${po.prNumber} • ${po.supplierName}`, keywords: [po.poNumber, po.prNumber, po.supplierName] }))}
                                onChange={handlePurchaseOrderChange}
                                placeholder="Select posted PO..."
                                searchPlaceholder="Search PO, PR, or supplier..."
                                buttonClassName={validationErrors.poRefno ? 'border-rose-400' : ''}
                            />
                            {validationErrors.poRefno && <p className="mt-1 text-xs text-rose-600">{validationErrors.poRefno}</p>}
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
                <div className="flex flex-1 flex-col bg-white p-2">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-bold uppercase">Items</h2>
                        <p className="text-xs text-slate-500">Only remaining items from the selected posted PO are available.</p>
                    </div>

                    <div className="min-h-[200px] overflow-hidden">
                        <table className="w-full table-fixed text-left text-xs leading-tight">
                            <colgroup>
                                <col className="w-[16%]" />
                                <col className="w-[28%]" />
                                <col className="w-[9%]" />
                                <col className="w-[11%]" />
                                <col className="w-[10%]" />
                                <col className="w-[11%]" />
                                <col className="w-[11%]" />
                                <col className="w-[4%]" />
                            </colgroup>
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="break-words py-3 pl-3 rounded-l-lg">Item</th>
                                    <th className="break-words px-2 py-3">Description</th>
                                    <th className="break-words px-2 py-3">Ordered</th>
                                    <th className="break-words px-2 py-3">Previously Received</th>
                                    <th className="break-words px-2 py-3">Qty Recv</th>
                                    <th className="break-words px-2 py-3">Unit Cost</th>
                                    <th className="break-words px-2 py-3 text-right">Total</th>
                                    <th className="px-2 py-3 rounded-r-lg"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No items added yet</p>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => (
                                        <tr key={item.tempId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="break-words py-3 pl-3">
                                                <div className="text-[13px] font-bold text-slate-900 dark:text-white">{item.part_no}</div>
                                                <div className="text-xs font-semibold text-[#173c83]">{item.item_code}</div>
                                            </td>
                                            <td className="break-words px-2 py-3 text-slate-600 dark:text-slate-300">
                                                {item.description}
                                            </td>
                                            <td className="break-words px-2 py-3">{item.qty_ordered}</td>
                                            <td className="break-words px-2 py-3">{item.qty_already_received}</td>
                                            <td className="px-2 py-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty_received || ''}
                                                    onChange={(e) => updateItem(item.tempId, 'qty_received', parseFloat(e.target.value) || 0)}
                                                    className={`w-full min-w-0 px-2 py-1 border rounded bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none ${
                                                        validationErrors[`item-${item.tempId}-qty`] ? 'border-rose-400' : 'border-slate-300 dark:border-slate-600'
                                                    }`}
                                                />
                                            </td>
                                            <td className="px-2 py-3">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-slate-400">₱</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.unit_cost || ''}
                                                        onChange={(e) => updateItem(item.tempId, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                        className="w-full min-w-0 pl-6 pr-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </td>
                                            <td className="break-words px-2 py-3 text-right font-medium text-slate-700 dark:text-white">
                                                ₱{(item.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-2 py-3 text-right">
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
                                    <td colSpan={6} className="text-right py-4 px-4 font-bold text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider">
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
