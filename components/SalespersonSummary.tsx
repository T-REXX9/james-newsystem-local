import React, { useState } from 'react';
import { Users, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { SalespersonTotal } from '../types';

interface SalespersonSummaryProps {
  salespersonTotals: SalespersonTotal[];
  formatCurrency: (amount: number) => string;
}

const SalespersonSummary: React.FC<SalespersonSummaryProps> = ({
  salespersonTotals,
  formatCurrency,
}) => {
  const [expandedSalespersons, setExpandedSalespersons] = useState<Set<string>>(new Set());

  const toggleExpand = (salesperson: string) => {
    const newExpanded = new Set(expandedSalespersons);
    if (newExpanded.has(salesperson)) {
      newExpanded.delete(salesperson);
    } else {
      newExpanded.add(salesperson);
    }
    setExpandedSalespersons(newExpanded);
  };

  const grandTotal = salespersonTotals.reduce((sum, sp) => sum + sp.total, 0);

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg print:shadow-none">
      <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-blue" />
          Salesperson Performance Summary
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Sales breakdown by salesperson and product category
        </p>
      </div>

      <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
        {salespersonTotals.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
            No salesperson data available.
          </div>
        ) : (
          salespersonTotals.map((sp) => {
            const isExpanded = expandedSalespersons.has(sp.salesperson);
            const percentage = grandTotal > 0 ? ((sp.total / grandTotal) * 100).toFixed(1) : '0';

            return (
              <div key={sp.salesperson}>
                <div
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(sp.salesperson)}
                >
                  <div className="flex items-center gap-4">
                    <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {sp.salesperson.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{sp.salesperson}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sp.categories.length} categories
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(sp.total)}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <TrendingUp className="w-3 h-3" />
                        {percentage}% of total
                      </div>
                    </div>
                    <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-blue to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 px-6 py-4 animate-fadeIn">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="text-left py-2 pl-14">Category</th>
                          <th className="text-right py-2">SO Amount</th>
                          <th className="text-right py-2">DR Amount</th>
                          <th className="text-right py-2">Invoice Amount</th>
                          <th className="text-right py-2 pr-4">Total</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {sp.categories.map((cat) => {
                          const catTotal = cat.soAmount + cat.drAmount + cat.invoiceAmount;
                          return (
                            <tr
                              key={cat.category}
                              className="border-t border-slate-200/60 dark:border-slate-700/40"
                            >
                              <td className="py-2 pl-14 text-slate-700 dark:text-slate-300">{cat.category}</td>
                              <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                {cat.soAmount > 0 ? formatCurrency(cat.soAmount) : '-'}
                              </td>
                              <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                {cat.drAmount > 0 ? formatCurrency(cat.drAmount) : '-'}
                              </td>
                              <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                {cat.invoiceAmount > 0 ? formatCurrency(cat.invoiceAmount) : '-'}
                              </td>
                              <td className="py-2 text-right pr-4 font-semibold text-slate-800 dark:text-white">
                                {formatCurrency(catTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {salespersonTotals.length > 0 && (
        <div className="px-6 py-4 bg-brand-blue/10 dark:bg-brand-blue/20 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="font-bold text-brand-blue">Total Sales (All Salespersons)</span>
            <span className="font-bold text-brand-blue text-lg">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalespersonSummary;
