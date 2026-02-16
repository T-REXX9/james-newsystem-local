import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutGrid,
  Plus,
  Trash2,
  AlertCircle,
  ListFilter,
  Search,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import {
  Contact,
  SalesInquiry,
  SalesInquiryDTO,
  SalesInquiryItem,
  SalesInquiryStatus,
} from '../types';
import { fetchContacts } from '../services/supabaseService';
import {
  approveInquiry,
  convertToOrder,
  createSalesInquiry,
  deleteSalesInquiry,
  getAllSalesInquiries,
  updateSalesInquiry,
} from '../services/salesInquiryService';
import { getProductPrice } from '../services/productService';
import { getSalesOrderByInquiry } from '../services/salesOrderService';

import ProductSearchModal from './ProductSearchModal';
import StatusBadge from './StatusBadge';
import { useToast } from './ToastProvider';
import { useRealtimeNestedList } from '../hooks/useRealtimeNestedList';
import { useRealtimeList } from '../hooks/useRealtimeList';
import ValidationSummary from './ValidationSummary';
import { validateNumeric, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';

interface InquiryItemRow extends Omit<SalesInquiryItem, 'id' | 'inquiry_id'> {
  tempId?: string;
  isNew?: boolean; // Flag to indicate if the row is new and editable via autocomplete
}

type LoadedFormSnapshot = {
  inquiryId: string;
  contactId: string;
  salesDate: string;
  salesPerson: string;
  deliveryAddress: string;
  referenceNo: string;
  customerReference: string;
  sendBy: string;
  poNumber: string;
  priceGroup: string;
  creditLimit: number;
  terms: string;
  promiseToPay: string;
  remarks: string;
  inquiryType: string;
  showNewInquiryType: boolean;
  newInquiryType: string;
  urgency: string;
  urgencyDate: string;
  items: InquiryItemRow[];
};

interface SalesInquiryViewProps {
  initialContactId?: string;
  initialPrefillToken?: string;
}

const SalesInquiryView: React.FC<SalesInquiryViewProps> = ({ initialContactId, initialPrefillToken }) => {
  const { addToast } = useToast();
  const lastAppliedPrefillRef = React.useRef<string | null>(null);
  // Data
  const [loading, setLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<SalesInquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SalesInquiryStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loadedSnapshot, setLoadedSnapshot] = useState<LoadedFormSnapshot | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const savedTheme = window.localStorage?.getItem('theme');
    if (savedTheme === 'light') return false;
    if (savedTheme === 'dark') return true;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      window.localStorage?.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      window.localStorage?.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Use real-time list for contacts
  const { data: customers } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
  });

  // Use real-time nested list for inquiries with items
  const sortByCreatedAt = (a: SalesInquiry, b: SalesInquiry) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const {
    data: inquiries,
    isLoading: listLoading,
    refetch: refetchInquiries
  } = useRealtimeNestedList<SalesInquiry, SalesInquiryItem>({
    parentTableName: 'sales_inquiries',
    childTableName: 'sales_inquiry_items',
    parentFetchFn: getAllSalesInquiries,
    childParentIdField: 'inquiry_id',
    childrenField: 'items',
    sortParentFn: sortByCreatedAt,
  });

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [inquiryNo, setInquiryNo] = useState('');
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesPerson, setSalesPerson] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [sendBy, setSendBy] = useState('');
  const [priceGroup, setPriceGroup] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [terms, setTerms] = useState('');
  const [promiseToPay, setPromiseToPay] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [inquiryType, setInquiryType] = useState('General');
  const [showNewInquiryType, setShowNewInquiryType] = useState(false);
  const [newInquiryType, setNewInquiryType] = useState('');
  const [urgency, setUrgency] = useState('N/A');
  const [urgencyDate, setUrgencyDate] = useState('');

  // Items Table
  const [items, setItems] = useState<InquiryItemRow[]>([]);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const generateInquiryNumber = useCallback(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `INQ${year}${month}${day}-${random}`;
  }, []);

  const handleOpenProductModal = (rowTempId: string) => {
    setActiveRowId(rowTempId);
    setShowProductModal(true);
  };

  const handleProductSelect = (product: any) => {
    if (!activeRowId) return;

    const price = getProductPrice(product, priceGroup);
    setItems(prev => prev.map(item => {
      if (item.tempId === activeRowId) {
        return {
          ...item,
          item_id: product.id,
          part_no: product.part_no,
          item_code: product.item_code,
          description: product.description,
          unit_price: price,
          amount: (item.qty || 1) * price,
          isNew: false
        };
      }
      return item;
    }));
  };

  const formatCurrency = useCallback((value: number) => {
    const normalized = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(normalized);
  }, []);

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

  const filteredInquiries = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return inquiries.filter((inquiry) => {
      const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
      const customerName = customerMap.get(inquiry.contact_id)?.company?.toLowerCase() || '';
      const matchesQuery =
        !query ||
        inquiry.inquiry_no.toLowerCase().includes(query) ||
        customerName.includes(query) ||
        (inquiry.sales_person || '').toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [customerMap, inquiries, searchTerm, statusFilter]);

  // Generate initial inquiry number and preload data
  useEffect(() => {
    const newInquiryNo = generateInquiryNumber();
    setInquiryNo(newInquiryNo);
    setReferenceNo(newInquiryNo);
  }, [generateInquiryNumber]);

  const resetFormForNew = useCallback(() => {
    const newInquiryNo = generateInquiryNumber();

    setInquiryNo(newInquiryNo);
    setSelectedCustomer(null);
    setSalesDate(new Date().toISOString().split('T')[0]);
    setSalesPerson('');
    setDeliveryAddress('');
    setReferenceNo(newInquiryNo);
    setCustomerReference('');
    setSendBy('');
    setPriceGroup('');
    setCreditLimit(0);
    setTerms('');
    setPromiseToPay('');
    setPoNumber('');
    setRemarks('');
    setInquiryType('General');
    setShowNewInquiryType(false);
    setNewInquiryType('');
    setUrgency('N/A');
    setUrgencyDate('');
    setItems([]);
    setValidationErrors({});
    setSubmitError('');
    setSubmitCount(0);
    setLoadedSnapshot(null);
  }, [generateInquiryNumber]);

  const loadInquiryIntoForm = useCallback((inquiry: SalesInquiry) => {
    const customer = customerMap.get(inquiry.contact_id) || null;
    const normalizedSalesDate = (inquiry.sales_date || '').split('T')[0];
    setInquiryNo((prev) => inquiry.inquiry_no || prev);

    const mappedItems: InquiryItemRow[] = (inquiry.items || []).map((item) => {
      const { id: _id, inquiry_id: _inquiryId, ...rest } = item as SalesInquiryItem;
      return {
        ...rest,
        tempId: (item as SalesInquiryItem).id,
        isNew: false,
      };
    });

    setSelectedCustomer(customer);
    setSalesDate(normalizedSalesDate || new Date().toISOString().split('T')[0]);
    setSalesPerson(inquiry.sales_person || customer?.salesman || '');
    setDeliveryAddress(inquiry.delivery_address || customer?.deliveryAddress || customer?.address || '');
    setReferenceNo(inquiry.reference_no || inquiry.inquiry_no || '');
    setCustomerReference(inquiry.customer_reference || '');
    setSendBy(inquiry.send_by || '');
    setPoNumber(inquiry.po_number || '');
    setPriceGroup(inquiry.price_group || customer?.priceGroup || '');
    setCreditLimit(Number.isFinite(inquiry.credit_limit) ? inquiry.credit_limit : (customer?.creditLimit || 0));
    setTerms(inquiry.terms || customer?.terms || '');
    setPromiseToPay(inquiry.promise_to_pay || customer?.dealershipTerms || '');
    setRemarks(inquiry.remarks || '');
    setInquiryType(inquiry.inquiry_type || 'General');
    setShowNewInquiryType(false);
    setNewInquiryType('');
    setUrgency(inquiry.urgency || 'N/A');
    setUrgencyDate(inquiry.urgency_date || '');
    setItems(mappedItems);
    setValidationErrors({});
    setSubmitError('');
    setSubmitCount(0);

    setLoadedSnapshot({
      inquiryId: inquiry.id,
      contactId: inquiry.contact_id,
      salesDate: normalizedSalesDate || '',
      salesPerson: inquiry.sales_person || '',
      deliveryAddress: inquiry.delivery_address || '',
      referenceNo: inquiry.reference_no || '',
      customerReference: inquiry.customer_reference || '',
      sendBy: inquiry.send_by || '',
      poNumber: inquiry.po_number || '',
      priceGroup: inquiry.price_group || '',
      creditLimit: inquiry.credit_limit || 0,
      terms: inquiry.terms || '',
      promiseToPay: inquiry.promise_to_pay || '',
      remarks: inquiry.remarks || '',
      inquiryType: inquiry.inquiry_type || 'General',
      showNewInquiryType: false,
      newInquiryType: '',
      urgency: inquiry.urgency || 'N/A',
      urgencyDate: inquiry.urgency_date || '',
      items: mappedItems,
    });
  }, [customerMap]);

  const startNewInquiry = useCallback(() => {
    setIsCreatingNew(true);
    setSelectedInquiry(null);
    resetFormForNew();
  }, [resetFormForNew]);

  const selectInquiry = useCallback((inquiry: SalesInquiry) => {
    setIsCreatingNew(false);
    setSelectedInquiry(inquiry);
    loadInquiryIntoForm(inquiry);
  }, [loadInquiryIntoForm]);

  useEffect(() => {
    if (isCreatingNew) return;
    if (selectedInquiry) return;
    if (inquiries.length === 0) return;
    selectInquiry(inquiries[0]);
  }, [inquiries, isCreatingNew, selectInquiry, selectedInquiry]);

  // When customer is selected, populate metrics and delivery address
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setDeliveryAddress(customer.deliveryAddress || customer.address || '');
      setSalesPerson(customer.salesman || '');
      setPriceGroup(customer.priceGroup || '');
      setCreditLimit(customer.creditLimit || 0);
      setTerms(customer.terms || '');
      setRemarks(customer.comment || '');
      setPromiseToPay(customer.dealershipTerms || '');
    }
  };

  useEffect(() => {
    if (!initialContactId) return;

    const prefillKey = `${initialPrefillToken || 'default'}:${initialContactId}`;
    if (lastAppliedPrefillRef.current === prefillKey) return;

    const customer = customers.find((entry) => entry.id === initialContactId);
    if (!customer) return;

    setIsCreatingNew(true);
    setSelectedInquiry(null);
    resetFormForNew();
    handleCustomerSelect(customer.id);
    lastAppliedPrefillRef.current = prefillKey;
  }, [customers, handleCustomerSelect, initialContactId, initialPrefillToken, resetFormForNew]);

  // Add new item row
  const addItemRow = () => {
    setItems([
      ...items,
      {
        qty: 1,
        part_no: '',
        item_code: '',
        location: '',
        description: '',
        unit_price: 0,
        amount: 0,
        remark: '',
        approval_status: 'pending',
        tempId: `temp-${Date.now()}`,
        isNew: true,
      },
    ]);
  };

  // Update item row
  const updateItemRow = (tempId: string | undefined, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const updated = { ...item, [field]: value };
        // Auto-calculate amount
        if (field === 'qty' || field === 'unit_price') {
          updated.amount = (updated.qty || 0) * (updated.unit_price || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  // Remove item row
  const removeItemRow = (tempId: string | undefined) => {
    setItems(items.filter(item => item.tempId !== tempId));
  };

  // Calculate grand total
  const grandTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInquiryForm()) {
      setSubmitCount((prev) => prev + 1);
      addToast({ type: 'warning', title: 'Fix validation issues', description: 'Review the highlighted fields and try again.' });
      return;
    }

    setLoading(true);
    setSubmitError('');
    try {
      if (!selectedCustomer?.id) {
        addToast({ type: 'warning', title: 'Missing customer', description: 'Please select a customer before saving.' });
        return;
      }

      // Prepare inquiry type
      let finalInquiryType = inquiryType;
      if (showNewInquiryType && newInquiryType) {
        finalInquiryType = newInquiryType;
      }

      const inquiryData: SalesInquiryDTO = {
        contact_id: selectedCustomer.id,
        sales_date: salesDate,
        sales_person: salesPerson,
        delivery_address: deliveryAddress,
        reference_no: referenceNo,
        customer_reference: customerReference,
        send_by: sendBy,
        price_group: priceGroup,
        credit_limit: creditLimit,
        terms: terms,
        promise_to_pay: promiseToPay,
        po_number: poNumber,
        remarks: remarks,
        inquiry_type: finalInquiryType,
        urgency: urgency,
        urgency_date: urgency !== 'N/A' ? urgencyDate : undefined,
        items: items.map(({ tempId, ...rest }) => rest),
      };

      if (selectedInquiry && !isCreatingNew) {
        const updated = await updateSalesInquiry(selectedInquiry.id, inquiryData);
        await refetchInquiries();
        addToast({ type: 'success', message: 'Inquiry updated successfully!' });

        if (updated?.id && updated?.contact_id) {
          setSelectedInquiry(updated);
          loadInquiryIntoForm(updated);
        }
        return;
      }

      const created = await createSalesInquiry(inquiryData);
      await refetchInquiries();
      addToast({ type: 'success', message: 'Sales Inquiry created successfully!' });

      if (created?.id && (created as SalesInquiry).contact_id) {
        setIsCreatingNew(false);
        setSelectedInquiry(created as SalesInquiry);
        loadInquiryIntoForm(created as SalesInquiry);
      } else {
        startNewInquiry();
      }
    } catch (error) {
      console.error('Error creating inquiry:', error);
      const friendlyMessage = parseSupabaseError(error, 'sales inquiry');
      setSubmitError(friendlyMessage);
      addToast({ type: 'error', title: 'Unable to create inquiry', description: friendlyMessage, durationMs: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const validateInquiryForm = () => {
    const errors: Record<string, string> = {};
    const customerCheck = validateRequired(selectedCustomer?.id, 'a customer');
    if (!customerCheck.isValid) errors.customer = customerCheck.message;
    const dateCheck = validateRequired(salesDate, 'a sales date');
    if (!dateCheck.isValid) errors.salesDate = dateCheck.message;
    if (items.length === 0) {
      errors.items = 'Please add at least one item to the inquiry.';
    }
    const invalidItems = items.filter(item => !item.item_id);
    if (invalidItems.length > 0) {
      errors.itemSelection = `Please select valid products for all items. ${invalidItems.length} item(s) are missing product details.`;
    }
    items.forEach((item) => {
      const qtyCheck = validateNumeric(item.qty, 'quantity', 1);
      if (!qtyCheck.isValid) errors[`item-${item.tempId}-qty`] = qtyCheck.message;
      const priceCheck = validateNumeric(item.unit_price, 'unit price', 0);
      if (!priceCheck.isValid) errors[`item-${item.tempId}-unit_price`] = priceCheck.message;
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle delete
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteConfirming(true);
    try {
      if (selectedInquiry && !isCreatingNew) {
        const ok = await deleteSalesInquiry(selectedInquiry.id);
        if (!ok) throw new Error('Delete failed');
        await refetchInquiries();
        addToast({ type: 'success', message: 'Inquiry deleted successfully!' });
        setSelectedInquiry(null);
        setLoadedSnapshot(null);
        setShowDeleteModal(false);
        return;
      }

      addToast({ type: 'success', message: 'Draft cleared.' });
      setShowDeleteModal(false);
      startNewInquiry();
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      addToast({ type: 'error', message: 'Failed to delete inquiry' });
    } finally {
      setDeleteConfirming(false);
    }
  };

  const handleFinalizeInquiry = async () => {
    if (!selectedInquiry || isCreatingNew) return;

    setLoading(true);
    try {
      const approvedInquiry = await approveInquiry(selectedInquiry.id);
      await refetchInquiries();

      if (approvedInquiry) {
        setIsCreatingNew(false);
        setSelectedInquiry(approvedInquiry);
        loadInquiryIntoForm(approvedInquiry);
      }

      addToast({ type: 'success', message: 'Inquiry finalized and ready for conversion.' });
    } catch (error) {
      console.error('Error finalizing inquiry:', error);
      const friendlyMessage = parseSupabaseError(error, 'sales inquiry');
      addToast({ type: 'error', title: 'Unable to finalize inquiry', description: friendlyMessage, durationMs: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const navigateToSalesOrder = (orderId: string) => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', {
      detail: {
        tab: 'salesorder',
        payload: { orderId }
      }
    }));
  };

  const handleConvertInquiry = async () => {
    if (!selectedInquiry || isCreatingNew) return;

    setLoading(true);
    try {
      const order = await convertToOrder(selectedInquiry.id);
      await refetchInquiries();
      addToast({ type: 'success', message: `Converted to Sales Order ${order.order_no || ''}`.trim() });

      if (order?.id) {
        navigateToSalesOrder(order.id);
      }
    } catch (error) {
      console.error('Error converting inquiry to sales order:', error);
      const friendlyMessage = parseSupabaseError(error, 'sales order conversion');
      addToast({ type: 'error', title: 'Unable to convert inquiry', description: friendlyMessage, durationMs: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConvertedOrder = async () => {
    if (!selectedInquiry || isCreatingNew) return;

    setLoading(true);
    try {
      const existingOrder = await getSalesOrderByInquiry(selectedInquiry.id);
      if (!existingOrder?.id) {
        addToast({ type: 'warning', message: 'No linked sales order found for this inquiry yet.' });
        return;
      }

      navigateToSalesOrder(existingOrder.id);
    } catch (error) {
      console.error('Error opening linked sales order:', error);
      addToast({ type: 'error', message: 'Unable to open linked sales order.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardChanges = () => {
    if (isCreatingNew || !selectedInquiry || !loadedSnapshot) {
      startNewInquiry();
      return;
    }

    const snapshotCustomer = customerMap.get(loadedSnapshot.contactId) || null;
    setSelectedCustomer(snapshotCustomer);
    setSalesDate(loadedSnapshot.salesDate || new Date().toISOString().split('T')[0]);
    setSalesPerson(loadedSnapshot.salesPerson);
    setDeliveryAddress(loadedSnapshot.deliveryAddress);
    setReferenceNo(loadedSnapshot.referenceNo);
    setCustomerReference(loadedSnapshot.customerReference);
    setSendBy(loadedSnapshot.sendBy);
    setPoNumber(loadedSnapshot.poNumber);
    setPriceGroup(loadedSnapshot.priceGroup);
    setCreditLimit(loadedSnapshot.creditLimit);
    setTerms(loadedSnapshot.terms);
    setPromiseToPay(loadedSnapshot.promiseToPay);
    setRemarks(loadedSnapshot.remarks);
    setInquiryType(loadedSnapshot.inquiryType);
    setShowNewInquiryType(loadedSnapshot.showNewInquiryType);
    setNewInquiryType(loadedSnapshot.newInquiryType);
    setUrgency(loadedSnapshot.urgency);
    setUrgencyDate(loadedSnapshot.urgencyDate);
    setItems(loadedSnapshot.items);
    setValidationErrors({});
    setSubmitError('');
    setSubmitCount(0);
  };
  const activeInquiryNumber = !isCreatingNew && selectedInquiry?.inquiry_no ? selectedInquiry.inquiry_no : inquiryNo;
  const customerOutstanding = selectedCustomer?.balance || 0;
  const isReadOnly = selectedInquiry?.status === SalesInquiryStatus.CONVERTED_TO_ORDER;
  const canFinalizeInquiry = Boolean(selectedInquiry && !isCreatingNew && selectedInquiry.status === SalesInquiryStatus.DRAFT);
  const canConvertInquiry = Boolean(selectedInquiry && !isCreatingNew && selectedInquiry.status === SalesInquiryStatus.APPROVED);
  const canOpenConvertedOrder = Boolean(
    selectedInquiry &&
    !isCreatingNew &&
    selectedInquiry.status === SalesInquiryStatus.CONVERTED_TO_ORDER
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-white/10 border border-white/10">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">Unified Sales Management</div>
          </div>
          <div className="ml-2 inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/10 border border-white/10">
            <span className="text-[10px] uppercase tracking-wide text-slate-300">Active:</span>
            <span className="text-[11px] font-mono text-white">{activeInquiryNumber || '—'}</span>
            {!isCreatingNew && selectedInquiry?.status && (
              <StatusBadge status={selectedInquiry.status} className="text-[10px] px-2 py-0.5" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Credit Limit</div>
              <div className="text-sm font-semibold text-white">{formatCurrency(creditLimit || 0)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Outstanding</div>
              <div className="text-sm font-semibold text-amber-300">{formatCurrency(customerOutstanding)}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={startNewInquiry}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Inquiry
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/15 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Sidebar */}
        <aside className="w-[360px] max-w-[45vw] hidden lg:flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Recent Inquiries</div>
              <button
                type="button"
                onClick={() => setShowStatusFilter((prev) => !prev)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                aria-label="Toggle status filter"
              >
                <ListFilter className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ID or Customer..."
                className="bg-transparent text-sm flex-1 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            {showStatusFilter && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | SalesInquiryStatus)}
                  className="flex-1 text-sm border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="all">All Statuses</option>
                  {Object.values(SalesInquiryStatus).map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowStatusFilter(false)}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  aria-label="Close status filter"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading && <div className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading inquiries...</div>}
            {!listLoading && filteredInquiries.length === 0 && (
              <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No inquiries found.</div>
            )}
            {!listLoading &&
              filteredInquiries.map((inquiry) => {
                const customer = customerMap.get(inquiry.contact_id);
                const isActive = selectedInquiry?.id === inquiry.id && !isCreatingNew;
                const total = Number(inquiry.grand_total || 0);
                return (
                  <button
                    key={inquiry.id}
                    type="button"
                    onClick={() => selectInquiry(inquiry)}
                    className={`w-full text-left px-3 py-3 border-l-2 transition-colors ${
                      isActive
                        ? 'bg-brand-blue/10 border-l-brand-blue'
                        : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-brand-blue truncate">{inquiry.inquiry_no}</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{customer?.company || '—'}</div>
                        <div className="text-[12px] text-slate-500 dark:text-slate-400">
                          {new Date(inquiry.sales_date).toLocaleDateString()} • {formatCurrency(total)}
                        </div>
                      </div>
                      <StatusBadge status={inquiry.status} className="text-[10px] px-2 py-0.5 shrink-0" />
                    </div>
                  </button>
                );
              })}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
            {submitError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</div>
            )}

            <form id="salesInquiryForm" onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 xl:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-6 xl:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Customer <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        disabled={isReadOnly}
                        value={selectedCustomer?.id || ''}
                        onChange={(e) => handleCustomerSelect(e.target.value)}
                        className={`w-full px-2 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                          validationErrors.customer ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                        } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Select customer…</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company}
                          </option>
                        ))}
                      </select>
                      {validationErrors.customer && <p className="mt-1 text-[11px] text-rose-600">{validationErrors.customer}</p>}
                    </div>

                    <div className="col-span-12 md:col-span-6 xl:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Sales Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        disabled={isReadOnly}
                        value={salesDate}
                        onChange={(e) => setSalesDate(e.target.value)}
                        className={`w-full px-2 py-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                          validationErrors.salesDate ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                        } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                      {validationErrors.salesDate && <p className="mt-1 text-[11px] text-rose-600">{validationErrors.salesDate}</p>}
                    </div>

                    <div className="col-span-12 md:col-span-6 xl:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Sales Person</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={salesPerson}
                        onChange={(e) => setSalesPerson(e.target.value)}
                        className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        placeholder="Name"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-6 xl:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Delivery Address</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        placeholder="Address"
                      />
                    </div>

                    <div className="col-span-12 grid grid-cols-12 gap-3">
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Our Ref</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={referenceNo}
                          onChange={(e) => setReferenceNo(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          placeholder="INQ…"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Your Ref</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={customerReference}
                          onChange={(e) => setCustomerReference(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          placeholder="PO/Reference"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Send By</label>
                        <select
                          disabled={isReadOnly}
                          value={sendBy}
                          onChange={(e) => setSendBy(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="">Select…</option>
                          <option value="Email">Email</option>
                          <option value="Phone">Phone</option>
                          <option value="Courier">Courier</option>
                          <option value="Walk-in">Walk-in</option>
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">PO Number</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          placeholder="PO #"
                        />
                      </div>
                    </div>

                    <div className="col-span-12 grid grid-cols-12 gap-3">
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Price Group</label>
                        <select
                          disabled={isReadOnly}
                          value={priceGroup}
                          onChange={(e) => setPriceGroup(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="">—</option>
                          <option value="AA">AA</option>
                          <option value="BB">BB</option>
                          <option value="CC">CC</option>
                          <option value="DD">DD</option>
                          <option value="VIP1">VIP1</option>
                          <option value="VIP2">VIP2</option>
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Terms</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={terms}
                          onChange={(e) => setTerms(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          placeholder="Net 30"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Promise to Pay</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={promiseToPay}
                          onChange={(e) => setPromiseToPay(e.target.value)}
                          className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                          placeholder="Terms/Date"
                        />
                      </div>
                      <div className="col-span-12 md:col-span-6 xl:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Urgency</label>
                        <div className="flex gap-2">
                          <select
                            disabled={isReadOnly}
                            value={urgency}
                            onChange={(e) => setUrgency(e.target.value)}
                            className={`flex-1 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                              isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          >
                            <option value="N/A">Normal</option>
                            <option value="Low">Low</option>
                            <option value="High">High</option>
                          </select>
                          {urgency !== 'N/A' && (
                            <input
                              type="date"
                              disabled={isReadOnly}
                              value={urgencyDate}
                              onChange={(e) => setUrgencyDate(e.target.value)}
                              className={`px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                                isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Inquiry Type</label>
                      <select
                        disabled={isReadOnly}
                        value={inquiryType}
                        onChange={(e) => {
                          if (e.target.value === 'AddNew') {
                            setShowNewInquiryType(true);
                            setInquiryType('General');
                          } else {
                            setInquiryType(e.target.value);
                            setShowNewInquiryType(false);
                          }
                        }}
                        className={`w-full px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="General">General Inquiry</option>
                        <option value="Bulk Order">Bulk Order</option>
                        <option value="AddNew">+ Add New</option>
                      </select>
                      {showNewInquiryType && (
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={newInquiryType}
                          onChange={(e) => setNewInquiryType(e.target.value)}
                          placeholder="Type"
                          className={`w-full mt-2 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm ${
                            isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Remarks</label>
                      <textarea
                        disabled={isReadOnly}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add internal notes..."
                        className={`w-full min-h-[140px] px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none ${
                          isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Inquiry Items</div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    disabled={isReadOnly}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-brand-blue font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
                      isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    ADD ITEM
                  </button>
                </div>

                {validationErrors.items && <div className="px-3 pt-2 text-sm text-rose-600">{validationErrors.items}</div>}
                {validationErrors.itemSelection && <div className="px-3 pt-2 text-sm text-rose-600">{validationErrors.itemSelection}</div>}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/40">
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="text-left px-3 py-2 w-10">#</th>
                        <th className="text-left px-3 py-2 min-w-[320px]">Item Description</th>
                        <th className="text-left px-3 py-2 w-32">SKU</th>
                        <th className="text-right px-3 py-2 w-24">Qty</th>
                        <th className="text-right px-3 py-2 w-32">Price</th>
                        <th className="text-right px-3 py-2 w-40">Total</th>
                        <th className="text-center px-3 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                            No items added.
                          </td>
                        </tr>
                      )}
                      {items.map((item, idx) => {
                        const sku = item.item_code || item.part_no || '—';
                        return (
                          <tr
                            key={item.tempId}
                            className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          >
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2">
                              {!item.item_id ? (
                                <button
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => handleOpenProductModal(item.tempId!)}
                                  className={`w-full text-left px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:border-brand-blue hover:text-brand-blue transition-colors ${
                                    isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                                  }`}
                                >
                                  Click to search product
                                </button>
                              ) : (
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white truncate">{item.description || '—'}</div>
                                  <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{item.part_no || item.item_code || ''}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{sku}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={item.qty}
                                onChange={(e) => updateItemRow(item.tempId, 'qty', parseInt(e.target.value) || 1)}
                                className={`w-20 text-right px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                                  validationErrors[`item-${item.tempId}-qty`] ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                                } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={item.unit_price}
                                onChange={(e) => updateItemRow(item.tempId, 'unit_price', parseFloat(e.target.value) || 0)}
                                className={`w-28 text-right px-2 py-1.5 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                                  validationErrors[`item-${item.tempId}-unit_price`] ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                                } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(item.amount || 0)}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => removeItemRow(item.tempId)}
                                className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors ${
                                  isReadOnly ? 'opacity-60 cursor-not-allowed hover:bg-transparent' : ''
                                }`}
                                aria-label="Remove item"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-6 px-3 py-3 border-t border-slate-200 dark:border-slate-800 text-sm">
                  <div className="text-slate-500 dark:text-slate-400">
                    Subtotal: <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(grandTotal)}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Grand Total: <span className="font-semibold text-brand-blue">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Action Bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={handleDeleteClick}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              Delete Current
            </button>

            <div className="flex items-center gap-2">
              {canFinalizeInquiry && (
                <button
                  type="button"
                  onClick={handleFinalizeInquiry}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'WORKING…' : 'FINALIZE INQUIRY'}
                </button>
              )}

              {canConvertInquiry && (
                <button
                  type="button"
                  onClick={handleConvertInquiry}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'WORKING…' : 'CONVERT TO SALES ORDER'}
                </button>
              )}

              {canOpenConvertedOrder && (
                <button
                  type="button"
                  onClick={handleOpenConvertedOrder}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue font-semibold hover:bg-brand-blue/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'OPENING…' : 'OPEN SALES ORDER'}
                </button>
              )}

              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                DISCARD CHANGES
              </button>

              <button
                type="submit"
                form="salesInquiryForm"
                disabled={loading || isReadOnly}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'SAVING…' : selectedInquiry && !isCreatingNew ? 'UPDATE INQUIRY' : 'CREATE INQUIRY'}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-sm w-full p-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {selectedInquiry && !isCreatingNew ? 'Delete inquiry?' : 'Clear draft?'}
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              {selectedInquiry && !isCreatingNew
                ? 'This will move the inquiry to the recycle bin.'
                : 'This will reset the form and remove all unsaved changes.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded text-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} disabled={deleteConfirming} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:bg-red-400 transition-colors">
                {deleteConfirming ? 'Working…' : selectedInquiry && !isCreatingNew ? 'Delete' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Search Modal */}
      <ProductSearchModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSelect={handleProductSelect}
      />
    </div>
  );
};

export default SalesInquiryView;
