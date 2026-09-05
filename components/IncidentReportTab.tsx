import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Plus, FileText, Receipt, ShoppingCart, HelpCircle, Package, XCircle, Loader2, RotateCcw, Factory } from 'lucide-react';
import { fetchDailyCallIncidentReports, reviewDailyCallIncidentReport } from '../services/dailyCallCustomerDetailService';
import CreateIncidentReportModal from './CreateIncidentReportModal';
import { IncidentReport, UserProfile } from '../types';

interface IncidentReportTabProps {
  contactId: string;
  currentUser?: UserProfile | null;
}

const IncidentReportTab: React.FC<IncidentReportTabProps> = ({ contactId, currentUser }) => {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [dispositions, setDispositions] = useState<Record<string, 'return_to_stock' | 'return_to_factory'>>({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  const role = String(currentUser?.role || '').toLowerCase();
  const canReview = currentUser?.user_type === 1 || currentUser?.user_type === '1' || ['owner', 'master user', 'master_user'].includes(role);

  const formatReportDateTime = (dateValue?: string, timeValue?: string) => {
    const date = String(dateValue || '').split('T')[0];
    const time = String(timeValue || '').slice(0, 5);
    if (!date && !time) return '-';
    const parsed = date ? new Date(`${date}T${time || '00:00'}:00`) : null;
    const dateLabel = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : date;
    return time ? `${dateLabel} ${time}` : dateLabel;
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyCallIncidentReports(contactId);
      setReports(data || []);
    } catch (err) {
      console.error('Error loading incident reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [contactId]);

  const handleReview = async (report: IncidentReport, decision: 'approved' | 'rejected') => {
    setReviewingId(report.id);
    setReviewError(null);
    try {
      await reviewDailyCallIncidentReport(report.id, {
        decision,
        disposition: decision === 'approved' ? (dispositions[report.id] || 'return_to_stock') : undefined,
        reviewerName: currentUser?.full_name || currentUser?.email || 'Master User',
        note: decisionNotes[report.id],
      });
      await loadReports();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'The incident decision could not be saved.');
    } finally {
      setReviewingId(null);
    }
  };

  const openPartHistory = (report: IncidentReport) => {
    const search = report.part_no || report.item_code || report.product_id || '';
    if (!search) return;
    window.dispatchEvent(new CustomEvent('workflow:navigate', {
      detail: {
        tab: 'warehouse-reports-incident-items-report',
        payload: { search, dateFrom: '', dateTo: '' },
      },
    }));
  };

  const getIssueTypeBadge = (type: string) => {
    const types: Record<string, { bg: string; color: string; text: string }> = {
      'product_quality': { bg: 'bg-rose-100 dark:bg-rose-900/30', color: 'text-rose-700 dark:text-rose-300', text: 'Product Quality' },
      'service_quality': { bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-700 dark:text-orange-300', text: 'Service Quality' },
      'delivery': { bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-700 dark:text-blue-300', text: 'Delivery' },
      'lbc_rto': { bg: 'bg-amber-100 dark:bg-amber-900/30', color: 'text-amber-700 dark:text-amber-300', text: 'LBC RTO' },
      'other': { bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-700 dark:text-slate-300', text: 'Other' }
    };
    const style = types[type] || types.other;
    return <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${style.bg} ${style.color}`}>{style.text}</span>;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'order_slip':
        return <Receipt className="w-4 h-4 text-purple-500" />;
      case 'sales_order':
        return <ShoppingCart className="w-4 h-4 text-green-500" />;
      case 'sales_inquiry':
        return <HelpCircle className="w-4 h-4 text-orange-500" />;
      case 'purchase_history':
        return <Package className="w-4 h-4 text-indigo-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading incident reports...</div>;
  }

  if (reports.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Incident Report
          </button>
        </div>
        <div className="text-center text-slate-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No incident reports yet. Create your first incident report.</p>
        </div>
        <CreateIncidentReportModal
          contactId={contactId}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={loadReports}
          currentUser={currentUser}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="mb-4">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Incident Report
        </button>
      </div>
      {reports.map(report => (
        <div key={report.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-slate-800 dark:text-white">
                  {report.record_source !== 'customer_log' && report.ir_number ? `${report.ir_number} · ` : ''}Incident - {formatReportDateTime(report.report_date, report.report_time)}
                </h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  report.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                  report.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                }`}>
                  {report.approval_status === 'approved' && <CheckCircle className="w-3 h-3" />}
                  {report.approval_status === 'pending' && <Clock className="w-3 h-3" />}
                  {report.approval_status.charAt(0).toUpperCase() + report.approval_status.slice(1)}
                </span>
              </div>
              <div className="mb-2">{getIssueTypeBadge(report.issue_type)}</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Incident Date/Time: {formatReportDateTime(report.incident_date, report.incident_time)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Report Date/Time: {formatReportDateTime(report.report_date, report.report_time)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reported By: {report.reported_by}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Done By: {report.done_by || report.reported_by}
              </p>
            </div>
          </div>

          <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Description:</h5>
            <p className="text-sm text-slate-700 dark:text-slate-300">{report.description}</p>
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Client incidents</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.customer_incident_count || reports.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Part incidents</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.item_incident_count || 0}</p>
              {(report.part_no || report.item_code || report.product_id) && <button type="button" onClick={() => openPartHistory(report)} className="mt-1 text-[11px] font-bold text-blue-700 hover:underline">View part history</button>}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Affected item</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{report.part_no || report.item_code || report.item_description || 'No item linked'}</p>
              {report.affected_quantity != null && <p className="text-xs text-slate-500">Quantity: {report.affected_quantity}</p>}
            </div>
          </div>

          {report.notes && (
            <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-900 rounded text-sm text-slate-600 dark:text-slate-300">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes:</p>
              {report.notes}
            </div>
          )}

          {report.related_transactions && report.related_transactions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Related Transactions:</p>
              <div className="flex flex-wrap gap-2">
                {report.related_transactions.map((transaction: any, idx: number) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm"
                  >
                    {getTransactionIcon(transaction.transaction_type)}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {transaction.transaction_number}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(transaction.transaction_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.attachments && report.attachments.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">File Attachments:</p>
              <div className="flex flex-wrap gap-2">
                {report.attachments.map((attachment: string, idx: number) => (
                  <a
                    key={idx}
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-blue hover:underline"
                  >
                    Attachment {idx + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          {report.approval_status === 'approved' && report.return_action && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="flex items-center gap-2 font-bold"><CheckCircle className="h-4 w-4" /> Sales return accepted</p>
              <p className="mt-1">Disposition: {report.return_action.disposition === 'return_to_stock' ? 'Return to stock' : 'Return to factory'}</p>
              <p className="mt-1 text-xs">Authorization {report.return_action.id} • {report.return_action.status}</p>
            </div>
          )}

          {report.approval_status === 'rejected' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <p className="flex items-center gap-2 font-bold"><XCircle className="h-4 w-4" /> Rejected - incident record only</p>
              <p className="mt-1">No sales return, stock movement, or factory-return action was created.</p>
              {report.decision_note && <p className="mt-2 text-xs">{report.decision_note}</p>}
            </div>
          )}

          {report.approval_status === 'pending' && canReview && (
            <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Sales return decision</p>
                <p className="mt-1 text-xs text-slate-500">Approval authorizes the return and records where the item must go. Rejection keeps only this incident record.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                  (dispositions[report.id] || 'return_to_stock') === 'return_to_stock' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'
                }`}>
                  <input type="radio" name={`disposition-${report.id}`} checked={(dispositions[report.id] || 'return_to_stock') === 'return_to_stock'} onChange={() => setDispositions((previous) => ({ ...previous, [report.id]: 'return_to_stock' }))} />
                  <RotateCcw className="h-4 w-4" /> Return to stock
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                  dispositions[report.id] === 'return_to_factory' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'
                }`}>
                  <input type="radio" name={`disposition-${report.id}`} disabled={!report.supplier_id && !report.supplier_name} checked={dispositions[report.id] === 'return_to_factory'} onChange={() => setDispositions((previous) => ({ ...previous, [report.id]: 'return_to_factory' }))} />
                  <Factory className="h-4 w-4" /> Return to factory
                </label>
              </div>
              <textarea
                aria-label={`Decision note for incident ${report.id}`}
                value={decisionNotes[report.id] || ''}
                onChange={(event) => setDecisionNotes((previous) => ({ ...previous, [report.id]: event.target.value }))}
                rows={2}
                maxLength={2000}
                placeholder="Optional approval or rejection note"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              {reviewError && <p role="alert" className="text-sm text-rose-600">{reviewError}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={reviewingId === report.id} onClick={() => void handleReview(report, 'rejected')} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  {reviewingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
                </button>
                <button type="button" disabled={reviewingId === report.id || (!report.product_id && !report.part_no && !report.item_code)} onClick={() => void handleReview(report, 'approved')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {reviewingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Approve Sales Return
                </button>
              </div>
              {!report.product_id && !report.part_no && !report.item_code && <p className="text-right text-xs text-amber-700">An affected item is required before a sales return can be approved.</p>}
              {!report.supplier_id && !report.supplier_name && <p className="text-right text-xs text-amber-700">Link a supplier to enable Return to factory.</p>}
            </div>
          )}

          {report.approval_status === 'pending' && !canReview && (
            <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Awaiting Master User approval.
            </div>
          )}
        </div>
      ))}
      <CreateIncidentReportModal
        contactId={contactId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadReports}
        currentUser={currentUser}
      />
    </div>
  );
};

export default IncidentReportTab;
