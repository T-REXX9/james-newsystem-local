import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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
}

const months = [
  ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'],
  ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'],
  ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

const PurchaseRequestList: React.FC<PurchaseRequestListProps> = ({
  requests,
  loading,
  onSelect,
  onCreate,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
}) => (
  <div className="min-h-full bg-[#f4f4f4] px-4 py-10 text-[#333]">
    <div className="mx-auto max-w-[1140px] overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      <header className="flex min-h-[64px] items-center justify-between border-b border-[#e5e5e5] px-5">
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1 rounded-[3px] border border-[#398439] bg-[#5cb85c] px-3 py-[7px] text-[13px] font-semibold text-white hover:bg-[#47a447]"
        >
          <Plus className="h-4 w-4" />
          Create New
        </button>

        <div className="flex items-center gap-3 text-[13px]">
          <label htmlFor="pr-filter-month" className="font-semibold">Filter by Month:</label>
          <select
            id="pr-filter-month"
            value={filterMonth}
            onChange={event => setFilterMonth(event.target.value)}
            className="h-[34px] w-[200px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner"
          >
            {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input
            aria-label="Filter year"
            type="number"
            value={filterYear}
            onChange={event => setFilterYear(event.target.value)}
            className="h-[34px] w-[100px] rounded-[3px] border border-[#ccc] bg-white px-3 shadow-inner"
          />
        </div>
      </header>

      <div className="p-5">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-[#ddd] text-left">
              <th className="w-1/4 px-2 py-2">Date</th>
              <th className="w-1/4 px-2 py-2">PR No.</th>
              <th className="w-1/4 px-2 py-2">Note</th>
              <th className="w-1/4 px-2 py-2">Status</th>
            </tr>
          </thead>
        </table>

        <div className="max-h-[260px] overflow-auto">
          <table className="w-full table-fixed border-collapse border border-[#ddd] text-[13px]">
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#777]">
                    <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-[#777]">No records found.</td></tr>
              ) : requests.map(request => (
                <tr
                  key={request.id}
                  onClick={() => onSelect(request)}
                  className="cursor-pointer border-b border-[#ddd] hover:bg-[#f5f5f5]"
                >
                  <td className="w-1/4 px-2 py-2">{new Date(request.request_date || '').toLocaleDateString('en-US')}</td>
                  <td className="w-1/4 px-2 py-2 text-[#337ab7] underline">
                    <ModuleRecordLink
                      tab="warehouse-purchasing-purchase-request"
                      payload={{ prId: request.id }}
                      onOpen={() => onSelect(request)}
                    >
                      {request.pr_number}
                    </ModuleRecordLink>
                  </td>
                  <td className="w-1/4 px-2 py-2 text-[#337ab7]">{request.notes || ''}</td>
                  <td className="w-1/4 px-2 py-2">{request.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

export default PurchaseRequestList;
