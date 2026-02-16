import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, Loader2, Package, AlertCircle, X, Check } from 'lucide-react';
import { Product } from '../types';
import { searchProducts } from '../services/productService';
import { useDebounce } from '../hooks/useDebounce';

interface ProductSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
}

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [noResults, setNoResults] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const debouncedQuery = useDebounce(query, 300);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(-1);
            setNoResults(false);
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
                                                <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                                    ₱{product.price_aa?.toFixed(2)}
                                                </span>
                                            </div>

                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1.5 line-clamp-2">
                                                {highlightMatch(product.description, query)}
                                            </p>

                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    Code: <span className="font-mono text-slate-700 dark:text-slate-300">{highlightMatch(product.item_code, query)}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    Stock: <span className={`font-medium ${(product.stock_wh1 || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {(product.stock_wh1 || 0) + (product.stock_wh2 || 0) + (product.stock_wh3 || 0)}
                                                    </span>
                                                </span>
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
