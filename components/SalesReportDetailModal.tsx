import React, { useState, useEffect } from 'react';
import { X, Package, Hash, Tag, DollarSign } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { SalesReportTransaction } from '../types';
import { getTransactionDetails } from '../services/salesReportService';

interface TransactionItem {
  id: string;
  qty: number;
  partNo: string;
  itemCode: string;
  description: string;
  unitPrice: number;
  amount: number;
  brand: string;
  category: string;
}

interface SalesReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: SalesReportTransaction | null;
  formatCurrency: (amount: number) => string;
}

const SalesReportDetailModal: React.FC<SalesReportDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  formatCurrency,
}) => {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      loadItems();
    }
  }, [isOpen, transaction]);

  const loadItems = async () => {
    if (!transaction) return;
    
    setIsLoading(true);
    try {
      const data = await getTransactionDetails(transaction.id, transaction.type);
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  const grandTotal = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slideInUp">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Transaction Details
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {transaction.type === 'invoice' ? 'Invoice' : 'Delivery Receipt'}: {transaction.refNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{transaction.customer}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Salesperson</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{transaction.salesperson}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Terms</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{transaction.terms || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SO #</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{transaction.soNo || 'N/A'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-blue" />
                Line Items
              </h3>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <CustomLoadingSpinner label="Loading" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                No items found for this transaction.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          Qty
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Item Code</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Part No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Brand
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-3 h-3" />
                          Unit Price
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-white font-medium">{item.qty}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.itemCode || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">{item.partNo || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.brand || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">{item.description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-white text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-white font-semibold text-right">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-brand-blue/10 dark:bg-brand-blue/20">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-brand-blue">
                        Grand Total:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-brand-blue text-right">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesReportDetailModal;
