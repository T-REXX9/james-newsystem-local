import React from 'react';
import { PurchaseRequestWithItems } from '../../purchaseRequest.types';
import { Filter, Plus, Search, RefreshCw } from 'lucide-react';

interface PurchaseRequestListProps {
    requests: PurchaseRequestWithItems[];
    loading: boolean;
    onSelect: (pr: PurchaseRequestWithItems) => void;
    onCreate: () => void;
    filterStatus: string;
    setFilterStatus: (s: string) => void;
    searchTerm: string;
    setSearchTerm: (s: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-800',
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Approved: 'bg-green-100 text-green-800 border-green-200',
    Submitted: 'bg-blue-100 text-blue-800 border-blue-200',
    Cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const PurchaseRequestList: React.FC<PurchaseRequestListProps> = ({
    requests,
    loading,
    onSelect,
    onCreate,
    filterStatus,
    setFilterStatus,
    searchTerm,
    setSearchTerm
}) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950">
            {/* Header / Toolbar */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="p-2 rounded bg-white/10"><Filter className="w-5 h-5" /></span>
                    <div>
                        <h1 className="text-lg font-semibold">Purchase Requests</h1>
                        <p className="text-xs text-slate-300">Manage internal procurement requests</p>
                    </div>
                </div>
                <button onClick={onCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors">
                    <Plus size={16} /> New Request
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar List */}
                <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 px-2 py-1 round border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                                className="flex-1 text-xs bg-transparent outline-none p-1"
                                placeholder="Search PR #..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded px-2 py-1 bg-slate-50 dark:bg-slate-800"
                        >
                            <option value="">All Statuses</option>
                            <option value="Draft">Draft</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Submitted">Submitted PO</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {loading && <div className="p-4 text-center text-xs text-slate-500"><RefreshCw className="animate-spin inline mr-2" /> Loading...</div>}
                        {!loading && requests.length === 0 && <div className="p-4 text-center text-xs text-slate-500">No requests found.</div>}

                        {!loading && requests.map(pr => (
                            <button
                                key={pr.id}
                                onClick={() => onSelect(pr)}
                                className="w-full text-left p-3 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{pr.pr_number}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[pr.status || 'Draft']}`}>
                                        {pr.status}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>{new Date(pr.request_date || '').toLocaleDateString()}</span>
                                    <span>{pr.items?.length || 0} items</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Placeholder for no selection (Mobile/Desktop logic might vary but following POView pattern) */}
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-950">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p>Select a Purchase Request to view details</p>
                </div>
            </div>
        </div>
    );
};

export default PurchaseRequestList;
