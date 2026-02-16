import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Filter, PackageOpen, Search, Truck } from 'lucide-react';
import { fetchLBCRTOData } from '../services/dailyCallMonitoringService';
import { LBCRTORecord } from '../types';

interface LBCRTOTabProps {
  contactId: string;
}

type RTOStatusFilter = 'all' | LBCRTORecord['status'];

const statusClassMap: Record<LBCRTORecord['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  in_transit: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const LBCRTOTab: React.FC<LBCRTOTabProps> = ({ contactId }) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<LBCRTORecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<RTOStatusFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const data = await fetchLBCRTOData(contactId);
      if (!mounted) return;
      setRecords(data);
      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [contactId]);

  const filteredRecords = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return records
      .filter((record) => (statusFilter === 'all' ? true : record.status === statusFilter))
      .filter((record) => {
        if (!normalized) return true;
        const haystack = `${record.tracking_number} ${record.reason} ${record.status}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, search, statusFilter]);

  const stats = useMemo(() => {
    const pending = records.filter((row) => row.status === 'pending' || row.status === 'in_transit').length;
    const resolved = records.filter((row) => row.status === 'resolved').length;
    return {
      total: records.length,
      pending,
      resolved,
    };
  }, [records]);

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading LBC RTO records...</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase text-slate-500">Total RTO</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase text-slate-500">Open Cases</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase text-slate-500">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.resolved}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tracking no., reason"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as RTOStatusFilter)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In transit</option>
            <option value="resolved">Resolved</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
          <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-60" />
          <p className="font-medium">No RTO records found.</p>
          <p className="mt-1 text-xs">Try changing your filters or search term.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Tracking No.</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Reason</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/30">
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{new Date(record.date).toLocaleDateString('en-PH')}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{record.tracking_number}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{record.reason}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClassMap[record.status]}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {record.status === 'resolved' ? <Truck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {record.status === 'resolved' ? 'Completed' : 'Needs action'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LBCRTOTab;
