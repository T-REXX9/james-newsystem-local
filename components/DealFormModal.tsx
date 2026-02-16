import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { createDeal, updateDeal, fetchContacts, fetchProfiles } from '../services/supabaseService';
import { useToast } from './ToastProvider';
import { PipelineDeal, UserProfile, Contact } from '../types';
import { PIPELINE_COLUMNS } from '../constants';
import ValidationSummary from './ValidationSummary';
import FieldHelp from './FieldHelp';
import { validateMinLength, validateNumeric, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deal?: PipelineDeal | null;
  currentUser?: UserProfile;
}

type CustomerType = 'VIP1' | 'VIP2' | 'Regular';

const DealFormModal: React.FC<DealFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  deal,
  currentUser,
}) => {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);

  const isEditMode = !!deal;

  const getDefaultFormData = () => ({
    title: '',
    company: '',
    contactName: '',
    value: 0,
    currency: '₱',
    stageId: PIPELINE_COLUMNS[0]?.id || 'prospective',
    ownerName: currentUser?.full_name || '',
    ownerId: currentUser?.id || '',
    customerType: 'Regular' as CustomerType,
    nextStep: '',
    entryEvidence: '',
    exitEvidence: '',
    riskFlag: '',
    avatar: 'https://i.pravatar.cc/150?u=default',
  });

  const [formData, setFormData] = useState(getDefaultFormData());

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      const loadData = async () => {
        setLoading(true);
        try {
          const [contactsData, profilesData] = await Promise.all([
            fetchContacts(),
            fetchProfiles(),
          ]);
          if (isMounted) {
            setContacts(contactsData);
            setProfiles(profilesData);
          }
        } catch (err) {
          console.error('Error loading data:', err);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        company: deal.company || '',
        contactName: deal.contactName || '',
        value: deal.value || 0,
        currency: deal.currency || '₱',
        stageId: deal.stageId || PIPELINE_COLUMNS[0]?.id || 'prospective',
        ownerName: deal.ownerName || '',
        ownerId: deal.ownerId || '',
        customerType: deal.customerType || 'Regular',
        nextStep: deal.nextStep || '',
        entryEvidence: deal.entryEvidence || '',
        exitEvidence: deal.exitEvidence || '',
        riskFlag: deal.riskFlag || '',
        avatar: deal.avatar || 'https://i.pravatar.cc/150?u=default',
      });
    } else {
      setFormData(getDefaultFormData());
    }
  }, [deal, currentUser]);

  const validateField = (field: string, value: unknown): string => {
    switch (field) {
      case 'title': {
        const requiredCheck = validateRequired(value, 'a deal title');
        if (!requiredCheck.isValid) return requiredCheck.message;
        const lengthCheck = validateMinLength(value, 'deal title', 3);
        return lengthCheck.isValid ? '' : lengthCheck.message;
      }
      case 'company': {
        const result = validateRequired(value, 'a company name');
        return result.isValid ? '' : result.message;
      }
      case 'value': {
        const result = validateNumeric(value, 'deal value', 1);
        return result.isValid ? '' : result.message.replace('deal value', 'deal value greater than 0');
      }
      case 'stageId': {
        const result = validateRequired(value, 'a stage');
        return result.isValid ? '' : result.message;
      }
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    (['title', 'company', 'value', 'stageId'] as const).forEach((field) => {
      const message = validateField(field, (formData as Record<string, unknown>)[field]);
      if (message) errors[field] = message;
    });
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
      if (isEditMode && deal) {
        await updateDeal(deal.id, formData);
        addToast({ type: 'success', title: 'Deal updated', description: 'Your changes have been saved.' });
      } else {
        await createDeal(formData);
        addToast({ type: 'success', title: 'Deal created', description: 'The deal is ready in your pipeline.' });
      }
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error saving deal:', err);
      const friendlyMessage = parseSupabaseError(err, 'deal');
      setError(friendlyMessage);
      addToast({ type: 'error', title: 'Unable to save deal', description: friendlyMessage, durationMs: 6000 });
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
      setFormData(getDefaultFormData());
      setValidationErrors({});
      setError(null);
      onClose();
    }
  };

  const handleCompanySelect = (contact: Contact) => {
    setFormData(prev => ({
      ...prev,
      company: contact.company,
      contactName: contact.name,
      avatar: contact.avatar || `https://i.pravatar.cc/150?u=${contact.id}`,
    }));
  };

  const handleOwnerSelect = (profile: UserProfile) => {
    setFormData(prev => ({
      ...prev,
      ownerName: profile.full_name,
      ownerId: profile.id,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            {isEditMode ? 'Edit Deal' : 'Create New Deal'}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <CustomLoadingSpinner label="Loading" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Deal Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    onBlur={e => handleBlur('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue ${
                      validationErrors.title ? 'border-rose-500' : 'border-gray-200 dark:border-slate-700'
                    }`}
                    placeholder="e.g., Monthly Oil Supply Contract"
                  />
                  <FieldHelp
                    text="Use a clear, specific title so your team can identify the opportunity quickly."
                    example="Monthly Oil Supply Contract"
                  />
                  {validationErrors.title && (
                    <p className="mt-1 text-xs text-rose-500">{validationErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Company <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="companies-list"
                    value={formData.company}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, company: e.target.value }));
                      const match = contacts.find(c => c.company === e.target.value);
                      if (match) handleCompanySelect(match);
                    }}
                    onBlur={e => handleBlur('company', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue ${
                      validationErrors.company ? 'border-rose-500' : 'border-gray-200 dark:border-slate-700'
                    }`}
                    placeholder="Select or type company name"
                  />
                  <datalist id="companies-list">
                    {contacts.map(c => (
                      <option key={c.id} value={c.company} />
                    ))}
                  </datalist>
                  {validationErrors.company && (
                    <p className="mt-1 text-xs text-rose-500">{validationErrors.company}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={e => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    placeholder="Primary contact person"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Value ({formData.currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.value}
                    onChange={e => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                    onBlur={e => handleBlur('value', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue ${
                      validationErrors.value ? 'border-rose-500' : 'border-gray-200 dark:border-slate-700'
                    }`}
                    placeholder="Deal value"
                  />
                  <FieldHelp
                    text="Enter the estimated revenue for this opportunity."
                    example="150000"
                  />
                  {validationErrors.value && (
                    <p className="mt-1 text-xs text-rose-500">{validationErrors.value}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Stage <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.stageId}
                    onChange={e => setFormData(prev => ({ ...prev, stageId: e.target.value }))}
                    onBlur={e => handleBlur('stageId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue ${
                      validationErrors.stageId ? 'border-rose-500' : 'border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {PIPELINE_COLUMNS.map(stage => (
                      <option key={stage.id} value={stage.id}>{stage.title}</option>
                    ))}
                  </select>
                  {validationErrors.stageId && (
                    <p className="mt-1 text-xs text-rose-500">{validationErrors.stageId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Owner
                  </label>
                  <select
                    value={formData.ownerId}
                    onChange={e => {
                      const profile = profiles.find(p => p.id === e.target.value);
                      if (profile) handleOwnerSelect(profile);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  >
                    <option value="">Select owner</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Customer Type
                  </label>
                  <select
                    value={formData.customerType}
                    onChange={e => setFormData(prev => ({ ...prev, customerType: e.target.value as CustomerType }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  >
                    <option value="VIP1">VIP1</option>
                    <option value="VIP2">VIP2</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Next Step
                  </label>
                  <input
                    type="text"
                    value={formData.nextStep}
                    onChange={e => setFormData(prev => ({ ...prev, nextStep: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    placeholder="What's the next action for this deal?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Entry Evidence
                  </label>
                  <textarea
                    value={formData.entryEvidence}
                    onChange={e => setFormData(prev => ({ ...prev, entryEvidence: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                    placeholder="Evidence for entering current stage"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Exit Evidence
                  </label>
                  <textarea
                    value={formData.exitEvidence}
                    onChange={e => setFormData(prev => ({ ...prev, exitEvidence: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                    placeholder="Evidence needed to exit current stage"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Risk Flag
                  </label>
                  <input
                    type="text"
                    value={formData.riskFlag}
                    onChange={e => setFormData(prev => ({ ...prev, riskFlag: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    placeholder="Any risks or blockers to note"
                  />
                </div>
              </div>
            </>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
            className="px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DealFormModal;
