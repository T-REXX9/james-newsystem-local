import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, Building2, Loader2, Search } from 'lucide-react';
import { Contact } from '../types';
import { useDebounce } from '../hooks/useDebounce';

interface CustomerAutocompleteProps {
  contacts: Contact[];
  onSelect: (customer: Contact) => void;
  selectedCustomer?: Contact | null;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  contacts,
  onSelect,
  selectedCustomer = null,
  disabled = false,
  placeholder = 'Search customer...',
  className = '',
  inputClassName = '',
}) => {
  const [query, setQuery] = useState(selectedCustomer?.company || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    setQuery(selectedCustomer?.company || '');
  }, [selectedCustomer]);

  const updatePosition = useCallback(() => {
    if (inputRef.current && showDropdown) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${Math.max(rect.width, 300)}px`,
        maxHeight: '320px',
        zIndex: 9999,
      });
    }
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return undefined;

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (wrapperRef.current?.contains(target)) {
        return;
      }

      const dropdownEl = document.getElementById('customer-autocomplete-dropdown');
      if (dropdownEl?.contains(target)) {
        return;
      }

      setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.company.localeCompare(b.company)),
    [contacts],
  );

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();

    if (!q) {
      return sortedContacts.slice(0, 50);
    }

    return sortedContacts.filter((contact) => {
      const company = contact.company?.toLowerCase() || '';
      const salesman = contact.salesman?.toLowerCase() || '';
      const city = contact.city?.toLowerCase() || '';
      return company.includes(q) || salesman.includes(q) || city.includes(q);
    });
  }, [debouncedQuery, sortedContacts]);

  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const handleSelect = (customer: Contact) => {
    onSelect(customer);
    setQuery(customer.company || '');
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const highlightMatch = (text: string, currentQuery: string) => {
    if (!text) return '';

    const trimmedQuery = currentQuery.trim();
    if (!trimmedQuery) return text;

    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === trimmedQuery.toLowerCase() ? (
            <span key={`${part}-${index}`} className="bg-brand-blue/20 text-brand-blue font-bold rounded px-0.5">
              {part}
            </span>
          ) : (
            <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
          ),
        )}
      </span>
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!showDropdown && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setShowDropdown(true);
      return;
    }

    if (!showDropdown) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setShowDropdown(false);
    }
  };

  const noResults = debouncedQuery.trim().length > 0 && results.length === 0;
  const isSearching = query !== debouncedQuery;

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 text-brand-blue animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full pl-8 pr-3 py-1.5 border rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue sm:text-xs transition-shadow ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${inputClassName}`}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setShowDropdown(true);
              requestAnimationFrame(updatePosition);
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      {showDropdown && ReactDOM.createPortal(
        <div
          id="customer-autocomplete-dropdown"
          className="fixed bg-white dark:bg-slate-900 shadow-xl rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-slate-200 dark:border-slate-700"
          style={dropdownStyle}
        >
          <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Customer Matches</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↵</kbd> Select</span>
            </span>
          </div>

          {results.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((customer, index) => {
                const isSelected = index === selectedIndex;

                return (
                  <li
                    key={customer.id}
                    className={`cursor-pointer select-none relative py-2 pl-3 pr-4 group transition-colors ${isSelected
                      ? 'bg-brand-blue/10 dark:bg-brand-blue/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => handleSelect(customer)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded ${isSelected ? 'bg-brand-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-slate-900 dark:text-white'}`}>
                          {highlightMatch(customer.company, debouncedQuery)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          {highlightMatch(customer.address || customer.deliveryAddress || customer.city || 'No address on file', debouncedQuery)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                          <span>Salesman: {customer.salesman || '—'}</span>
                          <span>•</span>
                          <span>City: {customer.city || '—'}</span>
                          <span>•</span>
                          <span>Terms: {customer.terms || '—'}</span>
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
              <p className="text-sm font-medium">No customers found</p>
              <p className="text-xs mt-1">Try searching by company, salesman, or city.</p>
            </div>
          ) : (
            <div className="py-6 px-4 text-center text-slate-500 dark:text-slate-400 text-xs">
              Start typing to narrow the customer list.
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default CustomerAutocomplete;
