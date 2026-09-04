import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import {
  fetchIncidentItemIncidents,
  formatIncidentReportShortId,
  IncidentItemIncidentSummary,
  IncidentItemIncidentsFilters,
  IncidentItemsReportRow,
} from '../services/incidentItemsReportService';
import { buildModuleRecordUrl } from '../utils/workflowNavigate';

interface IncidentItemIncidentsDialogProps {
  isOpen: boolean;
  row: IncidentItemsReportRow | null;
  listFilters: Pick<IncidentItemIncidentsFilters, 'dateFrom' | 'dateTo' | 'matchSource' | 'search' | 'supplier'>;
  onClose: () => void;
}

const formatDate = (value: string) => {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const openIncidentReportInNewTab = (incidentReportId: string) => {
  window.open(
    buildModuleRecordUrl('warehouse-reports-incident-items-report', { reportId: incidentReportId }),
    '_blank',
    'noopener,noreferrer'
  );
};

const IncidentItemIncidentsDialog: React.FC<IncidentItemIncidentsDialogProps> = ({
  isOpen,
  row,
  listFilters,
  onClose,
}) => {
  const { dialogRef, handleKeyDown } = useDialogAccessibility(isOpen, onClose);
  const [incidents, setIncidents] = useState<IncidentItemIncidentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !row) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchIncidentItemIncidents({
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          productId: row.product_id,
          itemCode: row.item_code,
          partNo: row.part_no,
          description: row.description,
          dateFrom: listFilters.dateFrom,
          dateTo: listFilters.dateTo,
          matchSource: listFilters.matchSource,
          search: listFilters.search,
          supplier: listFilters.supplier,
        });
        if (!cancelled) setIncidents(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setIncidents([]);
          setError(err instanceof Error ? err.message : 'Unable to load Incident Reports for this item.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, row, listFilters.dateFrom, listFilters.dateTo, listFilters.matchSource, listFilters.search, listFilters.supplier]);

  if (!isOpen || !row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-item-incidents-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 id="incident-item-incidents-title" className="text-lg font-bold text-slate-800 dark:text-white">
              Incident Reports
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {row.description || row.part_no || row.item_code || 'Selected item'}
            </p>
            <p className="mt-0.5 text-xs font-mono text-slate-400">
              {row.item_code || '-'} / {row.part_no || '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="mb-2 h-6 w-6 animate-spin" />
              Loading Incident Reports...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : incidents.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No Incident Reports match the current filters for this item.</p>
          ) : (
            <ul className="space-y-2">
              {incidents.map((incident) => (
                <li key={incident.incident_report_id}>
                  <button
                    type="button"
                    onClick={() => openIncidentReportInNewTab(incident.incident_report_id)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-blue hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-blue-500 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {formatIncidentReportShortId(incident.incident_report_id)}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(incident.date)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {incident.customer_name || 'Unknown customer'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {incident.summary || '-'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentItemIncidentsDialog;
