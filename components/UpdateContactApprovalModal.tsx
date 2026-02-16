import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';
import { Contact } from '../types';
import { fetchUpdatedContactDetails, approveContactDetailsUpdate } from '../services/supabaseService';

interface UpdateContactApprovalModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onApprove?: () => void;
}

const UpdateContactApprovalModal: React.FC<UpdateContactApprovalModalProps> = ({
  contact,
  isOpen,
  onClose,
  currentUserId,
  onApprove
}) => {
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUpdates();
    }
  }, [isOpen, contact.id]);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const data = await fetchUpdatedContactDetails(contact.id);
      setUpdates(data || []);
    } catch (err) {
      console.error('Error loading contact updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (updateId: string) => {
    if (!currentUserId) return;
    
    try {
      setApproving(updateId);
      await approveContactDetailsUpdate(updateId, currentUserId);
      setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, approval_status: 'approved' } : u));
      onApprove?.();
    } catch (err) {
      console.error('Error approving update:', err);
    } finally {
      setApproving(null);
    }
  };

  if (!isOpen) return null;

  const pendingUpdates = updates.filter(u => u.approval_status === 'pending');
  const approvedUpdates = updates.filter(u => u.approval_status === 'approved');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            Contact Details Update Approvals
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {loading ? (
            <div className="text-center text-slate-500">Loading updates...</div>
          ) : updates.length === 0 ? (
            <div className="text-center text-slate-500">No pending updates for this contact</div>
          ) : (
            <div className="space-y-6">
              {/* Pending Updates */}
              {pendingUpdates.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    Pending Approvals ({pendingUpdates.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingUpdates.map(update => (
                      <div
                        key={update.id}
                        className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4"
                      >
                        <div className="mb-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Submitted by {update.submitted_by} on{' '}
                            {new Date(update.submitted_date).toLocaleDateString()}
                          </p>
                          {update.notes && (
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                              <span className="font-semibold">Notes:</span> {update.notes}
                            </p>
                          )}
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded p-3 mb-3 max-h-40 overflow-y-auto">
                          <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase">
                            Changes:
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(update.changed_fields || {}).map(([field, changes]: [string, any]) => (
                              <div key={field} className="text-sm">
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{field}</p>
                                <div className="ml-2 mt-1 space-y-1">
                                  <p className="text-slate-600 dark:text-slate-400">
                                    <span className="text-xs text-slate-500">From:</span> {String(changes.oldValue || '-')}
                                  </p>
                                  <p className="text-emerald-600 dark:text-emerald-400">
                                    <span className="text-xs text-slate-500">To:</span> {String(changes.newValue || '-')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => handleApprove(update.id)}
                          disabled={approving === update.id}
                          className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {approving === update.id ? 'Approving...' : 'Approve Changes'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Updates */}
              {approvedUpdates.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Approved ({approvedUpdates.length})
                  </h3>
                  <div className="space-y-3">
                    {approvedUpdates.map(update => (
                      <div
                        key={update.id}
                        className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Approved
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(update.approval_date).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          By {update.approved_by}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateContactApprovalModal;
