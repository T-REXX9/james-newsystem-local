import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import type { PurchaseRequestWithItems } from '../../purchaseRequest.types';
import ModuleRecordLink from '../ModuleRecordLink';

interface PurchaseRequestListProps {
  requests: PurchaseRequestWithItems[];
  loading: boolean;
  onSelect: (pr: PurchaseRequestWithItems) => void;
  onCreate: () => void;
  filterMonth: string;
  setFilterMonth: (value: string) => void;
  filterYear: string;
  setFilterYear: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
}

const months = [
  ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'],
  ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'],
  ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

const statuses = ['All Statuses', 'Draft', 'Pending', 'Submitted', 'Approved', 'Cancelled'];

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

const statusClass = (status: string) => {
  switch (status) {
    case 'Approved': return 'bg-emerald-50 text-emerald-700';
    case 'Submitted': return 'bg-blue-50 text-blue-700';
    case 'Cancelled': return 'bg-rose-50 text-rose-700';
    case 'Draft': return 'bg-slate-100 text-slate-600';
    default: return 'bg-amber-50 text-amber-700';
  }
};

const PurchaseRequestList: React.FC<PurchaseRequestListProps> = ({
  requests,
  loading,
  onSelect,
  onCreate,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  filterStatus,
  setFilterStatus,
  search,
  setSearch,
}) => {
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRequests = useMemo(() => requests.slice((currentPage - 1) * pageSize, currentPage * pageSize), [requests, currentPage]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-slate-200 bg-white xl:w-[300px] xl:shrink-0">
      <div className="border-b border-slate-200 p-4">
        <button type="button" onClick={onCreate} className="flex w-full items-center justify-center gap-2 rounded-md bg-[#175fd3] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0e4fb7]">
          <Plus className="h-4 w-4" /> New Request
        </button>
        <label className="relative mt-3 block">
          <span className="sr-only">Search purchase requests</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search PR #..." className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="relative mt-2 block">
          <span className="sr-only">Filter by status</span>
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select value={filterStatus} onChange={event => { setFilterStatus(event.target.value); setPage(1); }} className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100">
            {statuses.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Filter by month</p>
        <div className="grid grid-cols-[1fr_0.85fr] gap-2">
          <select aria-label="Filter by month" value={filterMonth} onChange={event => { setFilterMonth(event.target.value); setPage(1); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100">
            {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input aria-label="Filter by year" type="number" min="2000" max="2100" value={filterYear} onChange={event => { setFilterYear(event.target.value); setPage(1); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#175fd3] focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 py-2 text-xs font-semibold text-slate-500">
          <span>{loading ? 'Loading...' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}</span>
          <span>{filterYear}</span>
        </div>
        {loading ? (
          <div className="rounded-md px-3 py-8 text-center text-sm text-slate-500">Loading purchase requests...</div>
        ) : visibleRequests.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">No purchase requests found for this filter.</div>
        ) : visibleRequests.map(request => (
          <div
            key={request.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(request)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(request);
              }
            }}
            className="mb-1.5 block w-full cursor-pointer rounded-md border border-transparent px-3 py-2.5 text-left transition hover:border-blue-100 hover:bg-blue-50/50 focus:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <div className="flex items-start justify-between gap-2">
              <ModuleRecordLink tab="warehouse-purchasing-purchase-request" payload={{ prId: request.id }} onOpen={() => onSelect(request)} className="font-bold text-[#173c83] hover:underline">
                {request.pr_number || 'Unnamed PR'}
              </ModuleRecordLink>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusClass(request.status)}`}>{request.status}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>{formatDate(request.request_date)}</span>
              <span>{request.item_count ?? request.items?.length ?? 0} item{(request.item_count ?? request.items?.length ?? 0) === 1 ? '' : 's'}</span>
            </div>
            {(request.created_by_name || request.notes) && <p className="mt-1 truncate text-[11px] text-slate-400">{request.created_by_name || request.notes}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1 border-t border-slate-200 p-3">
        <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-8 rounded bg-[#175fd3] px-2 py-1 text-center text-xs font-bold text-white">{currentPage}</span>
        <span className="px-1 text-xs text-slate-400">of {totalPages}</span>
        <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </aside>
  );
};

export default PurchaseRequestList;

export { months };
