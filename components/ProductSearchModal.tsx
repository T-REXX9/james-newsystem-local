import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, Search, X } from 'lucide-react';
import type { Product, UserProfile } from '../types';
import { searchSalesInquiryProducts } from '../services/productLocalApiService';
import { getCentralStock } from '../utils/productStock';
import { canExportProductImages, isSalesAgentUser } from '../utils/productImageExportAccess';
import ProductImageExportActions from './ProductImageExportActions';
import SearchableSelect from './SearchableSelect';

interface ProductSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
    customerName?: string;
    assignedAgentId?: string;
    currentUser?: UserProfile | null;
}

type SearchFields = { part_no: string; item_code: string; description: string; application: string; original_pn: string };
const emptySearchFields: SearchFields = { part_no: '', item_code: '', description: '', application: '', original_pn: '' };
const searchInputs: Array<{ key: keyof SearchFields; label: string; placeholder: string }> = [
    { key: 'part_no', label: 'Part No.', placeholder: 'Search Part No.' },
    { key: 'item_code', label: 'Item Code', placeholder: 'Search Item Code' },
    { key: 'description', label: 'Description', placeholder: 'Search Item Description' },
    { key: 'application', label: 'Application', placeholder: 'Search Item Application' },
    { key: 'original_pn', label: 'Original P/N', placeholder: 'Search Original P/N' },
];

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ isOpen, onClose, onSelect, customerName = '', assignedAgentId, currentUser = null }) => {
    const [fields, setFields] = useState<SearchFields>(emptySearchFields);
    const [results, setResults] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [exportSelection, setExportSelection] = useState<Map<string, Product>>(() => new Map());
    const searchRequestId = useRef(0);

    const canExport = canExportProductImages(currentUser, assignedAgentId);
    const isUnassignedSalesAgent = Boolean(currentUser?.id && isSalesAgentUser(currentUser) && !canExport);
    const selectedExportProducts = Array.from(exportSelection.values());

    useEffect(() => {
        if (!isOpen) {
            searchRequestId.current += 1;
            return;
        }
        setFields(emptySearchFields);
        setResults([]);
        setSelectedProduct(null);
        setHasSearched(false);
        setSearchError('');
        setLoading(false);
        setExportSelection(new Map());
        return () => { searchRequestId.current += 1; };
    }, [isOpen]);

    const runSearch = useCallback(async () => {
        const requestId = ++searchRequestId.current;
        setLoading(true);
        setSearchError('');
        setSelectedProduct(null);
        setHasSearched(true);
        try {
            const data = await searchSalesInquiryProducts('', fields);
            if (requestId === searchRequestId.current) setResults(data);
        } catch (error) {
            if (requestId === searchRequestId.current) {
                console.error('Error searching products:', error);
                setResults([]);
                setSearchError(error instanceof Error ? error.message : 'Unable to search products. Please try again.');
            }
        } finally {
            if (requestId === searchRequestId.current) setLoading(false);
        }
    }, [fields]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { searchRequestId.current += 1; onClose(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleClose = () => {
        searchRequestId.current += 1;
        onClose();
    };

    const handleSelect = () => {
        if (!selectedProduct) return;
        onSelect(selectedProduct);
        handleClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="product-search-title" className="relative flex h-[82vh] max-h-[760px] min-h-[min(560px,70vh)] w-full max-w-[1210px] flex-col overflow-hidden rounded-[5px] bg-white shadow-2xl">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd] px-4 py-3 sm:px-5">
                    <h2 id="product-search-title" className="text-[18px] font-semibold text-[#333]">Inquire Product</h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => void runSearch()} disabled={loading} className="rounded-[4px] border border-[#ccc] bg-white px-3 py-1.5 text-[13px] hover:bg-[#f5f5f5] disabled:opacity-50"><span className="inline-flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />Search</span></button>
                        <button type="button" disabled={loading} onClick={() => { setFields(emptySearchFields); setResults([]); setSelectedProduct(null); setHasSearched(false); setSearchError(''); }} className="rounded-[4px] border border-[#ccc] bg-white px-3 py-1.5 text-[13px] hover:bg-[#f5f5f5]">Refresh</button>
                        <button type="button" aria-label="Close product search" onClick={handleClose} className="rounded p-1 text-[#777] hover:bg-[#eee] hover:text-[#333]"><X className="h-5 w-5" /></button>
                    </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
                    <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {searchInputs.map(({ key, label, placeholder }) => (
                            <label key={key} className="grid min-w-0 grid-cols-1 items-center gap-1.5 sm:grid-cols-[105px_minmax(0,1fr)]">
                                <span className="text-[13px] text-[#333]">{label}</span>
                                <SearchableSelect value="" options={[]} onChange={() => undefined} inputOnly disabled={loading} inputValue={fields[key]} onInputChange={(value) => setFields((current) => ({ ...current, [key]: value }))} inputAriaLabel={`Search by ${label}`} searchPlaceholder={placeholder} searchInputClassName="h-[34px] rounded-[4px] border-[#ccc] py-1.5 text-[13px] focus:border-[#66afe9] focus:ring-[#66afe9]/20" />
                            </label>
                        ))}
                    </form>

                    {loading && <p className="py-3 text-center text-[13px] text-[#666]" role="status">Loading products...</p>}
                    {searchError && <p className="flex items-center justify-center gap-2 py-5 text-[13px] text-rose-700" role="alert"><AlertCircle className="h-4 w-4" />{searchError}</p>}
                    <div className="mt-4 min-h-[240px] flex-1 overflow-auto border border-[#ddd]">
                        <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
                            <thead className="sticky top-0 z-10 bg-[#f5f5f5] text-[#333] shadow-sm">
                                <tr>{canExport && <th className="border-b border-[#ccc] px-2 py-2" aria-label="Export selection" />}{['Part No.', 'Item Code', 'Description', 'Brand', 'Application', 'Reorder Qty', 'VIP 1', 'VIP 2', 'VIP 3', 'Stock'].map((heading) => <th key={heading} className="border-b border-[#ccc] px-2.5 py-2 font-semibold">{heading}</th>)}</tr>
                            </thead>
                            <tbody>
                                {results.map((product) => {
                                    const isSelected = selectedProduct?.id === product.id;
                                    return <tr key={product.id} tabIndex={0} onClick={() => setSelectedProduct(product)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedProduct(product); } }} aria-selected={isSelected} className={`cursor-pointer border-b border-[#e5e5e5] ${isSelected ? 'bg-[#eaf3ff] text-[#1d4ed8]' : 'hover:bg-[#f7faff]'}`}>
                                        {canExport && <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>{product.recordImage?.trim() && <input type="checkbox" aria-label={`Select ${product.description || product.part_no} image for export`} checked={exportSelection.has(product.id)} onChange={(event) => setExportSelection((current) => { const next = new Map(current); if (event.target.checked) next.set(product.id, product); else next.delete(product.id); return next; })} className="h-4 w-4 accent-blue-700" />}</td>}
                                        <td className="px-2.5 py-2 font-semibold">{product.part_no || '—'}</td><td className="px-2.5 py-2">{product.item_code || '—'}</td><td className="min-w-[180px] px-2.5 py-2">{product.description || '—'}{product.original_pn_no && <div className="mt-1 text-[11px] text-[#666]"><b>ORIG P/N No:</b> {product.original_pn_no}</div>}</td><td className="px-2.5 py-2">{product.brand || '—'}</td><td className="min-w-[150px] px-2.5 py-2">{product.application || '—'}</td><td className="px-2.5 py-2 text-right">{product.reorder_quantity ?? '—'}</td><td className="px-2.5 py-2 text-right">₱{Number(product.price_vip1 || 0).toFixed(2)}</td><td className="px-2.5 py-2 text-right">₱{Number(product.price_vip2 || 0).toFixed(2)}</td><td className="px-2.5 py-2 text-right">₱{Number(product.price_vip3 || 0).toFixed(2)}</td><td className="px-2.5 py-2 text-right">{getCentralStock(product)}</td>
                                    </tr>;
                                })}
                                {results.length === 0 && <tr><td colSpan={canExport ? 11 : 10} className="px-3 py-8 text-center text-[#777]">{searchError ? '' : loading ? 'Loading products...' : hasSearched ? 'No Record Found' : 'Enter one or more product filters, then select Search.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {canExport && selectedExportProducts.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ddd] px-4 py-3"><span className="text-xs text-slate-600">{selectedExportProducts.length} product image{selectedExportProducts.length === 1 ? '' : 's'} selected</span><ProductImageExportActions products={selectedExportProducts} customerName={customerName || 'product'} compact /></div>}
                {isUnassignedSalesAgent && <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">Select a customer assigned to you in Sales Inquiry to export product images.</p>}
                <footer className="flex justify-end gap-2 border-t border-[#ddd] bg-[#fafafa] px-4 py-3 sm:px-5">
                    <button type="button" onClick={handleClose} className="rounded-[4px] border border-[#ccc] bg-white px-4 py-2 text-[13px] hover:bg-[#f5f5f5]">Close</button>
                    <button type="button" onClick={handleSelect} disabled={!selectedProduct} className="rounded-[4px] bg-[#337ab7] px-4 py-2 text-[13px] text-white hover:bg-[#286090] disabled:cursor-not-allowed disabled:opacity-50">ADD SELECTED</button>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default ProductSearchModal;
