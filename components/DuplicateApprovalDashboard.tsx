import React, { useState, useEffect } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface PendingDuplicate {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface DuplicateApprovalDashboardProps {
  onOpenApprovalModal?: () => void;
  masterUserId?: string;
  refreshInterval?: number; // milliseconds
}

const DuplicateApprovalDashboard: React.FC<DuplicateApprovalDashboardProps> = ({
  onOpenApprovalModal,
  masterUserId = '',
  refreshInterval = 60000, // 1 minute default
}) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentItems, setRecentItems] = useState<PendingDuplicate[]>([]);

  useEffect(() => {
    const fetchPendingDuplicates = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/duplicate-requests/count');
        if (!response.ok) throw new Error('Failed to fetch pending count');

        const data = await response.json();
        setPendingCount(data.pendingCount || 0);

        // Fetch recent items if expanded
        if (isExpanded) {
          const itemsResponse = await fetch('/api/duplicate-requests?limit=5');
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            setRecentItems(itemsData.data || []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingDuplicates();
    const interval = setInterval(fetchPendingDuplicates, refreshInterval);
    return () => clearInterval(interval);
  }, [isExpanded, refreshInterval]);

  if (loading && pendingCount === 0) {
    return null;
  }

  if (pendingCount === 0) {
    return null; // Hide widget when no pending duplicates
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">
              {pendingCount} Duplicate Prospect{pendingCount !== 1 ? 's' : ''} Pending Approval
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              Review and approve or reject duplicate records to maintain clean data
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-amber-600 hover:text-amber-700 p-1"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-amber-200">
          {error && (
            <div className="text-sm text-rose-600 mb-3">{error}</div>
          )}

          {recentItems.length > 0 ? (
            <div className="space-y-2 mb-4">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded p-3 text-sm border border-amber-100"
                >
                  <div className="font-medium text-gray-900">{item.companyName}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {item.contactPerson && <span>Contact: {item.contactPerson}</span>}
                    {item.phone && <span className="ml-2">Phone: {item.phone}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Submitted by {item.submittedBy}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600 mb-4">Loading recent items...</div>
          )}

          <button
            onClick={() => onOpenApprovalModal?.()}
            className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-sm transition-colors"
          >
            Review All Pending Duplicates ({pendingCount})
          </button>
        </div>
      )}
    </div>
  );
};

export default DuplicateApprovalDashboard;
