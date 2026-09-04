import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Factory,
  FileText,
  HelpCircle,
  Loader2,
  Package,
  Receipt,
  RotateCcw,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import { reviewDailyCallIncidentReport } from '../services/dailyCallCustomerDetailService';
import {
  fetchWarehouseIncidentReport,
  formatIncidentReportShortId,
  WarehouseIncidentReport,
} from '../services/incidentItemsReportService';
import { UserProfile } from '../types';

interface WarehouseIncidentReportDetailProps {
  reportId: string;
  currentUser?: UserProfile | null;
}

const WarehouseIncidentReportDetail: React.FC<WarehouseIncidentReportDetailProps> = ({
  reportId,
  currentUser,
}) => {
  const [report, setReport] = useState<WarehouseIncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<'return_to_stock' | 'return_to_factory'>('return_to_stock');
  const [decisionNote, setDecisionNote] = useState('');

  const role = String(currentUser?.role || '').toLowerCase();
  const canReview =
    currentUser?.user_type === 1
    || currentUser?.user_type === '1'
    || ['owner', 'master user', 'master_user'].includes(role);

  const formatReportDateTime = (dateValue?: string, timeValue?: string) => {
    const date = String(dateValue || '').split('T')[0];
    const time = String(timeValue || '').slice(0, 5);
    if (!date && !time) return '-';
    const parsed = date ? new Date(`${date}T${time || '00:00'}:00`) : null;
    const dateLabel = parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      : date;
    return time ? `${dateLabel} ${time}` : dateLabel;
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWarehouseIncidentReport(reportId);
      setReport(data);
    } catch (err: unknown) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Unable to load Incident Report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [reportId]);

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (!report) return;
    setReviewing(true);
    setReviewError(null);
    try {
      await reviewDailyCallIncidentReport(report.id, {
        decision,
        disposition: decision === 'approved' ? disposition : undefined,
        reviewerName: currentUser?.full_name || currentUser?.email || 'Master User',
        note: decisionNote,
      });
      await loadReport();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'The incident decision could not be saved.');
    } finally {
      setReviewing(false);
    }
  };

  const getIssueTypeBadge = (type: string) => {
    const types: Record<string, { bg: string; color: string; text: string }> = {
      product_quality: { bg: 'bg-rose-100 dark:bg-rose-900/30', color: 'text-rose-700 dark:text-rose-300', text: 'Product Quality' },
      service_quality: { bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-700 dark:text-orange-300', text: 'Service Quality' },
      delivery: { bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-700 dark:text-blue-300', text: 'Delivery' },
      lbc_rto: { bg: 'bg-amber-100 dark:bg-amber-900/30', color: 'text-amber-700 dark:text-amber-300', text: 'LBC RTO' },
      other: { bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-700 dark:text-slate-300', text: 'Other' },
    };
    const style = types[type] || types.other;
    return <span className={`inline-block rounded px-2 py-1 text-xs font-bold ${style.bg} ${style.color}`}>{style.text}</span>;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'order_slip':
        return <Receipt className="h-4 w-4 text-purple-500" />;
      case 'sales_order':
        return <ShoppingCart className="h-4 w-4 text-green-500" />;
      case 'sales_inquiry':
        return <HelpCircle className="h-4 w-4 text-orange-500" />;
      case 'purchase_history':
        return <Package className="h-4 w-4 text-indigo-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6 text-slate-500 dark:bg-slate-950">
        <Loader2 className="mb-2 h-6 w-6 animate-spin" />
        Loading Incident Report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <AlertTriangle className="mb-2 h-8 w-8 text-rose-500 opacity-70" />
        <p className="text-sm text-rose-600 dark:text-rose-300">{error || 'Incident Report not found.'}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 text-slate-800 animate-fadeIn dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Incident Report</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <span className="font-mono">{formatIncidentReportShortId(report.id)}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              report.approval_status === 'approved'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : report.approval_status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            }`}>
              {report.approval_status === 'approved' && <CheckCircle className="h-3 w-3" />}
              {report.approval_status === 'pending' && <Clock className="h-3 w-3" />}
              {report.approval_status.charAt(0).toUpperCase() + report.approval_status.slice(1)}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {report.customer_name || 'Unknown customer'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">{getIssueTypeBadge(report.issue_type)}</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Incident Date/Time: {formatReportDateTime(report.incident_date, report.incident_time)}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Report Date/Time: {formatReportDateTime(report.report_date, report.report_time)}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Reported By: {report.reported_by}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Done By: {report.done_by || report.reported_by}</p>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
            <h2 className="mb-1 text-xs font-semibold text-slate-500">Description</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">{report.description}</p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Client incidents</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.customer_incident_count || 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Part incidents</p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.item_incident_count || 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Affected item</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {report.part_no || report.item_code || report.item_description || 'No item linked'}
              </p>
              {report.affected_quantity != null && (
                <p className="text-xs text-slate-500">Quantity: {report.affected_quantity}</p>
              )}
            </div>
          </div>

          {report.notes ? (
            <div className="mt-3 rounded bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <p className="mb-1 text-xs font-semibold text-slate-500">Notes</p>
              {report.notes}
            </div>
          ) : null}

          {report.related_transactions && report.related_transactions.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Related Transactions</p>
              <div className="flex flex-wrap gap-2">
                {report.related_transactions.map((transaction, idx) => (
                  <div
                    key={`${transaction.transaction_id}-${idx}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm dark:border-blue-800 dark:bg-blue-900/20"
                  >
                    {getTransactionIcon(transaction.transaction_type)}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {transaction.transaction_number}
                    </span>
                    <span className="text-xs text-slate-500">
                      {transaction.transaction_date
                        ? new Date(transaction.transaction_date).toLocaleDateString('en-PH', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {report.attachments && report.attachments.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">File Attachments</p>
              <div className="flex flex-wrap gap-2">
                {report.attachments.map((attachment, idx) => (
                  <a
                    key={`${attachment}-${idx}`}
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
          ) : null}

          {report.approval_status === 'approved' && report.return_action ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="flex items-center gap-2 font-bold"><CheckCircle className="h-4 w-4" /> Sales return accepted</p>
              <p className="mt-1">
                Disposition: {report.return_action.disposition === 'return_to_stock' ? 'Return to stock' : 'Return to factory'}
              </p>
              <p className="mt-1 text-xs">Authorization {report.return_action.id} • {report.return_action.status}</p>
            </div>
          ) : null}

          {report.approval_status === 'rejected' ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <p className="flex items-center gap-2 font-bold"><XCircle className="h-4 w-4" /> Rejected - incident record only</p>
              <p className="mt-1">No sales return, stock movement, or factory-return action was created.</p>
              {report.decision_note ? <p className="mt-2 text-xs">{report.decision_note}</p> : null}
            </div>
          ) : null}

          {report.approval_status === 'pending' && canReview ? (
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Sales return decision</p>
                <p className="mt-1 text-xs text-slate-500">
                  Approval authorizes the return and records where the item must go. Rejection keeps only this incident record.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                  disposition === 'return_to_stock'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="warehouse-disposition"
                    checked={disposition === 'return_to_stock'}
                    onChange={() => setDisposition('return_to_stock')}
                  />
                  <RotateCcw className="h-4 w-4" /> Return to stock
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                  disposition === 'return_to_factory'
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="warehouse-disposition"
                    disabled={!report.supplier_id && !report.supplier_name}
                    checked={disposition === 'return_to_factory'}
                    onChange={() => setDisposition('return_to_factory')}
                  />
                  <Factory className="h-4 w-4" /> Return to factory
                </label>
              </div>
              <textarea
                aria-label="Decision note"
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Optional approval or rejection note"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              {reviewError ? <p role="alert" className="text-sm text-rose-600">{reviewError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => void handleReview('rejected')}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
                </button>
                <button
                  type="button"
                  disabled={reviewing || (!report.product_id && !report.part_no && !report.item_code)}
                  onClick={() => void handleReview('approved')}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Approve Sales Return
                </button>
              </div>
            </div>
          ) : null}

          {report.approval_status === 'pending' && !canReview ? (
            <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Awaiting Master User approval.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default WarehouseIncidentReportDetail;
