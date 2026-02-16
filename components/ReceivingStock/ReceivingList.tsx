import React from 'react';
import { ReceivingReportWithDetails, RR_STATUS_COLORS } from '../../receiving.types';
import { ExternalLink, Calendar, FileText, User } from 'lucide-react';

interface ReceivingListProps {
    rrs: ReceivingReportWithDetails[];
    onView: (id: string) => void;
}

const ReceivingList: React.FC<ReceivingListProps> = ({ rrs, onView }) => {
    if (rrs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No receiving reports found</p>
                <p className="text-sm">Create a new one to get started</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="px-6 py-4">RR Number</th>
                        <th className="px-6 py-4">Date Received</th>
                        <th className="px-6 py-4">Supplier</th>
                        <th className="px-6 py-4">PO Reference</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {rrs.map((rr) => (
                        <tr
                            key={rr.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                            onClick={() => onView(rr.id)}
                        >
                            <td className="px-6 py-4">
                                <span className="font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                                    {rr.rr_no}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {new Date(rr.receive_date).toLocaleDateString()}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    {rr.supplier_name || 'N/A'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                                {rr.po_no ? (
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-700">
                                        {rr.po_no}
                                    </span>
                                ) : (
                                    '-'
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${RR_STATUS_COLORS[rr.status || 'Draft'] || 'bg-gray-100 text-gray-800 border-gray-200'
                                    // Note: RR_STATUS_COLORS defined with bg and text classes. Border usually needs separate handling or removal if bg is sufficient.
                                    // I'll stick to the classes provided in types, adding border-transparent to be safe.
                                    }`}>
                                    {rr.status || 'Draft'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onView(rr.id);
                                    }}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ReceivingList;
