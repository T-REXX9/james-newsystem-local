import React, { useState } from 'react';
import { PurchaseRequestWithItems, PurchaseRequestItem, Product, Contact, PRStatus } from '../../purchaseRequest.types';
import { Printer, CheckCircle, XCircle, Trash2, Save, FileOutput, Plus } from 'lucide-react';

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

    // Add Item State
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');

    const handleStatusChange = async (newStatus: PRStatus) => {
        if (confirm(`Change status to ${newStatus}?`)) {
            await onUpdate(request.id, { status: newStatus });
        }
    };

    const handleAddItem = async () => {
        if (!selectedProductId || quantity <= 0) return;
        const product = products.find(p => p.id === selectedProductId);
        const supplier = suppliers.find(s => s.id === selectedSupplierId);

        await onAddItem({
            item_id: selectedProductId,
            item_code: product?.item_code,
            part_number: product?.part_number,
            description: product?.description || product?.name,
            quantity: quantity,
            unit_cost: product?.cost || 0,
            supplier_id: selectedSupplierId || null,
            supplier_name: supplier?.company || null
        });

        setShowAddItem(false);
        setSelectedProductId('');
        setQuantity(1);
        setSelectedSupplierId('');
    };

    const handleEditItem = async (itemId: string, field: keyof PurchaseRequestItem, value: any) => {
        await onUpdateItem(itemId, { [field]: value });
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-950 p-4 h-full overflow-y-auto">
            <div className="space-y-6">
                {/* Header Card */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                {request.pr_number}
                                <span className={`px-2 py-0.5 text-sm rounded border ${request.status === 'Approved' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600'}`}>
                                    {request.status}
                                </span>
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Request Date: {new Date(request.request_date || '').toLocaleDateString()}</p>
                            {request.reference_no && <p className="text-slate-500 text-sm">Ref: {request.reference_no}</p>}
                            {request.notes && <p className="text-slate-600 text-sm mt-2 italic">"{request.notes}"</p>}
                        </div>

                        <div className="flex flex-col gap-2 items-end">
                            <button onClick={onBack} className="text-sm underline text-slate-500 mb-2">Back to List</button>
                            <div className="flex gap-2">
                                <button onClick={onPrint} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"><Printer size={16} /> Print</button>

                                {request.status === 'Draft' && (
                                    <button onClick={() => handleStatusChange('Pending')} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 shadow-sm">Submit</button>
                                )}

                                {request.status === 'Pending' && isApprover && (
                                    <button onClick={() => handleStatusChange('Approved')} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"><CheckCircle size={16} /> Approve</button>
                                )}

                                {request.status === 'Approved' && (
                                    <button onClick={onConvert} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"><FileOutput size={16} /> Convert to PO</button>
                                )}

                                {['Draft', 'Pending'].includes(request.status || '') && (
                                    <button onClick={() => handleStatusChange('Cancelled')} className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"><XCircle size={16} /> Cancel</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Card */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-bold text-slate-800 dark:text-white">Items</h3>
                        {request.status === 'Draft' && (
                            <button onClick={() => setShowAddItem(true)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1"><Plus size={14} /> Add Item</button>
                        )}
                    </div>

                    {showAddItem && (
                        <div className="p-4 bg-blue-50 border-b border-blue-100 grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                                <label className="text-xs font-semibold">Product</label>
                                <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full text-sm rounded border-gray-300">
                                    <option value="">Select...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.part_number} - {p.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-semibold">Qty</label>
                                <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full text-sm rounded border-gray-300" />
                            </div>
                            <div className="col-span-3">
                                <label className="text-xs font-semibold">Supplier</label>
                                <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full text-sm rounded border-gray-300">
                                    <option value="">Preferred...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 flex gap-1">
                                <button onClick={handleAddItem} className="flex-1 bg-blue-600 text-white rounded text-sm py-1.5">Add</button>
                                <button onClick={() => setShowAddItem(false)} className="flex-1 bg-white border rounded text-sm py-1.5">Cancel</button>
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
                                            {request.status === 'Draft' ? (
                                                <input
                                                    type="number"
                                                    className="w-16 text-center border rounded p-1"
                                                    value={item.quantity}
                                                    onChange={e => handleEditItem(item.id, 'quantity', Number(e.target.value))}
                                                />
                                            ) : item.quantity}
                                        </td>
                                        <td className="px-6 py-3">
                                            {request.status === 'Draft' ? (
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
                                            {request.status === 'Draft' && (
                                                <button onClick={() => onDeleteItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseRequestView;
