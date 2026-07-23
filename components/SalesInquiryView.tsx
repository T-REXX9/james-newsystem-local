import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  AlertCircle,
  Copy,
  RefreshCcw,
  Sun,
  Moon,
  Printer,
  MessageSquareText,
} from 'lucide-react';
import {
  Contact,
  SalesInquiry,
  SalesInquiryDTO,
  SalesInquiryItem,
  SalesInquiryStatus,
} from '../types';
import { fetchContactById, fetchContacts } from '../services/customerDatabaseLocalApiService';
import { getLocalAuthSession } from '../services/localAuthService';
import {
  approveInquiry,
  convertToOrder,
  createSalesInquiry,
  deleteSalesInquiry,
  getSalesInquiry,
  getAllSalesInquiries,
  updateSalesInquiry,
} from '../services/salesInquiryLocalApiService';
import { getProductPrice, fetchProductById } from '../services/productLocalApiService';
import { getSalesOrderByInquiry, getSalesOrder } from '../services/salesOrderLocalApiService';

import ProductSearchModal from './ProductSearchModal';
import CustomerAutocomplete from './CustomerAutocomplete';
import SearchableSelect from './SearchableSelect';
import SalesInquiryPrintPreview from './SalesInquiryPrintPreview';
import StatusBadge from './StatusBadge';
import { useToast } from './ToastProvider';
import ValidationSummary from './ValidationSummary';
import { validateNumeric, validateRequired } from '../utils/formValidation';
import { parseSupabaseError } from '../utils/errorHandler';
import {
  normalizePriceGroup,
  normalizePriceGroupToInternalKey,
  WRITABLE_PRICING_GROUP_OPTIONS,
} from '../constants/pricingGroups';
import { fetchCouriers, CourierRecord } from '../services/courierLocalApiService';
import { fetchRemarkTemplates, RemarkTemplateRecord } from '../services/remarkTemplateLocalApiService';
import {
  dispatchWorkflowNotification,
  markNotificationsAsReadByEntityKey,
  resolveNotificationUserId,
} from '../services/notificationLocalApiService';
import { PageHeader, RecordTrustStrip, WorkflowGuidance } from './common/PageScaffold';

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
  initialInquiryId?: string;
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
const SALES_INQUIRY_TAB_ID = 'sales-transaction-sales-inquiry';

const SalesInquiryView: React.FC<SalesInquiryViewProps> = ({ initialContactId, initialInquiryId, initialPrefillToken }) => {
  const { addToast } = useToast();
  const lastAppliedPrefillRef = React.useRef<string | null>(null);
  // Data
  const [loading, setLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<SalesInquiry | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SalesInquiryStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterMonth, setFilterMonth] = useState(() => String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()));
  const [dateFilterApplied, setDateFilterApplied] = useState(false);
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
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const getInquirySortTime = (inquiry: SalesInquiry) => {
    const value = inquiry.sales_date || inquiry.created_at || '';
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const sortByLatestInquiry = (a: SalesInquiry, b: SalesInquiry) => {
    const dateDiff = getInquirySortTime(b) - getInquirySortTime(a);
    if (dateDiff !== 0) return dateDiff;
    return (b.inquiry_no || '').localeCompare(a.inquiry_no || '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
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
      setInquiries((rows || []).slice().sort(sortByLatestInquiry));
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

  const repriceItemsForGroup = useCallback(async (targetGroup: string) => {
    const effectiveGroup = normalizePriceGroupToInternalKey(targetGroup);
    const itemsWithProduct = items.filter((item) => item.item_id);
    if (itemsWithProduct.length === 0) return;

    const productResults = await Promise.all(
      itemsWithProduct.map((item) => fetchProductById(item.item_id).catch(() => null))
    );

    const priceMap = new Map<string, number>();
    itemsWithProduct.forEach((item, idx) => {
      const product = productResults[idx];
      if (product) {
        priceMap.set(item.item_id, getProductPrice(product, effectiveGroup));
      }
    });

    if (priceMap.size === 0) return;

    setItems((prev) =>
      prev.map((item) => {
        const newPrice = priceMap.get(item.item_id);
        if (newPrice === undefined) {
          return item;
        }

        return {
          ...item,
          unit_price: newPrice,
          amount: (Number(item.qty) || 0) * newPrice,
        };
      })
    );
  }, [items]);

  const handlePriceGroupChange = useCallback(async (newGroup: string) => {
    const normalizedGroup = normalizePriceGroupToInternalKey(newGroup);
    setPriceGroup(normalizedGroup);
    await repriceItemsForGroup(normalizedGroup);
  }, [repriceItemsForGroup]);

  const formatCurrency = useCallback((value: number) => {
    const normalized = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(normalized);
  }, []);
  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  const notifyInquiryEvent = useCallback(async (
    title: string,
    message: string,
    action: string,
    status: string,
    entityId: string,
    recipients: { targetRoles?: string[]; targetUserIds?: string[] } = {},
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    const session = getLocalAuthSession();
    await dispatchWorkflowNotification({
      title,
      message,
      type,
      action,
      status,
      entityType: 'sales_inquiry',
      entityId,
      actionUrl: SALES_INQUIRY_TAB_ID,
      actorId: String(session?.userProfile?.id || '').trim(),
      actorRole: session?.userProfile?.role || 'Unknown',
      targetRoles: recipients.targetRoles,
      targetUserIds: recipients.targetUserIds,
      includeActor: false,
      metadata: {
        refno: `sales_inquiry:${entityId}`,
        inquiry_id: entityId,
        action_url: SALES_INQUIRY_TAB_ID,
      },
    });
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
      const matchesDay = !dateFilterApplied || !filterDay || dayValue === String(Number(filterDay));
      const matchesMonth = !dateFilterApplied || !filterMonth || monthValue === String(Number(filterMonth));
      const matchesYear = !dateFilterApplied || !filterYear || yearValue === filterYear;
      return matchesStatus && matchesQuery && matchesDay && matchesMonth && matchesYear;
    }).slice().sort(sortByLatestInquiry);
  }, [customerMap, dateFilterApplied, filterDay, filterMonth, filterYear, inquiries, debouncedSearch, statusFilter]);

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
    const rawPriceGroup = normalizePriceGroupToInternalKey(inquiry.price_group || customer?.priceGroup || '');
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

  useEffect(() => {
    if (!selectedInquiry || isCreatingNew) return;
    if (customers.length === 0) return;
    if (selectedCustomer?.id === selectedInquiry.contact_id) return;
    loadInquiryIntoForm(selectedInquiry);
  }, [customers, isCreatingNew, loadInquiryIntoForm, selectedCustomer?.id, selectedInquiry]);

  useEffect(() => {
    const userId = String(getLocalAuthSession()?.userProfile?.id || '').trim();
    if (!selectedInquiry?.id || isCreatingNew || !userId) return;
    void markNotificationsAsReadByEntityKey(userId, {
      entityType: 'sales_inquiry',
      entityId: selectedInquiry.id,
    });
  }, [isCreatingNew, selectedInquiry?.id]);

  const applySelectedCustomer = useCallback((customer: Contact) => {
    const normalizedGroup = normalizePriceGroupToInternalKey(customer.priceGroup);
    const defaultReference = String(customer.contactPersons?.[0]?.name || '').trim();
    setSelectedCustomer(customer);
    setDeliveryAddress(customer.deliveryAddress || customer.address || '');
    setSalesPerson(customer.salesman || '');
    setPriceGroup(normalizedGroup);
    setCreditLimit(Number(customer.creditLimit || 0));
    setTerms(customer.terms || '');
    setRemarks(customer.comment || '');
    setPromiseToPay('');
    setCustomerReference(defaultReference);
    return normalizedGroup;
  }, []);

  // When customer is selected, populate metrics and delivery address
  const handleCustomerSelect = useCallback(async (selected: string | Contact) => {
    const customerId = typeof selected === 'string' ? selected : selected.id;
    const fallbackCustomer = typeof selected === 'string'
      ? (customers.find((customer) => customer.id === customerId) || null)
      : selected;

    let fallbackGroup = '';
    if (fallbackCustomer) {
      fallbackGroup = applySelectedCustomer(fallbackCustomer);
    }

    const latestCustomer = await fetchContactById(customerId);
    const customer = latestCustomer || fallbackCustomer;
    if (!customer) {
      return;
    }

    if (latestCustomer) {
      setCustomers((prev) => {
        const next = prev.slice();
        const existingIndex = next.findIndex((entry) => entry.id === latestCustomer.id);
        if (existingIndex >= 0) {
          next[existingIndex] = latestCustomer;
        } else {
          next.push(latestCustomer);
        }
        return next;
      });
    }

    const appliedGroup = applySelectedCustomer(customer);
    await repriceItemsForGroup(appliedGroup || fallbackGroup);
  }, [applySelectedCustomer, customers, repriceItemsForGroup]);

  useEffect(() => {
    if (!initialContactId) return;
    if (initialInquiryId) return;

    const prefillKey = `${initialPrefillToken || 'default'}:${initialContactId}`;
    if (lastAppliedPrefillRef.current === prefillKey) return;

    const customer = customers.find((entry) => entry.id === initialContactId);
    if (!customer) return;

    setIsCreatingNew(true);
    setSelectedInquiry(null);
    resetFormForNew();
    handleCustomerSelect(customer);
    lastAppliedPrefillRef.current = prefillKey;
  }, [customers, handleCustomerSelect, initialContactId, initialInquiryId, initialPrefillToken, resetFormForNew]);

  useEffect(() => {
    if (!initialInquiryId) return;

    const inquiryInList = inquiries.find((entry) => entry.id === initialInquiryId);
    if (inquiryInList) {
      const salesDate = inquiryInList.sales_date ? new Date(inquiryInList.sales_date) : null;
      if (salesDate && !Number.isNaN(salesDate.getTime())) {
        setFilterDay('');
        setFilterMonth(String(salesDate.getMonth() + 1));
        setFilterYear(String(salesDate.getFullYear()));
      }
      void selectInquiry(inquiryInList);
      return;
    }

    let active = true;
    getSalesInquiry(initialInquiryId)
      .then((detail) => {
        if (!active || !detail) return;

        const salesDate = detail.sales_date ? new Date(detail.sales_date) : null;
        if (salesDate && !Number.isNaN(salesDate.getTime())) {
          setFilterDay('');
          setFilterMonth(String(salesDate.getMonth() + 1));
          setFilterYear(String(salesDate.getFullYear()));
        }

        setSelectedInquiry(detail);
        setIsCreatingNew(false);
        loadInquiryIntoForm(detail);
        setInquiries((prev) => (prev.some((entry) => entry.id === detail.id) ? prev : [detail, ...prev].sort(sortByLatestInquiry)));
      })
      .catch((err) => {
        console.error('Failed loading initial sales inquiry detail:', err);
      });

    return () => {
      active = false;
    };
  }, [initialInquiryId, inquiries, loadInquiryIntoForm, selectInquiry]);

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
  const printableInquiry = useMemo<SalesInquiry | null>(() => {
    if (!selectedInquiry || isCreatingNew) return null;

    const printableItems: SalesInquiryItem[] = items.map((item, index) => ({
      id: item.tempId || `${selectedInquiry.id}-print-${index}`,
      inquiry_id: selectedInquiry.id,
      item_id: item.item_id || '',
      qty: Number(item.qty || 0),
      part_no: item.part_no || '',
      item_code: item.item_code || '',
      location: item.location || '',
      description: item.description || '',
      unit_price: Number(item.unit_price || 0),
      amount: Number(item.amount || 0),
      remark: item.remark || '',
      approval_status: item.approval_status || 'approved',
    }));

    return {
      ...selectedInquiry,
      inquiry_no: inquiryNo || selectedInquiry.inquiry_no,
      sales_date: salesDate || selectedInquiry.sales_date,
      sales_person: salesPerson || selectedInquiry.sales_person,
      delivery_address: deliveryAddress || selectedInquiry.delivery_address,
      reference_no: referenceNo || selectedInquiry.reference_no,
      customer_reference: customerReference || selectedInquiry.customer_reference,
      send_by: sendBy || selectedInquiry.send_by,
      price_group: priceGroup || selectedInquiry.price_group,
      credit_limit: creditLimit,
      terms: terms || selectedInquiry.terms,
      promise_to_pay: promiseToPay || selectedInquiry.promise_to_pay,
      po_number: poNumber || selectedInquiry.po_number,
      remarks: remarks || selectedInquiry.remarks,
      inquiry_type: showNewInquiryType ? (newInquiryType.trim() || inquiryType) : inquiryType,
      urgency: urgency || selectedInquiry.urgency,
      urgency_date: urgencyDate || selectedInquiry.urgency_date,
      grand_total: grandTotal,
      items: printableItems,
    };
  }, [
    creditLimit,
    customerReference,
    deliveryAddress,
    grandTotal,
    inquiryNo,
    inquiryType,
    isCreatingNew,
    items,
    newInquiryType,
    poNumber,
    priceGroup,
    promiseToPay,
    referenceNo,
    remarks,
    salesDate,
    salesPerson,
    selectedInquiry,
    sendBy,
    showNewInquiryType,
    terms,
    urgency,
    urgencyDate,
  ]);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCreatingNew && selectedInquiry && selectedInquiry.is_editable === false) {
      addToast({
        type: 'warning',
        title: 'Inquiry locked',
        description: 'This inquiry can no longer be edited because it has already been converted to an invoice or order slip.',
      });
      return;
    }

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
        status: selectedInquiry && !isCreatingNew ? selectedInquiry.status : SalesInquiryStatus.DRAFT,
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
        await notifyInquiryEvent(
          'Sales Inquiry Created',
          `Sales inquiry ${(created as SalesInquiry).inquiry_no || referenceNo} has been created.`,
          'create',
          'pending',
          created.id,
          { targetRoles: ['Owner', 'Manager', 'Approver'] }
        );
        setIsCreatingNew(false);
        const createdInquiry = {
          ...(created as SalesInquiry),
          status: SalesInquiryStatus.DRAFT,
        };
        setSelectedInquiry(createdInquiry);
        loadInquiryIntoForm(createdInquiry);
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
    if (!isCreatingNew && selectedInquiry && selectedInquiry.is_editable === false) {
      addToast({
        type: 'warning',
        title: 'Inquiry locked',
        description: 'This inquiry is locked because its sales order already has an invoice or order slip.',
      });
      return;
    }
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
    if (
      !selectedInquiry ||
      isCreatingNew ||
      (selectedInquiry.status !== SalesInquiryStatus.DRAFT && selectedInquiry.status !== SalesInquiryStatus.APPROVED)
    ) {
      return;
    }

    setLoading(true);
    try {
      const creatorUserId = await resolveNotificationUserId(selectedInquiry.created_by, selectedInquiry.sales_person);
      if (selectedInquiry.status === SalesInquiryStatus.DRAFT) {
        const approvedInquiry = await approveInquiry(selectedInquiry.id);
        if (approvedInquiry?.id) {
          setSelectedInquiry(approvedInquiry);
          loadInquiryIntoForm(approvedInquiry);
        }
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
      await notifyInquiryEvent(
        'Sales Inquiry Converted',
        `Sales inquiry ${selectedInquiry.inquiry_no} has been converted to Sales Order ${order.order_no || ''}.`.trim(),
        'convert_to_so',
        'converted',
        selectedInquiry.id,
        {
          targetRoles: ['Owner', 'Manager'],
          targetUserIds: creatorUserId ? [creatorUserId] : [],
        }
      );

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
  const isConversionLocked = Boolean(selectedInquiry && !isCreatingNew && selectedInquiry.is_editable === false);
  const isReadOnly = selectedInquiry?.status === SalesInquiryStatus.CANCELLED || isConversionLocked;
  const handlePrint = () => {
    if (!printableInquiry) return;
    setShowPrintPreview(true);
    window.setTimeout(() => window.print(), 150);
  };
  const priceGroupDisplay = normalizePriceGroup(priceGroup);
  const canGenerateSO = Boolean(
    selectedInquiry &&
    !isCreatingNew &&
    !isReadOnly &&
    (
      selectedInquiry.status === SalesInquiryStatus.DRAFT ||
      selectedInquiry.status === SalesInquiryStatus.APPROVED
    )
  );
  const inquiryGuidance = (() => {
    if (isCreatingNew) {
      return {
        title: 'Create a clear inquiry',
        description: 'Select the customer, add requested items, and save the inquiry before generating a sales order.',
        tone: 'info' as const,
      };
    }
    if (!selectedInquiry) {
      return {
        title: 'Select an inquiry',
        description: 'Choose an inquiry from the list to review details, update follow-up information, or generate a sales order.',
        tone: 'default' as const,
      };
    }
    if (isConversionLocked) {
      return {
        title: 'Inquiry converted',
        description: 'This inquiry is locked because it already has downstream sales documents.',
        tone: 'success' as const,
      };
    }
    if (selectedInquiry.status === SalesInquiryStatus.CANCELLED) {
      return {
        title: 'Cancelled inquiry',
        description: 'This record is preserved for reference. Create a new inquiry for fresh work.',
        tone: 'danger' as const,
      };
    }
    if (canGenerateSO) {
      return {
        title: 'Next step: generate sales order',
        description: 'Review customer terms and items, then generate the sales order when ready.',
        tone: 'success' as const,
      };
    }
    return {
      title: 'Review inquiry',
      description: 'Keep customer request details clear so the sales order handoff is clean.',
      tone: 'info' as const,
    };
  })();
  const canOpenConvertedOrder = false;
  const currentMonthLabel = new Date(salesDate || Date.now()).toLocaleDateString('en-PH', { month: 'long' });
  const summaryCustomer = selectedCustomer as (Contact & {
    dealershipSales?: number;
    monthlySales?: number;
    since?: string;
  }) | null;
  const selectedCustomerCreditLimit = Number(creditLimit || summaryCustomer?.creditLimit || 0);
  const selectedCustomerBalance = Number(summaryCustomer?.balance || 0);
  const exceedsCreditLimit = selectedCustomerCreditLimit > 0 && selectedCustomerBalance > selectedCustomerCreditLimit;
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

  const legacyInputClass = 'h-[34px] w-full rounded-[4px] border border-[#c9c9c9] bg-white px-3 text-[13px] text-[#333] outline-none focus:border-[#7a9ab5] disabled:bg-[#f2f2f2] disabled:text-[#777]';
  const legacyLabelClass = 'whitespace-nowrap text-right text-[16px] font-semibold text-[#29475f]';
  const formatLegacyListDate = (value?: string | null) => {
    if (!value) return '';
    const normalized = String(value).split('T')[0];
    const [year, month, day] = normalized.split('-');
    return year && month && day ? `${month}/${day}/${year}` : formatDate(value);
  };
  const clearInquiryFilters = () => {
    const today = new Date();
    setSearchTerm('');
    setStatusFilter('all');
    setFilterDay('');
    setFilterMonth(String(today.getMonth() + 1));
    setFilterYear(String(today.getFullYear()));
    setDateFilterApplied(false);
    void refetchInquiries();
  };
  const openProspectiveCustomer = () => {
    window.dispatchEvent(new CustomEvent('workflow:navigate', {
      detail: {
        tab: 'maintenance-customer-customer-database',
        payload: { action: 'create', status: 'Prospective' },
      },
    }));
  };
  const filteredByLabel = `Year: ${filterYear || 'All'} Month: ${filterMonth ? monthOptions[Number(filterMonth) - 1]?.slice(0, 3) : 'All'},${filterDay ? ` Day: ${filterDay}` : ''}`;

  const legacyLayout = (
    <div className="min-h-full overflow-y-auto bg-[#f4f4f4] px-5 py-10 text-[#202020] dark:bg-[#f4f4f4] dark:text-[#202020]" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mx-auto w-full max-w-[1140px] space-y-[26px]">
        <section className="overflow-hidden rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex min-h-[83px] flex-col gap-5 border-b border-[#d7d7d7] px-[35px] py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-[5px]">
              <button type="button" onClick={() => setShowSearchModal(true)} className="rounded-[4px] bg-[#5d82a2] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#50738f]">Search</button>
              <button type="button" onClick={clearInquiryFilters} className="rounded-[4px] bg-[#4caf50] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#43a047]">Refresh</button>
              <button type="button" onClick={startNewInquiry} className="rounded-[4px] bg-[#4caf50] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#43a047]">Create New</button>
              <button type="button" onClick={openProspectiveCustomer} className="rounded-[4px] bg-[#5d82a2] px-[13px] py-[9px] text-[14px] text-white hover:bg-[#50738f]">Prospective</button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-0">
              <span className="mr-[30px] text-[20px] font-semibold text-[#29475f]">By Month:</span>
              <input type="number" min="1" max="31" value={filterDay} onChange={(event) => setFilterDay(event.target.value)} className="h-[34px] w-[44px] rounded-l-[3px] border border-[#cfcfcf] bg-white px-2 text-[13px] outline-none" aria-label="Filter day" />
              <select value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} className="h-[34px] w-[174px] border-y border-[#cfcfcf] bg-white px-4 text-[13px] outline-none" aria-label="Filter month">
                {monthOptions.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}
              </select>
              <input type="number" value={filterYear} onChange={(event) => setFilterYear(event.target.value)} className="h-[34px] w-[87px] border border-[#cfcfcf] bg-white px-3 text-[13px] outline-none" aria-label="Filter year" />
              <button type="button" onClick={() => setDateFilterApplied(true)} className="ml-0 h-[34px] rounded-r-[4px] bg-[#4caf50] px-[13px] text-[14px] text-white hover:bg-[#43a047]">Filter</button>
            </div>
          </div>

          <div className="h-[207px] px-[25px] py-[25px]">
            <div className="mb-[10px] text-[13px]"><strong>Filtered By:</strong> {filteredByLabel}</div>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <colgroup>{inquiryListColumnWidths.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
              <thead><tr className="border-b-2 border-[#d5d5d5] text-left text-[14px] font-semibold">
                <th className="px-2 pb-2">Date</th><th className="px-2 pb-2">Customer</th><th className="px-2 pb-2">SI No.</th><th className="px-2 pb-2">SO No.</th><th className="px-2 pb-2">Transaction No.</th><th className="px-2 pb-2">Sales Person</th><th className="px-2 pb-2">Status</th>
              </tr></thead>
            </table>
            <div className="max-h-[104px] overflow-y-auto">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <colgroup>{inquiryListColumnWidths.map((width, index) => <col key={`${width}-${index}`} style={{ width }} />)}</colgroup>
                <tbody>
                  {listLoading ? <tr><td colSpan={7} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">Loading inquiries...</td></tr> : filteredInquiries.length === 0 ? <tr><td colSpan={7} className="border border-[#d7d7d7] px-2 py-4 text-center text-[#777]">No inquiries found.</td></tr> : filteredInquiries.map((inquiry) => {
                    const customer = customerMap.get(inquiry.contact_id);
                    const isActive = selectedInquiry?.id === inquiry.id && !isCreatingNew;
                    const rowColor = inquiry.status === SalesInquiryStatus.CANCELLED ? 'text-[#d33]' : isActive ? 'text-[#245d91]' : 'text-[#202020]';
                    return <tr key={inquiry.id} onClick={() => void selectInquiry(inquiry)} className={`cursor-pointer hover:bg-[#f7f7f7] ${rowColor}`}>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{formatLegacyListDate(inquiry.sales_date)}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] truncate" title={customer?.company || ''}>{customer?.company || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]"><span className="underline">{formatInquiryDisplayNo(inquiry.inquiry_no)}</span> <Copy className="ml-1 inline h-3.5 w-3.5 text-[#337ab7]" /></td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{inquiry.so_no || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] underline">{inquiry.invoice_no || inquiry.dr_no || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px] truncate">{inquiry.sales_person || ''}</td>
                      <td className="border border-[#d7d7d7] px-2 py-[9px]">{inquiry.status}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-h-[695px] overflow-visible rounded-[5px] border border-[#d7d7d7] bg-white">
          <div className="flex h-[64px] items-center justify-between border-b border-[#d7d7d7] px-5">
            <div className="relative flex h-full items-center text-[18px] font-semibold text-[#29475f] after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-[135px] after:bg-[#6a92b3]">SALES INQUIRY</div>
            <div className="flex items-center gap-[28px]">
              <span className="text-[23px] font-semibold text-[#29475f]">INQ No. :</span>
              <input readOnly value={activeInquiryNumberDisplay} className="h-[35px] w-[116px] rounded-[4px] border border-[#c9c9c9] bg-[#f2f2f2] px-3 text-[12px] text-[#444]" />
            </div>
          </div>

          <form id="salesInquiryLegacyForm" onSubmit={handleSubmit} className="px-[25px] pb-[30px] pt-[38px]">
            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
            {submitError && <div className="mb-3 rounded border border-[#e8b5b5] bg-[#fff3f3] px-3 py-2 text-[12px] text-[#a33]">{submitError}</div>}
            {isConversionLocked && <div className="mb-3 rounded border border-[#e1c57b] bg-[#fff9e9] px-3 py-2 text-[12px] text-[#725b1b]">This inquiry is locked because it already has a sales document.</div>}

            <div className="mb-[35px] overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-center text-[13px]">
                <thead><tr>{['Dealership Since', 'Dealership Sales', 'Dealership Quota', `Total Sales for ${currentMonthLabel}`, 'Customer Since', 'Credit Limit', 'Terms', 'Balance'].map((label) => <th key={label} className="border border-[#d7d7d7] px-2 py-[10px] font-normal">{label}</th>)}</tr></thead>
                <tbody><tr>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(summaryCustomer?.dealershipSince)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(summaryCustomer?.dealershipSales, true)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(summaryCustomer?.dealershipQuota, true)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(summaryCustomer?.monthlySales, true)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(summaryCustomer?.since || summaryCustomer?.customerSince)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(creditLimit, true)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(terms)}</td>
                  <td className="border border-[#d7d7d7] px-2 py-2">{displayMetricValue(summaryCustomer?.balance, true)}</td>
                </tr></tbody>
              </table>
            </div>

            {exceedsCreditLimit && <div className="mb-3 text-center text-[12px] text-[#b06b00]">Balance exceeds credit limit. The old system treats this as informational only, so inquiry creation can still proceed.</div>}

            <table className="w-full border-separate border-spacing-y-[9px] text-[13px]">
              <tbody>
                <tr><td><div className="grid grid-cols-[17%_40%_10.5%_10.5%_9.5%_12.5%] items-center"><label className={legacyLabelClass}>Sold to :</label><div className="pl-3"><CustomerAutocomplete contacts={customers} selectedCustomer={selectedCustomer} disabled={isReadOnly} onSelect={(customer) => handleCustomerSelect(customer)} placeholder="Select Customer" inputClassName={`h-[34px] rounded-[4px] border-[#c9c9c9] bg-white text-center text-[13px] ${validationErrors.customer ? 'border-red-400' : ''}`} /></div><label className={legacyLabelClass}>Date :</label><div className="pl-2"><input type="date" required disabled={isReadOnly} value={salesDate} onChange={(event) => setSalesDate(event.target.value)} className={legacyInputClass} /></div><label className={legacyLabelClass}>Sales Person:</label><div className="pl-2"><input type="text" disabled={isReadOnly} value={salesPerson} onChange={(event) => setSalesPerson(event.target.value)} className={legacyInputClass} /></div></div></td></tr>
                <tr><td><div className="grid grid-cols-[17%_40%_10.5%_10.5%_9.5%_12.5%] items-center"><label className={legacyLabelClass}>Delivery Address :</label><div className="pl-3"><input type="text" disabled={isReadOnly} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} className={legacyInputClass} /></div><label className={legacyLabelClass}>Our Reference:</label><div className="pl-2"><input type="text" readOnly value={referenceNo} className={legacyInputClass} /></div><label className={legacyLabelClass}>Your Reference:</label><div className="pl-2"><select disabled={isReadOnly || !selectedCustomer} value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} className={legacyInputClass}><option value="">Select reference</option>{customerReferenceOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></div></td></tr>
                <tr><td><div className="grid grid-cols-[12%_20%_10%_19%_10%_11%_9%_9%] items-center"><label className={legacyLabelClass}>Send By:</label><div className="pl-3"><SearchableSelect value={sendBy} options={courierOptions.map((option) => ({ value: option.name, label: option.name }))} onChange={setSendBy} placeholder="Select..." searchPlaceholder="Search courier..." disabled={isReadOnly} /></div><label className={legacyLabelClass}>Price Group:</label><div className="pl-2"><select disabled={isReadOnly || !selectedCustomer} value={priceGroup} onChange={(event) => void handlePriceGroupChange(event.target.value)} className={legacyInputClass}>{!selectedCustomer && <option value="">Select</option>}{WRITABLE_PRICING_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><label className={legacyLabelClass}>Credit Limit:</label><div className="pl-2"><input type="text" readOnly value={creditLimit ? creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''} className={legacyInputClass} /></div><label className={legacyLabelClass}>Terms Strictly:</label><div className="pl-2"><input type="text" readOnly value={terms} className={legacyInputClass} /></div></div></td></tr>
                <tr><td><div className="grid grid-cols-[17%_63%_10%_10%] items-center"><label className={legacyLabelClass}>Promise to Pay:</label><div className="pl-3"><input type="text" disabled={isReadOnly} value={promiseToPay} onChange={(event) => setPromiseToPay(event.target.value)} placeholder="if applicable" className={legacyInputClass} /></div><label className={legacyLabelClass}>PO No.:</label><div className="pl-2"><input type="text" disabled={isReadOnly} value={poNumber} onChange={(event) => setPoNumber(event.target.value)} placeholder="if applicable" className={legacyInputClass} /></div></div></td></tr>
                <tr><td><div className="grid grid-cols-[17%_63%_10%_10%] items-center"><label className={legacyLabelClass}>Remarks:</label><div className="pl-3"><SearchableSelect value={remarks} options={remarkTemplateOptions.map((option) => ({ value: option.name, label: option.name }))} onChange={setRemarks} placeholder="No Remark" searchPlaceholder="Search remarks..." disabled={isReadOnly} /></div><label className={legacyLabelClass}>Inquiry Type:</label><div className="pl-2"><select disabled={isReadOnly} value={showNewInquiryType ? 'AddNew' : inquiryType} onChange={(event) => { if (event.target.value === 'AddNew') { setShowNewInquiryType(true); setInquiryType('General'); } else { setInquiryType(event.target.value); setShowNewInquiryType(false); } }} className={legacyInputClass}><option value="General">Phone Call</option><option value="Bulk Order">Bulk Order</option><option value="AddNew">Add New Type</option></select></div></div></td></tr>
                {showNewInquiryType && <tr><td><div className="ml-[17%] w-[40%] pl-3"><input type="text" disabled={isReadOnly} value={newInquiryType} onChange={(event) => setNewInquiryType(event.target.value)} placeholder="Input Inquiry Type" className={legacyInputClass} /></div></td></tr>}
                <tr><td><div className="grid grid-cols-[15%_45%_10%_11%_19%] items-center"><label className={legacyLabelClass}>Urgency/Type:</label><div className="pl-3"><select disabled={isReadOnly} value={urgency} onChange={(event) => setUrgency(event.target.value)} className={legacyInputClass}><option value="N/A">N/A</option><option value="Urgent">Urgent</option><option value="By Schedule">By Schedule</option></select></div><label className={legacyLabelClass}>Urgency/Date:</label><div className="pl-2"><input type="date" disabled={isReadOnly || urgency === 'N/A'} value={urgencyDate} onChange={(event) => setUrgencyDate(event.target.value)} className={legacyInputClass} /></div><div></div></div></td></tr>
              </tbody>
            </table>

            <button type="button" aria-label="Add Item" onClick={addItemRow} disabled={isReadOnly} className="ml-[190px] mt-[9px] rounded-[3px] bg-[#91a9bd] px-[12px] py-[8px] text-[12px] text-white hover:bg-[#7e99b0] disabled:opacity-50">Add Inquiry</button>
            <button type="submit" aria-label="Create Inquiry" className="sr-only">Create Inquiry</button>

            <div className="mt-[24px] overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-[12px]">
                <thead><tr className="border-b-2 border-[#d5d5d5] text-center text-[14px] font-semibold">
                  <th className="w-[70px] px-2 pb-2">Qty.</th><th className="w-[140px] px-2 pb-2">Part No.</th><th className="w-[140px] px-2 pb-2">Item Code</th><th className="w-[120px] px-2 pb-2">Location</th><th className="px-2 pb-2">Description</th><th className="w-[105px] px-2 pb-2">Unit price</th><th className="w-[105px] px-2 pb-2">Amount</th><th className="w-[120px] px-2 pb-2">Remark</th><th className="w-[100px] px-2 pb-2">Approval</th>
                </tr></thead>
                <tbody>{items.map((item) => <tr key={item.tempId} className="border-b border-[#e1e1e1]">
                  <td className="px-1 py-2"><input type="number" min="1" disabled={isReadOnly} value={item.qty} onChange={(event) => updateItemRow(item.tempId, 'qty', event.target.value === '' ? '' : Number(event.target.value))} className="w-full border border-[#ccc] px-1 py-1 text-center" /></td>
                  <td className="px-2 py-2 text-center">{isManualItem(item) ? <input value={item.part_no || ''} onChange={(event) => updateItemRow(item.tempId, 'part_no', event.target.value.toUpperCase())} className="w-full border border-[#ccc] px-1 py-1" /> : item.part_no || ''}</td>
                  <td className="px-2 py-2 text-center">{isManualItem(item) ? <input value={item.item_code || ''} onChange={(event) => updateItemRow(item.tempId, 'item_code', event.target.value.toUpperCase())} className="w-full border border-[#ccc] px-1 py-1" /> : item.item_code || ''}</td>
                  <td className="px-2 py-2 text-center">{item.location || ''}</td>
                  <td className="px-2 py-2">{!item.item_id && !isManualItem(item) ? <button type="button" onClick={() => handleOpenProductModal(item.tempId!)} className="text-[#337ab7] underline">Click to search product</button> : isManualItem(item) ? <input value={item.description || ''} onChange={(event) => updateItemRow(item.tempId, 'description', event.target.value.toUpperCase())} className="w-full border border-[#ccc] px-1 py-1" /> : item.description || ''}</td>
                  <td className="px-2 py-2 text-right"><input type="number" readOnly={!isManualItem(item)} value={item.unit_price} onChange={(event) => updateItemRow(item.tempId, 'unit_price', Number(event.target.value))} className="w-full border border-[#ccc] bg-white px-1 py-1 text-right read-only:bg-[#f5f5f5]" /></td>
                  <td className="px-2 py-2 text-right">{Number(item.amount || 0).toFixed(2)}</td>
                  <td className={`px-2 py-2 text-center ${remarkClassName(item.remark)}`}>{item.remark || ''}</td>
                  <td className="px-2 py-2 text-center"><button type="button" onClick={() => removeItemRow(item.tempId)} disabled={isReadOnly} className="text-[#c84848] underline disabled:opacity-40">Remove</button></td>
                </tr>)}</tbody>
                <tfoot><tr><td colSpan={6} className="px-2 py-3 text-right font-bold">Grand Total:</td><td className="px-2 py-3"><span className="rounded-full bg-[#6f91af] px-2 py-[2px] font-bold text-white">{grandTotal.toFixed(2)}</span></td><td colSpan={2}></td></tr></tfoot>
              </table>
            </div>

            {(items.length > 0 || (!isCreatingNew && selectedInquiry)) && <div className="mt-3 flex flex-wrap items-center gap-[5px] border-t border-[#e3e3e3] pt-4">
              <button type="button" onClick={handleDeleteClick} className="rounded-[4px] bg-[#d64b47] px-[20px] py-[9px] text-[13px] text-white">{isCreatingNew ? 'Clear' : 'Cancel'}</button>
              {printableInquiry && <button type="button" onClick={handlePrint} className="rounded-[4px] bg-[#4caf50] px-[20px] py-[9px] text-[13px] text-white">Print</button>}
              <button type="submit" disabled={loading || isReadOnly} className="rounded-[4px] bg-[#4caf50] px-[20px] py-[9px] text-[13px] text-white disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
              {canGenerateSO && <button type="button" onClick={handleFinalizeInquiry} disabled={loading} className="ml-auto rounded-[4px] bg-[#4caf50] px-[20px] py-[9px] text-[13px] text-white disabled:opacity-50">Generate SO</button>}
              <button type="button" onClick={addManualItemRow} disabled={isReadOnly} className="rounded-[4px] bg-[#5d82a2] px-[16px] py-[9px] text-[13px] text-white disabled:opacity-50">Not Listed Product</button>
            </div>}
          </form>
        </section>
      </div>

      {showSearchModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-[560px] rounded-[5px] bg-white shadow-xl">
          <div className="border-b border-[#ddd] px-5 py-4 text-[20px] font-semibold text-[#333]">Search Options</div>
          <div className="space-y-4 px-6 py-5">
            <label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Ref No.</span><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Input Ref No." className={legacyInputClass} /></label>
            <label className="grid grid-cols-[130px_1fr] items-center gap-3 text-[14px]"><span className="text-right">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | SalesInquiryStatus)} className={legacyInputClass}><option value="all">All Statuses</option>{oldSystemInquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#ddd] px-5 py-4"><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={() => setShowSearchModal(false)} className="rounded-[4px] bg-[#4caf50] px-4 py-2 text-[13px] text-white">Submit</button></div>
        </div>
      </div>}

      {showPrintPreview && printableInquiry && <SalesInquiryPrintPreview inquiry={printableInquiry} customer={selectedCustomer} inquiryNumberLabel={activeInquiryNumberDisplay} preparedBy={String(getLocalAuthSession()?.userProfile?.full_name || '').trim()} onClose={() => setShowPrintPreview(false)} />}
      {showDeleteModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-sm rounded-[5px] bg-white p-5 shadow-xl"><h3 className="mb-3 text-[18px] font-semibold">{selectedInquiry && !isCreatingNew ? 'Cancel Sales Inquiry' : 'Clear Sales Inquiry'}</h3><p className="mb-5 text-[14px] text-[#555]">{selectedInquiry && !isCreatingNew ? 'Are you sure you want to cancel this Sales Inquiry?' : 'Are you sure you want to clear this draft?'}</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowDeleteModal(false)} className="rounded border border-[#ccc] px-4 py-2 text-[13px]">Close</button><button type="button" onClick={handleDeleteConfirm} disabled={deleteConfirming} className="rounded bg-[#337ab7] px-4 py-2 text-[13px] text-white">{deleteConfirming ? 'Working...' : 'Proceed'}</button></div></div></div>}
      <ProductSearchModal isOpen={showProductModal} onClose={() => setShowProductModal(false)} onSelect={handleProductSelect} />
    </div>
  );

  return legacyLayout;

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-950 p-3 gap-4">
      <PageHeader
        eyebrow="Sales Transaction"
        title="Sales Inquiry"
        subtitle="Capture customer requests, validate item details, and move clean inquiries into sales orders."
        icon={<MessageSquareText className="h-6 w-6 text-brand-blue" />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {inquiries.length.toLocaleString()} inquiries on page
            </span>
            {!isCreatingNew && selectedInquiry?.status && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                Selected: {selectedInquiry.status}
              </span>
            )}
          </div>
        }
        actions={
          <button
            type="button"
            onClick={startNewInquiry}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Inquiry
          </button>
        }
      />
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
                <option value="">Month</option>
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
            {isConversionLocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 mb-4">
                This inquiry is locked. Old-system behavior stops inquiry editing once the linked sales order has already been converted to an invoice or order slip.
              </div>
            )}
            <div className="mb-4 space-y-3">
              <WorkflowGuidance
                title={inquiryGuidance.title}
                description={inquiryGuidance.description}
                tone={inquiryGuidance.tone}
              />
              <RecordTrustStrip
                items={[
                  { label: 'Document No.', value: activeInquiryNumberDisplay },
                  { label: 'Status', value: !isCreatingNew && selectedInquiry?.status ? <StatusBadge status={selectedInquiry.status} /> : 'Draft' },
                  { label: 'Created By', value: selectedInquiry?.created_by || salesPerson || '-' },
                  { label: 'Created Date', value: selectedInquiry?.created_at ? formatDate(selectedInquiry.created_at) : salesDate || '-' },
                ]}
              />
            </div>

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

              {exceedsCreditLimit && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  Balance exceeds credit limit. The old system treats this as informational only, so inquiry creation can still proceed.
                </div>
              )}

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
                        onSelect={(customer) => handleCustomerSelect(customer)}
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
                          disabled={isReadOnly || !selectedCustomer}
                          value={priceGroup}
                          onChange={(e) => handlePriceGroupChange(e.target.value)}
                          className={`w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm ${isReadOnly || !selectedCustomer ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {!selectedCustomer && <option value="">Select a customer first</option>}
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
                      {isReadOnly ? (
                        <input type="text" readOnly value={formatCurrency(creditLimit || 0)} className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-sm opacity-60 cursor-not-allowed" />
                      ) : (
                        <input
                          type="text"
                          value={creditLimit || ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            setCreditLimit(parseFloat(raw) || 0);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-sm"
                        />
                      )}
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
            {printableInquiry && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition-colors inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
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

      {/* Delete Modal */}
      {showPrintPreview && printableInquiry && (
        <SalesInquiryPrintPreview
          inquiry={printableInquiry}
          customer={selectedCustomer}
          inquiryNumberLabel={activeInquiryNumberDisplay}
          preparedBy={String(getLocalAuthSession()?.userProfile?.full_name || '').trim()}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

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
