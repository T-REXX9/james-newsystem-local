import React, { useEffect, useState } from 'react';
import { HelpCircle, CheckCircle, Clock } from 'lucide-react';
import { fetchInquiryHistory } from '../services/supabaseService';

interface InquiryHistoryTabProps {
  contactId: string;
}

const InquiryHistoryTab: React.FC<InquiryHistoryTabProps> = ({ contactId }) => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInquiries = async () => {
      try {
        const data = await fetchInquiryHistory(contactId);
        setInquiries(data || []);
      } catch (err) {
        console.error('Error loading inquiry history:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadInquiries();
  }, [contactId]);

  const getStatusIcon = (status: string) => {
    if (status === 'converted') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === 'pending') return <Clock className="w-4 h-4 text-yellow-500" />;
    return null;
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading inquiry history...</div>;
  }

  if (inquiries.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No inquiry history yet</p>
      </div>
    );
  }

  const convertedCount = inquiries.filter((i: any) => i.status === 'converted').length;
  const pendingCount = inquiries.filter((i: any) => i.status === 'pending').length;
  const conversionRate = inquiries.length > 0 ? Math.round((convertedCount / inquiries.length) * 100) : 0;

  return (
    <div className="space-y-4 p-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{inquiries.length}</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">Total Inquiries</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-lg p-3 text-center border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{convertedCount}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Converted</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
          <p className="text-sm font-bold text-purple-900 dark:text-purple-100">{conversionRate}%</p>
          <p className="text-xs text-purple-700 dark:text-purple-300">Conversion</p>
        </div>
      </div>

      {/* Inquiry List */}
      <div className="space-y-3">
        {inquiries.map((inquiry, idx) => (
          <div key={inquiry.id || idx} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-800 dark:text-white">
                    {inquiry.product}
                  </h4>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    inquiry.status === 'converted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                    inquiry.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {getStatusIcon(inquiry.status)}
                    {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Date</p>
                    <p className="text-slate-700 dark:text-slate-300">
                      {new Date(inquiry.inquiry_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Quantity</p>
                    <p className="text-slate-700 dark:text-slate-300">
                      {inquiry.quantity} unit(s)
                    </p>
                  </div>
                </div>
              </div>
              {inquiry.converted_to_purchase && (
                <div className="text-right">
                  <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded text-xs font-bold">
                    Purchased
                  </span>
                </div>
              )}
            </div>

            {inquiry.notes && (
              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 rounded text-sm text-slate-600 dark:text-slate-300">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Notes:</p>
                {inquiry.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InquiryHistoryTab;
