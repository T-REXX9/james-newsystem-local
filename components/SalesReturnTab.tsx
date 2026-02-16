import React, { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle, Clock } from 'lucide-react';
import { fetchSalesReturns, processSalesReturn } from '../services/supabaseService';

interface SalesReturnTabProps {
  contactId: string;
  currentUserId?: string;
}

const SalesReturnTab: React.FC<SalesReturnTabProps> = ({ contactId, currentUserId }) => {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReturns = async () => {
      try {
        const data = await fetchSalesReturns(contactId);
        setReturns(data || []);
      } catch (err) {
        console.error('Error loading sales returns:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadReturns();
  }, [contactId]);

  const handleProcess = async (returnId: string) => {
    try {
      await processSalesReturn(returnId, currentUserId || '');
      setReturns(prev => prev.map(r => r.id === returnId ? { ...r, status: 'processed' } : r));
    } catch (err) {
      console.error('Error processing return:', err);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading sales returns...</div>;
  }

  if (returns.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No sales returns yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {returns.map(returnItem => (
        <div key={returnItem.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-slate-800 dark:text-white">
                  Return - {new Date(returnItem.return_date).toLocaleDateString()}
                </h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  returnItem.status === 'processed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                }`}>
                  {returnItem.status === 'processed' && <CheckCircle className="w-3 h-3" />}
                  {returnItem.status === 'pending' && <Clock className="w-3 h-3" />}
                  {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reason: {returnItem.reason}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-800 dark:text-white">
                ₱{returnItem.total_refund?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Refund</p>
            </div>
          </div>

          <div className="mb-3">
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Products Returned:</h5>
            <div className="space-y-1 text-sm">
              {returnItem.products?.map((product: any, idx: number) => (
                <div key={idx} className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>
                    {product.name} x{product.quantity} @ ₱{product.originalPrice.toLocaleString()}
                  </span>
                  <span className="font-semibold">
                    ₱{product.refundAmount?.toLocaleString() || '0'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {returnItem.notes && (
            <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-900 rounded text-sm text-slate-600 dark:text-slate-300">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes:</p>
              {returnItem.notes}
            </div>
          )}

          {returnItem.status === 'pending' && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => handleProcess(returnItem.id)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded transition-colors"
              >
                Process Return
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SalesReturnTab;
