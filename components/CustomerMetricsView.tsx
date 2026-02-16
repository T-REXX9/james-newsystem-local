import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { CustomerMetrics } from '../types';
import { fetchCustomerMetrics, fetchPurchaseHistory, fetchPaymentTerms } from '../services/supabaseService';

interface CustomerMetricsViewProps {
  contactId: string;
}

const CustomerMetricsView: React.FC<CustomerMetricsViewProps> = ({ contactId }) => {
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await fetchCustomerMetrics(contactId);
        setMetrics(data);
      } catch (err) {
        console.error('Error loading metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMetrics();
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading metrics...
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No metrics data available
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Avg Monthly Purchase</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                ₱{metrics.average_monthly_purchase?.toLocaleString() || '0'}
              </p>
            </div>
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Purchase Frequency</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-2">
                {metrics.purchase_frequency || 0} days
              </p>
            </div>
            <Calendar className="w-6 h-6 text-green-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase">Outstanding Balance</p>
              <p className={`text-2xl font-bold mt-2 ${metrics.outstanding_balance > 0 ? 'text-orange-900 dark:text-orange-100' : 'text-slate-600'}`}>
                ₱{metrics.outstanding_balance?.toLocaleString() || '0'}
              </p>
            </div>
            <DollarSign className="w-6 h-6 text-orange-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">Total Purchases</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                {metrics.total_purchases || 0}
              </p>
            </div>
            <BarChart3 className="w-6 h-6 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Detailed Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Order Value</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">
              ₱{metrics.average_order_value?.toLocaleString() || '0'}
            </p>
          </div>
          {metrics.last_purchase_date && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last Purchase</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">
                {new Date(metrics.last_purchase_date).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Currency</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">
              {metrics.currency || 'PHP'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerMetricsView;
