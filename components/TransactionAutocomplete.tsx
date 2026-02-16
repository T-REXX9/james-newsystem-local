import React, { useState, useEffect, useRef } from 'react';
import { X, Search, FileText, Receipt, ShoppingCart, HelpCircle, Package } from 'lucide-react';
import { ContactTransaction } from '../types';

interface TransactionAutocompleteProps {
  transactions: ContactTransaction[];
  selectedTransactions: ContactTransaction[];
  onSelect: (transaction: ContactTransaction) => void;
  onRemove: (transactionId: string) => void;
  disabled?: boolean;
}

const TransactionAutocomplete: React.FC<TransactionAutocompleteProps> = ({
  transactions,
  selectedTransactions,
  onSelect,
  onRemove,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredTransactions, setFilteredTransactions] = useState<ContactTransaction[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Filter transactions based on search term
    const filtered = transactions.filter(transaction => {
      const matchesSearch = 
        transaction.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.label.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Exclude already selected transactions
      const notSelected = !selectedTransactions.find(st => st.id === transaction.id);
      
      return matchesSearch && notSelected;
    });

    setFilteredTransactions(filtered);
  }, [searchTerm, transactions, selectedTransactions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'order_slip':
        return <Receipt className="w-4 h-4 text-purple-500" />;
      case 'sales_order':
        return <ShoppingCart className="w-4 h-4 text-green-500" />;
      case 'sales_inquiry':
        return <HelpCircle className="w-4 h-4 text-orange-500" />;
      case 'purchase_history':
        return <Package className="w-4 h-4 text-indigo-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      invoice: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Invoice' },
      order_slip: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Order Slip' },
      sales_order: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Sales Order' },
      sales_inquiry: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Inquiry' },
      purchase_history: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', label: 'Purchase' },
    };
    const badge = badges[type] || badges.invoice;
    return <span className={`text-xs px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>{badge.label}</span>;
  };

  const handleSelect = (transaction: ContactTransaction) => {
    onSelect(transaction);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Selected Transactions */}
      {selectedTransactions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedTransactions.map(transaction => (
            <div
              key={transaction.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm"
            >
              {getTransactionIcon(transaction.type)}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {transaction.number}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                {new Date(transaction.date).toLocaleDateString()}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(transaction.id)}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  aria-label="Remove transaction"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder="Search transactions by number or type..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && filteredTransactions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredTransactions.map(transaction => (
            <button
              key={transaction.id}
              type="button"
              onClick={() => handleSelect(transaction)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  {getTransactionIcon(transaction.type)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {transaction.number}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(transaction.date).toLocaleDateString()} • ₱{transaction.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
                {getTransactionTypeBadge(transaction.type)}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !disabled && searchTerm && filteredTransactions.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          No transactions found
        </div>
      )}
    </div>
  );
};

export default TransactionAutocomplete;

