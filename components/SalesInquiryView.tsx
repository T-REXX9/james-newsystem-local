import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  AlertCircle,
  Copy,
  RefreshCcw,
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
import { fetchContacts } from '../services/customerDatabaseLocalApiService';
import {
  approveInquiry,
  convertToOrder,
  createSalesInquiry,
  deleteSalesInquiry,
  getSalesInquiry,
  getAllSalesInquiries,
  updateSalesInquiry,
} from '../services/salesInquiryLocalApiService';
import { getProductPrice } from '../services/productLocalApiService';
import { getSalesOrderByInquiry, getSalesOrder } from '../services/salesOrderLocalApiService';

import ProductSearchModal from './ProductSearchModal';
import CustomerAutocomplete from './CustomerAutocomplete';
import SearchableSelect from './SearchableSelect';
import StatusBadge from './StatusBadge';
import { useToast } from './ToastProvider';
import ValidationSummary from './ValidationSummary';
import { validateNumeric, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import {
  normalizePriceGroup,
  WRITABLE_PRICING_GROUP_OPTIONS,
} from '../constants/pricingGroups';
import { fetchCouriers, CourierRecord } from '../services/courierLocalApiService';
import { fetchRemarkTemplates, RemarkTemplateRecord } from '../services/remarkTemplateLocalApiService';

interface InquiryItemRow extends Omit<SalesInquiryItem, 'id' | 'inquiry_id' | 'qty' | 'unit_price'> {
  qty: number | '';
  unit_price: number | '';
  brand?: string;
  tempId?: string;
  isNew?: boolean; // Flag to indicate if the row is new and editable via autocomplete
  isManual?: boolean;
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

const inquiryListColumnWidths = [
  '8rem',
  '30%',
  '12rem',
  '11rem',
  '14rem',
  '16%',
  '10rem',
];

const SalesInquiryView: React.FC<SalesInquiryViewProps> = ({ initialContactId, initialPrefillToken }) => {
  const { addToast } = useToast();
  const lastAppliedPrefillRef = React.useRef<string | null>(null);
  // Data
  const [loading, setLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<SalesInquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SalesInquiryStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
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

  // Debounce search term changes to prevent lag
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedSearch = searchTerm.trim();
      // Only update if search value actually changed
      if (trimmedSearch !== debouncedSearch) {
        setDebouncedSearch(trimmedSearch);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const [customers, setCustomers] = useState<Contact[]>([]);
  const [inquiries, setInquiries] = useState<SalesInquiry[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const sortByCreatedAt = (a: SalesInquiry, b: SalesInquiry) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  };

  const loadCustomers = useCallback(async () => {
    try {
      const rows = await fetchContacts();
      setCustomers(rows);
    } catch (error) {
      console.error('Failed loading customers:', error);
      setCustomers([]);
    }
  }, []);

  const refetchInquiries = useCallback(async () => {
    setListLoading(true);
    try {
      const rows = await getAllSalesInquiries();
      setInquiries((rows || []).slice().sort(sortByCreatedAt));
    } catch (error) {
      console.error('Failed loading inquiries:', error);
      setInquiries([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    void refetchInquiries();
  }, [refetchInquiries]);

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

  // Courier & Remark Template options (loaded from database)
  const [courierOptions, setCourierOptions] = useState<CourierRecord[]>([]);
  const [remarkTemplateOptions, setRemarkTemplateOptions] = useState<RemarkTemplateRecord[]>([]);

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [courierRes, remarkRes] = await Promise.all([
          fetchCouriers(),
          fetchRemarkTemplates(),
        ]);
        setCourierOptions(courierRes.items || []);
        setRemarkTemplateOptions(remarkRes.items || []);
      } catch (err) {
        console.error('Failed to load courier/remark options:', err);
      }
    };
    loadDropdownData();
  }, []);

  // Items Table
  const [items, setItems] = useState<InquiryItemRow[]>([]);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const getNextLegacyInquiryCounter = useCallback(() => {
    const counters = inquiries
      .map((inquiry) => {
        const match = /(\d+)$/.exec(String(inquiry.inquiry_no || '').trim());
        return match ? Number.parseInt(match[1], 10) : 0;
      })
      .filter((value) => Number.isFinite(value) && value > 0);

    return (counters.length > 0 ? Math.max(...counters) : 0) + 1;
  }, [inquiries]);

  const generateInquiryNumber = useCallback(() => {
    const date = new Date();
    const nextCounter = getNextLegacyInquiryCounter();
    return `INQ${String(date.getFullYear()).slice(-2)}-${nextCounter}`;
  }, [getNextLegacyInquiryCounter]);

  const generateLegacyReferenceNo = useCallback(() => {
    const date = new Date();
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateValue = Number.parseInt(`${year}${month}${day}`, 10);
    return `REF${dateValue + getNextLegacyInquiryCounter()}`;
  }, [getNextLegacyInquiryCounter]);

  const formatInquiryDisplayNo = useCallback((value: string | undefined | null): string => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';

    if (!raw.startsWith('INQ')) {
      return raw;
    }

    const suffix = raw.slice(3).trim();
    if (!suffix) return 'INQ';

    if (suffix.includes('-')) {
      return `INQ${suffix}`;
    }

    const compact = suffix.replace(/[^A-Z0-9]/g, '');
    if (compact.length <= 2) {
      return `INQ${compact}`;
    }

    return `INQ${compact.slice(0, 2)}-${compact.slice(2)}`;
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
          location: product.location || '',
          brand: product.brand || '',
          description: product.description,
          unit_price: price,
          amount: (item.qty || 1) * price,
          isNew: false,
          isManual: false,
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
  const oldSystemInquiryStatuses = useMemo(
    () => [SalesInquiryStatus.DRAFT, SalesInquiryStatus.APPROVED, SalesInquiryStatus.CANCELLED],
    []
  );
  const customerReferenceOptions = useMemo(() => {
    const contactOptions = (selectedCustomer?.contactPersons || [])
      .map((contact) => String(contact?.name || '').trim())
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

    const currentReference = String(customerReference || '').trim();
    if (currentReference && !contactOptions.includes(currentReference)) {
      return [currentReference, ...contactOptions];
    }

    return contactOptions;
  }, [customerReference, selectedCustomer]);

  const filteredInquiries = useMemo(() => {
    const query = debouncedSearch.toLowerCase();

    // Detect search type: inquiry_no/reference (usually contains numbers/patterns) vs customer name
    const isRefNoLike = /[\d-]/g.test(query);

    return inquiries.filter((inquiry) => {
      const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
      const customerName = customerMap.get(inquiry.contact_id)?.company?.toLowerCase() || '';

      // Smart search matching
      let matchesQuery = !query;
      if (query) {
        // Always search inquiry_no, reference_no, and sales_person
        matchesQuery =
          inquiry.inquiry_no.toLowerCase().includes(query) ||
          (inquiry.reference_no || '').toLowerCase().includes(query) ||
          (inquiry.sales_person || '').toLowerCase().includes(query);

        // For text-based searches, also match customer names
        if (!matchesQuery && !isRefNoLike) {
          matchesQuery = customerName.includes(query);
        }
      }

      const parsedDate = inquiry.sales_date ? new Date(inquiry.sales_date) : null;
      const dayValue = parsedDate ? String(parsedDate.getDate()) : '';
      const monthValue = parsedDate ? String(parsedDate.getMonth() + 1) : '';
      const yearValue = parsedDate ? String(parsedDate.getFullYear()) : '';
      const matchesDay = !filterDay || dayValue === String(Number(filterDay));
      const matchesMonth = !filterMonth || monthValue === String(Number(filterMonth));
      const matchesYear = !filterYear || yearValue === filterYear;
      return matchesStatus && matchesQuery && matchesDay && matchesMonth && matchesYear;
    });
  }, [customerMap, filterDay, filterMonth, filterYear, inquiries, debouncedSearch, statusFilter]);

  // Generate initial inquiry number and preload data
  useEffect(() => {
    const newInquiryNo = generateInquiryNumber();
    setInquiryNo(newInquiryNo);
    setReferenceNo(generateLegacyReferenceNo());
  }, [generateInquiryNumber, generateLegacyReferenceNo]);

  const resetFormForNew = useCallback(() => {
    const newInquiryNo = generateInquiryNumber();

    setInquiryNo(newInquiryNo);
    setSelectedCustomer(null);
    setSalesDate(new Date().toISOString().split('T')[0]);
    setSalesPerson('');
    setDeliveryAddress('');
    setReferenceNo(generateLegacyReferenceNo());
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
  }, [generateInquiryNumber, generateLegacyReferenceNo]);

  const loadInquiryIntoForm = useCallback((inquiry: SalesInquiry) => {
    const customer = customerMap.get(inquiry.contact_id) || null;
    const normalizedSalesDate = (inquiry.sales_date || '').split('T')[0];
    const rawPriceGroup = inquiry.price_group || customer?.priceGroup || '';
    setInquiryNo((prev) => inquiry.inquiry_no || prev);

    const mappedItems: InquiryItemRow[] = (inquiry.items || []).map((item) => {
      const { id: _id, inquiry_id: _inquiryId, ...rest } = item as SalesInquiryItem;
      return {
        ...rest,
        tempId: (item as SalesInquiryItem).id,
        isNew: false,
        isManual: item.remark === 'NotListed',
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
    setPriceGroup(rawPriceGroup);
    setCreditLimit(Number.isFinite(inquiry.credit_limit) ? inquiry.credit_limit : (customer?.creditLimit || 0));
    setTerms(inquiry.terms || customer?.terms || '');
    setPromiseToPay(inquiry.promise_to_pay || '');
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
      priceGroup: rawPriceGroup,
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

  const selectInquiry = useCallback(async (inquiry: SalesInquiry) => {
    setIsCreatingNew(false);
    const detailed = await getSalesInquiry(inquiry.id);
    const selected = detailed || inquiry;
    setSelectedInquiry(selected);
    loadInquiryIntoForm(selected);
  }, [loadInquiryIntoForm]);

  useEffect(() => {
    if (isCreatingNew) return;
    if (selectedInquiry) return;
    if (inquiries.length === 0) return;
    void selectInquiry(inquiries[0]);
  }, [inquiries, isCreatingNew, selectInquiry, selectedInquiry]);

  // When customer is selected, populate metrics and delivery address
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      const defaultReference = String(customer.contactPersons?.[0]?.name || '').trim();
      setSelectedCustomer(customer);
      setDeliveryAddress(customer.deliveryAddress || customer.address || '');
      setSalesPerson(customer.salesman || '');
      setPriceGroup(customer.priceGroup || '');
      setCreditLimit(customer.creditLimit || 0);
      setTerms(customer.terms || '');
      setRemarks(customer.comment || '');
      setPromiseToPay('');
      setCustomerReference(defaultReference);
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
        brand: '',
        description: '',
        unit_price: 0,
        amount: 0,
        remark: '',
        approval_status: 'approved',
        tempId: `temp-${Date.now()}`,
        isNew: true,
        isManual: false,
      },
    ]);
  };

  const addManualItemRow = () => {
    setItems([
      ...items,
      {
        qty: 1,
        part_no: '',
        item_code: '',
        location: '',
        brand: '',
        description: '',
        unit_price: 0,
        amount: 0,
        remark: 'NotListed',
        approval_status: 'approved',
        tempId: `manual-${Date.now()}`,
        isNew: false,
        isManual: true,
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
          updated.amount = (Number(updated.qty) || 0) * (Number(updated.unit_price) || 0);
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
        items: items.map(({ tempId, isManual, brand, ...rest }) => ({
          ...rest,
          qty: rest.qty === '' ? 1 : Number(rest.qty) || 1,
          unit_price: Number(rest.unit_price) || 0,
        })),
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
    const invalidItems = items.filter(item => !item.item_id && !item.isManual);
    if (invalidItems.length > 0) {
      errors.itemSelection = `Please select valid products for all items. ${invalidItems.length} item(s) are missing product details.`;
    }
    items.forEach((item) => {
      if (item.qty !== '') {
        const qtyCheck = validateNumeric(item.qty, 'quantity', 1);
        if (!qtyCheck.isValid) errors[`item-${item.tempId}-qty`] = qtyCheck.message;
      }
      const priceCheck = validateNumeric(item.unit_price, 'unit price', 0);
      if (!priceCheck.isValid) errors[`item-${item.tempId}-unit_price`] = priceCheck.message;
      if (item.isManual) {
        const descriptionCheck = validateRequired(item.description, 'a description');
        if (!descriptionCheck.isValid) errors[`item-${item.tempId}-description`] = descriptionCheck.message;
      }
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
      // If still a draft, finalize first, then convert to SO in one step
      if (selectedInquiry.status === SalesInquiryStatus.DRAFT) {
        await approveInquiry(selectedInquiry.id);
      }

      const order = await convertToOrder(selectedInquiry.id);

      let verifiedOrder = await getSalesOrder(order.id);
      if (!verifiedOrder) {
        addToast({ type: 'info', message: 'Verifying order creation...', durationMs: 3000 });
        for (let attempt = 0; attempt < 3 && !verifiedOrder; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          verifiedOrder = await getSalesOrder(order.id);
        }
      }

      if (!verifiedOrder) {
        addToast({ type: 'error', title: 'Order created but not accessible', description: 'The order was created but could not be verified. Please refresh and try again.', durationMs: 6000 });
        await refetchInquiries();
        return;
      }

      await refetchInquiries();
      addToast({ type: 'success', message: `Converted to Sales Order ${order.order_no || ''}`.trim() });

      window.dispatchEvent(new CustomEvent('salesorder:created', {
        detail: { orderId: order.id, orderNo: order.order_no }
      }));

      navigateToSalesOrder(order.id);
    } catch (error) {
      console.error('Error generating sales order:', error);
      const friendlyMessage = parseSupabaseError(error, 'sales order');
      addToast({ type: 'error', title: 'Unable to generate sales order', description: friendlyMessage, durationMs: 6000 });
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

      // Verify the order was actually created and is accessible
      let verifiedOrder = await getSalesOrder(order.id);
      if (!verifiedOrder) {
        // Show a more detailed message during retries
        addToast({ type: 'info', message: 'Verifying order creation...', durationMs: 3000 });
        for (let attempt = 0; attempt < 3 && !verifiedOrder; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          verifiedOrder = await getSalesOrder(order.id);
        }
      }

      if (!verifiedOrder) {
        console.error('Order verification failed: order created but not accessible', { orderId: order.id });
        addToast({ type: 'error', title: 'Order created but not accessible', description: 'The order was created but could not be verified. Please refresh and try again.', durationMs: 6000 });
        await refetchInquiries();
        return;
      }

      await refetchInquiries();
      addToast({ type: 'success', message: `Converted to Sales Order ${order.order_no || ''}`.trim() });

      window.dispatchEvent(new CustomEvent('salesorder:created', {
        detail: { orderId: order.id, orderNo: order.order_no }
      }));

      navigateToSalesOrder(order.id);
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
  const activeInquiryNumberDisplay = formatInquiryDisplayNo(activeInquiryNumber);
  const isReadOnly = selectedInquiry?.status === SalesInquiryStatus.CANCELLED;
  const priceGroupDisplay = normalizePriceGroup(priceGroup);
  const canFinalizeInquiry = Boolean(selectedInquiry && !isCreatingNew && selectedInquiry.status === SalesInquiryStatus.DRAFT);
  const canConvertInquiry = Boolean(selectedInquiry && !isCreatingNew && selectedInquiry.status === SalesInquiryStatus.APPROVED);
  const canGenerateSO = canFinalizeInquiry || canConvertInquiry;
  const canOpenConvertedOrder = false;
  const currentMonthLabel = new Date(salesDate || Date.now()).toLocaleDateString('en-PH', { month: 'long' });
  const summaryCustomer = selectedCustomer as (Contact & {
    dealershipSales?: number;
    monthlySales?: number;
    since?: string;
  }) | null;
  const displayMetricValue = (value: number | string | undefined | null, isCurrency = false) => {
    if (value === '' || value === null || value === undefined) return '—';
    if (typeof value === 'number') return isCurrency ? formatCurrency(value) : String(value);
    const numericValue = Number(value);
    if (isCurrency && Number.isFinite(numericValue)) {
      return formatCurrency(numericValue);
    }
    return String(value).trim() || '—';
  };
  const monthOptions = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const remarkClassName = (remark?: string) => {
    if (remark === 'OutStock') return 'text-green-600 underline';
    if (remark === 'NotListed') return 'text-red-600';
    return 'text-slate-900 dark:text-slate-100';
  };
  const isManualItem = (item: InquiryItemRow) => Boolean(item.isManual);

  return (
    <div className="w-full flex flex-col bg-white dark:bg-slate-900 p-3 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-4">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => void refetchInquiries()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | SalesInquiryStatus)}
                className="px-2 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                {oldSystemInquiryStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search inquiry or customer"
                className="w-56 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                placeholder="Day"
                className="w-20 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
              />
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-36 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
              >
                {monthOptions.map((month, index) => (
                  <option key={month} value={String(index + 1)}>
                    {month}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                placeholder="Year"
                className="w-24 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold"
              >
                Filter
              </button>
            </div>
          </div>
        </div>
        <div className="px-4 py-3">
          {listLoading && <div className="py-6 text-sm text-slate-500 dark:text-slate-400">Loading inquiries...</div>}
          {!listLoading && filteredInquiries.length === 0 && (
            <div className="py-6 text-sm text-slate-500 dark:text-slate-400">No inquiries found.</div>
          )}
          {!listLoading && filteredInquiries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  {inquiryListColumnWidths.map((width) => (
                    <col key={width} style={{ width }} />
                  ))}
                </colgroup>
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-700 dark:text-slate-200">
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">SI No.</th>
                    <th className="px-3 py-2 font-semibold">SO No.</th>
                    <th className="px-3 py-2 font-semibold">Transaction No.</th>
                    <th className="px-3 py-2 font-semibold">Sales Person</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
              </table>
              <div className="max-h-[160px] overflow-y-auto border border-t-0 border-slate-200 dark:border-slate-800">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    {inquiryListColumnWidths.map((width) => (
                      <col key={width} style={{ width }} />
                    ))}
                  </colgroup>
                  <tbody>
                    {filteredInquiries.map((inquiry) => {
                      const customer = customerMap.get(inquiry.contact_id);
                      const isActive = selectedInquiry?.id === inquiry.id && !isCreatingNew;
                      const rowTone =
                        inquiry.status === SalesInquiryStatus.CANCELLED
                          ? 'text-red-600'
                          : isActive
                            ? 'text-brand-blue'
                            : 'text-slate-700 dark:text-slate-200';
                      return (
                        <tr
                          key={inquiry.id}
                          onClick={() => void selectInquiry(inquiry)}
                          className={`cursor-pointer border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${rowTone}`}
                        >
                          <td className="px-3 py-2">{inquiry.sales_date ? new Date(inquiry.sales_date).toLocaleDateString() : '—'}</td>
                          <td className="px-3 py-2">
                            <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={customer?.company || '—'}>
                              {customer?.company || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="min-w-0 break-all leading-5" title={formatInquiryDisplayNo(inquiry.inquiry_no) || '—'}>
                                {formatInquiryDisplayNo(inquiry.inquiry_no) || '—'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startNewInquiry();
                                }}
                                className="shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label="Repeat inquiry"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="min-w-0 break-all leading-5" title={inquiry.so_no || '—'}>
                              {inquiry.so_no || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="min-w-0 break-all leading-5" title={inquiry.invoice_no || inquiry.dr_no || '—'}>
                              {inquiry.invoice_no || inquiry.dr_no || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={inquiry.sales_person || '—'}>
                              {inquiry.sales_person || '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={inquiry.status} className="text-[10px] px-2 py-0.5" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h4 className="font-bold text-base uppercase text-slate-900 dark:text-slate-100">SALES INQUIRY</h4>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">INQ No.:</label>
            <input
              readOnly
              value={activeInquiryNumberDisplay}
              className="w-40 inline-block px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
            />
            {!isCreatingNew && selectedInquiry?.status && (
              <StatusBadge status={selectedInquiry.status} className="text-[10px] px-2 py-0.5" />
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto">
            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
            {submitError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 mb-4">{submitError}</div>
            )}

            <form id="salesInquiryForm" onSubmit={handleSubmit} className="space-y-4">
              <table className="w-full table-fixed border border-slate-200 dark:border-slate-800 text-sm text-center mb-4">
                <thead>
                  <tr>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Dealership Since</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Dealership Sales</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Dealership Quota</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Total Sales for {currentMonthLabel}</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Customer Since</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Credit Limit</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Terms</th>
                    <th className="bg-slate-50 dark:bg-slate-800 font-semibold py-2 px-2 border border-slate-200 dark:border-slate-800">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-700 dark:text-slate-200">
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.dealershipSince)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.dealershipSales, true)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.dealershipQuota, true)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.monthlySales, true)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.since || summaryCustomer?.customerSince)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(creditLimit, true)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(terms)}</td>
                    <td className="py-2 px-2 border border-slate-200 dark:border-slate-800">{displayMetricValue(summaryCustomer?.balance, true)}</td>
                  </tr>
                </tbody>
              </table>

              <table width="100%" cellPadding="8" className="tlbcustom text-sm text-slate-700 dark:text-slate-200">
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sold to:</td>
                    <td>
                      <CustomerAutocomplete
                        contacts={customers}
                        selectedCustomer={selectedCustomer}
                        disabled={isReadOnly}
                        onSelect={(customer) => handleCustomerSelect(customer.id)}
                        inputClassName={validationErrors.customer ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'}
                      />
                      {validationErrors.customer && <p className="mt-1 text-[11px] text-rose-600">{validationErrors.customer}</p>}
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Date:</td>
                    <td>
                      <input
                        type="date"
                        required
                        disabled={isReadOnly}
                        value={salesDate}
                        onChange={(e) => setSalesDate(e.target.value)}
                        className={`w-full px-2 py-1.5 border rounded bg-white dark:bg-slate-800 text-sm ${validationErrors.salesDate ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                      {validationErrors.salesDate && <p className="mt-1 text-[11px] text-rose-600">{validationErrors.salesDate}</p>}
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Sales Person:</td>
                    <td>
                      <input type="text" disabled={isReadOnly} value={salesPerson} onChange={(e) => setSalesPerson(e.target.value)} className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Delivery Address:</td>
                    <td>
                      <input type="text" disabled={isReadOnly} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Our Reference:</td>
                    <td>
                      <input type="text" readOnly value={referenceNo} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Your Reference:</td>
                    <td>
                      <select
                        disabled={isReadOnly || !selectedCustomer}
                        value={customerReference}
                        onChange={(e) => setCustomerReference(e.target.value)}
                        className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly || !selectedCustomer ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="">{selectedCustomer ? 'Select reference…' : 'Select a customer first'}</option>
                        {customerReferenceOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Price Group:</td>
                    <td>
                      {isReadOnly ? (
                        <input
                          type="text"
                          readOnly
                          value={priceGroupDisplay}
                          className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm"
                        />
                      ) : (
                        <select
                          disabled={isReadOnly}
                          value={priceGroup}
                          onChange={(e) => setPriceGroup(e.target.value)}
                          className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="">—</option>
                          {WRITABLE_PRICING_GROUP_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Credit Limit:</td>
                    <td>
                      <input type="text" readOnly value={formatCurrency(creditLimit || 0)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Terms Strictly:</td>
                    <td>
                      <input type="text" readOnly value={terms} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm" />
                    </td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Promise to Pay:</td>
                    <td colSpan={3}>
                      <input type="text" disabled={isReadOnly} value={promiseToPay} onChange={(e) => setPromiseToPay(e.target.value)} placeholder="if applicable" className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">PO No.:</td>
                    <td>
                      <input type="text" disabled={isReadOnly} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Remark:</td>
                    <td colSpan={3}>
                      <SearchableSelect
                        value={remarks}
                        options={remarkTemplateOptions.map(r => ({
                          value: r.name,
                          label: r.name,
                        }))}
                        onChange={(val) => setRemarks(val)}
                        placeholder="Select remark…"
                        searchPlaceholder="Search remarks..."
                        disabled={isReadOnly}
                      />
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Inquiry Type:</td>
                    <td>
                      <div className="space-y-2">
                        <select
                          disabled={isReadOnly}
                          value={showNewInquiryType ? 'AddNew' : inquiryType}
                          onChange={(e) => {
                            if (e.target.value === 'AddNew') {
                              setShowNewInquiryType(true);
                              setInquiryType('General');
                            } else {
                              setInquiryType(e.target.value);
                              setShowNewInquiryType(false);
                            }
                          }}
                          className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="General">General Inquiry</option>
                          <option value="Bulk Order">Bulk Order</option>
                          <option value="AddNew">+ Add New</option>
                        </select>
                        {showNewInquiryType && (
                          <input type="text" disabled={isReadOnly} value={newInquiryType} onChange={(e) => setNewInquiryType(e.target.value)} className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="New inquiry type" />
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap">Send By:</td>
                    <td>
                      <SearchableSelect
                        value={sendBy}
                        options={courierOptions.map(c => ({
                          value: c.name,
                          label: c.name,
                        }))}
                        onChange={(val) => setSendBy(val)}
                        placeholder="Select…"
                        searchPlaceholder="Search courier..."
                        disabled={isReadOnly}
                      />
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap text-red-600">Urgency/Type:</td>
                    <td>
                      <select disabled={isReadOnly} value={urgency} onChange={(e) => setUrgency(e.target.value)} className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <option value="N/A">Normal</option>
                        <option value="Low">Low</option>
                        <option value="High">High</option>
                      </select>
                    </td>
                    <td className="text-right font-semibold text-sm pr-2 whitespace-nowrap text-red-600">Urgency/Date:</td>
                    <td>
                      <input type="date" disabled={isReadOnly || urgency === 'N/A'} value={urgencyDate} onChange={(e) => setUrgencyDate(e.target.value)} className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${(isReadOnly || urgency === 'N/A') ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <hr className="border-slate-200 dark:border-slate-800" />

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Inquiry Items</div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    disabled={isReadOnly}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-brand-blue font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Plus className="w-4 h-4" />
                    ADD ITEM
                  </button>
                </div>

                {validationErrors.items && <div className="px-3 pt-2 text-sm text-rose-600">{validationErrors.items}</div>}
                {validationErrors.itemSelection && <div className="px-3 pt-2 text-sm text-rose-600">{validationErrors.itemSelection}</div>}

                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-collapse text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr className="text-left text-slate-700 dark:text-slate-200">
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">#</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Qty</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Part No.</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Item Code</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Location</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Brand</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Description</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Unit Price</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Amount</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Remark</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-3 py-10 text-center text-slate-500 dark:text-slate-400">
                            No items added.
                          </td>
                        </tr>
                      )}
                      {items.map((item, idx) => (
                        <tr key={item.tempId} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/30">
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">{idx + 1}</td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            <input
                              type="number"
                              disabled={isReadOnly}
                              value={item.qty}
                              onChange={(e) =>
                                updateItemRow(
                                  item.tempId,
                                  'qty',
                                  e.target.value === '' ? '' : parseInt(e.target.value, 10) || ''
                                )
                              }
                              className={`w-20 px-2 py-1.5 border rounded bg-white dark:bg-slate-800 text-sm text-right ${validationErrors[`item-${item.tempId}-qty`] ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            {isManualItem(item) ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">P-</span>
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={item.part_no || ''}
                                  onChange={(e) => updateItemRow(item.tempId, 'part_no', e.target.value.toUpperCase())}
                                  placeholder="Part no."
                                  className={`w-full min-w-[110px] px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                              </div>
                            ) : (
                              item.part_no || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            {isManualItem(item) ? (
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={item.item_code || ''}
                                onChange={(e) => updateItemRow(item.tempId, 'item_code', e.target.value.toUpperCase())}
                                placeholder="Item code"
                                className={`w-full min-w-[110px] px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            ) : (
                              item.item_code || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            {isManualItem(item) ? (
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={item.location || ''}
                                onChange={(e) => updateItemRow(item.tempId, 'location', e.target.value)}
                                placeholder="Application / location"
                                className={`w-full min-w-[130px] px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            ) : (
                              item.location || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            {isManualItem(item) ? (
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={item.brand || ''}
                                onChange={(e) => updateItemRow(item.tempId, 'brand', e.target.value.toUpperCase())}
                                placeholder="Brand"
                                className={`w-full min-w-[110px] px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            ) : (
                              item.brand || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            {isManualItem(item) ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={item.description || ''}
                                  onChange={(e) => updateItemRow(item.tempId, 'description', e.target.value.toUpperCase())}
                                  placeholder="Description"
                                  className={`w-full min-w-[220px] px-2 py-1.5 border rounded bg-white dark:bg-slate-800 text-sm ${validationErrors[`item-${item.tempId}-description`] ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                                {validationErrors[`item-${item.tempId}-description`] && (
                                  <p className="text-[11px] text-rose-600">{validationErrors[`item-${item.tempId}-description`]}</p>
                                )}
                              </div>
                            ) : !item.item_id ? (
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => handleOpenProductModal(item.tempId!)}
                                className={`text-brand-blue hover:underline ${isReadOnly ? 'opacity-60 cursor-not-allowed no-underline' : ''}`}
                              >
                                Click to search product
                              </button>
                            ) : (
                              item.description || '—'
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            <input
                              type="number"
                              disabled={isReadOnly || !isManualItem(item)}
                              value={item.unit_price}
                              onChange={(e) =>
                                updateItemRow(
                                  item.tempId,
                                  'unit_price',
                                  e.target.value === '' ? '' : parseFloat(e.target.value) || ''
                                )
                              }
                              className={`w-28 px-2 py-1.5 border rounded bg-white dark:bg-slate-800 text-sm text-right ${validationErrors[`item-${item.tempId}-unit_price`] ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'} ${(isReadOnly || !isManualItem(item)) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-right">{formatCurrency(item.amount || 0)}</td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            <div className="space-y-1">
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={item.remark || ''}
                                onChange={(e) => updateItemRow(item.tempId, 'remark', e.target.value)}
                                className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${remarkClassName(item.remark)} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => removeItemRow(item.tempId)}
                                className={`p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors ${isReadOnly ? 'opacity-60 cursor-not-allowed hover:bg-transparent' : ''}`}
                                aria-label="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {!item.item_id && !isManualItem(item) && (
                                <button
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => handleOpenProductModal(item.tempId!)}
                                  className={`text-xs text-brand-blue hover:underline ${isReadOnly ? 'opacity-60 cursor-not-allowed no-underline' : ''}`}
                                >
                                  Click to search product
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={7} className="px-3 py-3 border-t border-slate-200 dark:border-slate-800"></td>
                        <td className="px-3 py-3 text-right font-bold border-t border-slate-200 dark:border-slate-800">Grand Total</td>
                        <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                          <span className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 font-bold text-brand-blue">{formatCurrency(grandTotal)}</span>
                        </td>
                        <td colSpan={2} className="border-t border-slate-200 dark:border-slate-800"></td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            {canGenerateSO && (
                              <button
                                type="button"
                                onClick={handleFinalizeInquiry}
                                disabled={loading}
                                className="px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {loading ? 'WORKING…' : 'Generate SO'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={addManualItemRow}
                              disabled={isReadOnly}
                              className={`px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              Not Listed Product
                            </button>
                          </div>
                        </td>
                        <td colSpan={2} className="border-t border-slate-200 dark:border-slate-800"></td>
                        <td className="px-3 py-3 text-right font-semibold border-t border-slate-200 dark:border-slate-800">Transaction Type</td>
                        <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                          <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                            {selectedCustomer?.transactionType || '—'}
                          </span>
                        </td>
                        <td className="border-t border-slate-200 dark:border-slate-800"></td>
                      </tr>
                      {canOpenConvertedOrder && (
                        <tr>
                          <td colSpan={8} className="border-t border-slate-200 dark:border-slate-800"></td>
                          <td className="px-3 py-3 text-right font-semibold border-t border-slate-200 dark:border-slate-800">SO No.</td>
                          <td className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                            <button type="button" onClick={handleOpenConvertedOrder} className="text-brand-blue font-semibold hover:underline">
                              Open Sales Order
                            </button>
                          </td>
                          <td className="border-t border-slate-200 dark:border-slate-800"></td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            Delete Current
          </button>

          <div className="flex items-center gap-2">
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
