import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { fetchDailyCallPurchaseHistory } from '../services/dailyCallCustomerDetailService';
import { shouldSuppressAuthError } from '../services/localApiAuth';

interface PurchaseProduct {
  name?: string;
  quantity?: number | string;
  price?: number | string;
}

interface PurchaseRecord {
  id?: string;
  purchase_date?: string;
  invoice_number?: string;
  total_amount?: number | string;
  payment_status?: string;
  notes?: string;
  products?: PurchaseProduct[];
}

interface PurchaseMonth {
  key: string;
  label: string;
  purchases: PurchaseRecord[];
  total: number;
}

interface PurchaseHistoryTabProps {
  contactId: string;
}

const pesoFormat = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const toAmount = (value: number | string | undefined): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const getMonthKey = (value: string | undefined): string => {
  const match = /^(\d{4})-(\d{2})/.exec(value || '');
  if (!match) return 'unknown';
  return `${match[1]}-${match[2]}`;
};

const formatMonth = (key: string): string => {
  if (key === 'unknown') return 'Date unavailable';
  const date = new Date(`${key}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
};

const formatPurchaseDate = (value: string | undefined): string => {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
};

const formatStatus = (value: string | undefined): string => {
  const status = value?.trim();
  if (!status) return 'Status unavailable';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const PurchaseHistoryTab: React.FC<PurchaseHistoryTabProps> = ({ contactId }) => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadPurchases = async () => {
      setLoading(true);
      setLoadError(null);
      setPurchases([]);
      try {
        const data = await fetchDailyCallPurchaseHistory(contactId);
        if (active) setPurchases(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) {
          setPurchases([]);
        }
        if (!shouldSuppressAuthError(err) && active) {
          console.error('Error loading purchase history:', err);
          setLoadError(err instanceof Error ? err.message : 'Purchase history is unavailable.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPurchases();
    return () => {
      active = false;
    };
  }, [contactId]);

  const months = useMemo<PurchaseMonth[]>(() => {
    const grouped = new Map<string, PurchaseMonth>();
    for (const purchase of purchases) {
      const key = getMonthKey(purchase.purchase_date);
      let month = grouped.get(key);
      if (!month) {
        month = { key, label: formatMonth(key), purchases: [], total: 0 };
        grouped.set(key, month);
      }
      month.purchases.push(purchase);
      month.total += toAmount(purchase.total_amount);
    }
    return Array.from(grouped.values());
  }, [purchases]);

  const totalValue = months.reduce((total, month) => total + month.total, 0);

  if (loading) {
    return <div className="p-6 text-center text-base text-slate-600 dark:text-slate-300" role="status">Loading purchase history…</div>;
  }

  if (purchases.length === 0) {
    if (loadError) {
      return <div className="p-6 text-center text-base text-rose-700 dark:text-rose-300" role="alert">{loadError}</div>;
    }
    return (
      <div className="p-8 text-center text-base text-slate-600 dark:text-slate-300">
        <ShoppingCart aria-hidden="true" className="mx-auto mb-3 h-9 w-9 opacity-50" />
        <p>No purchase history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <section className="rounded border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-800" aria-label="Purchase summary">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Total Purchase Value</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{pesoFormat.format(totalValue)}</p>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-300">Across {purchases.length} transaction{purchases.length === 1 ? '' : 's'}</p>
      </section>

      <div className="space-y-7">
        {months.map((month) => (
          <section key={month.key} className="overflow-hidden rounded border border-slate-300 dark:border-slate-700" aria-labelledby={`purchase-month-${contactId}-${month.key}`}>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <h3 id={`purchase-month-${contactId}-${month.key}`} className="text-lg font-bold text-slate-900 dark:text-white">{month.label}</h3>
              <p className="text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {month.purchases.length} transaction{month.purchases.length === 1 ? '' : 's'} · {pesoFormat.format(month.total)}
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-base">
                <thead className="bg-white text-left text-sm font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <tr>
                    <th scope="col" className="border-b border-slate-300 px-4 py-3 dark:border-slate-700">Date / Reference</th>
                    <th scope="col" className="border-b border-slate-300 px-4 py-3">Items</th>
                    <th scope="col" className="border-b border-slate-300 px-4 py-3">Payment</th>
                    <th scope="col" className="border-b border-slate-300 px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {month.purchases.map((purchase, index) => {
                    const products = Array.isArray(purchase.products) ? purchase.products : [];
                    const status = purchase.payment_status?.toLowerCase();
                    const statusClass = status === 'paid'
                      ? 'text-emerald-800 dark:text-emerald-300'
                      : status === 'pending'
                        ? 'text-amber-800 dark:text-amber-300'
                        : status === 'overdue'
                          ? 'text-rose-800 dark:text-rose-300'
                          : 'text-slate-700 dark:text-slate-200';
                    return (
                      <tr key={purchase.id || `${month.key}-${index}`} className="align-top even:bg-slate-50 dark:even:bg-slate-900/40">
                        <td className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                          <p className="font-semibold text-slate-900 dark:text-white">{formatPurchaseDate(purchase.purchase_date)}</p>
                          <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">{purchase.invoice_number || purchase.id || '—'}</p>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                          {products.length > 0 ? (
                            <ul className="space-y-1.5 text-slate-800 dark:text-slate-100">
                              {products.map((product, productIndex) => (
                                <li key={`${product.name || 'item'}-${productIndex}`}>
                                  {product.name || 'Item'} <span className="text-slate-600 dark:text-slate-300">× {toAmount(product.quantity).toLocaleString('en-PH')}</span>
                                  {product.price !== undefined ? <span className="ml-2 whitespace-nowrap text-slate-600 dark:text-slate-300">({pesoFormat.format(toAmount(product.price))} each)</span> : null}
                                </li>
                              ))}
                            </ul>
                          ) : <span className="text-slate-600 dark:text-slate-300">No item details</span>}
                          {purchase.notes ? <p className="mt-2 border-t border-slate-200 pt-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Notes: {purchase.notes}</p> : null}
                        </td>
                        <td className={`border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-700 ${statusClass}`}>{formatStatus(purchase.payment_status)}</td>
                        <td className="border-b border-slate-200 px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:border-slate-700 dark:text-white">{pesoFormat.format(toAmount(purchase.total_amount))}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-bold dark:bg-slate-900">
                    <th scope="row" colSpan={3} className="border-t border-slate-300 px-4 py-3 text-right text-slate-900 dark:border-slate-700 dark:text-white">{month.label} Total</th>
                    <td className="border-t border-slate-300 px-4 py-3 text-right tabular-nums text-slate-900 dark:border-slate-700 dark:text-white">{pesoFormat.format(month.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-end border-t-2 border-slate-400 pt-4 dark:border-slate-600">
        <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">Grand Total: {pesoFormat.format(totalValue)}</p>
      </div>
    </div>
  );
};

export default PurchaseHistoryTab;
