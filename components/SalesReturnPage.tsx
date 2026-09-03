import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Search, Plus, Trash2, FileText, Loader2 } from 'lucide-react';
import ReactDOM from 'react-dom';
import {
  SalesReturnItem,
  SalesReturnRecord,
  SalesReturnSourceDocument,
  SourceItem,
  salesReturnService,
} from '../services/salesReturnLocalApiService';
import { Contact } from '../types';
import { fetchContacts, fetchPurchasedItems } from '../services/customerDatabaseLocalApiService';
import CustomerAutocomplete from './CustomerAutocomplete';
import { useDebounce } from '../hooks/useDebounce';

type SourceDocument = SalesReturnSourceDocument;

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* -------------------------------------------------------------------------- */
/*  Confirmation Dialog                                                        */
/* -------------------------------------------------------------------------- */
const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Source Items Modal (pick items from linked Invoice/OR)                      */
/* -------------------------------------------------------------------------- */
const SourceItemsModal: React.FC<{
  open: boolean;
  sourceItems: SourceItem[];
  loading: boolean;
  emptyMessage?: string;
  onAdd: (item: SourceItem, qty: number) => void;
  onClose: () => void;
  onSearch?: (query: string) => void;
}> = ({ open, sourceItems, loading, emptyMessage, onAdd, onClose, onSearch }) => {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    if (open) {
      setItemSearch('');
      const defaults: Record<number, number> = {};
      sourceItems.forEach((si) => {
        defaults[si.source_item_id] = si.is_catalog_item ? 1 : si.remaining_qty;
      });
      setQuantities(defaults);
    }
  }, [open, sourceItems]);

  if (!open) return null;
  const searchNeedle = itemSearch.trim().toLowerCase();
  const visibleSourceItems = sourceItems
    .filter((item) => !searchNeedle || [item.item_code, item.part_no, item.description, item.brand]
      .some((value) => String(value || '').toLowerCase().includes(searchNeedle)))
    .slice(0, 150);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Return Items</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-500">Loading source items...</div>
          ) : sourceItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              {emptyMessage || 'No available items to return. All items have been fully returned or no source document is linked.'}
            </div>
          ) : (
            <>
            <input
              value={itemSearch}
              onChange={(event) => {
                setItemSearch(event.target.value);
                onSearch?.(event.target.value);
              }}
              placeholder="Search item code, part number or description"
              className="mb-3 h-[36px] w-full rounded border border-slate-300 px-3 text-sm"
            />
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr className="text-left text-xs uppercase tracking-wide">
                  <th className="px-3 py-2">Item Code</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2 text-right">Return Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibleSourceItems.map((si) => (
                  <tr key={si.source_item_id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="px-3 py-2">{si.item_code}</td>
                    <td className="px-3 py-2">{si.description}</td>
                    <td className="px-3 py-2 text-right">{si.is_catalog_item ? '—' : si.remaining_qty}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={si.remaining_qty}
                        value={quantities[si.source_item_id] ?? (si.is_catalog_item ? 1 : si.remaining_qty)}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [si.source_item_id]: Math.max(1, Math.min(si.remaining_qty, Number(e.target.value) || 1)),
                          }))
                        }
                        className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{peso.format(si.unit_price)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onAdd(si, quantities[si.source_item_id] ?? (si.is_catalog_item ? 1 : si.remaining_qty))}
                        className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Source Document Autocomplete                                               */
/*  Unified search for Invoices + Order Slips — mirrors old system's           */
/*  tbl_invoice_or search that returns both types in one dropdown.             */
/* -------------------------------------------------------------------------- */
export const SourceDocAutocomplete: React.FC<{
  documents: SourceDocument[];
  customers: Contact[];
  selectedDoc: SourceDocument | null;
  onSelect: (doc: SourceDocument) => void;
  onSearch: (query: string) => Promise<SourceDocument[]>;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
}> = ({ documents, customers, selectedDoc, onSelect, onSearch, disabled = false, placeholder = 'Search invoice or OR number...', inputClassName = '' }) => {
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const [query, setQuery] = useState(selectedDoc?.doc_no || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);
  const [remoteResults, setRemoteResults] = useState<SourceDocument[] | null>(null);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    setQuery(selectedDoc?.doc_no || '');
  }, [selectedDoc]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    if (!trimmedQuery || selectedDoc?.doc_no === trimmedQuery) {
      setRemoteResults(null);
      setRemoteSearching(false);
      return undefined;
    }

    const requestId = ++searchRequestRef.current;
    setRemoteSearching(true);
    onSearch(trimmedQuery)
      .then((matches) => {
        if (searchRequestRef.current === requestId) setRemoteResults(matches);
      })
      .catch(() => {
        if (searchRequestRef.current === requestId) setRemoteResults([]);
      })
      .finally(() => {
        if (searchRequestRef.current === requestId) setRemoteSearching(false);
      });

    return () => {
      if (searchRequestRef.current === requestId) searchRequestRef.current += 1;
    };
  }, [debouncedQuery, onSearch, selectedDoc?.doc_no]);

  const updatePosition = useCallback(() => {
    if (inputRef.current && showDropdown) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${Math.max(rect.width, 360)}px`,
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
      if (wrapperRef.current?.contains(target)) return;
      const dropdownEl = document.getElementById('source-doc-autocomplete-dropdown');
      if (dropdownEl?.contains(target)) return;
      setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const source = q && remoteResults !== null ? remoteResults : documents;
    const sorted = [...source].sort((a, b) => b.sales_date.localeCompare(a.sales_date));
    if (!q) return sorted.slice(0, 50);
    if (remoteResults !== null) return sorted;
    return sorted.filter((doc) => {
      const no = doc.doc_no?.toLowerCase() || '';
      const id = doc.id?.toLowerCase() || '';
      const custName = customerMap.get(doc.contact_id)?.company?.toLowerCase() || '';
      return no.includes(q) || id.includes(q) || custName.includes(q);
    });
  }, [debouncedQuery, documents, remoteResults, customerMap]);

  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  const handleSelect = (doc: SourceDocument) => {
    onSelect(doc);
    setQuery(doc.doc_no || doc.id);
    setShowDropdown(false);
    setSelectedIndex(-1);
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
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) handleSelect(results[selectedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setShowDropdown(false);
    }
  };

  const isSearching = query !== debouncedQuery || remoteSearching;

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 text-brand-blue animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full pl-8 pr-3 py-1.5 border rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue sm:text-xs transition-shadow ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${inputClassName}`}
          onChange={(e) => {
            setQuery(e.target.value);
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
          id="source-doc-autocomplete-dropdown"
          className="fixed bg-white dark:bg-slate-900 shadow-xl rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-slate-200 dark:border-slate-700"
          style={dropdownStyle}
        >
          <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>Invoice / OR Matches</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">↵</kbd> Select</span>
            </span>
          </div>

          {results.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((doc, index) => {
                const isSelected = index === selectedIndex;
                const typeBadgeCls = doc.type === 'Invoice'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
                return (
                  <li
                    key={`${doc.type}-${doc.id}`}
                    className={`cursor-pointer select-none relative py-2 pl-3 pr-4 group transition-colors ${isSelected
                      ? 'bg-brand-blue/10 dark:bg-brand-blue/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => handleSelect(doc)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded ${isSelected ? 'bg-brand-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isSelected ? 'text-brand-blue' : 'text-slate-900 dark:text-white'}`}>
                            {doc.doc_no || doc.id}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeBadgeCls}`}>
                            {doc.type}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          {customerMap.get(doc.contact_id)?.company || 'Unknown Customer'}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                          <span>Date: {doc.sales_date || '—'}</span>
                          <span>•</span>
                          <span>Salesman: {doc.sales_person || '—'}</span>
                          <span>•</span>
                          <span>Total: {peso.format(doc.grand_total)}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-medium">No invoices or order slips found</p>
              <p className="text-xs mt-1">Try searching by document number or customer name.</p>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Create Credit Memo Modal                                                   */
/* -------------------------------------------------------------------------- */
const CreateModal: React.FC<{
  open: boolean;
  onCreated: (record: SalesReturnRecord) => void;
  onClose: () => void;
}> = ({ open, onCreated, onClose }) => {
  const [referenceMode, setReferenceMode] = useState<'with' | 'none'>('with');
  const [form, setForm] = useState({
    customer_id: '',
    invoice_refno: '',
    type: 'Invoice' as string,
    salesman: '',
    remark: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [sourceDocs, setSourceDocs] = useState<SourceDocument[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SourceDocument | null>(null);
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);

  const searchSourceDocs = useCallback(async (query: string): Promise<SourceDocument[]> => {
    return salesReturnService.sourceDocuments(query, 50);
  }, []);

  useEffect(() => {
    if (open) {
      setReferenceMode('with');
      setSelectedCustomer(null);
      setSelectedDoc(null);
      setPendingContactId(null);
      setError('');
      setForm({
        customer_id: '',
        invoice_refno: '',
        type: 'Invoice',
        salesman: '',
        remark: '',
        date: new Date().toISOString().slice(0, 10),
      });
      fetchContacts().then(setCustomers).catch(() => setCustomers([]));
      salesReturnService.sourceDocuments('', 50).then(setSourceDocs).catch(() => setSourceDocs([]));
    }
  }, [open]);

  // Resolve pending customer match once customers list is loaded
  useEffect(() => {
    if (pendingContactId && customers.length > 0) {
      const matched = customers.find((c) => c.id === pendingContactId);
      if (matched) {
        setSelectedCustomer(matched);
        setForm((f) => ({ ...f, customer_id: matched.id }));
      }
      setPendingContactId(null);
    }
  }, [pendingContactId, customers]);

  const handleDocSelect = (doc: SourceDocument) => {
    setSelectedDoc(doc);
    setForm((f) => ({
      ...f,
      invoice_refno: doc.id,
      type: doc.type,
      salesman: doc.sales_person || f.salesman,
    }));
    // Auto-populate customer from the document's contact_id
    if (doc.contact_id) {
      const matched = customers.find((c) => c.id === doc.contact_id);
      if (matched) {
        setSelectedCustomer(matched);
        setForm((f) => ({ ...f, customer_id: matched.id }));
      } else {
        setPendingContactId(doc.contact_id);
      }
    }
  };

  const handleReferenceMode = (mode: 'with' | 'none') => {
    setReferenceMode(mode);
    setSelectedDoc(null);
    setPendingContactId(null);
    setForm((current) => ({
      ...current,
      invoice_refno: '',
      type: mode === 'none' ? 'No Reference' : 'Invoice',
    }));
  };

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      const record = await salesReturnService.create(form as Record<string, unknown>);
      onCreated(record);
    } catch (err: any) {
      setError(err?.message || 'Failed to create credit memo');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">New Credit Memo</h3>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center gap-5">
            <span className="text-slate-600 dark:text-slate-300">Type</span>
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={referenceMode === 'with'} onChange={() => handleReferenceMode('with')} />
              With Reference
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={referenceMode === 'none'} onChange={() => handleReferenceMode('none')} />
              No Reference
            </label>
          </div>
          {referenceMode === 'with' && <div className="block">
            <span className="text-slate-600 dark:text-slate-300 text-sm">Invoice / OR No.</span>
            <SourceDocAutocomplete
              documents={sourceDocs}
              customers={customers}
              selectedDoc={selectedDoc}
              onSelect={handleDocSelect}
              onSearch={searchSourceDocs}
              placeholder="Search invoice or OR number..."
              inputClassName="border-slate-300 dark:border-slate-600"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Selecting a document auto-fills customer, type, and salesman.</p>
          </div>}
          <div className="block">
            <span className="text-slate-600 dark:text-slate-300 text-sm">Customer</span>
            <CustomerAutocomplete
              contacts={customers}
              selectedCustomer={selectedCustomer}
              onSelect={(customer) => {
                setSelectedCustomer(customer);
                setForm((f) => ({ ...f, customer_id: customer.id }));
              }}
              placeholder="Search customer..."
              inputClassName="border-slate-300 dark:border-slate-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {referenceMode === 'with' && <label className="block">
              <span className="text-slate-600 dark:text-slate-300">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              >
                <option value="Invoice">Invoice</option>
                <option value="OR">OR (Delivery Receipt)</option>
              </select>
            </label>}
            <label className="block">
              <span className="text-slate-600 dark:text-slate-300">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-300">Salesman</span>
            <input
              value={form.salesman}
              onChange={(e) => setForm((f) => ({ ...f, salesman: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </label>
          <label className="block">
            <span className="text-slate-600 dark:text-slate-300">Remark</span>
            <textarea
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              rows={2}
              className="w-full mt-1 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main Page                                                                  */
/* -------------------------------------------------------------------------- */
interface SalesReturnPageProps {
  initialMonth?: string;
  initialYear?: string;
  initialStatus?: string;
}

const SalesReturnPage: React.FC<SalesReturnPageProps> = ({ initialMonth, initialYear, initialStatus }) => {
  const today = new Date();
  const [rows, setRows] = useState<SalesReturnRecord[]>([]);
  const [selectedRefno, setSelectedRefno] = useState('');
  const [selected, setSelected] = useState<SalesReturnRecord | null>(null);
  const [items, setItems] = useState<SalesReturnItem[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus || 'All');
  const [month, setMonth] = useState(initialMonth || String(today.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(initialYear || String(today.getFullYear()));

  const [page, setPage] = useState(1);
  const [perPage] = useState(50);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSourceItems, setShowSourceItems] = useState(false);
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const debouncedSourceSearch = useDebounce(sourceSearch, 250);

  useEffect(() => {
    if (!initialMonth || !initialYear) return;
    setMonth(String(initialMonth).padStart(2, '0'));
    setYear(String(initialYear));
    if (initialStatus) setStatus(initialStatus);
    setPage(1);
  }, [initialMonth, initialStatus, initialYear]);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', message: '', confirmLabel: '', action: async () => {} });

  const isPending = selected?.lstatus?.toLowerCase() === 'pending' || selected?.lstatus === '';
  const isPosted = selected?.lstatus?.toLowerCase() === 'posted';

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await salesReturnService.list({ search, status, month, year, page, perPage });
      setRows(data.items);

      if (!selectedRefno && data.items[0]?.lrefno) {
        setSelectedRefno(data.items[0].lrefno);
      } else if (selectedRefno && !data.items.some((r) => r.lrefno === selectedRefno)) {
        setSelectedRefno(data.items[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load sales return records');
      setRows([]);
      setSelectedRefno('');
      setSelected(null);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [search, status, month, year, page, perPage, selectedRefno]);

  const loadDetail = useCallback(
    async (refno: string) => {
      if (!refno) {
        setSelected(null);
        setItems([]);
        return;
      }
      setLoadingDetail(true);
      setError('');
      try {
        const [header, detailItems] = await Promise.all([
          salesReturnService.show(refno),
          salesReturnService.items(refno),
        ]);
        setSelected(header);
        setItems(detailItems);
      } catch (err: any) {
        setError(err?.message || 'Failed to load sales return detail');
        setSelected(null);
        setItems([]);
      } finally {
        setLoadingDetail(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadList();
  }, [search, status, month, year, page]);

  useEffect(() => {
    loadDetail(selectedRefno);
  }, [selectedRefno]);

  /* ---- Actions ---- */
  const handleCreated = (record: SalesReturnRecord) => {
    setShowCreate(false);
    setSelectedRefno(record.lrefno);
    loadList();
  };

  const openSourceItemsModal = async () => {
    if (!selectedRefno) return;
    setShowSourceItems(true);
    setSourceSearch('');
    setLoadingSource(true);
    try {
      if (selected?.ltype === 'No Reference') {
        await loadPurchasedReturnItems('');
      } else {
        const sourceRows = await salesReturnService.sourceItems(selectedRefno);
        setSourceItems(sourceRows);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load source items');
      setSourceItems([]);
    } finally {
      setLoadingSource(false);
    }
  };

  const loadPurchasedReturnItems = async (search: string) => {
    const customerId = selected?.customer_id || '';
    if (!customerId) {
      setSourceItems([]);
      setError('A customer is required so return items can be limited to purchase history.');
      return;
    }
    const products = await fetchPurchasedItems(customerId, search, 150);
    setSourceItems(products
      .filter((item) => item.remaining_qty > 0)
      .map((item, index): SourceItem => ({
        source_item_id: index + 1,
        is_catalog_item: false,
        linv_refno: '',
        item_code: item.item_code,
        part_no: item.part_no,
        brand: item.brand,
        description: item.description,
        unit_price: item.unit_price,
        original_qty: item.purchased_qty,
        remaining_qty: item.remaining_qty,
        unit: '',
        discount: 0,
      })));
  };

  useEffect(() => {
    if (!showSourceItems || selected?.ltype !== 'No Reference') return;
    setLoadingSource(true);
    loadPurchasedReturnItems(debouncedSourceSearch)
      .catch((err: any) => {
        setError(err?.message || 'Failed to load purchased items');
        setSourceItems([]);
      })
      .finally(() => setLoadingSource(false));
  }, [debouncedSourceSearch, showSourceItems, selected?.ltype, selected?.customer_id]);

  const handleAddSourceItem = async (si: SourceItem, qty: number) => {
    setActionLoading(true);
    try {
      await salesReturnService.addItem(selectedRefno, {
        item_code: si.item_code,
        part_no: si.part_no,
        brand: si.brand,
        description: si.description,
        unit_price: si.unit_price,
        qty,
        linv_refno: si.linv_refno,
        original_qty: si.original_qty,
        unit: si.unit,
        discount: si.discount,
      });
      // Refresh items and source items
      const updatedItems = await salesReturnService.items(selectedRefno);
      setItems(updatedItems);
      if (selected?.ltype === 'No Reference') {
        await loadPurchasedReturnItems(debouncedSourceSearch);
      } else if (!si.is_catalog_item) {
        setSourceItems(await salesReturnService.sourceItems(selectedRefno));
      }
      // Also refresh the list to update totals
      loadList();
    } catch (err: any) {
      setError(err?.message || 'Failed to add item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = (itemId: number) => {
    setConfirmAction({
      open: true,
      title: 'Delete Item',
      message: 'Are you sure you want to remove this item from the credit memo?',
      confirmLabel: 'Delete',
      action: async () => {
        setActionLoading(true);
        try {
          await salesReturnService.deleteItem(itemId);
          const updatedItems = await salesReturnService.items(selectedRefno);
          setItems(updatedItems);
          loadList();
        } catch (err: any) {
          setError(err?.message || 'Failed to delete item');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handlePost = () => {
    setConfirmAction({
      open: true,
      title: 'Post Credit Memo',
      message:
        'Posting will create a ledger credit entry and restore inventory quantities. Are you sure you want to post this credit memo?',
      confirmLabel: 'Post',
      action: async () => {
        setActionLoading(true);
        try {
          const updated = await salesReturnService.post(selectedRefno);
          setSelected(updated);
          loadList();
        } catch (err: any) {
          setError(err?.message || 'Failed to post credit memo');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleUnpost = () => {
    setConfirmAction({
      open: true,
      title: 'Unpost Credit Memo',
      message:
        'Unposting will remove the ledger and inventory log entries created during posting. Are you sure?',
      confirmLabel: 'Unpost',
      action: async () => {
        setActionLoading(true);
        try {
          const updated = await salesReturnService.unpost(selectedRefno);
          setSelected(updated);
          loadList();
        } catch (err: any) {
          setError(err?.message || 'Failed to unpost credit memo');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleConfirmAction = async () => {
    await confirmAction.action();
    setConfirmAction((prev) => ({ ...prev, open: false }));
  };

  return (
    <div className="min-h-full bg-[#f4f4f4] px-4 py-10 text-[13px] text-[#222]">
      <div className="mx-auto max-w-[1140px] space-y-6">
        <section className="overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white">
          <div className="flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-[#ddd] px-9 py-5">
            <div className="flex gap-1">
              <button type="button" onClick={() => setShowSearchModal(true)} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white">Search</button>
              <button type="button" onClick={() => setShowCreate(true)} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-white">Create New</button>
              <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setStatus('All'); setPage(1); void loadList(); }} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-white">Refresh</button>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-['Oswald'] text-[20px] text-[#263f52]">Filter by Month:</span>
              <select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} className="h-[34px] w-[200px] rounded-[3px] border border-[#ccc] bg-white px-3">
                {MONTHS.map((label, idx) => <option key={label} value={String(idx + 1).padStart(2, '0')}>{label}</option>)}
              </select>
              <input value={year} onChange={(e) => { setYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4)); setPage(1); }} className="h-[34px] w-[100px] rounded-[3px] border border-[#ccc] px-3" />
              <button type="button" onClick={() => void loadList()} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-white">Filter</button>
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="mb-2"><b>Filtered By:</b> Year: {year} Month: {MONTHS[Number(month) - 1]?.slice(0, 3)},</div>
            <div className="max-h-[150px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="sticky top-0 bg-white font-['Oswald'] text-[14px]">
                  <tr className="border-b-2 border-[#ddd]">
                    <th className="w-[12%] px-2 py-2">Date</th>
                    <th className="w-[42%] px-2 py-2">Customer</th>
                    <th className="w-[15%] px-2 py-2">CM No.</th>
                    <th className="w-[18%] px-2 py-2">Transaction No.</th>
                    <th className="w-[13%] px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList && <tr><td colSpan={5} className="px-2 py-4 text-slate-500">Loading...</td></tr>}
                  {!loadingList && rows.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-slate-500">No sales return records found.</td></tr>}
                  {!loadingList && rows.map((row) => {
                    const active = selectedRefno === row.lrefno;
                    return (
                      <tr key={row.lrefno} onClick={() => setSelectedRefno(row.lrefno)} className={`cursor-pointer border-b border-[#ddd] ${active ? 'text-blue-600' : ''}`}>
                        <td className="px-2 py-2">{formatDate(row.ldate)}</td>
                        <td className="px-2 py-2">{row.customer_name || '-'}</td>
                        <td className="px-2 py-2 underline">{row.lcredit_no || '-'}</td>
                        <td className="px-2 py-2 underline">{row.linvoice_no || '-'}</td>
                        <td className="px-2 py-2">{row.lstatus || 'Pending'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white">
          <div className="flex min-h-[64px] items-center justify-between border-b border-[#ddd] px-5">
            <h2 className="border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] uppercase text-[#315574]">Sales Return</h2>
            <div className="flex items-center gap-2 font-['Oswald'] text-[18px] text-[#263f52]">
              {selected && isPending && items.length > 0 && <button type="button" onClick={handlePost} disabled={actionLoading} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-[12px] font-bold text-white">POST <u>Credit Memo</u></button>}
              {selected && isPosted && <button type="button" onClick={handleUnpost} disabled={actionLoading} className="rounded-[4px] bg-[#f0ad4e] px-4 py-2 text-[12px] font-bold text-white">UNPOST</button>}
              <span>CM No. :</span>
              <input readOnly value={selected?.lcredit_no || ''} className="h-[34px] w-[130px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3 font-sans text-[13px]" />
            </div>
          </div>

          {error && <div className="mx-6 mt-5 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
          <div className="px-8 py-8">
            {!selected ? (
              <p className="text-slate-500">Select a sales return record from the list or click Create New.</p>
            ) : (
              <>
                <div className="mx-auto grid max-w-[1000px] grid-cols-[90px_1fr_80px_170px_100px_190px] items-center gap-x-3 gap-y-4">
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Type:</label>
                  <span>{selected.ltype === 'OR' ? 'No Reference' : 'With Reference'}</span>
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Date :</label>
                  <input readOnly value={formatDate(selected.ldate)} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Sales Person:</label>
                  <input readOnly value={selected.sales_person || ''} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />

                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">DR/Invoice</label>
                  <input readOnly value={selected.linvoice_no || ''} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Ship VIA :</label>
                  <input readOnly value={selected.ship_via || ''} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Tracking No.:</label>
                  <input readOnly value={selected.tracking_no || ''} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />

                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Customer:</label>
                  <input readOnly value={selected.customer_name || ''} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Status:</label>
                  <span>{selected.lstatus || 'Pending'}</span>
                  <label className="text-right font-['Oswald'] text-[16px] text-[#263f52]">Remark:</label>
                  <input readOnly value={selected.lremark || ''} className="h-[34px] rounded-[3px] border border-[#ccc] bg-[#eee] px-3" />
                </div>

                {isPending && (
                  <div className="mt-5">
                    <button type="button" onClick={openSourceItemsModal} disabled={actionLoading} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white">Add Record</button>
                  </div>
                )}
                <hr className="my-5 border-[#eee]" />
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full border-collapse text-left">
                    <thead className="font-['Oswald'] text-[14px]">
                      <tr className="border-b-2 border-[#ddd]">
                        {isPending && <th className="w-8 px-2 py-2" />}
                        <th className="px-2 py-2">Item Code</th>
                        <th className="px-2 py-2 text-right">Quantity</th>
                        <th className="px-2 py-2">Location.</th>
                        <th className="px-2 py-2">Part No.</th>
                        <th className="px-2 py-2">Brand</th>
                        <th className="px-2 py-2">Description</th>
                        <th className="px-2 py-2 text-right">Unit price</th>
                        <th className="px-2 py-2">Remark</th>
                        <th className="px-2 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDetail && <tr><td colSpan={10} className="px-2 py-5 text-slate-500">Loading items...</td></tr>}
                      {!loadingDetail && items.length === 0 && <tr><td colSpan={10} className="px-2 py-5 text-slate-500">No line items for this record.</td></tr>}
                      {!loadingDetail && items.map((item) => (
                        <tr key={item.id} className="border-b border-[#ddd]">
                          {isPending && <td className="px-2 py-2"><button type="button" onClick={() => handleDeleteItem(item.id)} disabled={actionLoading} className="text-[#d9534f]" title="Remove item"><Trash2 className="h-4 w-4" /></button></td>}
                          <td className="px-2 py-2">{item.item_code || '-'}</td>
                          <td className="px-2 py-2 text-right">{item.qty.toFixed(2)}</td>
                          <td className="px-2 py-2">{item.location || '-'}</td>
                          <td className="px-2 py-2">{item.part_no || '-'}</td>
                          <td className="px-2 py-2">{item.brand || '-'}</td>
                          <td className="px-2 py-2">{item.description || '-'}</td>
                          <td className="px-2 py-2 text-right">{peso.format(item.unit_price)}</td>
                          <td className="px-2 py-2">{item.remark || '-'}</td>
                          <td className="px-2 py-2 text-right">{peso.format(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-semibold">
                      <tr>
                        <td colSpan={isPending ? 2 : 1} className="px-2 py-3 text-right">Total Qty:</td>
                        <td className="px-2 py-3 text-right"><span className="rounded-full bg-[#5d82a2] px-2 py-0.5 text-white">{items.reduce((sum, item) => sum + item.qty, 0).toFixed(2)}</span></td>
                        <td colSpan={6} className="px-2 py-3 text-right">Grand Total:</td>
                        <td className="px-2 py-3 text-right"><span className="rounded-full bg-[#5d82a2] px-2 py-0.5 text-white">{peso.format(items.reduce((sum, item) => sum + item.amount, 0))}</span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      <CreateModal open={showCreate} onCreated={handleCreated} onClose={() => setShowCreate(false)} />

      <SourceItemsModal
        open={showSourceItems}
        sourceItems={sourceItems}
        loading={loadingSource}
        emptyMessage={selected?.ltype === 'No Reference'
          ? 'No purchased items found for this customer. Only parts in purchase history can be returned.'
          : undefined}
        onAdd={handleAddSourceItem}
        onClose={() => setShowSourceItems(false)}
        onSearch={selected?.ltype === 'No Reference' ? setSourceSearch : undefined}
      />

      <ConfirmDialog
        open={confirmAction.open}
        title={confirmAction.title}
        message={confirmAction.message}
        confirmLabel={confirmAction.confirmLabel}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction((prev) => ({ ...prev, open: false }))}
      />
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[600px] rounded-[5px] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-[20px] font-semibold">Search Options</h3>
              <button type="button" onClick={() => setShowSearchModal(false)} className="text-2xl text-slate-500">×</button>
            </div>
            <div className="space-y-4 px-8 py-6">
              <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Ref No.</span><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Input Ref No." className="h-[36px] rounded border border-[#ccc] px-3" /></label>
              <label className="grid grid-cols-[130px_1fr] items-center gap-3"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-[36px] rounded border border-[#ccc] bg-white px-3"><option value="All">All Status</option><option value="Pending">Pending</option><option value="Posted">Posted</option><option value="Canceled">Canceled</option></select></label>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button type="button" onClick={() => { setSearch(searchInput.trim()); setPage(1); setShowSearchModal(false); }} className="rounded bg-[#51b957] px-4 py-2 text-white">Submit</button>
              <button type="button" onClick={() => setShowSearchModal(false)} className="rounded bg-[#5d82a2] px-4 py-2 text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReturnPage;
