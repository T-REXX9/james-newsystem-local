import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Plus, FileText, Receipt, ShoppingCart, HelpCircle, Package } from 'lucide-react';
import { fetchDailyCallIncidentReports } from '../services/dailyCallCustomerDetailService';
import CreateIncidentReportModal from './CreateIncidentReportModal';
import { UserProfile } from '../types';

interface IncidentReportTabProps {
  contactId: string;
  currentUser?: UserProfile | null;
}

const IncidentReportTab: React.FC<IncidentReportTabProps> = ({ contactId, currentUser }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchDailyCallIncidentReports(contactId);
      setReports(data || []);
    } catch (err) {
      console.error('Error loading incident reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [contactId]);

  const getIssueTypeBadge = (type: string) => {
    const types: Record<string, { bg: string; color: string; text: string }> = {
      'product_quality': { bg: 'bg-rose-100 dark:bg-rose-900/30', color: 'text-rose-700 dark:text-rose-300', text: 'Product Quality' },
      'service_quality': { bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-700 dark:text-orange-300', text: 'Service Quality' },
      'delivery': { bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-700 dark:text-blue-300', text: 'Delivery' },
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
                  Incident - {new Date(report.report_date).toLocaleDateString()}
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
                Incident Date: {new Date(report.incident_date).toLocaleDateString()}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reported By: {report.reported_by}
              </p>
            </div>
          </div>

          <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Description:</h5>
            <p className="text-sm text-slate-700 dark:text-slate-300">{report.description}</p>
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
                      {new Date(transaction.transaction_date).toLocaleDateString()}
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

          {report.approval_status === 'pending' && (
            <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Approval actions are unavailable in local MySQL read mode.
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
