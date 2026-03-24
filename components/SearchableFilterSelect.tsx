import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

interface SearchableFilterSelectProps {
  label?: string;
  value?: string;
  options: string[];
  placeholder: string;
  allLabel?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
}

const SearchableFilterSelect: React.FC<SearchableFilterSelectProps> = ({
  label,
  value,
  options,
  placeholder,
  allLabel = 'All',
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <div ref={containerRef} className={`relative min-w-[220px] ${className}`.trim()}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <span className="truncate">{value || allLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-brand-blue dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              autoFocus
            />
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="truncate">{allLabel}</span>
              {!value && <Check className="h-4 w-4 shrink-0 text-brand-blue" />}
            </button>

            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No matches found.</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="truncate">{option}</span>
                  {value === option && <Check className="h-4 w-4 shrink-0 text-brand-blue" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableFilterSelect;
