import React, { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { fetchDailyCallPurchaseHistory } from '../services/dailyCallCustomerDetailService';

interface PurchaseHistoryTabProps {
  contactId: string;
}

const PurchaseHistoryTab: React.FC<PurchaseHistoryTabProps> = ({ contactId }) => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    const loadPurchases = async () => {
      try {
        const data = await fetchDailyCallPurchaseHistory(contactId);
        setPurchases(data || []);
        
        // Calculate total value
        const total = data?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0;
        setTotalValue(total);
      } catch (err) {
        console.error('Error loading purchase history:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadPurchases();
  }, [contactId]);

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading purchase history...</div>;
  }

  if (purchases.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No purchase history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-brand-blue to-blue-600 rounded-lg p-4 text-white">
        <p className="text-xs font-semibold uppercase opacity-90">Total Purchase Value</p>
        <p className="text-3xl font-bold mt-2">₱{totalValue.toLocaleString()}</p>
        <p className="text-sm mt-2 opacity-80">Across {purchases.length} transaction(s)</p>
      </div>

      {/* Purchase List */}
      <div className="space-y-3">
        {purchases.map((purchase, idx) => (
          <div key={purchase.id || idx} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">
                  {new Date(purchase.purchase_date).toLocaleDateString()}
                </p>
                {purchase.invoice_number && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Invoice: {purchase.invoice_number}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-800 dark:text-white">
                  ₱{purchase.total_amount?.toLocaleString() || '0'}
                </p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold mt-1 ${
                  purchase.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                  purchase.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                }`}>
                  {purchase.payment_status.charAt(0).toUpperCase() + purchase.payment_status.slice(1)}
                </span>
              </div>
            </div>

            {purchase.products && purchase.products.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Items:</p>
                <div className="space-y-1 text-sm">
                  {purchase.products.map((product: any, pidx: number) => (
                    <div key={pidx} className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>{product.name} x{product.quantity}</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        ₱{(product.price * product.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {purchase.notes && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Notes:</span> {purchase.notes}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PurchaseHistoryTab;
