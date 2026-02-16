import React from 'react';
import { PurchaseRequestWithItems } from '../../purchaseRequest.types';
import { Printer, XCircle } from 'lucide-react';

interface PurchaseRequestPrintProps {
    request: PurchaseRequestWithItems;
    onClose: () => void;
}

const PurchaseRequestPrint: React.FC<PurchaseRequestPrintProps> = ({ request, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/50 flex justify-center py-8 print:p-0 print:bg-white print:fixed print:inset-0">
            <div className="bg-white p-8 max-w-4xl w-full mx-auto border shadow-lg relative print:shadow-none print:border-none">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 print:hidden">
                    <XCircle size={24} />
                </button>

                <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
                    <div>
                        <h1 className="text-3xl font-bold uppercase">Purchase Request</h1>
                        <p className="mt-1 font-mono text-lg">{request.pr_number}</p>
                        <p>Date: {new Date(request.request_date || '').toLocaleDateString()}</p>
                        <p className="text-sm">Status: {request.status}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold">TND OPC</h2>
                        <p>Taguig City</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Requested By</h3>
                        <p>Staff (ID: {request.created_by?.slice(0, 8) || 'Unknown'})</p>
                        {request.notes && <p className="mt-2 text-sm italic">Note: {request.notes}</p>}
                    </div>
                    <div>
                        <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Details</h3>
                        <p>Ref: {request.reference_no || 'N/A'}</p>
                        <p>Total Items: {request.items?.length || 0}</p>
                    </div>
                </div>

                <table className="w-full text-sm border-collapse mb-8">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="text-left py-1">Qty</th>
                            <th className="text-left py-1">Part No</th>
                            <th className="text-left py-1">Description</th>
                            <th className="text-left py-1">Supplier</th>
                            <th className="text-right py-1">Cost Est.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {request.items?.map((item, i) => (
                            <tr key={i} className="border-b border-gray-100">
                                <td className="py-2">{item.quantity}</td>
                                <td className="py-2 font-bold">{item.part_number}</td>
                                <td className="py-2">{item.description}</td>
                                <td className="py-2">{item.supplier_name || '-'}</td>
                                <td className="py-2 text-right">{item.unit_cost ? item.unit_cost.toFixed(2) : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="mt-12 grid grid-cols-2 gap-16 text-sm">
                    <div>
                        <p className="mb-8 font-bold">Requested By:</p>
                        <div className="border-b border-black"></div>
                    </div>
                    <div>
                        <p className="mb-8 font-bold">Approved By:</p>
                        <div className="border-b border-black"></div>
                    </div>
                </div>

                <div className="mt-8 flex justify-center print:hidden">
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700">
                        <Printer size={18} /> Print Now
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PurchaseRequestPrint;
