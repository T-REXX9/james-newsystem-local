import React from 'react';
import { ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import type { InventoryLogWithProduct } from '../types';

interface InventoryLogRowProps {
  log: InventoryLogWithProduct;
  showWarehouse: boolean;
  onReferenceClick?: (log: InventoryLogWithProduct) => void;
}

const InventoryLogRow: React.FC<InventoryLogRowProps> = ({ log, showWarehouse, onReferenceClick }) => {
  const isStockIn = log.status_indicator === '+';
  const dateStr = new Date(log.date).toLocaleDateString();
  const timeStr = new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <tr className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
      isStockIn ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'bg-rose-50/30 dark:bg-rose-900/10'
    }`}>
      {/* Date */}
      <td className="p-3 text-xs text-slate-600 dark:text-slate-300">
        <div>{dateStr}</div>
        <div className="text-[10px] text-slate-400">{timeStr}</div>
      </td>

      {/* Transaction Type */}
      <td className="p-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1">
          {isStockIn ? <ArrowLeft className="w-3 h-3 text-emerald-500" /> : <ArrowRight className="w-3 h-3 text-rose-500" />}
          {log.transaction_type}
        </span>
      </td>

      {/* Reference No - Clickable */}
      <td className="p-3 text-xs">
        <button
          onClick={() => onReferenceClick?.(log)}
          className="flex items-center gap-1 text-brand-blue hover:underline font-medium"
          title={`Navigate to ${log.transaction_type}`}
        >
          {log.reference_no}
          <ExternalLink className="w-3 h-3" />
        </button>
      </td>

      {/* Partner */}
      <td className="p-3 text-xs text-slate-600 dark:text-slate-300">
        {log.partner}
      </td>

      {/* Qty In/Out */}
      <td className="p-3 text-xs text-right">
        {isStockIn ? (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            +{log.qty_in}
          </span>
        ) : (
          <span className="font-bold text-rose-600 dark:text-rose-400">
            -{log.qty_out}
          </span>
        )}
      </td>

      {/* Unit Price (only for stock-out) */}
      <td className="p-3 text-xs text-right text-slate-600 dark:text-slate-300">
        {isStockIn ? '-' : `₱${Number(log.unit_price).toLocaleString()}`}
      </td>

      {/* Warehouse */}
      {showWarehouse && (
        <td className="p-3 text-xs text-center">
          <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold">
            {log.warehouse_id}
          </span>
        </td>
      )}

      {/* Running Balance */}
      <td className="p-3 text-xs text-right">
        <span className={`font-bold ${log.balance && log.balance >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-rose-600 dark:text-rose-400'}`}>
          {log.balance !== undefined ? log.balance.toLocaleString() : '-'}
        </span>
      </td>

      {/* Notes */}
      <td className="p-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
        {log.notes || '-'}
      </td>
    </tr>
  );
};

export default InventoryLogRow;
