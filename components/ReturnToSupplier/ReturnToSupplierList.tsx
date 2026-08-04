import React, { useMemo } from 'react';
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
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    return (
        <table className="w-full border-collapse text-left text-sm">
            <thead><tr className="border-b-2 border-[#ddd]"><th className="px-2 py-3">Date</th><th className="px-2 py-3">RS No.</th><th className="px-2 py-3">RR No.</th><th className="px-2 py-3">Supplier</th><th className="px-2 py-3">Amount</th><th className="px-2 py-3">Status</th></tr></thead>
            <tbody>
            {filteredReturns.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">No records found.</td></tr>}
            {filteredReturns.map(r => (
                <tr key={r.id} onClick={() => onSelect(r)} className={`cursor-pointer border-b border-[#e5e5e5] hover:bg-[#f5f5f5] ${selectedId === r.id ? 'bg-[#eef6fb]' : ''}`}>
                    <td className="px-2 py-3">{new Date(r.return_date).toLocaleDateString()}</td>
                    <td className="px-2 py-3 font-semibold text-[#337ab7]">{r.return_no}</td>
                    <td className="px-2 py-3">{r.rr_no || '-'}</td>
                    <td className="px-2 py-3">{r.supplier_name || '-'}</td>
                    <td className="px-2 py-3">{r.grand_total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-2 py-3"><StatusBadge status={r.status.toLowerCase()} label={r.status} tone={r.status === 'Posted' ? 'success' : 'neutral'} /></td>
                </tr>
            ))}</tbody>
        </table>
    );
};

export default ReturnToSupplierList;
