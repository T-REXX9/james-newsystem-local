import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SearchableSelectOption {
    value: string;
    label: string;
    keywords?: string[];
}

interface SearchableSelectProps {
    value: string;
    options: SearchableSelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
    buttonClassName?: string;
    dropdownClassName?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    value,
    options,
    onChange,
    placeholder = 'Select an option',
    searchPlaceholder = 'Search...',
    disabled = false,
    className = '',
    buttonClassName = '',
    dropdownClassName = '',
}) => {
    const selectId = useId().replace(/:/g, '-');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value) ?? null,
        [options, value]
    );

    const filteredOptions = useMemo(() => {
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery) {
            return options;
        }

        return options.filter((option) => {
            const haystack = [option.label, option.value, ...(option.keywords ?? [])]
                .join(' ')
                .toLowerCase();
            return haystack.includes(trimmedQuery);
        });
    }, [options, query]);

    const updatePosition = useCallback(() => {
        if (!buttonRef.current || !isOpen) return;

        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: 'fixed',
            top: `${rect.bottom + 6}px`,
            left: `${rect.left}px`,
            width: `${Math.max(rect.width, 220)}px`,
            zIndex: 9999,
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (wrapperRef.current?.contains(target)) {
                return;
            }

            const dropdown = document.getElementById(`${selectId}-dropdown`);
            if (dropdown?.contains(target)) {
                return;
            }

            setIsOpen(false);
            setQuery('');
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                setQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, selectId]);

    useEffect(() => {
        if (!isOpen) return;

        const frame = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isOpen]);

    const handleSelect = (nextValue: string) => {
        onChange(nextValue);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (disabled) return;
                    setIsOpen((open) => !open);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ${buttonClassName}`}
            >
                <span className={selectedOption ? '' : 'text-gray-400 dark:text-gray-400'}>
                    {selectedOption?.label ?? placeholder}
                </span>
                <ChevronDown size={16} className={`shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen &&
                ReactDOM.createPortal(
                    <div
                        id={`${selectId}-dropdown`}
                        style={dropdownStyle}
                        className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 ${dropdownClassName}`}
                    >
                        <div className="border-b border-gray-200 p-2 dark:border-gray-700">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                />
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">No matches found</div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const isSelected = option.value === value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleSelect(option.value)}
                                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-700/60 ${
                                                isSelected ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'
                                            }`}
                                        >
                                            <span>{option.label}</span>
                                            {isSelected ? <Check size={16} className="shrink-0" /> : null}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default SearchableSelect;
