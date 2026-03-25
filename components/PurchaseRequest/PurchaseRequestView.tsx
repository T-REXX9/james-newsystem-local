import React, { useState } from 'react';
import { PurchaseRequestWithItems, PurchaseRequestItem, Product, Contact, PRStatus } from '../../purchaseRequest.types';
import { Printer, CheckCircle, XCircle, Trash2, FileOutput, Plus, ArrowLeft, Package2 } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import ProductAutocomplete from '../ProductAutocomplete';
import { Product as SearchProduct } from '../../types';

interface PurchaseRequestViewProps {
    request: PurchaseRequestWithItems;
    onBack: () => void;
    onUpdate: (id: string, updates: any) => Promise<void>;
    onUpdateItem: (itemId: string, updates: any) => Promise<void>;
    onDeleteItem: (itemId: string) => Promise<void>;
    onAddItem: (item: any) => Promise<void>;
    onConvert: () => void;
    onPrint: () => void;
    products: Product[];
    suppliers: Contact[];
    isApprover?: boolean; // Determine if user can approve
}

const PurchaseRequestView: React.FC<PurchaseRequestViewProps> = ({
    request,
    onBack,
    onUpdate,
    onUpdateItem,
    onDeleteItem,
    onAddItem,
    onConvert,
    onPrint,
    products,
    suppliers,
    isApprover = true // Default true for now until strict RBAC
}) => {
    const [showAddItem, setShowAddItem] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel: string;
        variant: 'danger' | 'warning' | 'info' | 'success';
        onConfirm: (() => Promise<void>) | null;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        variant: 'warning',
        onConfirm: null,
    });

    // Add Item State
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [etaDate, setEtaDate] = useState('');

    const handleStatusChange = async (newStatus: PRStatus) => {
        setConfirmModal({
            isOpen: true,
            title: `${newStatus} Purchase Request`,
            message: `Are you sure you want to change the status of ${request.pr_number} to ${newStatus}?`,
            confirmLabel: newStatus === 'Approved' ? 'Approve' : 'Confirm',
            variant: newStatus === 'Cancelled' ? 'danger' : 'warning',
            onConfirm: async () => {
                await onUpdate(request.id, { status: newStatus });
            },
        });
    };

    const handleAddItem = async () => {
        if (!selectedProductId || quantity <= 0) return;
        const product = selectedProduct || products.find(p => p.id === selectedProductId);
        const supplier = suppliers.find(s => s.id === selectedSupplierId);

        await onAddItem({
            item_id: selectedProductId,
            item_code: product?.item_code,
            part_number: (product as any)?.part_no || product?.part_number,
            description: product?.description || (product as any)?.name,
            quantity,
            unit_cost: (product as any)?.cost || 0,
            supplier_id: selectedSupplierId || null,
            supplier_name: supplier?.company || null,
            eta_date: etaDate || null
        });

        setShowAddItem(false);
        setSelectedProductId('');
        setSelectedProduct(null);
        setQuantity(1);
        setSelectedSupplierId('');
        setEtaDate('');
    };

    const handleDeleteItemRequest = (itemId: string, partNumber?: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Item',
            message: `Are you sure you want to delete ${partNumber || 'this item'} from ${request.pr_number}?`,
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                await onDeleteItem(itemId);
            },
        });
    };

    const handleEditItem = async (itemId: string, field: keyof PurchaseRequestItem, value: any) => {
        await onUpdateItem(itemId, { [field]: value });
    };

    const handleConvertRequest = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Convert to Purchase Order',
            message: `Create a new Purchase Order from ${request.pr_number}? This will carry over the current request items.`,
            confirmLabel: 'Convert',
            variant: 'info',
            onConfirm: async () => {
                await onConvert();
            },
        });
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-950 p-4 h-full overflow-y-auto">
            <div className="space-y-6">
                {/* Header Card */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex flex-col gap-5 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700">
                                <ArrowLeft size={16} />
                                Back to List
                            </button>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                {request.pr_number}
                                <span className={`px-2 py-0.5 text-sm rounded border ${request.status === 'Approved' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600'}`}>
                                    {request.status}
                                </span>
                            </h1>
                            <p className="text-sm text-slate-500">Created {new Date(request.request_date || '').toLocaleDateString()}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button onClick={onPrint} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"><Printer size={16} /> Print</button>

                            {request.status === 'Pending' && isApprover && (
                                <button onClick={() => handleStatusChange('Approved')} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"><CheckCircle size={16} /> Approve</button>
                            )}

                            {request.status === 'Approved' && (
                                <button onClick={handleConvertRequest} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"><FileOutput size={16} /> Convert to PO</button>
                            )}

                            {['Pending', 'Approved'].includes(request.status || '') && (
                                <button onClick={() => handleStatusChange('Cancelled')} className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"><XCircle size={16} /> Cancel</button>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-6 text-sm md:grid-cols-3">
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Request Details</p>
                            <p className="text-slate-700 dark:text-slate-200">Reference: {request.reference_no || '-'}</p>
                            <p className="text-slate-700 dark:text-slate-200">Items: {request.items?.length || 0}</p>
                            <p className="text-slate-700 dark:text-slate-200">Total Quantity: {request.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}</p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                            <p className="text-slate-600 dark:text-slate-300">{request.notes || 'No notes provided.'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                    <Package2 size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Status</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{request.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Card */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-bold text-slate-800 dark:text-white">Items</h3>
                        {request.status === 'Pending' && (
                            <button onClick={() => setShowAddItem(true)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1"><Plus size={14} /> Add Item</button>
                        )}
                    </div>

                    {showAddItem && (
                        <div className="border-b border-blue-100 bg-blue-50 p-4">
                            <div className="grid gap-3 xl:grid-cols-[minmax(0,2.9fr)_120px_230px_190px_56px_56px] xl:items-start">
                                <div className="grid gap-1 [grid-template-rows:auto_44px_auto]">
                                    <label className="text-xs font-semibold">Product</label>
                                    <ProductAutocomplete
                                        onSelect={(product) => {
                                            setSelectedProduct(product);
                                            setSelectedProductId(product.id);
                                        }}
                                        placeholder="Part no. or Item code"
                                    />
                                    <p className="text-xs leading-snug text-slate-500">
                                        {selectedProduct
                                            ? `${selectedProduct.part_no} • ${selectedProduct.description}`
                                            : 'Search and select a product before adding.'}
                                    </p>
                                </div>
                                <div className="grid gap-1 [grid-template-rows:auto_44px_auto]">
                                    <label className="text-xs font-semibold">Qty</label>
                                    <input aria-label="Add item quantity" type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full text-sm rounded border-gray-300" />
                                    <div />
                                </div>
                                <div className="grid gap-1 [grid-template-rows:auto_44px_auto]">
                                    <label className="text-xs font-semibold">Supplier</label>
                                    <select aria-label="Add item supplier" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full text-sm rounded border-gray-300">
                                        <option value="">Preferred...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                                    </select>
                                    <div />
                                </div>
                                <div className="grid gap-1 [grid-template-rows:auto_44px_auto]">
                                    <label className="text-xs font-semibold">ETA</label>
                                    <input aria-label="Add item ETA" type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} className="w-full text-sm rounded border-gray-300" />
                                    <div />
                                </div>
                                <div className="flex xl:pt-[1.45rem] xl:justify-end">
                                    <button onClick={handleAddItem} className="flex h-10 w-10 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700" aria-label="Confirm add item">
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div className="flex xl:pt-[1.45rem] xl:justify-end">
                                    <button onClick={() => setShowAddItem(false)} className="flex h-10 w-10 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 transition-colors hover:bg-slate-50" aria-label="Close add item">
                                        <XCircle size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                                    <th className="px-6 py-3">Part No</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3 text-center">Qty</th>
                                    <th className="px-6 py-3">Supplier</th>
                                    <th className="px-6 py-3">ETA</th>
                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {request.items?.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-medium">{item.part_number}</td>
                                        <td className="px-6 py-3 text-slate-500">{item.description}</td>
                                        <td className="px-6 py-3 text-center">
                                            {request.status === 'Pending' ? (
                                                <input
                                                    type="number"
                                                    className="w-16 text-center border rounded p-1"
                                                    value={item.quantity}
                                                    onChange={e => handleEditItem(item.id, 'quantity', Number(e.target.value))}
                                                />
                                            ) : item.quantity}
                                        </td>
                                        <td className="px-6 py-3">
                                            {request.status === 'Pending' ? (
                                                <select
                                                    className="w-full border rounded p-1 text-xs"
                                                    value={item.supplier_id || ''}
                                                    onChange={e => {
                                                        const s = suppliers.find(sup => sup.id === e.target.value);
                                                        handleEditItem(item.id, 'supplier_id', e.target.value);
                                                        handleEditItem(item.id, 'supplier_name', s?.company || null);
                                                    }}
                                                >
                                                    <option value="">-</option>
                                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                                                </select>
                                            ) : item.supplier_name || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-xs">{item.eta_date || '-'}</td>
                                        <td className="px-6 py-3 text-center">
                                            {request.status === 'Pending' && (
                                                <button aria-label={`Delete ${item.part_number || 'item'}`} onClick={() => handleDeleteItemRequest(item.id, item.part_number)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }))}
                onConfirm={async () => {
                    if (!confirmModal.onConfirm) return;
                    await confirmModal.onConfirm();
                }}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmLabel={confirmModal.confirmLabel}
                variant={confirmModal.variant}
            />
        </div>
    );
};

export default PurchaseRequestView;
