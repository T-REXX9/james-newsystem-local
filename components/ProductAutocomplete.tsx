import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Search, Loader2, Package, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { searchProducts } from '../services/productService';
import { useDebounce } from '../hooks/useDebounce';

interface ProductAutocompleteProps {
    onSelect: (product: Product) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
    onSelect,
    placeholder = "Search by Part No, Item Code, or Description...",
    className = "",
    autoFocus = false
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [noResults, setNoResults] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    // Debounce query to avoid too many requests
    const debouncedQuery = useDebounce(query, 300);

    // Calculate position
    const updatePosition = useCallback(() => {
        if (inputRef.current && showDropdown) {
            const rect = inputRef.current.getBoundingClientRect();
            // We use fixed positioning linked to the input
            setDropdownStyle({
                position: 'fixed',
                top: `${rect.bottom + 4}px`,
                left: `${rect.left}px`,
                width: `${Math.max(rect.width, 300)}px`, // Min width 300px
                maxHeight: '320px',
                zIndex: 9999, // Ensure it's on top
            });
        }
    }, [showDropdown]);

    // Handle scroll/resize to update position
    useEffect(() => {
        if (showDropdown) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true); // Capture phase for all scroll containers
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [showDropdown, updatePosition]);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check if click is inside wrapper (input)
            if (wrapperRef.current && wrapperRef.current.contains(target)) {
                return;
            }

            // Check if click is inside dropdown (in portal)
            const dropdownEl = document.getElementById('product-autocomplete-dropdown');
            if (dropdownEl && dropdownEl.contains(target)) {
                return;
            }

            setShowDropdown(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Effect for searching
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                // We now allow empty query to fetch default products
                const data = await searchProducts(debouncedQuery);
                setResults(data);
                setNoResults(data.length === 0);

                if (data.length > 0) {
                    setShowDropdown(true);
                    requestAnimationFrame(updatePosition);
                }
                setSelectedIndex(-1);
            } catch (error) {
                console.error('Error in autocomplete search:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [debouncedQuery, updatePosition]);

    // Focus management
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && results[selectedIndex]) {
                handleSelect(results[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const handleSelect = (product: Product) => {
        onSelect(product);
        setQuery('');
        setShowDropdown(false);
        setResults([]);
        // Optionally keep focus or move to next field - let parent handle via onSelect side effects
    };

    // Helper to highlight matching text
    const highlightMatch = (text: string, query: string) => {
        if (!text) return '';
        if (!query) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <span key={i} className="bg-brand-blue/20 text-brand-blue font-bold rounded px-0.5">
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </span>
        );
    };

    // Determine which field matched best or is being typed
    const getMatchLabel = (product: Product): string => {
        const q = query.toLowerCase();

        if (product.part_no.toLowerCase().includes(q)) return 'Part No';
        if (product.item_code.toLowerCase().includes(q)) return 'Item Code';
        if (product.description.toLowerCase().includes(q)) return 'Description';

        return 'Product';
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 text-brand-blue animate-spin" />
                    ) : (
                        <Search className="h-3.5 w-3.5 text-slate-400" />
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className="block w-full pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue sm:text-xs transition-shadow"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        // Trigger search on focus if we don't have results yet, or just show dropdown
                        if (results.length === 0) {
                            searchProducts('').then(data => {
                                setResults(data);
                                setShowDropdown(true);
                                requestAnimationFrame(updatePosition);
                            });
                        } else {
                            setShowDropdown(true);
                            requestAnimationFrame(updatePosition);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded border border-slate-200 dark:border-slate-600">
                        /
                    </span>
                </div>
            </div>

            {showDropdown && ReactDOM.createPortal(
                <div
                    id="product-autocomplete-dropdown"
                    className="fixed bg-white dark:bg-slate-900 shadow-xl rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-slate-200 dark:border-slate-700"
                    style={dropdownStyle}
                >
                    {/* Header Legend */}
                    <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Result Matches</span>
                        <span className="flex items-center gap-2">
                            <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↓</kbd> Navigate</span>
                            <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↵</kbd> Select</span>
                        </span>
                    </div>

                    {results.length > 0 ? (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {results.map((product, index) => {
                                const isSelected = index === selectedIndex;
                                const matchType = getMatchLabel(product);

                                return (
                                    <li
                                        key={product.id}
                                        className={`cursor-pointer select-none relative py-2 pl-3 pr-4 group transition-colors ${isSelected
                                            ? 'bg-brand-blue/10 dark:bg-brand-blue/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        onClick={() => handleSelect(product)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 p-1.5 rounded ${isSelected ? 'bg-brand-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-bold font-mono ${isSelected ? 'text-brand-blue' : 'text-slate-900 dark:text-white'}`}>
                                                        {highlightMatch(product.part_no, query)}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${matchType === 'Part No' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                        matchType === 'Item Code' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
                                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                        Matched by {matchType}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                    {highlightMatch(product.description, query)}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="uppercase">Code:</span>
                                                        <span className="font-mono text-slate-600 dark:text-slate-300">{highlightMatch(product.item_code, query)}</span>
                                                    </span>
                                                    <span>•</span>
                                                    <span>Stock: {
                                                        (product.stock_wh1 || 0) +
                                                        (product.stock_wh2 || 0) +
                                                        (product.stock_wh3 || 0) +
                                                        (product.stock_wh4 || 0) +
                                                        (product.stock_wh5 || 0) +
                                                        (product.stock_wh6 || 0)
                                                    }</span>
                                                    <span>•</span>
                                                    <span>Base Price: ₱{product.price_aa?.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : noResults ? (
                        <div className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
                            <div className="flex justify-center mb-2">
                                <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-sm font-medium">No products found</p>
                            <p className="text-xs mt-1">Try searching by part number, description, or item code.</p>
                        </div>
                    ) : null}
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProductAutocomplete;
