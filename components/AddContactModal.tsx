import React, { useEffect, useState } from 'react';
import { X, Loader2, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { CustomerStatus, DealStage, Contact, ContactPerson } from '../types';
import ValidationSummary from './ValidationSummary';
import FieldHelp from './FieldHelp';
import { validateOptionalEmail, validateOptionalPhone, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface ToastOverride {
  title?: string;
  description?: string;
  durationMs?: number;
}

interface ToastOverrides {
  success?: ToastOverride;
  error?: ToastOverride;
}

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Contact, 'id'>) => Promise<Contact>;
  mode?: 'create' | 'edit';
  initialData?: Contact;
  enableToasts?: boolean;
  toastOverrides?: ToastOverrides;
}

const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  mode = 'create',
  initialData,
  enableToasts = false,
  toastOverrides,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [allowPlaceholderSubmission, setAllowPlaceholderSubmission] = useState(false);
  const { addToast } = useToast();
  
  type ContactPersonDraft = Omit<ContactPerson, 'id'>;

  const today = new Date().toISOString().split('T')[0];
  const isEditMode = mode === 'edit';

  const createEmptyContactPerson = (): ContactPersonDraft => ({
    enabled: true,
    name: '',
    position: '',
    birthday: '',
    telephone: '',
    mobile: '',
    email: '',
  });

  const buildInitialFormData = (): Partial<Contact> => ({
    company: '',
    customerSince: today,
    lastContactDate: today,
    team: '',
    salesman: '',
    referBy: '',
    address: '',
    province: '',
    city: '',
    deliveryAddress: '',
    area: '',
    tin: '',
    priceGroup: 'AA',
    businessLine: '',
    terms: '',
    transactionType: '',
    vatType: 'Exclusive',
    vatPercentage: '12',
    dealershipTerms: '',
    dealershipSince: '',
    dealershipQuota: 0,
    creditLimit: 0,
    status: ((CustomerStatus && CustomerStatus.PROSPECTIVE) || 'Prospective') as CustomerStatus,
    isHidden: false,
    debtType: 'Good',
    comment: '',
    // Legacy fields initialization
    dealValue: 0,
    stage: DealStage.NEW,
    interactions: [],
    comments: [],
    salesHistory: [],
    topProducts: [],
    avatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
  });

  const buildFormDataFromContact = (contact?: Contact): Partial<Contact> => ({
    ...buildInitialFormData(),
    company: contact?.company || '',
    customerSince: contact?.customerSince || today,
    lastContactDate: contact?.lastContactDate || today,
    team: contact?.team || '',
    salesman: contact?.salesman || '',
    referBy: contact?.referBy || '',
    address: contact?.address || '',
    province: contact?.province || '',
    city: contact?.city || '',
    deliveryAddress: contact?.deliveryAddress || '',
    area: contact?.area || '',
    tin: contact?.tin || '',
    priceGroup: contact?.priceGroup || 'AA',
    businessLine: contact?.businessLine || '',
    terms: contact?.terms || '',
    transactionType: contact?.transactionType || '',
    vatType: contact?.vatType || 'Exclusive',
    vatPercentage: contact?.vatPercentage || '12',
    dealershipTerms: contact?.dealershipTerms || '',
    dealershipSince: contact?.dealershipSince || '',
    dealershipQuota: contact?.dealershipQuota ?? 0,
    creditLimit: contact?.creditLimit ?? 0,
    status: (contact?.status as CustomerStatus) || ((CustomerStatus && CustomerStatus.PROSPECTIVE) || 'Prospective'),
    isHidden: !!contact?.isHidden,
    debtType: contact?.debtType || 'Good',
    comment: contact?.comment || '',
    dealValue: contact?.dealValue ?? 0,
    stage: (contact?.stage as DealStage) || DealStage.NEW,
    interactions: contact?.interactions || [],
    comments: contact?.comments || [],
    salesHistory: contact?.salesHistory || [],
    topProducts: contact?.topProducts || [],
    avatar: contact?.avatar || `https://i.pravatar.cc/150?u=${Date.now()}`,
  });

  const buildContactPersonsFromContact = (contact?: Contact): ContactPersonDraft[] => {
    const persons = contact?.contactPersons || [];
    if (persons.length === 0) return [createEmptyContactPerson()];
    return persons.map(person => ({
      enabled: person.enabled ?? true,
      name: person.name || '',
      position: person.position || '',
      birthday: person.birthday || '',
      telephone: person.telephone || '',
      mobile: person.mobile || '',
      email: person.email || '',
    }));
  };

  const [contactPersons, setContactPersons] = useState<ContactPersonDraft[]>([createEmptyContactPerson()]);
  const [formData, setFormData] = useState<Partial<Contact>>(
    isEditMode ? buildFormDataFromContact(initialData) : buildInitialFormData()
  );

  useEffect(() => {
    if (!isOpen) return;
    setLoading(false);
    setSubmitError(null);
    setAllowPlaceholderSubmission(false);
    if (isEditMode && initialData) {
      setFormData(buildFormDataFromContact(initialData));
      setContactPersons(buildContactPersonsFromContact(initialData));
    } else {
      setFormData(buildInitialFormData());
      setContactPersons([createEmptyContactPerson()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditMode, initialData]);

  // Safe status options
  const statusOptions = (CustomerStatus && Object.keys(CustomerStatus).length > 0)
    ? Object.values(CustomerStatus)
    : ['Active', 'Inactive', 'Prospective', 'Blacklisted'];

  if (!isOpen) return null;

  const handleAddContactPerson = () => {
      setContactPersons([...contactPersons, createEmptyContactPerson()]);
  };

  const handleRemoveContactPerson = (index: number) => {
      if (contactPersons.length === 1) return;
      const newPersons = [...contactPersons];
      newPersons.splice(index, 1);
      setContactPersons(newPersons);
  };

  const handleContactPersonChange = (index: number, field: keyof ContactPersonDraft, value: string) => {
      const newPersons = [...contactPersons];
      newPersons[index] = { ...newPersons[index], [field]: value };
      setContactPersons(newPersons);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm(allowPlaceholderSubmission)) {
      setSubmitCount((prev) => prev + 1);
      return;
    }
    setLoading(true);
    setSubmitError(null);
    try {
      const resolvedContactPersons = contactPersons.map((cp, idx) => {
        if (idx !== 0 || !allowPlaceholderSubmission) {
          return cp;
        }
        const emailValidation = validateOptionalEmail(cp.email);
        const phoneValidation = validateOptionalPhone(cp.mobile);
        return {
          ...cp,
          email: emailValidation.isValid ? cp.email : 'n/a',
          mobile: phoneValidation.isValid ? cp.mobile : 'n/a',
        };
      });
      const isDeleted = isEditMode ? !!initialData?.is_deleted : false;
      // Construct final object
      const fullContactPersons: ContactPerson[] = resolvedContactPersons.map((cp, idx) => ({
          ...cp,
          id: `cp-${Date.now()}-${idx}`,
          enabled: true
      })) as ContactPerson[];

      const resolvedDeliveryAddress =
        (formData.deliveryAddress || '').trim() || (formData.address || '').trim();

      const newContact: Omit<Contact, 'id'> = {
        // Core Identifiers
        company: (formData.company || '').trim(),
        customerSince: formData.customerSince || today,
        team: formData.team || '',
        salesman: formData.salesman || '',
        referBy: formData.referBy || '',

        // Location
        address: formData.address || '',
        province: formData.province || '',
        city: formData.city || '',
        area: formData.area || '',
        deliveryAddress: resolvedDeliveryAddress,

        // Financial / Legal
        tin: formData.tin || '',
        priceGroup: formData.priceGroup || 'AA',
        businessLine: formData.businessLine || '',
        terms: formData.terms || '',
        transactionType: formData.transactionType || '',
        vatType: formData.vatType || 'Exclusive',
        vatPercentage: formData.vatPercentage || '12',

        // Dealership Specifics
        dealershipTerms: formData.dealershipTerms || '',
        dealershipSince: formData.dealershipSince || '',
        dealershipQuota: formData.dealershipQuota ?? 0,
        creditLimit: formData.creditLimit ?? 0,

        // Status & Logic
        status:
          (formData.status as CustomerStatus) ||
          (((CustomerStatus && CustomerStatus.PROSPECTIVE) || 'Prospective') as CustomerStatus),
        isHidden: !!formData.isHidden,
        debtType: (formData.debtType as any) || 'Good',
        comment: formData.comment || '',

        // Nested Data
        contactPersons: fullContactPersons,

        // Legacy / UI Helper Fields
        name: fullContactPersons[0]?.name || 'Unknown Contact',
        title: fullContactPersons[0]?.position || '',
        email: fullContactPersons[0]?.email || '',
        phone: fullContactPersons[0]?.mobile || '',
        mobile: fullContactPersons[0]?.mobile || '',
        avatar: formData.avatar || `https://i.pravatar.cc/150?u=${Date.now()}`,
        dealValue: formData.dealValue ?? 0,
        stage: (formData.stage as DealStage) || DealStage.NEW,
        lastContactDate: formData.lastContactDate || today,
        interactions: formData.interactions || [],
        comments: formData.comments || [],
        salesHistory: formData.salesHistory || [],
        topProducts: formData.topProducts || [],
        assignedAgent: formData.salesman || '',

        // Soft delete defaults
        is_deleted: isDeleted,
      };

      await onSubmit(newContact);
      if (enableToasts) {
        const successToast = toastOverrides?.success;
        addToast({ 
          type: 'success', 
          title: successToast?.title ?? (isEditMode ? 'Customer updated' : 'Customer created'),
          description: successToast?.description ?? (isEditMode ? 'Customer information has been updated successfully.' : 'New customer has been added to the database.'),
          durationMs: successToast?.durationMs ?? 4000,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
      const errorMessage = parseSupabaseError(error, 'customer');
      setSubmitError(errorMessage);
      if (enableToasts) {
        const errorToast = toastOverrides?.error;
        addToast({ 
          type: 'error', 
          title: errorToast?.title ?? (isEditMode ? 'Unable to update customer' : 'Unable to create customer'),
          description: errorToast?.description ?? errorMessage,
          durationMs: errorToast?.durationMs ?? 6000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (allowPlaceholders = false): boolean => {
    const errors: Record<string, string> = {};
    const companyValidation = validateRequired(formData.company, 'a customer name');
    if (!companyValidation.isValid) errors.company = companyValidation.message;

    const primaryPerson = contactPersons[0];
    if (primaryPerson) {
      const emailValidation = validateOptionalEmail(primaryPerson.email);
      if (!emailValidation.isValid && !allowPlaceholders) errors.primaryEmail = emailValidation.message;

      const phoneValidation = validateOptionalPhone(primaryPerson.mobile);
      if (!phoneValidation.isValid && !allowPlaceholders) errors.primaryMobile = phoneValidation.message;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: string, value: unknown) => {
    let message = '';
    if (field === 'company') {
      const result = validateRequired(value, 'a customer name');
      message = result.isValid ? '' : result.message;
    }
    if (field === 'primaryEmail') {
      const result = validateOptionalEmail(value);
      message = allowPlaceholderSubmission ? '' : (result.isValid ? '' : result.message);
    }
    if (field === 'primaryMobile') {
      const result = validateOptionalPhone(value);
      message = allowPlaceholderSubmission ? '' : (result.isValid ? '' : result.message);
    }
    if (message || validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: message }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {isEditMode ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form id="add-contact-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <ValidationSummary
            errors={validationErrors}
            summaryKey={submitCount}
            onDismiss={() => {
              setAllowPlaceholderSubmission(true);
              setValidationErrors((prev) => ({
                ...prev,
                primaryEmail: '',
                primaryMobile: '',
              }));
            }}
          />
          <div className="space-y-6">
              
              {/* Core Info */}
              <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">Customer Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="md:col-span-2">
                           <label className="label">Customer Name (Company) *</label>
                           <input
                             required
                             className={`input ${validationErrors.company ? 'border-rose-500' : ''}`}
                             value={formData.company}
                             onChange={e => setFormData({...formData, company: e.target.value})}
                             onBlur={e => handleBlur('company', e.target.value)}
                             placeholder="e.g. Acme Corp"
                           />
                           <FieldHelp
                             text="Enter the registered business name exactly as it appears on official documents."
                             example="Acme Corporation Inc."
                           />
                           {validationErrors.company && (
                             <div className="mt-1 text-xs text-rose-600">{validationErrors.company}</div>
                           )}
                       </div>
                       <div>
                           <label className="label">Customer Since</label>
                           <input type="date" className="input" value={formData.customerSince} onChange={e => setFormData({...formData, customerSince: e.target.value})} />
                       </div>
                       <div>
                           <label className="label">Team</label>
                           <input className="input" value={formData.team} onChange={e => setFormData({...formData, team: e.target.value})} />
                       </div>
                       <div>
                           <label className="label">Salesman</label>
                           <input className="input" value={formData.salesman} onChange={e => setFormData({...formData, salesman: e.target.value})} />
                       </div>
                       <div>
                           <label className="label">Refer By</label>
                           <input className="input" value={formData.referBy} onChange={e => setFormData({...formData, referBy: e.target.value})} />
                       </div>
                  </div>
              </section>

              {/* Address */}
              <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                          <label className="label">Address (Street/Bldg)</label>
                          <input className="input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">Province</label>
                          <input className="input" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">City</label>
                          <input className="input" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">Area</label>
                          <input className="input" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} />
                      </div>
                      <div className="md:col-span-3">
                          <label className="label">Delivery Address</label>
                          <input className="input" value={formData.deliveryAddress} onChange={e => setFormData({...formData, deliveryAddress: e.target.value})} placeholder="Leave blank if same as above" />
                      </div>
                  </div>
              </section>

               {/* Business Info */}
               <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">Business Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                          <label className="label">TIN</label>
                          <input className="input" value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">Price Group</label>
                          <select className="input" value={formData.priceGroup} onChange={e => setFormData({...formData, priceGroup: e.target.value})}>
                              <option value="AA">AA</option><option value="BB">BB</option><option value="CC">CC</option>
                              <option value="DD">DD</option><option value="VIP1">VIP1</option><option value="VIP2">VIP2</option>
                          </select>
                      </div>
                      <div>
                          <label className="label">Business Line</label>
                          <input className="input" value={formData.businessLine} onChange={e => setFormData({...formData, businessLine: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">Terms</label>
                          <input className="input" value={formData.terms} onChange={e => setFormData({...formData, terms: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">Transaction Type</label>
                          <input className="input" value={formData.transactionType} onChange={e => setFormData({...formData, transactionType: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">VAT Type</label>
                          <select className="input" value={formData.vatType} onChange={e => setFormData({...formData, vatType: e.target.value})}>
                              <option value="Exclusive">Exclusive</option>
                              <option value="Inclusive">Inclusive</option>
                          </select>
                      </div>
                      <div>
                          <label className="label">VAT %</label>
                          <input className="input" value={formData.vatPercentage} onChange={e => setFormData({...formData, vatPercentage: e.target.value})} />
                      </div>
                  </div>
              </section>

              {/* Dealership Info */}
               <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">Dealership & Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div>
                          <label className="label">Dealership Terms</label>
                          <input className="input" value={formData.dealershipTerms} onChange={e => setFormData({...formData, dealershipTerms: e.target.value})} />
                      </div>
                      <div>
                          <label className="label">Dealership Since</label>
                          <input className="input" value={formData.dealershipSince} onChange={e => setFormData({...formData, dealershipSince: e.target.value})} />
                      </div>
                       <div>
                          <label className="label">Quota</label>
                          <input type="number" className="input" value={formData.dealershipQuota} onChange={e => setFormData({...formData, dealershipQuota: Number(e.target.value)})} />
                      </div>
                      <div>
                          <label className="label">Credit Limit</label>
                          <input type="number" className="input" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: Number(e.target.value)})} />
                      </div>
                      
                      <div>
                          <label className="label">Status</label>
                          <select className="input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as CustomerStatus})}>
                             {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="label">Debt Type</label>
                          <select className="input" value={formData.debtType} onChange={e => setFormData({...formData, debtType: e.target.value as any})}>
                             <option value="Good">Good</option>
                             <option value="Bad">Bad</option>
                          </select>
                      </div>

                      <div className="col-span-2 flex items-end">
                           <button 
                                type="button"
                                onClick={() => setFormData({...formData, isHidden: !formData.isHidden})}
                                className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border ${
                                    formData.isHidden 
                                    ? 'bg-slate-100 border-slate-200 text-slate-500' 
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                }`}
                            >
                                {formData.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                <span className="text-sm font-bold">{formData.isHidden ? 'Hidden' : 'Visible'}</span>
                           </button>
                      </div>
                  </div>
                   <div className="mt-4">
                      <label className="label">Comment</label>
                      <textarea className="input" rows={2} value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})}></textarea>
                   </div>
              </section>

              {/* Contact Persons */}
              <section>
                   <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact Persons</h3>
                        <button type="button" onClick={handleAddContactPerson} className="text-xs text-brand-blue font-bold flex items-center gap-1 hover:underline">
                            <Plus className="w-3 h-3" /> Add Person
                        </button>
                   </div>
                   
                   <div className="space-y-4">
                       {contactPersons.map((person, idx) => (
                           <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl relative group border border-slate-100 dark:border-slate-800">
                               <button 
                                    type="button" 
                                    onClick={() => handleRemoveContactPerson(idx)} 
                                    className="absolute right-2 top-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                   <Trash2 className="w-4 h-4" />
                               </button>
                               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                   <div>
                                       <label className="label">Name</label>
                                       <input className="input" value={person.name} onChange={e => handleContactPersonChange(idx, 'name', e.target.value)} placeholder="Full Name" />
                                   </div>
                                   <div>
                                       <label className="label">Position</label>
                                       <input className="input" value={person.position} onChange={e => handleContactPersonChange(idx, 'position', e.target.value)} placeholder="Role" />
                                   </div>
                                   <div>
                                       <label className="label">Birthday</label>
                                       <input type="date" className="input" value={person.birthday} onChange={e => handleContactPersonChange(idx, 'birthday', e.target.value)} />
                                   </div>
                                   <div>
                                       <label className="label">Mobile</label>
                                       <input
                                         className={`input ${idx === 0 && validationErrors.primaryMobile ? 'border-rose-500' : ''}`}
                                         value={person.mobile}
                                         onChange={e => handleContactPersonChange(idx, 'mobile', e.target.value)}
                                         onBlur={e => idx === 0 && handleBlur('primaryMobile', e.target.value)}
                                       />
                                       {idx === 0 && validationErrors.primaryMobile && (
                                         <div className="mt-1 text-xs text-rose-600">{validationErrors.primaryMobile}</div>
                                       )}
                                   </div>
                                   <div>
                                       <label className="label">Telephone</label>
                                       <input className="input" value={person.telephone} onChange={e => handleContactPersonChange(idx, 'telephone', e.target.value)} />
                                   </div>
                                   <div>
                                       <label className="label">Email</label>
                                       <input
                                         className={`input ${idx === 0 && validationErrors.primaryEmail ? 'border-rose-500' : ''}`}
                                         value={person.email}
                                         onChange={e => handleContactPersonChange(idx, 'email', e.target.value)}
                                         onBlur={e => idx === 0 && handleBlur('primaryEmail', e.target.value)}
                                       />
                                       {idx === 0 && validationErrors.primaryEmail && (
                                         <div className="mt-1 text-xs text-rose-600">{validationErrors.primaryEmail}</div>
                                       )}
                                   </div>
                               </div>
                           </div>
                       ))}
                   </div>
              </section>

          </div>

          <style>{`
            .label {
                display: block;
                font-size: 0.75rem;
                font-weight: 700;
                color: #64748b;
                margin-bottom: 0.25rem;
                text-transform: uppercase;
            }
            .dark .label { color: #94a3b8; }
            .input {
              width: 100%;
              background-color: rgb(248 250 252);
              border: 1px solid rgb(226 232 240);
              border-radius: 0.5rem;
              padding: 0.5rem 0.75rem;
              font-size: 0.875rem;
              color: rgb(30 41 59);
              outline: none;
              transition: all 0.2s;
            }
            .dark .input {
              background-color: rgb(30 41 59);
              border-color: rgb(51 65 85);
              color: white;
            }
            .input:focus {
              border-color: #0F5298;
              box-shadow: 0 0 0 1px #0F5298;
            }
          `}</style>
        </form>
        
        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1 flex flex-col gap-2">
              {submitError && (
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {submitError}
                </div>
              )}
              <button
                type="submit"
                form="add-contact-form"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditMode ? 'Update Customer' : 'Save Customer')}
              </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default AddContactModal;
