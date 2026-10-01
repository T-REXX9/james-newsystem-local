import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, Loader2, Package, AlertCircle, X, Check } from 'lucide-react';
import type { Product, UserProfile } from '../types';
import { searchProducts } from '../services/productLocalApiService';
import { useDebounce } from '../hooks/useDebounce';
import { getCentralStock } from '../utils/productStock';
import { canExportProductImages, isSalesAgentUser } from '../utils/productImageExportAccess';
import ProductImageExportActions from './ProductImageExportActions';

interface ProductSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
    customerName?: string;
    assignedAgentId?: string;
    currentUser?: UserProfile | null;
}

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ isOpen, onClose, onSelect, customerName = '', assignedAgentId, currentUser = null }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [noResults, setNoResults] = useState(false);
    const [exportSelection, setExportSelection] = useState<Map<string, Product>>(() => new Map());
    const inputRef = useRef<HTMLInputElement>(null);

    const debouncedQuery = useDebounce(query, 300);
    const canExport = canExportProductImages(currentUser, assignedAgentId);
    const isUnassignedSalesAgent = Boolean(currentUser?.id && isSalesAgentUser(currentUser) && !canExport);
    const selectedExportProducts = Array.from(exportSelection.values());

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(-1);
            setNoResults(false);
            setExportSelection(new Map());
            // Fetch default results immediately on open
            searchProducts('').then(data => setResults(data));

            // Focus input after a small delay to ensure render
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Search effect
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const data = await searchProducts(debouncedQuery);
                setResults(data);
                setNoResults(data.length === 0);
                setSelectedIndex(-1);
            } catch (error) {
                console.error('Error searching products:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchProducts();
        }
    }, [debouncedQuery, isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && results[selectedIndex]) {
                onSelect(results[selectedIndex]);
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // Highlight helper
    const highlightMatch = (text: string, query: string) => {
        if (!text) return '';
        if (!query) return text;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <span key={i} className="bg-brand-blue/20 text-brand-blue font-bold rounded px-0.5">{part}</span>
                    ) : part
                )}
            </span>
        );
    };

    const getMatchLabel = (product: Product): string => {
        const q = query.toLowerCase();
        if (product.part_no.toLowerCase().includes(q)) return 'Part No';
        if (product.item_code.toLowerCase().includes(q)) return 'Item Code';
        if (product.description.toLowerCase().includes(q)) return 'Description';
        return 'Product';
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">

                {/* Header / Search */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                        placeholder="Search products..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                    />
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Loading Bar */}
                {loading && (
                    <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-brand-blue animate-progress origin-left" style={{ width: '50%' }}></div>
                    </div>
                )}

                {/* Results List */}
                <div className="flex-1 overflow-y-auto min-h-[300px] p-2">
                    {results.length > 0 ? (
                        <ul className="space-y-1">
                            {results.map((product, index) => {
                                const isSelected = index === selectedIndex;
                                const matchType = getMatchLabel(product);

                                return (
                                    <li
                                        key={product.id}
                                        className={`group flex items-start gap-4 p-3 rounded-lg cursor-pointer transition-all ${isSelected
                                                ? 'bg-brand-blue/5 ring-1 ring-brand-blue/20'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        onClick={() => {
                                            onSelect(product);
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        {canExport && product.recordImage?.trim() && (
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${product.description || product.part_no} image for export`}
                                                checked={exportSelection.has(product.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => setExportSelection((current) => {
                                                    const next = new Map(current);
                                                    if (event.target.checked) next.set(product.id, product); else next.delete(product.id);
                                                    return next;
                                                })}
                                                className="mt-2 h-4 w-4 shrink-0 accent-blue-700"
                                            />
                                        )}
                                        <div className={`mt-1 p-2 rounded-lg ${isSelected ? 'bg-brand-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                            <Package className="h-5 w-5" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                                        {highlightMatch(product.part_no, query)}
                                                    </span>
                                                    {matchType !== 'Product' && query && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                            via {matchType}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1.5 line-clamp-2">
                                                {highlightMatch(product.description, query)}
                                            </p>

                                            {product.application && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 line-clamp-2">
                                                    <span className="font-medium text-slate-600 dark:text-slate-300">Application:</span>{' '}
                                                    {highlightMatch(product.application, query)}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    Brand: <span className="font-medium text-slate-700 dark:text-slate-300">{product.brand || '—'}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    Code: <span className="font-mono text-slate-700 dark:text-slate-300">{highlightMatch(product.item_code, query)}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    Stock: <span className={`font-medium ${getCentralStock(product) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {getCentralStock(product)}
                                                    </span>
                                                </span>
                                            </div>

                                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                                {[
                                                    ['VIP 1', product.price_vip1],
                                                    ['VIP 2', product.price_vip2],
                                                    ['VIP 3', product.price_vip3],
                                                ].map(([label, amount]) => (
                                                    <div key={label} className="rounded bg-slate-50 px-2 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        <div className="font-medium">{label}</div>
                                                        <div className="font-mono font-semibold text-slate-900 dark:text-white">₱{Number(amount || 0).toFixed(2)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="self-center pr-2">
                                                <Check className="h-4 w-4 text-brand-blue" />
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                            {noResults ? (
                                <>
                                    <AlertCircle className="h-12 w-12 mb-3 text-slate-200 dark:text-slate-700" />
                                    <p className="text-sm">No products found for "{query}"</p>
                                </>
                            ) : (
                                <p className="text-sm">Start typing to search products...</p>
                            )}
                        </div>
                    )}
                </div>

                {canExport && selectedExportProducts.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs text-slate-600 dark:text-slate-300">{selectedExportProducts.length} product image{selectedExportProducts.length === 1 ? '' : 's'} selected</span>
                            <ProductImageExportActions products={selectedExportProducts} customerName={customerName || 'product'} compact />
                        </div>
                        <ul aria-label="Selected product images" className="flex max-h-14 flex-wrap gap-1.5 overflow-y-auto">
                            {selectedExportProducts.map((product) => (
                                <li key={product.id} className="flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    <span className="max-w-40 truncate">{product.description || product.part_no || product.item_code}</span>
                                    <button type="button" aria-label={`Remove ${product.description || product.part_no || product.item_code} from image export`} onClick={() => setExportSelection((current) => {
                                        const next = new Map(current);
                                        next.delete(product.id);
                                        return next;
                                    })} className="rounded-full px-1.5 py-0.5 font-bold text-slate-500 hover:bg-slate-200">×</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {isUnassignedSalesAgent && (
                    <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">Select a customer assigned to you in Sales Inquiry to export product images.</p>
                )}

                {/* Footer Legend */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 rounded-b-xl flex justify-between text-xs text-slate-400">
                    <div>
                        Showing top 50 results
                    </div>
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><kbd className="font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1">↑↓</kbd> Navigate</span>
                        <span className="flex items-center gap-1"><kbd className="font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1">↵</kbd> Select</span>
                        <span className="flex items-center gap-1"><kbd className="font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1">Esc</kbd> Close</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProductSearchModal;
