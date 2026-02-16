import React from 'react';
import { X, Calendar, User, Briefcase, Package, DollarSign, Inbox, Code, FileText, Users } from 'lucide-react';

interface InquiryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inquiry: any;
}

const InquiryDetailsModal: React.FC<InquiryDetailsModalProps> = ({ isOpen, onClose, inquiry }) => {
  if (!isOpen || !inquiry) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Inquiry Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4" />
                  Inquiry Number
                </label>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{inquiry.inquiry_no || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" />
                  Sales Date
                </label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.sales_date ? formatDate(inquiry.sales_date) : 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <User className="w-4 h-4" />
                  Salesperson
                </label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.sales_person || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4" />
                  Customer
                </label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.customer_company || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Item Details
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                    <Code className="w-4 h-4" />
                    Part No
                  </label>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{inquiry.part_no || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                    <Code className="w-4 h-4" />
                    Item Code
                  </label>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.item_code || 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Briefcase className="w-4 h-4" />
                  Brand / Description
                </label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.description || inquiry.brand || 'N/A'}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Inbox className="w-4 h-4" />
                  Application
                </label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.application || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Order Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Quantity</label>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{inquiry.qty || inquiry.quantity || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Unit Price</label>
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.unit_price ? formatCurrency(inquiry.unit_price) : 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Total Amount</label>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{inquiry.amount ? formatCurrency(inquiry.amount) : 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Stock Status</label>
                <p className={`text-sm font-semibold ${inquiry.remark === 'OutStock' ? 'text-red-600' : 'text-green-600'}`}>
                  {inquiry.remark === 'OutStock' ? 'Out of Stock' : 'On Stock'}
                </p>
              </div>
            </div>
          </div>

          {inquiry.remarks && (
            <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                Remarks
              </label>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-gray-700 dark:text-slate-300">{inquiry.remarks}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InquiryDetailsModal;
