import React, { useMemo } from 'react';
import { Search, Calendar, Package, ArrowRightLeft } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { SupplierReturn } from '../../returnToSupplier.types';

interface ReturnToSupplierListProps {
    returns: SupplierReturn[];
    selectedId: string | null;
    onSelect: (r: SupplierReturn) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    statusFilter: string;
    onStatusFilterChange: (status: string) => void;
    loading: boolean;
}

const ReturnToSupplierList: React.FC<ReturnToSupplierListProps> = ({
    returns,
    selectedId,
    onSelect,
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    loading
}) => {
    const filteredReturns = useMemo(() => {
        const query = searchTerm.toLowerCase();
        return returns.filter(r => {
            const matchStatus = statusFilter === 'all' || r.status === statusFilter;
            const matchSearch =
                !query ||
                r.return_no.toLowerCase().includes(query) ||
                r.supplier_name.toLowerCase().includes(query) ||
                (r.remarks && r.remarks.toLowerCase().includes(query));
            return matchStatus && matchSearch;
        });
    }, [returns, searchTerm, statusFilter]);

    if (loading && returns.length === 0) {
        return <div className="p-4 text-center text-gray-500">Loading returns...</div>;
    }

    if (filteredReturns.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <ArrowRightLeft className="w-10 h-10 mb-2 opacity-20" />
                <p>No returns found</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {filteredReturns.map((r) => (
                <div
                    key={r.id}
                    onClick={() => onSelect(r)}
                    className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${selectedId === r.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                >
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                                {r.return_no}
                            </div>
                            <div className="text-xs text-brand-blue font-medium mt-0.5">
                                {r.supplier_name}
                            </div>
                        </div>
                        <StatusBadge
                            status={r.status.toLowerCase()}
                            label={r.status}
                            tone={r.status === 'Posted' ? 'success' : r.status === 'Pending' ? 'neutral' : 'warning'}
                        />
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {new Date(r.return_date).toLocaleDateString()}
                            </div>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                ₱{r.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReturnToSupplierList;
