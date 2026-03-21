import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import {
  dailyCollectionService,
  DailyCollectionApproverLog,
  DailyCollectionHeader,
  DailyCollectionItem,
  CollectionCustomer,
  CollectionUnpaidRow,
} from '../services/dailyCollectionService';
import { getLocalAuthSession } from '../services/localAuthService';
import { dispatchWorkflowNotification } from '../services/supabaseService';
import DeleteCollectionReportModal from './DeleteCollectionReportModal';
import { BUTTON_BASE, BUTTON_PRIMARY, BUTTON_SUCCESS } from '../utils/uiConstants';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

const COLLECTION_PAGE_NO = '21';
const COLLECTION_TAB_ID = 'accounting-transactions-daily-collection-entry';

const hasDeletePermission = (): boolean => {
  const session = getLocalAuthSession();
  const webPerms = session?.context?.permissions?.web;
  if (!Array.isArray(webPerms)) return false;
  const perm = webPerms.find(
    (p) => String(p.lpageno) === COLLECTION_PAGE_NO,
  );
  return String(perm?.ldelete_action) === '1';
};

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const toDateInput = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toDisplayDate = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getStatusBadgeClasses = (status?: string): string => {
  switch ((status || '').toLowerCase()) {
    case 'approved':
    case 'posted':
    case 'received':
    case 'deposited':
      return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'rejected':
    case 'cancelled':
    case 'disapproved':
      return 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300';
    case 'submitted':
      return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300';
  }
};

const INPUT_CLASS = 'w-full px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-sm';
const SELECT_CLASS = 'px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-sm';

const DailyCollectionEntryView: React.FC = () => {
  const [headers, setHeaders] = useState<DailyCollectionHeader[]>([]);
  const [selectedRefno, setSelectedRefno] = useState<string>('');
  const [selectedHeader, setSelectedHeader] = useState<DailyCollectionHeader | null>(null);
  const [items, setItems] = useState<DailyCollectionItem[]>([]);
  const [approverLogs, setApproverLogs] = useState<DailyCollectionApproverLog[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const [customers, setCustomers] = useState<CollectionCustomer[]>([]);
  const [unpaidRows, setUnpaidRows] = useState<CollectionUnpaidRow[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Record<string, boolean>>({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter] = useState('All');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [workingAction, setWorkingAction] = useState('');
  const [showDeleteReportModal, setShowDeleteReportModal] = useState(false);
  const [error, setError] = useState('');
  const [showApproverLogsModal, setShowApproverLogsModal] = useState(false);
  const closeApproverLogsModal = useCallback(() => setShowApproverLogsModal(false), []);
  const { dialogRef: approverLogsDialogRef, handleKeyDown: approverLogsKeyDown } =
    useDialogAccessibility(showApproverLogsModal, closeApproverLogsModal);

  const [form, setForm] = useState({
    customerId: '',
    customerCompany: '',
    type: 'Cash',
    bank: '',
    checkNo: '',
    checkDate: toDateInput(new Date().toISOString()),
    amount: '',
    status: 'Received',
    collectDate: toDateInput(new Date().toISOString()),
    remarks: '',
  });
  const session = getLocalAuthSession();
  const actorId = session?.userProfile?.id;
  const actorRole = session?.userProfile?.role || 'Unknown';

  const selectedAmount = useMemo(() => {
    return unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  }, [unpaidRows, selectedTransactions]);

  const customerOptions = useMemo(() => {
    const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
    if (selectedCustomer) return customers;
    if (!form.customerId) return customers;

    return [
      {
        id: form.customerId,
        code: '',
        company: form.customerCompany || form.customerId,
      },
      ...customers,
    ];
  }, [customers, form.customerCompany, form.customerId]);

  const notifyCollectionEvent = useCallback(async (input: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    action: string;
    status: string;
    entityId: string;
    targetRoles?: string[];
    targetUserIds?: string[];
    metadata?: Record<string, unknown>;
  }) => {
    await dispatchWorkflowNotification({
      title: input.title,
      message: input.message,
      type: input.type,
      action: input.action,
      status: input.status,
      entityType: 'daily_collection',
      entityId: input.entityId,
      actionUrl: COLLECTION_TAB_ID,
      actorId,
      actorRole,
      targetRoles: input.targetRoles,
      targetUserIds: input.targetUserIds,
      includeActor: false,
      metadata: {
        collection_refno: input.entityId,
        action_url: COLLECTION_TAB_ID,
        ...input.metadata,
      },
    });
  }, [actorId, actorRole]);

  const totalCheck = useMemo(() => items.filter((i) => i.ltype === 'Check').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const totalTT = useMemo(() => items.filter((i) => i.ltype === 'TT').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const totalCash = useMemo(() => items.filter((i) => i.ltype === 'Cash').reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);
  const grandTotal = useMemo(() => items.reduce((s, i) => s + Number(i.lamt || 0), 0), [items]);

  const postableItems = useMemo(
    () => items.filter((item) => item.lpost !== 1 && item.lcollection_status !== 'Posted'),
    [items],
  );
  const allSelectableChecked = postableItems.length > 0 && selectedItemIds.length === postableItems.length;

  const fetchList = async () => {
    setListLoading(true);
    setError('');
    try {
      let dateFrom = '';
      let dateTo = '';
      if (filterMonth !== 'All') {
        const year = parseInt(filterYear, 10);
        const month = parseInt(filterMonth, 10);
        if (!Number.isNaN(year) && year >= 2000 && year <= 2099) {
          dateFrom = `${year}-${filterMonth}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          dateTo = `${year}-${filterMonth}-${String(lastDay).padStart(2, '0')}`;
        }
      }
      const rows = await dailyCollectionService.listCollections({
        search,
        status: statusFilter,
        dateFrom,
        dateTo,
      });
      setHeaders(rows);
      if (!selectedRefno && rows[0]?.lrefno) {
        setSelectedRefno(rows[0].lrefno);
      } else if (selectedRefno && !rows.some((row) => row.lrefno === selectedRefno)) {
        setSelectedRefno(rows[0]?.lrefno || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load collections');
    } finally {
      setListLoading(false);
    }
  };

  const fetchDetail = async (refno: string) => {
    if (!refno) return;
    setDetailLoading(true);
    setError('');
    setSelectedTransactions({});
    setSelectedItemIds([]);
    try {
      const [header, collectionItems, logs] = await Promise.all([
        dailyCollectionService.getCollection(refno),
        dailyCollectionService.getCollectionItems(refno),
        dailyCollectionService.getApproverLogs(refno),
      ]);
      setSelectedHeader(header);
      setItems(collectionItems);
      setApproverLogs(logs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load collection detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchCustomers = useCallback(async (searchText = '') => {
    setLoadingCustomers(true);
    try {
      const rows = await dailyCollectionService.getCustomers(searchText);
      setCustomers(rows);
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    fetchList();
  }, [statusFilter, filterMonth, filterYear]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchList();
    }, 400);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [search]);

  useEffect(() => {
    if (!selectedRefno) {
      setSelectedHeader(null);
      setItems([]);
      setApproverLogs([]);
      return;
    }
    fetchDetail(selectedRefno);
  }, [selectedRefno]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCustomers(customerSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch, fetchCustomers]);

  useEffect(() => {
    if (!form.customerId) {
      setUnpaidRows([]);
      setSelectedTransactions({});
      return;
    }
    setSelectedTransactions({});
    dailyCollectionService
      .getUnpaidTransactions(form.customerId)
      .then(setUnpaidRows)
      .catch(() => setUnpaidRows([]));
  }, [form.customerId]);

  useEffect(() => {
    if (selectedAmount > 0) {
      setForm((prev) => ({ ...prev, amount: selectedAmount.toFixed(2) }));
    }
  }, [selectedAmount]);

  const handleCreate = async () => {
    setWorkingAction('create');
    setError('');
    try {
      const created = await dailyCollectionService.createCollection();
      await fetchList();
      setSelectedRefno(created.lrefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to create DCR');
    } finally {
      setWorkingAction('');
    }
  };

  const handleAction = async (
    action: 'submitrecord' | 'approverecord' | 'disapproverecord' | 'cancelrecord' | 'postrecord' | 'posttoledger',
  ) => {
    if (!selectedRefno) return;
    let remarks = '';
    if (action === 'disapproverecord') {
      remarks = window.prompt('Reason for disapproval', '') || '';
    }
    setWorkingAction(action);
    setError('');
    try {
      await dailyCollectionService.runAction(selectedRefno, action, remarks);
      await Promise.all([fetchList(), fetchDetail(selectedRefno)]);

      const referenceNo = selectedHeader?.lcolection_no || selectedRefno;
      const submitterUserIds = selectedHeader?.created_by ? [selectedHeader.created_by] : [];
      if (action === 'submitrecord') {
        await notifyCollectionEvent({
          title: 'Collection Submitted',
          message: `Collection ${referenceNo} is submitted and waiting for your approval.`,
          type: 'info',
          action: 'submit_collection',
          status: 'submitted',
          entityId: selectedRefno,
          targetRoles: ['Owner'],
        });
      }
      if (action === 'approverecord') {
        await notifyCollectionEvent({
          title: 'Collection Approved',
          message: `Collection ${referenceNo} has been approved.`,
          type: 'success',
          action: 'approve_collection',
          status: 'approved',
          entityId: selectedRefno,
          targetUserIds: submitterUserIds,
        });
      }
      if (action === 'disapproverecord') {
        await notifyCollectionEvent({
          title: 'Collection Disapproved',
          message: `Collection ${referenceNo} was disapproved.${remarks ? ` Reason: ${remarks}` : ''}`,
          type: 'error',
          action: 'disapprove_collection',
          status: 'disapproved',
          entityId: selectedRefno,
          targetUserIds: submitterUserIds,
          metadata: remarks ? { disapproval_reason: remarks } : undefined,
        });
      }
    } catch (err: any) {
      setError(err?.message || `Failed to run ${action}`);
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteCollectionReport = async () => {
    if (!selectedRefno) return;
    setWorkingAction('delete-report');
    setError('');
    try {
      await dailyCollectionService.deleteCollection(selectedRefno);
      setSelectedRefno('');
      setSelectedHeader(null);
      setItems([]);
      setApproverLogs([]);
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete collection report');
      throw err;
    } finally {
      setWorkingAction('');
    }
  };

  const handlePostSelectedItems = async () => {
    if (!selectedRefno || selectedItemIds.length === 0) return;
    setWorkingAction('post-items');
    setError('');
    try {
      await dailyCollectionService.postItems(selectedRefno, selectedItemIds);
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to post selected lines');
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedRefno || !window.confirm('Delete this payment line?')) return;
    setWorkingAction(`delete-${itemId}`);
    setError('');
    try {
      await dailyCollectionService.deleteItem(itemId);
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete payment line');
    } finally {
      setWorkingAction('');
    }
  };

  const handleDeleteSelectedItems = async () => {
    if (!selectedRefno || selectedItemIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.length} selected payment line(s)?`)) return;
    setWorkingAction('delete-selected');
    setError('');
    try {
      for (const itemId of selectedItemIds) {
        await dailyCollectionService.deleteItem(itemId);
      }
      await fetchDetail(selectedRefno);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete selected lines');
    } finally {
      setWorkingAction('');
    }
  };

  const handleTypeChange = (newType: string) => {
    let autoStatus = 'Received';
    if (newType === 'Check') autoStatus = 'Pending';
    else if (newType === 'TT') autoStatus = 'Deposited';
    else if (newType === 'Cash') autoStatus = 'Received';
    setForm((prev) => ({ ...prev, type: newType, status: autoStatus }));
  };

  const handleSavePayment = async () => {
    if (!selectedRefno) return;
    if (!form.customerId) {
      setError('Customer is required');
      return;
    }
    const amount = Number(form.amount || 0);
    if (!(amount > 0)) {
      setError('Amount must be greater than 0');
      return;
    }
    if (!form.collectDate) {
      setError('Collection date is required');
      return;
    }

    const transactions = unpaidRows
      .filter((row) => selectedTransactions[`${row.transactionType}:${row.lrefno}`])
      .map((row) => ({
        transaction_type: row.transactionType,
        transaction_refno: row.lrefno,
        transaction_no: row.linvoice_no,
        transaction_amount: Number(row.totalAmount || 0),
      }));

    setSavingPayment(true);
    setError('');
    try {
      await dailyCollectionService.addPayment(selectedRefno, {
        customerId: form.customerId,
        type: form.type,
        bank: form.bank,
        checkNo: form.checkNo,
        checkDate: form.checkDate,
        amount,
        status: form.status,
        remarks: form.remarks,
        collectDate: form.collectDate,
        transactions,
      });
      setForm((prev) => ({
        ...prev,
        bank: '',
        checkNo: '',
        amount: '',
        remarks: '',
      }));
      setSelectedTransactions({});
      await Promise.all([fetchDetail(selectedRefno), fetchList()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to add payment line');
    } finally {
      setSavingPayment(false);
    }
  };

  const canAddPayment = selectedHeader?.lstatus === 'Pending' || selectedHeader?.lstatus === 'Submitted' || selectedHeader?.lstatus === 'Posted';

  const renderStatusButtons = () => {
    const status = selectedHeader?.lstatus;
    const primary: React.ReactNode[] = [];
    const secondary: React.ReactNode[] = [];

    if (status === 'Pending') {
      primary.push(
        <button
          key="submit"
          className={`${BUTTON_PRIMARY} min-w-[110px] disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => handleAction('submitrecord')}
          disabled={!!workingAction}
        >
          For Approval
        </button>,
      );
    }
    if (status === 'Submitted') {
      primary.push(
        <button
          key="approve"
          className={`${BUTTON_SUCCESS} min-w-[110px]`}
          onClick={() => handleAction('approverecord')}
          disabled={!!workingAction}
        >
          Approve
        </button>,
        <button
          key="disapprove"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold min-w-[110px] hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => handleAction('disapproverecord')}
          disabled={!!workingAction}
        >
          Disapprove
        </button>,
      );
    }
    if (status === 'Approved') {
      primary.push(
        <button
          key="post"
          className={`${BUTTON_PRIMARY} min-w-[110px] disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => handleAction('postrecord')}
          disabled={!!workingAction}
        >
          Post
        </button>,
      );
    }
    if (selectedRefno) {
      secondary.push(
        <button key="print" className={BUTTON_BASE} onClick={() => window.print()}>
          Print
        </button>,
        <button
          key="logs"
          className={BUTTON_BASE}
          onClick={() => setShowApproverLogsModal(true)}
        >
          Approver Logs
        </button>,
      );
      if (status === 'Pending' && hasDeletePermission()) {
        secondary.push(
          <button
            key="delete-report"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={() => setShowDeleteReportModal(true)}
            disabled={!!workingAction}
          >
            Delete Collection Report
          </button>,
        );
      }
    }

    return { primary, secondary };
  };

  const statusButtons = renderStatusButtons();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 flex gap-3 overflow-hidden p-3">
        {/* Left panel */}
        <div className="w-[280px] shrink-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-3">
            <div className="flex flex-col gap-3 mb-3">
              <button
                className={`w-full px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={handleCreate}
                disabled={workingAction === 'create'}
              >
                Create New
              </button>
              <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-800">
                <select
                  className={`${SELECT_CLASS} min-w-[88px]`}
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="All">All</option>
                  {MONTH_NAMES.map((name, idx) => {
                    const value = String(idx + 1).padStart(2, '0');
                    return (
                      <option key={value} value={value}>
                        {name.substring(0, 3)}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  className={`${INPUT_CLASS} w-[88px]`}
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  min={2000}
                  max={2099}
                />
              </div>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${INPUT_CLASS} pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search DCR no / refno"
              />
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-[110px_1fr] px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b-2 border-brand-blue text-xs font-bold text-slate-700 dark:text-slate-200">
              <span>Date</span>
              <span>DCR No.</span>
            </div>

            {listLoading && <p className="p-3 text-sm text-slate-500 dark:text-slate-400">Loading collections...</p>}
            {!listLoading && headers.length === 0 && (
              <p className="p-3 text-sm text-slate-500 dark:text-slate-400">No collection record found.</p>
            )}

            {headers.map((row) => {
              const active = selectedRefno === row.lrefno;
              return (
                <div
                  key={row.lrefno}
                  onClick={() => setSelectedRefno(row.lrefno)}
                  className={`grid grid-cols-[110px_1fr] px-3 py-2 mx-1 my-0.5 rounded-lg border cursor-pointer transition-colors ${
                    active
                      ? 'border-l-4 border-brand-blue bg-brand-blue/10 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <Calendar size={12} />
                    {toDisplayDate(row.ldatetime) || '-'}
                  </span>
                  <span className={`text-sm font-bold ${active ? 'text-brand-blue' : 'text-slate-900 dark:text-slate-100'}`}>
                    {row.lcolection_no || row.lrefno}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden border-t-4 border-t-brand-blue">
          {!selectedRefno && (
            <div className="h-full grid place-items-center text-slate-500 dark:text-slate-400">
              <p>Select or create a DCR record</p>
            </div>
          )}

          {selectedRefno && (
            <>
              {/* Action bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b-2 border-brand-blue bg-slate-50 dark:bg-slate-800/50">
                <div className="flex flex-wrap gap-2">
                  {statusButtons.primary}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusButtons.secondary}
                </div>
              </div>

              {/* DCR header info */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="border-l-4 border-brand-blue pl-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">Daily Collection Report</p>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">DAILY COLLECTION REPORT</h2>
                    <p className="text-base text-slate-900 dark:text-slate-100 mt-0.5">
                      {selectedHeader?.lcolection_no || selectedRefno}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Date: {toDisplayDate(selectedHeader?.ldatetime) || '-'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Ref No.: {selectedRefno}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(selectedHeader?.lstatus)}`}>
                    {selectedHeader?.lstatus || 'Pending'}
                  </span>
                </div>
                {error && (
                  <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                    {error}
                  </div>
                )}
              </div>

              {/* Content area */}
              <div className="p-4 flex flex-col gap-4 min-h-0 overflow-auto">
                {!detailLoading && canAddPayment && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <button
                        className={`${BUTTON_BASE} text-red-600 border-red-300 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed`}
                        onClick={handleDeleteSelectedItems}
                        disabled={selectedItemIds.length === 0 || !!workingAction}
                      >
                        Delete Selected
                      </button>
                      <button
                        className={`${BUTTON_SUCCESS} disabled:opacity-50 disabled:cursor-not-allowed`}
                        onClick={handlePostSelectedItems}
                        disabled={selectedItemIds.length === 0 || !!workingAction}
                      >
                        Post Selected
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Collection Date</label>
                        <input
                          type="date"
                          className={INPUT_CLASS}
                          value={form.collectDate}
                          onChange={(e) => setForm((prev) => ({ ...prev, collectDate: e.target.value }))}
                        />
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(form.status)}`}>
                        {form.status}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment lines table */}
                <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm min-w-[1400px]">
                    <thead className="bg-slate-800 text-white sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap w-10">
                          <input
                            type="checkbox"
                            className="accent-brand-blue"
                            checked={allSelectableChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedItemIds.length > 0 && !allSelectableChecked;
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIds(postableItems.map((item) => item.lid));
                              } else {
                                setSelectedItemIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Customer</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Transaction No.</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Check/Cash</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Bank</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Check Number</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Check Date</th>
                        <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Amount</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Status</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Remarks</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {detailLoading && (
                        <tr>
                          <td colSpan={11} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                            Loading payment lines...
                          </td>
                        </tr>
                      )}
                      {!detailLoading && items.length === 0 && !canAddPayment && (
                        <tr>
                          <td colSpan={11} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                            No payment lines yet.
                          </td>
                        </tr>
                      )}
                      {!detailLoading && items.map((item, index) => {
                        const posted = item.lpost === 1 || item.lcollection_status === 'Posted';
                        return (
                          <tr
                            key={item.lid}
                            className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'} hover:bg-slate-100 dark:hover:bg-slate-800`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                className="accent-brand-blue"
                                checked={selectedItemIds.includes(item.lid)}
                                disabled={posted}
                                onChange={(e) => {
                                  setSelectedItemIds((prev) => (
                                    e.target.checked ? [...prev, item.lid] : prev.filter((id) => id !== item.lid)
                                  ));
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">{item.lcustomer_fname || item.lcustomer || '-'}</td>
                            <td className="px-3 py-2">{item.ltransaction_no || '-'}</td>
                            <td className="px-3 py-2">{item.ltype || '-'}</td>
                            <td className="px-3 py-2">{item.lbank || '-'}</td>
                            <td className="px-3 py-2">{item.lchk_no || '-'}</td>
                            <td className="px-3 py-2">{item.lchk_date ? toDisplayDate(item.lchk_date) : '-'}</td>
                            <td className="px-3 py-2 text-right">{peso.format(item.lamt || 0)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClasses(item.lstatus || item.lcollection_status)}`}>
                                {item.lstatus || item.lcollection_status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-3 py-2">{item.lremarks || '-'}</td>
                            <td className="px-3 py-2">
                              {posted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  Posted
                                </span>
                              ) : (
                                <button
                                  className={`${BUTTON_BASE} text-red-600 border-red-300 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed`}
                                  onClick={() => handleDeleteItem(item.lid)}
                                  disabled={!!workingAction}
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!detailLoading && canAddPayment && (
                        <tr className="bg-slate-50 dark:bg-slate-800/30">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="accent-brand-blue"
                              checked={allSelectableChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = selectedItemIds.length > 0 && !allSelectableChecked;
                              }}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItemIds(postableItems.map((item) => item.lid));
                                } else {
                                  setSelectedItemIds([]);
                                }
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[220px]">
                            <div className="space-y-2">
                              <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  className={`${INPUT_CLASS} pl-9`}
                                  value={customerSearch}
                                  onChange={(e) => setCustomerSearch(e.target.value)}
                                  placeholder="Search customer"
                                />
                              </div>
                              <select
                                className={`${SELECT_CLASS} w-full`}
                                value={form.customerId}
                                onChange={(e) => {
                                  const nextCustomerId = e.target.value;
                                  const selectedCustomer = customers.find((customer) => customer.id === nextCustomerId);
                                  setForm((prev) => ({
                                    ...prev,
                                    customerId: nextCustomerId,
                                    customerCompany: selectedCustomer?.company || '',
                                  }));
                                }}
                                disabled={loadingCustomers}
                              >
                                <option value="">
                                  {loadingCustomers ? 'Loading customers...' : 'Customer'}
                                </option>
                                {customerOptions.map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.code ? `${customer.code} - ` : ''}{customer.company}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2 min-w-[220px]">
                            <select
                              className={`${SELECT_CLASS} w-full`}
                              multiple
                              value={Object.entries(selectedTransactions).filter(([, value]) => value).map(([key]) => key)}
                              onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                                const newSelections: Record<string, boolean> = {};
                                unpaidRows.forEach((row) => {
                                  const key = `${row.transactionType}:${row.lrefno}`;
                                  newSelections[key] = selected.includes(key);
                                });
                                setSelectedTransactions(newSelections);
                              }}
                            >
                              {!form.customerId && <option disabled value="">Pick a customer</option>}
                              {form.customerId && unpaidRows.length === 0 && <option disabled value="">No unpaid items</option>}
                              {unpaidRows.map((row) => {
                                const key = `${row.transactionType}:${row.lrefno}`;
                                return (
                                  <option key={key} value={key}>
                                    {row.linvoice_no} - {peso.format(row.totalAmount || 0)}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-3 py-2 min-w-[130px]">
                            <select
                              className={`${SELECT_CLASS} w-full`}
                              value={form.type}
                              onChange={(e) => handleTypeChange(e.target.value)}
                            >
                              <option value="Cash">Cash</option>
                              <option value="Check">Check</option>
                              <option value="TT">TT</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 min-w-[140px]">
                            <input
                              className={INPUT_CLASS}
                              value={form.bank}
                              onChange={(e) => setForm((prev) => ({ ...prev, bank: e.target.value }))}
                              placeholder="Bank"
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[140px]">
                            <input
                              className={INPUT_CLASS}
                              value={form.checkNo}
                              onChange={(e) => setForm((prev) => ({ ...prev, checkNo: e.target.value }))}
                              placeholder="Check Number"
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[150px]">
                            <input
                              type="date"
                              className={INPUT_CLASS}
                              value={form.checkDate}
                              onChange={(e) => setForm((prev) => ({ ...prev, checkDate: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[140px]">
                            <input
                              type="number"
                              className={INPUT_CLASS}
                              value={form.amount}
                              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                              step="0.01"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClasses(form.status)}`}>
                              {form.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 min-w-[180px]">
                            <input
                              className={INPUT_CLASS}
                              value={form.remarks}
                              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                              placeholder="Remarks"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              className={`${BUTTON_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}
                              onClick={handleSavePayment}
                              disabled={savingPayment}
                            >
                              {savingPayment ? 'Saving...' : 'Add Payment'}
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-sm">
                        <td className="px-3 py-3" />
                        <td colSpan={2} className="px-3 py-3 text-slate-900 dark:text-slate-100">
                          Total Check: {peso.format(totalCheck)}
                        </td>
                        <td colSpan={2} className="px-3 py-3 text-slate-900 dark:text-slate-100">
                          Total T/T: {peso.format(totalTT)}
                        </td>
                        <td colSpan={2} className="px-3 py-3 text-slate-900 dark:text-slate-100">
                          Total Cash: {peso.format(totalCash)}
                        </td>
                        <td colSpan={3} className="px-3 py-3 text-right text-slate-900 dark:text-slate-100">
                          Grand Total: {peso.format(grandTotal)}
                        </td>
                        <td className="px-3 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Approver Logs Modal */}
              {showApproverLogsModal && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                  aria-hidden="true"
                  onClick={closeApproverLogsModal}
                >
                  <div
                    ref={approverLogsDialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="approver-logs-title"
                    tabIndex={-1}
                    onKeyDown={approverLogsKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                      <h2 id="approver-logs-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Approver Logs</h2>
                      <button onClick={closeApproverLogsModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 overflow-auto max-h-[70vh]">
                      <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800 text-white sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-bold whitespace-nowrap">ID</th>
                              <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Approver Name</th>
                              <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Date &amp; Time</th>
                              <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Remark</th>
                              <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {approverLogs.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                                  No approver logs yet.
                                </td>
                              </tr>
                            ) : (
                              approverLogs.map((log, index) => (
                                <tr
                                  key={log.lid}
                                  className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'} hover:bg-slate-100 dark:hover:bg-slate-800`}
                                >
                                  <td className="px-3 py-2">{log.lid}</td>
                                  <td className="px-3 py-2">
                                    {((log.staff_fName || '') + ' ' + (log.staff_lName || '')).trim() || log.lstaff_id}
                                  </td>
                                  <td className="px-3 py-2">{log.ldatetime || '-'}</td>
                                  <td className="px-3 py-2">{log.lremarks || '-'}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClasses(log.lstatus)}`}>
                                      {log.lstatus || 'Pending'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                      <button onClick={closeApproverLogsModal} className={BUTTON_BASE}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <DeleteCollectionReportModal
        isOpen={showDeleteReportModal}
        onClose={() => setShowDeleteReportModal(false)}
        onConfirm={handleDeleteCollectionReport}
        refNo={selectedRefno}
        itemCount={items.length}
      />
    </div>
  );
};

export default DailyCollectionEntryView;
