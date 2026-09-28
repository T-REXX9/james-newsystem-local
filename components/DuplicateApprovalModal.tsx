import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface ProspectRecord {
  id: string;
  company: string;
  contactPersonName?: string;
  phone?: string;
  address?: string;
  tin?: string;
  createdAt?: string;
}

interface DuplicatePair {
  id: string;
  existing: ProspectRecord;
  new: ProspectRecord;
  matchingFields: string[];
  status?: 'pending' | 'approved' | 'rejected';
}

interface DuplicateApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicatePair[];
  onApprove: (duplicateId: string, action: 'merge' | 'reject' | 'skip') => Promise<void>;
  loading?: boolean;
  snoozeEnabled?: boolean;
  onSnooze?: (duration: number) => Promise<void>;
}

const DuplicateApprovalModal: React.FC<DuplicateApprovalModalProps> = ({
  isOpen,
  onClose,
  duplicates = [],
  onApprove,
  loading = false,
  snoozeEnabled = true,
  onSnooze,
}) => {
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [snoozeHours, setSnoozeHours] = useState(24);
  const pendingCount = duplicates.filter(d => d.status === 'pending').length;
  const approvedCount = duplicates.filter(d => d.status === 'approved').length;
  const rejectedCount = duplicates.filter(d => d.status === 'rejected').length;

  useEffect(() => {
    if (isOpen) {
      setSelectedDuplicates(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectDuplicate = (duplicateId: string) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(duplicateId)) {
      newSelected.delete(duplicateId);
    } else {
      newSelected.add(duplicateId);
    }
    setSelectedDuplicates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDuplicates.size === duplicates.length) {
      setSelectedDuplicates(new Set());
    } else {
      setSelectedDuplicates(new Set(duplicates.map(d => d.id)));
    }
  };

  const handleAction = async (duplicateId: string, action: 'merge' | 'reject' | 'skip') => {
    setActionLoading(prev => ({ ...prev, [duplicateId]: true }));
    try {
      await onApprove(duplicateId, action);
      // Remove from selected after successful action
      const newSelected = new Set(selectedDuplicates);
      newSelected.delete(duplicateId);
      setSelectedDuplicates(newSelected);
    } finally {
      setActionLoading(prev => ({ ...prev, [duplicateId]: false }));
    }
  };

  const handleBulkAction = async (action: 'merge' | 'reject' | 'skip') => {
    const selected = Array.from(selectedDuplicates);
    setActionLoading(prev => {
      const newState = { ...prev };
      selected.forEach(id => newState[id] = true);
      return newState;
    });
    try {
      await Promise.all(selected.map(id => onApprove(id, action)));
      setSelectedDuplicates(new Set());
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        selected.forEach(id => delete newState[id]);
        return newState;
      });
    }
  };

  const handleSnooze = async () => {
    if (onSnooze) {
      setActionLoading(prev => ({ ...prev, snooze: true }));
      try {
        await onSnooze(snoozeHours);
      } finally {
        setActionLoading(prev => ({ ...prev, snooze: false }));
      }
    }
  };

  const getMatchIcon = (field: string) => {
    const icons: Record<string, string> = {
      'company': '🏢',
      'contact_person': '👤',
      'phone': '📞',
      'address': '📍',
      'tin': '🆔',
    };
    return icons[field] || '✓';
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getFieldValue = (prospect: ProspectRecord, field: string): string => {
    switch (field) {
      case 'company':
        return prospect.company || 'N/A';
      case 'contact_person':
        return prospect.contactPersonName || 'N/A';
      case 'phone':
        return prospect.phone || 'N/A';
      case 'address':
        return prospect.address || 'N/A';
      case 'tin':
        return prospect.tin || 'N/A';
      default:
        return 'N/A';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Duplicate Prospect Review</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {pendingCount} pending • {approvedCount} approved • {rejectedCount} rejected
              </p>
            </div>
            <div className="ml-4 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-semibold">
              {pendingCount} pending
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {duplicates.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-slate-400 font-medium">No duplicate prospects pending review</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicates.map((duplicate) => (
                <div
                  key={duplicate.id}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    duplicate.status === 'approved'
                      ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20'
                      : duplicate.status === 'rejected'
                      ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Duplicate pair header with selection */}
                  <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedDuplicates.has(duplicate.id)}
                      onChange={() => handleSelectDuplicate(duplicate.id)}
                      disabled={actionLoading[duplicate.id] || duplicate.status !== 'pending'}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                          {duplicate.existing.company}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">vs</span>
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                          {duplicate.new.company}
                        </span>
                      </div>
                      {duplicate.matchingFields.length > 0 && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Matches:</span>
                          {duplicate.matchingFields.map(field => (
                            <span
                              key={field}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium"
                            >
                              <span>{getMatchIcon(field)}</span>
                              {formatFieldName(field)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {duplicate.status === 'approved' && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-xs font-semibold">Approved</span>
                      </div>
                    )}
                    {duplicate.status === 'rejected' && (
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <XCircle className="w-5 h-5" />
                        <span className="text-xs font-semibold">Rejected</span>
                      </div>
                    )}
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Existing */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                          Existing Prospect
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company</label>
                            <p className="text-gray-800 dark:text-white font-medium">
                              {getFieldValue(duplicate.existing, 'company')}
                            </p>
                          </div>
                          {duplicate.existing.contactPersonName && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contact Person</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.existing, 'contact_person')}
                              </p>
                            </div>
                          )}
                          {duplicate.existing.phone && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phone</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.existing, 'phone')}
                              </p>
                            </div>
                          )}
                          {duplicate.existing.address && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Address</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.existing, 'address')}
                              </p>
                            </div>
                          )}
                          {duplicate.existing.tin && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">TIN</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.existing, 'tin')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* New */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                          New Prospect
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company</label>
                            <p className="text-gray-800 dark:text-white font-medium">
                              {getFieldValue(duplicate.new, 'company')}
                            </p>
                          </div>
                          {duplicate.new.contactPersonName && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contact Person</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.new, 'contact_person')}
                              </p>
                            </div>
                          )}
                          {duplicate.new.phone && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phone</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.new, 'phone')}
                              </p>
                            </div>
                          )}
                          {duplicate.new.address && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Address</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.new, 'address')}
                              </p>
                            </div>
                          )}
                          {duplicate.new.tin && (
                            <div>
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">TIN</label>
                              <p className="text-gray-800 dark:text-white font-medium">
                                {getFieldValue(duplicate.new, 'tin')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {duplicate.status === 'pending' && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700">
                      <button
                        onClick={() => handleAction(duplicate.id, 'merge')}
                        disabled={actionLoading[duplicate.id] || loading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {actionLoading[duplicate.id] && <Loader2 className="w-4 h-4 animate-spin" />}
                        Approve & Merge
                      </button>
                      <button
                        onClick={() => handleAction(duplicate.id, 'reject')}
                        disabled={actionLoading[duplicate.id] || loading}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {actionLoading[duplicate.id] && <Loader2 className="w-4 h-4 animate-spin" />}
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(duplicate.id, 'skip')}
                        disabled={actionLoading[duplicate.id] || loading}
                        className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {actionLoading[duplicate.id] && <Loader2 className="w-4 h-4 animate-spin" />}
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {duplicates.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedDuplicates.size > 0 && (
                  <>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {selectedDuplicates.size} selected
                    </span>
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      {selectedDuplicates.size === duplicates.length ? 'Deselect all' : 'Select all'}
                    </button>
                    {selectedDuplicates.size > 0 && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleBulkAction('merge')}
                          disabled={loading || actionLoading['bulk']}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {actionLoading['bulk'] && <Loader2 className="w-3 h-3 animate-spin" />}
                          Approve All
                        </button>
                        <button
                          onClick={() => handleBulkAction('reject')}
                          disabled={loading || actionLoading['bulk']}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {actionLoading['bulk'] && <Loader2 className="w-3 h-3 animate-spin" />}
                          Reject All
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {snoozeEnabled && (
                  <div className="flex items-center gap-2">
                    <select
                      value={snoozeHours}
                      onChange={(e) => setSnoozeHours(Number(e.target.value))}
                      disabled={loading || actionLoading.snooze}
                      className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-300"
                    >
                      <option value={1}>1 hour</option>
                      <option value={4}>4 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={72}>3 days</option>
                    </select>
                    <button
                      onClick={handleSnooze}
                      disabled={loading || actionLoading.snooze}
                      className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {actionLoading.snooze && <Loader2 className="w-4 h-4 animate-spin" />}
                      <Clock className="w-4 h-4" />
                      Snooze
                    </button>
                  </div>
                )}

                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateApprovalModal;
