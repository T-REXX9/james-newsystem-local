import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { createDailyCallIncidentReport } from '../services/dailyCallCustomerDetailService';
import { fetchContactTransactions } from '../services/customerDatabaseLocalApiService';
import { syncIncidentReportItem } from '../services/incidentItemSyncService';
import { useToast } from './ToastProvider';
import { Product, UserProfile, ContactTransaction } from '../types';
import ProductAutocomplete from './ProductAutocomplete';
import TransactionAutocomplete from './TransactionAutocomplete';
import ValidationSummary from './ValidationSummary';
import FieldHelp from './FieldHelp';
import { validateMinLength, validateRequired } from '../utils/formValidation';

interface CreateIncidentReportModalProps {
  contactId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: UserProfile | null;
}

const CreateIncidentReportModal: React.FC<CreateIncidentReportModalProps> = ({
  contactId,
  isOpen,
  onClose,
  onSuccess,
  currentUser,
}) => {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ContactTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<ContactTransaction[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [affectedQuantity, setAffectedQuantity] = useState('1');
  const savedIncidentReportIdRef = useRef<string | null>(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    reportDate: today,
    incidentDate: '',
    issueType: '' as 'product_quality' | 'service_quality' | 'delivery' | 'other' | '',
    description: '',
    reportedBy: currentUser?.full_name || '',
    attachments: '',
    notes: '',
  });

  // Update reportedBy when currentUser changes
  useEffect(() => {
    if (currentUser?.full_name) {
      setFormData(prev => ({ ...prev, reportedBy: currentUser.full_name }));
    }
  }, [currentUser]);

  // Fetch transactions when modal opens
  useEffect(() => {
    if (isOpen && contactId) {
      const loadTransactions = async () => {
        setLoadingTransactions(true);
        try {
          const data = await fetchContactTransactions(contactId);
          setTransactions(data);
        } catch (err) {
          console.error('Error loading transactions:', err);
        } finally {
          setLoadingTransactions(false);
        }
      };
      loadTransactions();
    }
  }, [isOpen, contactId]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateField = (field: string, value: unknown): string => {
    switch (field) {
      case 'incidentDate': {
        const requiredCheck = validateRequired(value, 'an incident date');
        if (!requiredCheck.isValid) return requiredCheck.message;
        if (value && new Date(value as string) > new Date()) {
          return 'Please choose an incident date that is not in the future.';
        }
        return '';
      }
      case 'issueType': {
        const result = validateRequired(value, 'an issue type');
        return result.isValid ? '' : result.message;
      }
      case 'description': {
        const requiredCheck = validateRequired(value, 'a description');
        if (!requiredCheck.isValid) return requiredCheck.message;
        const lengthCheck = validateMinLength(value, 'description', 10);
        return lengthCheck.isValid ? '' : lengthCheck.message;
      }
      case 'reportedBy': {
        const result = validateRequired(value, 'a reporter name');
        return result.isValid ? '' : result.message;
      }
      case 'affectedProduct': {
        if (formData.issueType !== 'product_quality' && formData.issueType !== 'delivery') return '';
        return selectedProduct ? '' : 'Please select the affected item for this complaint.';
      }
      case 'affectedQuantity': {
        if (!selectedProduct) return '';
        const quantity = Number(value);
        return Number.isFinite(quantity) && quantity > 0 ? '' : 'Quantity must be greater than zero.';
      }
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    (['incidentDate', 'issueType', 'description', 'reportedBy'] as const).forEach((field) => {
      const message = validateField(field, (formData as Record<string, unknown>)[field]);
      if (message) errors[field] = message;
    });

    const affectedProductError = validateField('affectedProduct', selectedProduct);
    if (affectedProductError) errors.affectedProduct = affectedProductError;
    const affectedQuantityError = validateField('affectedQuantity', affectedQuantity);
    if (affectedQuantityError) errors.affectedQuantity = affectedQuantityError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      setSubmitCount((prev) => prev + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      const attachmentsArray = formData.attachments
        ? formData.attachments.split(',').map(url => url.trim()).filter(url => url)
        : undefined;

      const relatedTransactions = selectedTransactions.map(transaction => ({
        transaction_type: transaction.type,
        transaction_id: transaction.id,
        transaction_number: transaction.number,
        transaction_date: transaction.date,
      }));

      let incidentReportId = savedIncidentReportIdRef.current;
      if (!incidentReportId) {
        const draftIncidentReportId = globalThis.crypto?.randomUUID?.();
        if (!draftIncidentReportId) {
          throw new Error('This browser cannot create a stable incident reference. Please use an updated browser.');
        }

        const createdIncidentReport = await createDailyCallIncidentReport({
          id: draftIncidentReportId,
          contact_id: contactId,
          report_date: formData.reportDate,
          incident_date: formData.incidentDate,
          issue_type: formData.issueType as 'product_quality' | 'service_quality' | 'delivery' | 'other',
          description: formData.description.trim(),
          reported_by: formData.reportedBy.trim(),
          attachments: attachmentsArray,
          related_transactions: relatedTransactions.length > 0 ? relatedTransactions : undefined,
          notes: formData.notes.trim() || undefined,
        });

        if (!createdIncidentReport?.id) {
          throw new Error('The customer incident was saved, but it could not be linked to the warehouse report.');
        }
        savedIncidentReportIdRef.current = createdIncidentReport.id;
        incidentReportId = createdIncidentReport.id;
      }

      const supplier = selectedProduct?.supplier_costs?.find((entry) => !entry.is_blacklisted) || selectedProduct?.supplier_costs?.[0];
      await syncIncidentReportItem({
        incident_report_id: incidentReportId,
        contact_id: contactId,
        product_id: selectedProduct?.id,
        item_code: selectedProduct?.item_code,
        part_no: selectedProduct?.part_no,
        description: selectedProduct?.description || formData.description.trim(),
        supplier_id: supplier?.supplier_id,
        supplier_name: supplier?.supplier_name,
        quantity: selectedProduct ? Number(affectedQuantity) : undefined,
        issue_summary: formData.description.trim(),
        issue_type: formData.issueType,
        report_date: formData.reportDate,
      });

      addToast({
        type: 'success',
        title: 'Incident report submitted',
        description: 'The customer record and warehouse incident report have both been saved.',
      });
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error creating incident report:', err);
      const friendlyMessage = savedIncidentReportIdRef.current
        ? 'The customer incident was saved, but the warehouse report sync failed. Please click Retry Warehouse Sync.'
        : err instanceof Error ? err.message : 'Unable to create the incident report. Please try again.';
      setError(friendlyMessage);
      addToast({ type: 'error', title: 'Unable to complete report sync', description: friendlyMessage, durationMs: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlur = (field: string, value: unknown) => {
    const message = validateField(field, value);
    setValidationErrors((prev) => ({ ...prev, [field]: message }));
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        reportDate: today,
        incidentDate: '',
        issueType: '',
        description: '',
        reportedBy: currentUser?.full_name || '',
        attachments: '',
        notes: '',
      });
      setSelectedProduct(null);
      setAffectedQuantity('1');
      setSelectedTransactions([]);
      savedIncidentReportIdRef.current = null;
      setValidationErrors({});
      setError(null);
      onClose();
    }
  };

  const handleSelectTransaction = (transaction: ContactTransaction) => {
    setSelectedTransactions(prev => [...prev, transaction]);
  };

  const handleRemoveTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => prev.filter(t => t.id !== transactionId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Incident Report
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Date
              </label>
              <input
                type="date"
                value={formData.reportDate}
                onChange={(e) => setFormData({ ...formData, reportDate: e.target.value })}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Incident Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.incidentDate}
                onChange={(e) => {
                  setFormData({ ...formData, incidentDate: e.target.value });
                  setValidationErrors({ ...validationErrors, incidentDate: '' });
                }}
                onBlur={(e) => handleBlur('incidentDate', e.target.value)}
                disabled={isSubmitting}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 ${
                  validationErrors.incidentDate
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              <FieldHelp
                text="Select the date the incident occurred, not the date you are reporting it."
                example="2026-01-15"
              />
              {validationErrors.incidentDate && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {validationErrors.incidentDate}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Issue Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.issueType}
              onChange={(e) => {
                setFormData({ ...formData, issueType: e.target.value as any });
                setValidationErrors({ ...validationErrors, issueType: '' });
              }}
              onBlur={(e) => handleBlur('issueType', e.target.value)}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 ${
                validationErrors.issueType
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">Select an issue type</option>
              <option value="product_quality">Product Quality</option>
              <option value="service_quality">Service Quality</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </select>
            {validationErrors.issueType && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.issueType}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Affected Item {(formData.issueType === 'product_quality' || formData.issueType === 'delivery') && <span className="text-red-500">*</span>}
            </label>
            {selectedProduct ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedProduct.description || 'Selected product'}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    {selectedProduct.part_no || 'No part number'} {selectedProduct.item_code ? `• ${selectedProduct.item_code}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  disabled={isSubmitting}
                  className="rounded p-1 text-gray-500 hover:bg-white hover:text-red-600 disabled:opacity-50 dark:hover:bg-gray-800"
                  aria-label="Remove affected item"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <ProductAutocomplete
                onSelect={(product) => {
                  setSelectedProduct(product);
                  setValidationErrors((prev) => ({ ...prev, affectedProduct: '', affectedQuantity: '' }));
                }}
                placeholder="Search by part number, item code, or description..."
              />
            )}
            {selectedProduct && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="incident-affected-quantity">
                  Affected Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  id="incident-affected-quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={affectedQuantity}
                  onChange={(e) => {
                    setAffectedQuantity(e.target.value);
                    setValidationErrors((prev) => ({ ...prev, affectedQuantity: '' }));
                  }}
                  onBlur={(e) => handleBlur('affectedQuantity', e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 ${
                    validationErrors.affectedQuantity ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {validationErrors.affectedQuantity && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{validationErrors.affectedQuantity}</p>}
              </div>
            )}
            {validationErrors.affectedProduct && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{validationErrors.affectedProduct}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select the product for product-quality or delivery complaints so it appears in the warehouse incident report.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reported By <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reportedBy}
              readOnly
              disabled={isSubmitting}
              placeholder="Current user"
              className={`w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed ${
                validationErrors.reportedBy
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              title="This field is automatically filled with your name"
            />
            {validationErrors.reportedBy && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.reportedBy}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Automatically filled with your name
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setValidationErrors({ ...validationErrors, description: '' });
              }}
              onBlur={(e) => handleBlur('description', e.target.value)}
              disabled={isSubmitting}
              placeholder="Describe the incident in detail (minimum 10 characters)"
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 resize-none ${
                validationErrors.description
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {validationErrors.description && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {validationErrors.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Related Transactions (Optional)
            </label>
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading transactions...
              </div>
            ) : (
              <TransactionAutocomplete
                transactions={transactions}
                selectedTransactions={selectedTransactions}
                onSelect={handleSelectTransaction}
                onRemove={handleRemoveTransaction}
                disabled={isSubmitting}
              />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Attach invoices, orders, or other transactions related to this incident
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              File Attachments (Optional)
            </label>
            <input
              type="text"
              value={formData.attachments}
              onChange={(e) => setFormData({ ...formData, attachments: e.target.value })}
              disabled={isSubmitting}
              placeholder="Enter URLs separated by commas"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter multiple file URLs separated by commas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isSubmitting}
              placeholder="Additional notes or comments"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : savedIncidentReportIdRef.current ? 'Retry Warehouse Sync' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateIncidentReportModal;
