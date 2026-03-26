import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  cancelOrderSlip,
  finalizeOrderSlip,
  getOrderSlip,
  getAllOrderSlips,
  printOrderSlip,
  updateOrderSlip,
} from '../services/orderSlipLocalApiService';
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import { isOrderSlipAllowedForTransactionType, syncDocumentPolicyState, unpostSalesOrder } from '../services/salesOrderLocalApiService';
import { Contact, OrderSlip, OrderSlipStatus } from '../types';
import { applyOptimisticUpdate } from '../utils/optimisticUpdates';
import { getLocalAuthSession } from '../services/localAuthService';
import { normalizePriceGroup } from '../constants/pricingGroups';

interface OrderSlipViewProps {
  initialSlipId?: string;
  initialSlipRefNo?: string;
}

const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ORDER_SLIP_LIST_COLUMN_WIDTHS = [
  '8rem',
  '26%',
  '11rem',
  '11rem',
  '10rem',
  '11rem',
  '14%',
  '10rem',
];

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const formatCurrency = (value?: number | string | null): string => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString()}`;
};

const OrderSlipView: React.FC<OrderSlipViewProps> = ({ initialSlipId, initialSlipRefNo }) => {
  const [selectedSlip, setSelectedSlip] = useState<OrderSlip | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderSlipStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [finalizing, setFinalizing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [orderSlips, setOrderSlips] = useState<OrderSlip[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [unpostModalOpen, setUnpostModalOpen] = useState(false);
  const [unpostLoading, setUnpostLoading] = useState(false);
  const [trackingNoDraft, setTrackingNoDraft] = useState('');
  const [trackingSaveLoading, setTrackingSaveLoading] = useState(false);

  const isAdmin = useMemo(() => {
    const session = getLocalAuthSession();
    const userType = String(session?.context?.user?.type || session?.context?.user_type || '').toLowerCase();
    return userType === 'admin' || userType === 'administrator';
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const contactsData = await fetchContacts();
      setContacts(contactsData);
    } catch (err) {
      console.error('Failed loading order slip contacts:', err);
      setContacts([]);
    }
  }, []);

  const loadOrderSlips = useCallback(async () => {
    setLoading(true);
    try {
      const allSlips = await getAllOrderSlips();

      // Client-side filtering
      let filtered = allSlips;

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter((slip) => slip.status === statusFilter);
      }

      // Filter by month/year
      if (month !== undefined && year !== undefined) {
        filtered = filtered.filter((slip) => {
          const slipDate = new Date(slip.created_at || '');
          if (Number.isNaN(slipDate.getTime())) return false;
          return (
            slipDate.getMonth() + 1 === month &&
            slipDate.getFullYear() === year
          );
        });
      }

      // Client-side smart search filtering
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const isRefNoLike = /[\d-]/g.test(query); // Contains numbers or dashes

        filtered = filtered.filter((slip) => {
          // Always search slip_no, reference_no, and remarks
          const refMatch = (slip.slip_no || '').toLowerCase().includes(query) ||
                          (slip.reference_no || '').toLowerCase().includes(query) ||
                          (slip.remarks || '').toLowerCase().includes(query);

          if (refMatch) return true;

          // For text-based searches, also match customer names
          if (!isRefNoLike) {
            const customerMatch = contacts.some(
              contact => contact.id === slip.contact_id &&
                         (contact.company || '').toLowerCase().includes(query)
            );
            if (customerMatch) return true;
          }

          return false;
        });
      }

      // Client-side pagination
      const perPage = 50;
      const totalFiltered = filtered.length;
      const computedTotalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
      const start = (page - 1) * perPage;
      const paged = filtered.slice(start, start + perPage);

      setOrderSlips(paged);
      setTotalPages(computedTotalPages);
    } catch (err) {
      console.error('Failed loading order slips:', err);
      setOrderSlips([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [month, year, debouncedSearch, statusFilter, page, contacts]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmedSearch = searchTerm.trim();
      // Only update if search value actually changed
      if (trimmedSearch !== debouncedSearch) {
        setPage(1);
        setDebouncedSearch(trimmedSearch);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    loadOrderSlips();
  }, [loadOrderSlips]);

  const customerMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => String(a.company || '').localeCompare(String(b.company || ''), undefined, { sensitivity: 'base' })),
    [contacts]
  );

  const notifyOrderSlipEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: 'success' | 'failed',
    entityId: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    void title;
    void message;
    void action;
    void status;
    void entityId;
    void type;
  }, []);

  const navigateToModule = useCallback((tab: string, payload?: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab, payload } }));
  }, []);

  useEffect(() => {
    if (orderSlips.length > 0 && !selectedSlip) {
      setSelectedSlip(orderSlips[0]);
    }
  }, [orderSlips, selectedSlip]);

  useEffect(() => {
    if (!orderSlips.length) return;
    const slipById = initialSlipId ? orderSlips.find(entry => entry.id === initialSlipId) : null;
    const slipByNo = initialSlipRefNo
      ? orderSlips.find(entry => String(entry.slip_no || '').toLowerCase() === initialSlipRefNo.toLowerCase())
      : null;
    const slip = slipById || slipByNo;
    if (slip) setSelectedSlip(slip);
  }, [initialSlipId, initialSlipRefNo, orderSlips]);

  useEffect(() => {
    if (!selectedSlip?.id) return;
    let active = true;
    getOrderSlip(selectedSlip.id)
      .then((detail) => {
        if (!active || !detail) return;
        setSelectedSlip(detail);
        setTrackingNoDraft(detail.tracking_no || '');
      })
      .catch((err) => {
        console.error('Failed loading selected order slip detail:', err);
      });
    return () => {
      active = false;
    };
  }, [selectedSlip?.id]);

  useEffect(() => {
    setTrackingNoDraft(selectedSlip?.tracking_no || '');
  }, [selectedSlip?.id, selectedSlip?.tracking_no]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, month, year]);

  const selectedCustomer = selectedSlip ? customerMap.get(selectedSlip.contact_id) : null;
  const selectedCustomerLabel = selectedCustomer?.company || selectedSlip?.customer_name || selectedSlip?.contact_id || '-';
  const selectedSlipPriceGroupDisplay = normalizePriceGroup(selectedSlip?.price_group || '');
  const canProcessOrderSlip = isOrderSlipAllowedForTransactionType(selectedCustomer?.transactionType);

  useEffect(() => {
    syncDocumentPolicyState(selectedCustomer?.transactionType || null);
  }, [selectedCustomer?.transactionType]);

  const activeFilterLabel = useMemo(() => {
    if (!month || !year) return 'All Records';
    return `${MONTH_OPTIONS[month - 1]} ${year}`;
  }, [month, year]);

  const orderRowTone = (slip: OrderSlip) => {
    if (slip.status === OrderSlipStatus.CANCELLED) return 'text-red-600';
    if (selectedSlip?.id === slip.id) return 'text-brand-blue';
    return 'text-slate-700 dark:text-slate-200';
  };

  const handleMonthChange = (monthValue: string) => {
    if (!monthValue) {
      setMonth(undefined);
      return;
    }
    setMonth(Number(monthValue));
    if (!year) setYear(new Date().getFullYear());
  };

  const handleYearChange = (yearValue: string) => {
    if (!yearValue) {
      setYear(undefined);
      return;
    }
    setYear(Number(yearValue));
    if (!month) setMonth(new Date().getMonth() + 1);
  };

  const handleFilterApply = async () => {
    setPage(1);
    await loadOrderSlips();
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setMonth(undefined);
    setYear(undefined);
    setPage(1);
    setSelectedSlip(null);
  };

  const handleFinalize = async () => {
    if (!selectedSlip || !canProcessOrderSlip) return;
    setFinalizing(true);

    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: OrderSlipStatus.FINALIZED } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, status: OrderSlipStatus.FINALIZED } : null);

    try {
      const updated = await finalizeOrderSlip(selectedSlip.id);
      if (updated) {
        setOrderSlips(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedSlip(updated);
      }
      await notifyOrderSlipEvent('Order Slip Finalized', `Order Slip ${selectedSlip.slip_no} marked as finalized.`, 'finalize', 'success', selectedSlip.id);
    } catch (err) {
      console.error('Error finalizing order slip:', err);
      await notifyOrderSlipEvent('Order Slip Finalization Failed', `Failed to finalize order slip ${selectedSlip.slip_no}.`, 'finalize', 'failed', selectedSlip.id, 'error');
      alert('Failed to finalize order slip');
    } finally {
      setFinalizing(false);
      await loadOrderSlips();
    }
  };

  const handlePrint = async () => {
    if (!selectedSlip || !canProcessOrderSlip) return;
    setPrinting(true);

    const printedAt = new Date().toISOString();
    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { printed_at: printedAt } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, printed_at: printedAt } : null);

    try {
      const updated = await printOrderSlip(selectedSlip.id);
      if (updated) {
        setOrderSlips(prev => prev.map(row => row.id === updated.id ? updated : row));
        setSelectedSlip(updated);
      }
      await notifyOrderSlipEvent('Order Slip Printed', `Order Slip ${selectedSlip.slip_no} was printed.`, 'print', 'success', selectedSlip.id);
      window.print();
    } catch (err) {
      console.error('Error printing order slip:', err);
      await notifyOrderSlipEvent('Order Slip Print Failed', `Failed to print order slip ${selectedSlip.slip_no}.`, 'print', 'failed', selectedSlip.id, 'error');
      alert('Failed to mark order slip as printed');
    } finally {
      setPrinting(false);
      await loadOrderSlips();
    }
  };

  const handleCancelOrderSlip = async () => {
    if (!selectedSlip || !cancelReason.trim()) return;
    setCancelLoading(true);

    const previousStatus = selectedSlip.status;
    setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: OrderSlipStatus.CANCELLED } as Partial<OrderSlip>));
    setSelectedSlip(prev => prev ? { ...prev, status: OrderSlipStatus.CANCELLED } : null);

    try {
      await cancelOrderSlip(selectedSlip.id, cancelReason.trim());
      setCancelModalOpen(false);
      setCancelReason('');
      await loadOrderSlips();
    } catch (err) {
      console.error('Failed to cancel order slip:', err);
      setOrderSlips(prev => applyOptimisticUpdate(prev, selectedSlip.id, { status: previousStatus } as Partial<OrderSlip>));
      setSelectedSlip(prev => prev ? { ...prev, status: previousStatus } : null);
      alert('Failed to cancel order slip');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUnpostOrderSlip = async () => {
    if (!selectedSlip) return;
    setUnpostLoading(true);

    try {
      const salesOrderId = String(selectedSlip.order_id || '').trim();
      if (!salesOrderId) {
        throw new Error('This order slip is not linked to a sales order.');
      }

      await unpostSalesOrder(salesOrderId);
      setUnpostModalOpen(false);
      await loadOrderSlips();
      navigateToModule('salesorder', { orderId: salesOrderId });
    } catch (err) {
      console.error('Failed to unpost order slip:', err);
      alert(err instanceof Error ? err.message : 'Failed to unpost order slip');
    } finally {
      setUnpostLoading(false);
    }
  };

  const handleSaveTrackingNo = async () => {
    if (!selectedSlip) return;
    setTrackingSaveLoading(true);
    try {
      const updated = await updateOrderSlip(selectedSlip.id, {
        tracking_no: trackingNoDraft.trim(),
      });
      if (updated) {
        setSelectedSlip(updated);
        setOrderSlips(prev => prev.map(row => row.id === updated.id ? { ...row, tracking_no: updated.tracking_no } : row));
      }
      await loadOrderSlips();
    } catch (err) {
      console.error('Failed to update order slip tracking number:', err);
      alert('Failed to update tracking number');
    } finally {
      setTrackingSaveLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white dark:bg-slate-900 p-3 gap-4">
      {/* Filter bar + List table card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between text-sm">
            <div className="flex flex-wrap items-center gap-2 flex-grow">
              <div className="relative flex-grow max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by ref no. or customer name..."
                  className="w-full pl-9 pr-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderSlipStatus)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                {Object.values(OrderSlipStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">Filter by Month:</span>
              <select
                value={month !== undefined ? String(month) : ''}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <option value="">All</option>
                {MONTH_OPTIONS.map((m, index) => (
                  <option key={m} value={index + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year || ''}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-28 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                placeholder="Year"
              />
              <button
                type="button"
                onClick={handleFilterApply}
                className="px-4 py-2 rounded bg-slate-700 text-white dark:bg-slate-700"
              >
                Filter
              </button>
            </div>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Filtered By:</span> {activeFilterLabel}
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                {ORDER_SLIP_LIST_COLUMN_WIDTHS.map((width) => (
                  <col key={width} style={{ width }} />
                ))}
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">SO No.</th>
                  <th className="px-3 py-2 text-left">OS No.</th>
                  <th className="px-3 py-2 text-left">DM No.</th>
                  <th className="px-3 py-2 text-left">Tracking No.</th>
                  <th className="px-3 py-2 text-left">Sales Person</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
            </table>
            <div className="max-h-[220px] overflow-y-auto border border-t-0 border-slate-300 dark:border-slate-700">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {ORDER_SLIP_LIST_COLUMN_WIDTHS.map((width) => (
                    <col key={width} style={{ width }} />
                  ))}
                </colgroup>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Loading slips...
                        </span>
                      </td>
                    </tr>
                  )}
                  {!loading && orderSlips.map((slip, index) => {
                    const customer = customerMap.get(slip.contact_id);
                    return (
                      <tr
                        key={slip.id}
                        onClick={() => setSelectedSlip(slip)}
                        className={`cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/60'} hover:bg-slate-100 dark:hover:bg-slate-800 ${orderRowTone(slip)}`}
                      >
                        <td className="px-3 py-2">{formatDate(slip.sales_date)}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={customer?.company || slip.contact_id}>
                            {customer?.company || slip.customer_name || slip.contact_id}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all leading-5" title={slip.sales_no || slip.order_id || '-'}>
                            {slip.sales_no || slip.order_id || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 break-all font-semibold leading-5" title={slip.slip_no || '-'}>
                            {slip.slip_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">{slip.debit_memo_no || '-'}</td>
                        <td className="px-3 py-2">{slip.tracking_no || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={slip.sales_person || '-'}>
                            {slip.sales_person || '-'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={slip.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && orderSlips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                        No order slips match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded border border-slate-300 disabled:opacity-40 dark:border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded border border-slate-300 disabled:opacity-40 dark:border-slate-700"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail section */}
      {selectedSlip ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-base uppercase text-slate-900 dark:text-slate-100">ORDER SLIP</h4>
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">OS No.:</span>
              <input readOnly value={selectedSlip.slip_no} className="w-40 inline-block px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200" />
              <StatusBadge status={selectedSlip.status} className="text-[10px] px-2 py-0.5" />
            </div>
          </div>

          <div className="p-4 text-sm space-y-4">
            {/* Header info table */}
            <div className="overflow-x-auto">
              <table width="100%" cellPadding="8" className="tlbcustom text-sm text-slate-700 dark:text-slate-200">
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sold to:</td>
                    <td><input readOnly value={selectedCustomerLabel} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Date:</td>
                    <td><input readOnly value={selectedSlip.sales_date || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Terms Strictly:</td>
                    <td><input readOnly value={selectedSlip.terms || 'N/A'} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Address:</td>
                    <td><input readOnly value={selectedSlip.delivery_address || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Reference No.:</td>
                    <td><input readOnly value={selectedSlip.reference_no || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Salesperson:</td>
                    <td><input readOnly value={selectedSlip.sales_person || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Shipped Via:</td>
                    <td><input readOnly value={selectedSlip.send_by || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Prod Type:</td>
                    <td><input readOnly value={selectedSlip.product_type || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap"></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Del. to:</td>
                    <td><input readOnly value={selectedSlip.delivered_to || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">PO No.:</td>
                    <td><input readOnly value={selectedSlip.po_number || ''} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" /></td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap"></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Tracking No.:</td>
                    <td>
                      <select
                        value={trackingNoDraft}
                        onChange={(e) => setTrackingNoDraft(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm"
                      >
                        <option value="">Select Tracking</option>
                        {selectedSlip.tracking_no && !selectedSlip.tracking_options?.includes(selectedSlip.tracking_no) ? (
                          <option value={selectedSlip.tracking_no}>{selectedSlip.tracking_no}</option>
                        ) : null}
                        {(selectedSlip.tracking_options || []).map((trackingNo) => (
                          <option key={trackingNo} value={trackingNo}>
                            {trackingNo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td colSpan={4}>
                      <button
                        type="button"
                        onClick={handleSaveTrackingNo}
                        disabled={trackingSaveLoading || trackingNoDraft === (selectedSlip.tracking_no || '')}
                        className="px-3 py-2 rounded bg-slate-700 text-white text-sm disabled:opacity-50"
                      >
                        {trackingSaveLoading ? 'Saving...' : 'Update Tracking'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <WorkflowStepper currentStage="document" documentLabel="Order Slip" />

            {!canProcessOrderSlip && selectedCustomer && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded p-2">
                {selectedCustomer.company} is configured for invoice issuance. Order slip actions are disabled for this customer.
              </div>
            )}

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-sm border border-slate-300 dark:border-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Part No.</th>
                    <th className="px-3 py-2 text-left">Item Code</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Qty</th>
                    <th className="px-3 py-2 text-left">Unit Price</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {selectedSlip.items?.map((item, index) => (
                    <tr key={item.id || `${item.item_code}-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/30">
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{index + 1}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.part_no || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.item_code || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.location || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.description || '-'}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{item.qty}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-right font-bold border-t border-slate-200 dark:border-slate-700">Grand Total</td>
                    <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-700">
                      <span className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 font-bold text-brand-blue">{formatCurrency(selectedSlip.grand_total)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedSlip.printed_at && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Printed {new Date(selectedSlip.printed_at).toLocaleString()}
              </div>
            )}

            {/* Action buttons bar (footbar) */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
              {selectedSlip.status === OrderSlipStatus.DRAFT && canProcessOrderSlip && (
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
                >
                  {finalizing ? 'Finalizing...' : 'Finalize'}
                </button>
              )}
              {(!selectedSlip.printed_at || isAdmin) && canProcessOrderSlip && (
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing}
                  className="px-3 py-2 rounded bg-slate-500 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print'}
                </button>
              )}
              {selectedSlip.status !== OrderSlipStatus.CANCELLED && canProcessOrderSlip && (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="px-3 py-2 rounded bg-slate-500 text-white text-sm"
                >
                  Cancel
                </button>
              )}
              {selectedSlip.status === OrderSlipStatus.FINALIZED && (
                <button
                  type="button"
                  onClick={() => setUnpostModalOpen(true)}
                  className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                >
                  UNPOST
                </button>
              )}
              <button
                type="button"
                onClick={() => navigateToModule('salesorder', { orderId: selectedSlip.order_id })}
                className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm"
              >
                View Sales Order
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-16 text-center text-slate-500">
          Select an order slip from the table above to view its full details.
        </div>
      )}

      {/* Search modal */}
      {/* Cancel modal */}
      {cancelModalOpen && selectedSlip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Cancel Order Slip</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Are you sure you want to cancel this Order Slip? This cannot be undone.
            </div>
            <label className="block text-sm text-slate-700 dark:text-slate-200">
              <span className="block mb-1">Reason to Cancel:</span>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelReason('');
                }}
                className="px-3 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCancelOrderSlip}
                disabled={!cancelReason.trim() || cancelLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {cancelLoading ? 'Processing...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpost modal */}
      {unpostModalOpen && selectedSlip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Unposting</h3>
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              NOTE: Unposting will withdraw the Ledger entry, delete the DR/Invoice attached and open the sales inquiry.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnpostModalOpen(false)}
                className="px-3 py-2 text-sm rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUnpostOrderSlip}
                disabled={unpostLoading}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-50"
              >
                {unpostLoading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSlipView;
