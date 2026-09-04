import React from 'react';
import { ReceivingReportWithDetails, RR_STATUS_COLORS } from '../../receiving.types';
import ModuleRecordLink from '../ModuleRecordLink';

interface ReceivingListProps {
    rrs: ReceivingReportWithDetails[];
    onView: (id: string) => void;
}

const ReceivingList: React.FC<ReceivingListProps> = ({ rrs, onView }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
                <thead>
                    <tr className="border-b-2 border-[#ddd] font-semibold">
                        <th className="px-2 py-3">Date</th>
                        <th className="px-2 py-3">RR No.</th>
                        <th className="px-2 py-3">PO No.</th>
                        <th className="px-2 py-3">Supplier</th>
                        <th className="px-2 py-3">Delivery</th>
                        <th className="px-2 py-3">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rrs.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">No records found.</td></tr>}
                    {rrs.map((rr) => (
                        <tr key={rr.id} className="cursor-pointer border-b border-[#e5e5e5] hover:bg-[#f5f5f5]" onClick={() => onView(rr.id)}>
                            <td className="px-2 py-3">{new Date(rr.receive_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                            <td className="px-2 py-3 font-semibold text-[#337ab7]">
                                <ModuleRecordLink tab="warehouse-purchasing-receiving-stock" payload={{ rrId: rr.id, rrRefNo: rr.rr_no }} onOpen={() => onView(rr.id)}>
                                    {rr.rr_no}
                                </ModuleRecordLink>
                            </td>
                            <td className="px-2 py-3">{rr.po_no || '-'}</td>
                            <td className="px-2 py-3">{rr.supplier_name || '-'}</td>
                            <td className="px-2 py-3 text-xs">
                                <span className="block font-bold text-indigo-700">{rr.cycle_status || 'Complete Delivery'}</span>
                                <span className="text-slate-600">Ordered {Number(rr.ordered_qty ?? rr.total_qty ?? 0)} · Received {Number(rr.received_qty ?? rr.total_qty ?? 0)} · Left {Number(rr.remaining_qty ?? 0)}</span>
                            </td>
                            <td className="px-2 py-3">
                                <span className={`rounded border px-2 py-1 text-xs font-semibold ${RR_STATUS_COLORS[rr.status || 'Draft'] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                    {rr.status || 'Draft'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ReceivingList;
