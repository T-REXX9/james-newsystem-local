import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Search, Sheet, Users } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import {
  fetchCustomersForDailyCall,
  subscribeToDailyCallMonitoringUpdates,
} from '../services/dailyCallMonitoringService';
import { DailyCallCustomerFilterStatus, DailyCallCustomerRow, UserProfile } from '../types';
import { useToast } from './ToastProvider';
import DailyCallCustomerDetailModal from './DailyCallCustomerDetailModal';

interface DailyCallExcelFormatViewProps {
  currentUser: UserProfile | null;
}

const statusFilters: Array<{ id: DailyCallCustomerFilterStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive+' },
  { id: 'prospective', label: 'Prospective+' },
];

const rowHeightPx = 42;
const viewportHeightPx = 530;

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const toShortK = (value: number) => `${Math.round((value || 0) / 1000)}k`;

const resolveDealerPriceTier = (row: DailyCallCustomerRow) => {
  const raw = String(row.dealerPriceGroup || '').trim().toLowerCase();
  if (raw.includes('gold') || raw === 'vip3') return 'gold';
  if (raw.includes('silver') || raw === 'vip2') return 'silver';
  if (raw.includes('regular') || raw === 'vip1') return 'regular';
  if (row.monthlyOrder >= 30000) return 'gold';
  if (row.monthlyOrder >= 10000) return 'silver';
  return 'regular';
};

const vipTargetLabel = (monthlySales: number) => {
  if (monthlySales >= 30000) {
    return 'gold';
  }
  if (monthlySales >= 10000) {
    return `-${toShortK(30000 - monthlySales)}/gold`;
  }
  return `-${toShortK(10000 - monthlySales)}/silver`;
};

const DailyCallExcelFormatView: React.FC<DailyCallExcelFormatViewProps> = ({ currentUser }) => {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<DailyCallCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DailyCallCustomerFilterStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const loadRows = useCallback(
    async (withLoading = true) => {
      if (withLoading) {
        setLoading(true);
      }

      setError(null);
      const rows = await fetchCustomersForDailyCall({
        status: statusFilter,
        search: debouncedSearch,
      });

      setCustomers(rows);
      if (withLoading) setLoading(false);
    },
    [debouncedSearch, statusFilter]
  );

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const unsubscribe = subscribeToDailyCallMonitoringUpdates({
      onInsert: () => loadRows(false),
      onUpdate: () => loadRows(false),
      onDelete: () => loadRows(false),
      onError: () => {
        setError('Unable to sync realtime updates.');
      },
    });

    return unsubscribe;
  }, [loadRows]);

  useEffect(() => {
    const selectedExists = customers.some((row) => row.id === selectedCustomerId);
    if (!selectedExists) {
      setSelectedCustomerId(null);
      setIsDetailModalOpen(false);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const runRetry = async () => {
    setError(null);
    try {
      await loadRows();
      addToast({ type: 'success', title: 'Refreshed', description: 'Customer data updated.' });
    } catch {
      setError('Unable to refresh data.');
    }
  };

  const handleCloseModal = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedCustomerId(null);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading daily call records...
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Sheet className="h-4 w-4 text-blue-600" />
            Excel-format customer monitoring
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, city, contact"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const isActive = filter.id === statusFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </span>
          <button
            type="button"
            onClick={runRetry}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-70" />
          <p className="font-semibold">No customers found for this view.</p>
          <p className="mt-1 text-xs">Try adjusting the status filter or search query.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {customers.length} customer{customers.length > 1 ? 's' : ''}
            </p>
          </div>

          <div
            className="overflow-x-hidden overflow-y-hidden"
            style={{ overscrollBehaviorX: 'contain', overflowAnchor: 'none' }}
          >
            <div
              className="w-full overflow-y-auto overflow-x-hidden"
              style={{ height: `${viewportHeightPx}px`, overscrollBehaviorY: 'contain', overflowAnchor: 'none' }}
            >
            <table className="w-full table-fixed divide-y divide-slate-200 text-[10px] dark:divide-slate-700">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="px-1 py-1.5 text-center font-semibold text-slate-600">
                    #
                  </th>
                  <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-100 px-1.5 py-1.5 text-left font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900">
                    CUSTOMER
                  </th>
                  <th className="px-1.5 py-1.5 text-left font-semibold text-slate-600">LOCATION</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold text-slate-600">ASSIGNED</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold text-slate-600">DEALER</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold text-slate-600">STATUS</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold text-slate-600">AVG</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold text-slate-600">CURRENT</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold text-slate-600">VIP</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold text-slate-600">TERMS</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold text-slate-600">BAL</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((row, index) => {
                  const isSelected = selectedCustomerId === row.id;
                  const dealerPriceTier = resolveDealerPriceTier(row);
                  const location = row.province || row.city || '—';
                  const statusDate = row.statusDate || row.clientSince || '—';
                  const terms = row.terms || row.modeOfPayment || '—';
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedCustomerId(row.id);
                        setIsDetailModalOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedCustomerId(row.id);
                          setIsDetailModalOpen(true);
                        }
                      }}
                      className={`cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white hover:bg-slate-50 dark:bg-slate-900/40 dark:hover:bg-slate-800/50'}`}
                      style={{ height: `${rowHeightPx}px` }}
                    >
                      <td className="px-1 py-1.5 text-center text-slate-600">{index + 1}</td>
                      <td className="sticky left-0 z-[1] border-r border-slate-100 bg-inherit px-1.5 py-1.5 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100 truncate" title={row.shopName}>
                        {row.shopName}
                      </td>
                      <td className="px-1.5 py-1.5 text-slate-600 truncate" title={location}>{location}</td>
                      <td className="px-1.5 py-1.5 text-slate-600">
                        <div className="font-medium text-slate-700 dark:text-slate-200 truncate" title={row.assignedTo}>{row.assignedTo}</div>
                        <div className="text-[9px] text-slate-500 truncate" title={row.assignedDate || '—'}>{row.assignedDate || '—'}</div>
                      </td>
                      <td className="px-1.5 py-1.5 text-slate-600">
                        <div className="font-medium text-slate-700 dark:text-slate-200 capitalize truncate">{dealerPriceTier}</div>
                        <div className="text-[9px] text-slate-500 truncate" title={row.dealerPriceDate || row.ishinomotoDealerSince || '—'}>{row.dealerPriceDate || row.ishinomotoDealerSince || '—'}</div>
                      </td>
                      <td className="px-1.5 py-1.5 text-slate-600">
                        <div className="font-medium text-slate-700 dark:text-slate-200 capitalize truncate">{row.status}</div>
                        <div className="text-[9px] text-slate-500 truncate" title={statusDate}>{statusDate}</div>
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-slate-700 truncate" title={toCurrency(row.averageMonthlyOrder)}>{toCurrency(row.averageMonthlyOrder)}</td>
                      <td className="px-1.5 py-1.5 text-right font-semibold text-slate-900 dark:text-white truncate" title={toCurrency(row.monthlyOrder)}>{toCurrency(row.monthlyOrder)}</td>
                      <td className="px-1.5 py-1.5 text-slate-700 font-semibold lowercase truncate" title={vipTargetLabel(row.monthlyOrder)}>{vipTargetLabel(row.monthlyOrder)}</td>
                      <td className="px-1.5 py-1.5 text-slate-600 truncate" title={terms}>{terms}</td>
                      <td className="px-1.5 py-1.5 text-right text-slate-700 truncate" title={toCurrency(row.outstandingBalance)}>{toCurrency(row.outstandingBalance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedCustomer && (
        <DailyCallCustomerDetailModal
          isOpen={isDetailModalOpen}
          customer={selectedCustomer}
          currentUser={currentUser}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default DailyCallExcelFormatView;
