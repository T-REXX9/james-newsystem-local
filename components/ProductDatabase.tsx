import React, { useEffect, useRef, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import type { Supplier } from '../maintenance.types';
import type { Product, UserProfile } from '../types';
import ConfirmModal from './ConfirmModal';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import ValidationSummary from './ValidationSummary';
import { useToast } from './ToastProvider';
import { fetchCategories, type CategoryRecord } from '../services/categoryLocalApiService';
import {
  createProduct,
  deleteProduct,
  fetchProductById,
  fetchProductsPage,
  updateProduct,
  type ProductListStatus,
} from '../services/productLocalApiService';
import { fetchSuppliers } from '../services/supplierService';
import { parseSupabaseError } from '../utils/errorHandler';
import { validateMinLength, validateRequired } from '../utils/formValidation';
import { getCentralStock } from '../utils/productStock';

interface ProductDatabaseProps {
  currentUser: UserProfile | null;
  initialProductId?: string;
  initialCreate?: boolean;
  initialPartNo?: string;
  initialDescription?: string;
}

type ProductForm = Omit<Product, 'id'>;
type SupplierCost = NonNullable<Product['supplier_costs']>[number];

interface LegacyFilters {
  partNo: string;
  itemCode: string;
  category: string;
  originalPn: string;
  oemNo: string;
  description: string;
  descriptiveInquiry: string;
  application: string;
  brand: string;
  size: string;
  holes: string;
  cylinder: string;
  barcode: string;
}

const EMPTY_FILTERS: LegacyFilters = {
  partNo: '',
  itemCode: '',
  category: '',
  originalPn: '',
  oemNo: '',
  description: '',
  descriptiveInquiry: '',
  application: '',
  brand: '',
  size: '',
  holes: '',
  cylinder: '',
  barcode: '',
};

const EMPTY_PRODUCT: ProductForm = {
  part_no: '',
  oem_no: '',
  brand: '',
  barcode: '',
  no_of_pieces_per_box: 0,
  item_code: '',
  description: '',
  size: '',
  reorder_quantity: 0,
  status: 'Active',
  category: '',
  descriptive_inquiry: '',
  no_of_holes: '',
  original_pn_no: '',
  application: '',
  location: '',
  no_of_cylinder: '',
  cost: 0,
  price_aa: 0,
  price_bb: 0,
  price_cc: 0,
  price_dd: 0,
  price_vip1: 0,
  price_vip2: 0,
  price_baa: 0,
  price_bbb: 0,
  price_bcc: 0,
  price_bdd: 0,
  stock_wh1: 0,
  stock_wh2: 0,
  stock_wh3: 0,
  stock_wh4: 0,
  stock_wh5: 0,
  stock_wh6: 0,
  supplier_costs: [],
  transaction_count: 0,
};

const inputClass = 'h-[38px] w-full rounded-[3px] border border-[#ccc] bg-white px-3 text-[14px] text-[#333] outline-none focus:border-[#5d82a2]';

const money = (value?: number) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getConsolidatedStock = getCentralStock;

const formatBlueprintDate = (value?: string): string => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('en-GB');
};

const compactQuantity = (value?: number): string => {
  const amount = Number(value || 0);
  return Number.isInteger(amount) ? amount.toLocaleString() : amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const getLastTwelveMonthsRange = () => {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setFullYear(dateFrom.getFullYear() - 1);
  return {
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
  };
};

const openProductHistoryReport = (product: Product, report: 'incident' | 'return') => {
  const search = product.part_no || product.item_code || product.description || '';
  const { dateFrom, dateTo } = getLastTwelveMonthsRange();
  const params = new URLSearchParams({ search, dateFrom, dateTo });
  const url = new URL(window.location.href);
  const tab = report === 'incident'
    ? 'warehouse-reports-incident-items-report'
    : 'accounting-reports-sales-return-report';
  url.hash = `#/${tab}?${params.toString()}`;
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
};

const getSpecificationRows = (product: Product) => {
  const searchable = `${product.specifications || ''} ${product.application || ''}`;
  const side = searchable.match(/\b(?:L|R)\s*\d+(?:\.\d+)?\s*mm(?:\s*\((?:Left|Right)\))?/i)?.[0]
    || searchable.match(/\b(?:Left|Right)\b/i)?.[0]
    || '-';
  const profile = searchable.match(/\b(?:FLAT|LUBOG)\b/i)?.[0]?.toUpperCase() || '-';
  return [
    ['Measurement', product.size || product.specifications || '-'],
    ['# Holes', product.no_of_holes ? `${product.no_of_holes}${/hole/i.test(product.no_of_holes) ? '' : ' Holes'}` : '-'],
    ['# Cylinder', product.no_of_cylinder ? `${product.no_of_cylinder}${/cylinder/i.test(product.no_of_cylinder) ? '' : ' Cylinder'}` : '-'],
    ['Left / Right', side],
    ['Flat / Lubog', profile],
  ];
};

const LegacyField: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="grid min-w-0 grid-cols-[118px_minmax(0,1fr)] items-center gap-2">
    <label className="font-semibold text-[#263f52]">{label}</label>
    {children}
  </div>
);

const ProductDatabase: React.FC<ProductDatabaseProps> = ({
  currentUser: _currentUser,
  initialProductId,
  initialCreate = false,
  initialPartNo = '',
  initialDescription = '',
}) => {
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [formData, setFormData] = useState<ProductForm>({ ...EMPTY_PRODUCT });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<LegacyFilters>({ ...EMPTY_FILTERS });
  const [statusFilter, setStatusFilter] = useState<ProductListStatus>('active');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierRows, setSelectedSupplierRows] = useState<number[]>([]);
  const [applyCostToAll, setApplyCostToAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'suppliers' | 'pricing'>('details');
  const productRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: async () => {},
  });

  const loadProducts = async (targetPage = 1, append = false) => {
    if (append && loadingRef.current) return;
    loadingRef.current = true;
    const requestId = ++requestSequenceRef.current;
    setIsLoading(true);
    try {
      const result = await fetchProductsPage({
        partNo: appliedFilters.partNo,
        itemCode: appliedFilters.itemCode,
        category: appliedFilters.category,
        originalPn: appliedFilters.originalPn,
        oemNo: appliedFilters.oemNo,
        description: appliedFilters.description,
        descriptiveInquiry: appliedFilters.descriptiveInquiry,
        application: appliedFilters.application,
        brand: appliedFilters.brand,
        size: appliedFilters.size,
        holes: appliedFilters.holes,
        cylinder: appliedFilters.cylinder,
        barcode: appliedFilters.barcode,
        status: statusFilter,
        page: targetPage,
        perPage: 100,
      });
      if (requestId !== requestSequenceRef.current) return;
      setProducts((current) => {
        if (!append) return result.items;
        const existingIds = new Set(current.map((product) => product.id));
        return [...current, ...result.items.filter((product) => !existingIds.has(product.id))];
      });
      setPage(result.meta.page);
      setTotalItems(result.meta.total);
      setTotalPages(Math.max(1, result.meta.total_pages));
      setHasLoadedOnce(true);
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return;
      addToast({
        type: 'error',
        title: 'Unable to load products',
        description: parseSupabaseError(error, 'product'),
        durationMs: 6000,
      });
    } finally {
      if (requestId === requestSequenceRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    setPage(1);
    if (listViewportRef.current) listViewportRef.current.scrollTop = 0;
    void loadProducts(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, statusFilter]);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const nearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 120;
    if (nearBottom && !loadingRef.current && page < totalPages) {
      void loadProducts(page + 1, true);
    }
  };

  useEffect(() => {
    void Promise.all([fetchCategories(), fetchSuppliers()])
      .then(([categoryResult, supplierResult]) => {
        setCategories(categoryResult.items);
        setSuppliers(supplierResult);
      })
      .catch(() => {
        setCategories([]);
        setSuppliers([]);
      });
  }, []);

  useEffect(() => {
    if (!initialProductId) return;
    void fetchProductById(initialProductId).then((product) => {
      if (!product) return;
      setEditingProduct(product);
      setFormData({ ...product, supplier_costs: product.supplier_costs || [] });
      setHighlightedProductId(product.id);
      window.setTimeout(() => productRowRefs.current[product.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    });
  }, [initialProductId]);

  useEffect(() => {
    if (!initialCreate || initialProductId) return;
    setEditingProduct(null);
    setFormData({
      ...EMPTY_PRODUCT,
      supplier_costs: [],
      part_no: initialPartNo,
      description: initialDescription,
    });
    setSelectedSupplierRows([]);
    setApplyCostToAll(false);
    setSubmitError('');
    setValidationErrors({});
    setHighlightedProductId(null);
    setDetailTab('details');
  }, [initialCreate, initialDescription, initialPartNo, initialProductId]);

  useEffect(() => {
    if (!initialPartNo || initialCreate || initialProductId) return;
    setAppliedFilters((current) => ({ ...current, partNo: initialPartNo }));
  }, [initialCreate, initialPartNo, initialProductId]);

  const updateField = (field: keyof ProductForm, value: string | number) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const fieldInput = (field: keyof ProductForm, placeholder: string, type: 'text' | 'number' = 'text') => (
    <input
      type={type}
      value={type === 'number' && Number(formData[field] || 0) === 0 ? '' : String(formData[field] ?? '')}
      onChange={(event) => updateField(field, type === 'number' ? Number(event.target.value || 0) : event.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  );

  const selectProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({ ...product, supplier_costs: product.supplier_costs || [] });
    setSelectedSupplierRows([]);
    setApplyCostToAll(false);
    setSubmitError('');
    setValidationErrors({});
    setHighlightedProductId(product.id);
    setDetailTab('details');
  };

  const clearEditor = () => {
    setEditingProduct(null);
    setFormData({ ...EMPTY_PRODUCT, supplier_costs: [] });
    setSelectedSupplierRows([]);
    setApplyCostToAll(false);
    setSubmitError('');
    setValidationErrors({});
    setHighlightedProductId(null);
    setDetailTab('details');
  };

  const validateForm = (mode: 'add' | 'edit') => {
    const errors: Record<string, string> = {};
    const partNo = validateRequired(formData.part_no, 'a part number');
    const itemCode = validateRequired(formData.item_code, 'an item code');
    const description = validateRequired(formData.description, 'a description');
    const descriptionLength = validateMinLength(formData.description, 'description', 3);
    if (!partNo.isValid) errors.part_no = partNo.message;
    if (mode === 'add' && !itemCode.isValid) errors.item_code = itemCode.message;
    if (!description.isValid) errors.description = description.message;
    else if (!descriptionLength.isValid) errors.description = descriptionLength.message;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = () => {
    // Reorder quantity is the sole stocking control. Do not carry the retired
    // replenish value forward when an existing product is saved.
    const { replenish_quantity: _replenishQuantity, ...productPayload } = formData;
    return {
    ...productPayload,
    part_no: String(formData.part_no || '').replace(/\s+/g, ''),
    item_code: String(formData.item_code || '').trim(),
    supplier_costs: formData.supplier_costs || [],
    apply_cost_to_all_part_no: applyCostToAll,
    };
  };

  const saveProduct = async (mode: 'add' | 'edit') => {
    if (!validateForm(mode)) {
      setSubmitCount((count) => count + 1);
      return;
    }
    if (mode === 'edit' && !editingProduct) return;

    setIsSaving(true);
    setSubmitError('');
    try {
      if (mode === 'add') {
        await createProduct(buildPayload());
        addToast({ type: 'success', title: 'Product added', description: 'Product record was added successfully.' });
        clearEditor();
        await loadProducts(1, false);
      } else if (editingProduct) {
        await updateProduct(editingProduct.id, buildPayload());
        addToast({ type: 'success', title: 'Product saved', description: 'Product record was updated successfully.' });
        const refreshed = await fetchProductById(editingProduct.id);
        if (refreshed) {
          selectProduct(refreshed);
          setProducts((current) => current.map((product) => product.id === refreshed.id ? refreshed : product));
        }
      }
    } catch (error) {
      const message = parseSupabaseError(error, 'product');
      setSubmitError(message);
      addToast({ type: 'error', title: mode === 'add' ? 'Unable to add product' : 'Unable to save product', description: message, durationMs: 6000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = () => {
    setAppliedFilters({
      partNo: formData.part_no,
      itemCode: formData.item_code,
      category: formData.category,
      originalPn: formData.original_pn_no,
      oemNo: formData.oem_no,
      description: formData.description,
      descriptiveInquiry: formData.descriptive_inquiry,
      application: formData.application,
      brand: formData.brand,
      size: formData.size,
      holes: formData.no_of_holes,
      cylinder: formData.no_of_cylinder,
      barcode: formData.barcode,
    });
  };

  const handleRefresh = () => {
    clearEditor();
    setAppliedFilters({ ...EMPTY_FILTERS });
    setStatusFilter('active');
  };

  const handleDelete = () => {
    if (!editingProduct || Number(editingProduct.transaction_count || 0) > 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product record?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteProduct(editingProduct.id);
          addToast({ type: 'success', title: 'Product deleted', description: 'Product was removed from the database.' });
          clearEditor();
          await loadProducts(1, false);
        } catch (error) {
          addToast({ type: 'error', title: 'Unable to delete product', description: parseSupabaseError(error, 'product'), durationMs: 6000 });
        }
      },
    });
  };

  const addSupplierCost = () => {
    setFormData((current) => ({
      ...current,
      supplier_costs: [...(current.supplier_costs || []), { supplier_id: '', supplier_name: '', cost: 0 }],
    }));
  };

  const updateSupplierCost = (index: number, updates: Partial<SupplierCost>) => {
    setFormData((current) => ({
      ...current,
      supplier_costs: (current.supplier_costs || []).map((row, rowIndex) => rowIndex === index ? { ...row, ...updates } : row),
    }));
  };

  const deleteSelectedSupplierCosts = () => {
    setFormData((current) => ({
      ...current,
      supplier_costs: (current.supplier_costs || []).filter((_, index) => !selectedSupplierRows.includes(index)),
    }));
    setSelectedSupplierRows([]);
  };

  const activeFilterLabels = Object.entries(appliedFilters)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value}`);

  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f4f4]">
        <CustomLoadingSpinner label="Loading product database" />
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-auto bg-[#f4f4f4] px-2 py-6 text-[14px] text-[#222] sm:px-3 lg:px-4">
      <div className="w-full max-w-none">
        <section className="overflow-hidden rounded-[5px] border border-[#d8d8d8] bg-white">
          <header className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-[#ddd] px-5">
            <h1 className="border-b border-[#5d82a2] py-5 pr-24 font-['Oswald'] text-[18px] font-semibold uppercase text-[#315574]">
              Product Database
            </h1>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={handleSearch} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white">Search</button>
              <button type="button" onClick={() => void saveProduct('add')} disabled={isSaving} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-white disabled:opacity-50">Add</button>
              <button type="button" onClick={() => void saveProduct('edit')} disabled={!editingProduct || isSaving} className="rounded-[4px] bg-[#51b957] px-4 py-2 text-white disabled:opacity-50">Save</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!editingProduct || Number(editingProduct.transaction_count || 0) > 0 || isSaving}
                title={editingProduct && Number(editingProduct.transaction_count || 0) > 0 ? 'Products with transactions cannot be deleted.' : 'Delete selected product'}
                className="rounded-[4px] bg-[#d9534f] px-4 py-2 text-white disabled:opacity-50"
              >
                Delete
              </button>
              <button type="button" onClick={handleRefresh} className="rounded-[4px] bg-[#5d82a2] px-4 py-2 text-white">Refresh</button>
            </div>
          </header>

          <div className="px-6 py-6">
            <ValidationSummary errors={validationErrors} summaryKey={submitCount} />
            {submitError && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{submitError}</div>}
            {editingProduct && (
              <div className="mb-4 text-xs text-blue-700">
                Selected product: <strong>{editingProduct.part_no}</strong>
                {Number(editingProduct.transaction_count || 0) > 0 && <span className="ml-2 text-slate-500">(Delete disabled because this item has transaction history.)</span>}
              </div>
            )}

            <nav className="mb-5 flex flex-wrap border-b border-[#ccc]" aria-label="Product detail sections">
              {([
                ['details', 'Product Details'],
                ['suppliers', 'Supplier & Costing'],
                ['pricing', 'Pricing & Stock'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === value}
                  onClick={() => setDetailTab(value)}
                  className={`border-b-2 px-5 py-3 text-[14px] font-semibold ${detailTab === value ? 'border-[#315574] bg-[#edf3f7] text-[#315574]' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {detailTab === 'details' && <div className="grid grid-cols-1 gap-x-5 gap-y-3 lg:grid-cols-2 xl:grid-cols-4">
              <LegacyField label="Part No.">{fieldInput('part_no', 'Input Part Number')}</LegacyField>
              <LegacyField label="Item Code">{fieldInput('item_code', 'Input Item Code')}</LegacyField>
              <LegacyField label="Category">
                <select value={formData.category} onChange={(event) => updateField('category', event.target.value)} className={inputClass}>
                  <option value="">Select Category</option>
                  {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
              </LegacyField>
              <LegacyField label="Original P/N No.">{fieldInput('original_pn_no', 'Input P/N No.')}</LegacyField>
              <LegacyField label="OEM No.">{fieldInput('oem_no', 'Input OEM No.')}</LegacyField>
              <LegacyField label="Description">{fieldInput('description', 'Input Description')}</LegacyField>
              <LegacyField label="Descriptive Inquiry">{fieldInput('descriptive_inquiry', 'Input Descriptive Inquiry')}</LegacyField>
              <LegacyField label="Application">{fieldInput('application', 'Input Application')}</LegacyField>
              <LegacyField label="Brand">{fieldInput('brand', 'Input Brand')}</LegacyField>
              <LegacyField label="Size">{fieldInput('size', 'Input Size')}</LegacyField>
              <LegacyField label="No. of Holes">{fieldInput('no_of_holes', 'Input No. of Holes')}</LegacyField>
              <LegacyField label="No. of Cylinder">{fieldInput('no_of_cylinder', 'Input No. of Cylinder')}</LegacyField>
              <LegacyField label="Barcode">{fieldInput('barcode', 'Input Barcode')}</LegacyField>
              <LegacyField label="Reorder Quantity">{fieldInput('reorder_quantity', 'Input Reorder Qty', 'number')}</LegacyField>
              <LegacyField label="Pcs per Box">{fieldInput('no_of_pieces_per_box', 'Input Qty', 'number')}</LegacyField>
              <LegacyField label="Status">
                <select value={formData.status} onChange={(event) => updateField('status', event.target.value)} className={inputClass}>
                  <option value="Active">Unhide</option>
                  <option value="Inactive">Hide</option>
                </select>
              </LegacyField>
            </div>}

            {detailTab === 'suppliers' && <div>

            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Supplier COG</h2>
              <div className="flex gap-1">
                <button type="button" onClick={addSupplierCost} className="rounded-[4px] bg-[#51b957] px-3 py-2 text-white">Add Supplier</button>
                <button type="button" onClick={deleteSelectedSupplierCosts} disabled={selectedSupplierRows.length === 0} className="rounded-[4px] bg-[#d9534f] px-3 py-2 text-white disabled:opacity-50">Delete Supplier</button>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {(formData.supplier_costs || []).length === 0 && (
                    <tr>
                      <td className="py-3 text-slate-500">No supplier costing added.</td>
                    </tr>
                  )}
                  {(formData.supplier_costs || []).map((row, index) => (
                    <tr key={`${row.supplier_id}-${index}`} className="border-t border-[#eee]">
                      <td className="w-10 py-2">
                        <input
                          type="checkbox"
                          checked={selectedSupplierRows.includes(index)}
                          onChange={(event) => setSelectedSupplierRows((current) => event.target.checked ? [...current, index] : current.filter((value) => value !== index))}
                        />
                      </td>
                      <th className="w-[110px] text-left">Supplier #{index + 1}</th>
                      <td className="px-2">
                        <select
                          value={row.supplier_id}
                          onChange={(event) => {
                            const supplier = suppliers.find((item) => item.id === event.target.value);
                            updateSupplierCost(index, { supplier_id: event.target.value, supplier_name: supplier?.name || '' });
                          }}
                          className={inputClass}
                        >
                          <option value="">Select Supplier</option>
                          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                        </select>
                      </td>
                      <th className="w-[90px] text-left">COG #{index + 1}</th>
                      <td className="px-2">
                        <input type="number" value={row.cost || ''} onChange={(event) => updateSupplierCost(index, { cost: Number(event.target.value || 0) })} placeholder="Input COG" className={inputClass} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="mt-3 inline-flex items-center gap-2">
              <input type="checkbox" checked={applyCostToAll} onChange={(event) => setApplyCostToAll(event.target.checked)} />
              Apply this costing to all Part No.
            </label>
            </div>}

            {detailTab === 'pricing' && <div>
            <h2 className="mb-3 font-semibold">Price List</h2>
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
              <LegacyField label="VIP 1">{fieldInput('price_aa', 'Input Amount', 'number')}</LegacyField>
              <LegacyField label="VIP 2">{fieldInput('price_vip1', 'Input Amount', 'number')}</LegacyField>
              <LegacyField label="VIP 3">{fieldInput('price_vip2', 'Input Amount', 'number')}</LegacyField>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
              <LegacyField label="Current Stock">
                <input type="text" value={compactQuantity(getConsolidatedStock(formData as Product))} readOnly className={`${inputClass} bg-[#eee] text-slate-600`} />
              </LegacyField>
              <LegacyField label="Reorder Quantity">{fieldInput('reorder_quantity', 'Input Reorder Qty', 'number')}</LegacyField>
              <LegacyField label="Pcs per Box">{fieldInput('no_of_pieces_per_box', 'Input Qty', 'number')}</LegacyField>
            </div>
            </div>}

            <div className="mt-6 grid max-w-[260px] gap-1">
              <span>Additional Filters:</span>
              <label>Show Status</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ProductListStatus)}
                className={inputClass}
              >
                <option value="active">All Unhidden</option>
                <option value="inactive">All Hidden</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="mt-5 border-t border-[#ddd] pt-4">
              <div className="mb-2">
                Filtered by keyword {activeFilterLabels.length ? <strong>{activeFilterLabels.join(' | ')}</strong> : <strong>Show Only: {statusFilter === 'active' ? 'Unhidden' : statusFilter === 'inactive' ? 'Hidden' : 'All'}</strong>}
                {isLoading && <span className="ml-3 inline-flex items-center gap-1 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Updating...</span>}
              </div>
              <div
                ref={listViewportRef}
                onScroll={handleListScroll}
                className="max-h-[520px] w-full overflow-y-auto overflow-x-hidden border border-[#ddd]"
              >
                <table className="w-full table-fixed border-collapse text-left text-[clamp(8px,0.72vw,12px)] leading-[1.35] [&_td]:break-words [&_th]:break-normal [&_th]:[hyphens:none] [&_th]:[word-break:keep-all] [&_th]:[overflow-wrap:normal]">
                  <colgroup>
                    {[1.8, 7.6, 6.0, 3.8, 5.6, 3.6, 6.6, 3.8, 4.2, 4.2, 3.4, 4.6, 4.4, 4.0, 4.0, 3.8, 3.8, 3.8, 5.6, 4.0, 4.0, 5.0].map((width, index) => (
                      <col key={index} style={{ width: `${width}%` }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-[#f7f7f7] font-['Oswald'] text-[10px] tracking-tight uppercase leading-tight min-[1450px]:text-[11px] min-[1700px]:text-[12px]">
                    <tr>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">#</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Part Number</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Original Part Number</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Item Code</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Description</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Brand</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Specifications</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Packing<br />(pcs / box)</th>
                      <th colSpan={4} className="border border-[#ccc] bg-[#edf3f7] px-0.5 py-2 text-center text-[#315574]">Supplier (Cost of Goods)</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Last Receive Qty<br />(Date)</th>
                      <th colSpan={2} className="border border-[#ccc] bg-[#eef6ee] px-0.5 py-2 text-center text-[#315b36]">Stock &amp; Reorder</th>
                      <th colSpan={3} className="border border-[#ccc] bg-[#eef4fa] px-0.5 py-2 text-center text-[#315574]">Price List (Per Piece)</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Qty Sold Per Year<br />(pcs)</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Incident Report<br />(Last 12 Months)</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Return Report<br />(Last 12 Months)</th>
                      <th rowSpan={2} className="border border-[#ccc] px-0.5 py-2 text-center">Last Price Update</th>
                    </tr>
                    <tr>
                      <th className="border border-[#ccc] bg-[#edf3f7] px-0.5 py-1.5 text-center">Supplier Code</th>
                      <th className="border border-[#ccc] bg-[#edf3f7] px-0.5 py-1.5 text-center">Supplier Name</th>
                      <th className="border border-[#ccc] bg-[#edf3f7] px-0.5 py-1.5 text-center">Cost (₱)</th>
                      <th className="border border-[#ccc] bg-[#edf3f7] px-0.5 py-1.5 text-center">Status</th>
                      <th className="border border-[#ccc] bg-[#eef6ee] px-0.5 py-1.5 text-center">Current Stock</th>
                      <th className="border border-[#ccc] bg-[#eef6ee] px-0.5 py-1.5 text-center">Reorder Qty</th>
                      <th className="border border-[#ccc] bg-[#eef4fa] px-0.5 py-1.5 text-center">1st<br />(VIP 1)</th>
                      <th className="border border-[#ccc] bg-[#eef4fa] px-0.5 py-1.5 text-center">2nd<br />(VIP 2)</th>
                      <th className="border border-[#ccc] bg-[#eef4fa] px-0.5 py-1.5 text-center">3rd<br />(VIP 3)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!isLoading && products.length === 0 && <tr><td colSpan={22} className="px-3 py-6 text-center text-slate-500">No products found.</td></tr>}
                    {products.map((product, productIndex) => {
                      const selected = highlightedProductId === product.id;
                      const yearlySales = Object.entries(product.sales_by_year || {}).sort(([a], [b]) => Number(b) - Number(a));
                      const background = product.status === 'Active' ? 'bg-white' : 'bg-[#e8e8e8]';
                      const supplierCosts = (product.supplier_costs || []).slice(0, 3);
                      const supplierRows = Array.from({ length: 3 }, (_, index) => supplierCosts[index] || null);
                      const currentStock = getConsolidatedStock(product);
                      const isLowStock = currentStock <= Number(product.reorder_quantity || 0);
                      const specifications = getSpecificationRows(product);
                      return (
                        <tr
                          key={product.id}
                          ref={(node) => { productRowRefs.current[product.id] = node; }}
                          onClick={() => selectProduct(product)}
                          className={`cursor-pointer ${background} ${selected ? 'bg-blue-50 outline outline-1 outline-blue-300' : ''}`}
                        >
                          <td className="border border-[#ddd] px-0.5 py-2 text-center align-top font-semibold">
                            {productIndex + 1}
                            <button type="button" onClick={(event) => { event.stopPropagation(); selectProduct(product); }} className="mt-1 block w-full text-[#315574]" title="View full details"><Eye className="mx-auto h-3 w-3" /></button>
                          </td>
                          <td className="border border-[#ddd] px-1 py-2 align-top overflow-hidden whitespace-nowrap">
                            <button type="button" onClick={(event) => { event.stopPropagation(); selectProduct(product); }} className="block w-full max-w-full overflow-hidden whitespace-nowrap text-[clamp(5px,0.65vw,11px)] font-bold text-[#1675bd] underline" title={product.part_no || '-'}>{product.part_no || '-'}</button>
                          </td>
                          <td className="border border-[#ddd] px-1 py-2 align-top font-semibold">
                            {product.original_pn_no || '-'}
                            <div className="mt-0.5 font-normal text-slate-500">({product.original_pn_no || '-'})</div>
                          </td>
                          <td className="border border-[#ddd] px-1 py-2 align-top">{product.item_code || '-'}</td>
                          <td className="border border-[#ddd] px-1 py-2 align-top font-medium">{product.description || '-'}</td>
                          <td className="border border-[#ddd] px-1 py-2 align-top">{product.brand || '-'}</td>
                          <td className="border border-[#ddd] px-1 py-2 align-top">
                            <div className="space-y-0.5">
                              {specifications.map(([label, value]) => (
                                <div key={label} className="grid grid-cols-[5px_minmax(0,1fr)] gap-0.5">
                                  <span>▪</span>
                                  <span><span className="font-semibold">{label}</span> : {value}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="border border-[#ddd] px-1 py-2 text-center align-top">
                            {product.packing || `${compactQuantity(product.no_of_pieces_per_box)} pcs`}
                          </td>
                          <td className="border border-[#ddd] p-0 align-top">
                            {supplierRows.map((supplier, index) => (
                              <div key={`${supplier?.supplier_id || 'empty'}-${index}`} className="flex h-12 items-center overflow-hidden border-b border-[#eee] px-0.5 py-1 leading-tight last:border-b-0">
                                {supplier && <><span className={index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : 'text-orange-600'}>{index === 0 ? '⭐' : '🏆'}</span>{' '}</>}
                                {supplier?.supplier_code || '-'}
                              </div>
                            ))}
                          </td>
                          <td className="border border-[#ddd] p-0 align-top">
                            {supplierRows.map((supplier, index) => <div key={`${supplier?.supplier_id || 'empty'}-${index}`} className="flex h-12 items-center overflow-hidden border-b border-[#eee] px-0.5 py-1 leading-tight last:border-b-0" title={supplier?.supplier_name || ''}>{supplier?.supplier_name || '-'}</div>)}
                          </td>
                          <td className="border border-[#ddd] p-0 text-right align-top">
                            {supplierRows.map((supplier, index) => <div key={`${supplier?.supplier_id || 'empty'}-${index}`} className="flex h-12 items-center justify-end overflow-hidden border-b border-[#eee] px-0.5 py-1 leading-tight last:border-b-0">{supplier ? money(supplier.cost) : '-'}</div>)}
                          </td>
                          <td className="border border-[#ddd] p-0 text-center align-top">
                            {supplierRows.map((supplier, index) => {
                              const blacklisted = Boolean(supplier?.is_blacklisted);
                              const status = blacklisted
                                ? `Recommended for Blacklisted${supplier?.rank ? ` Supplier ${supplier.rank}` : ''}`
                                : supplier?.status || '';
                              return (
                                <div key={`${supplier?.supplier_id || 'empty'}-${index}`} className="flex h-12 items-center justify-center overflow-hidden border-b border-[#eee] px-0.5 py-1 leading-tight last:border-b-0">
                                  {status ? <span className={`rounded-full px-1 py-0.5 font-semibold leading-tight ${blacklisted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>{status}</span> : <span>-</span>}
                                </div>
                              );
                            })}
                          </td>
                          <td className="border border-[#ddd] px-1 py-2 text-center align-top">
                            <strong className="text-[9.9px] min-[1450px]:text-[11px]">{compactQuantity(product.last_receive_quantity)}</strong>
                            <div className="mt-0.5 text-slate-500">({formatBlueprintDate(product.last_receive_date)})</div>
                          </td>
                          <td className="border border-[#ddd] px-0.5 py-2 text-center align-top">
                            {currentStock === 0
                              ? <span className="inline-block rounded bg-rose-600 px-1 py-0.5 font-bold text-white">⚠ Out of Stock</span>
                              : <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-emerald-700'}`}>{compactQuantity(currentStock)}</span>}
                          </td>
                          <td className="border border-[#ddd] px-0.5 py-2 text-center align-top">{compactQuantity(product.reorder_quantity)}</td>
                          <td className="border border-[#ddd] px-0.5 py-2 text-right align-top font-bold text-[#1675bd]">{money(product.price_aa)}</td>
                          <td className="border border-[#ddd] px-0.5 py-2 text-right align-top font-bold text-[#1675bd]">{money(product.price_vip1)}</td>
                          <td className="border border-[#ddd] px-0.5 py-2 text-right align-top font-bold text-[#1675bd]">{money(product.price_vip2)}</td>
                          <td className="border border-[#ddd] px-1 py-2 align-top text-slate-500">
                            {yearlySales.map(([year, quantity]) => (
                              <div key={year} className="grid grid-cols-[auto_1fr] gap-1">
                                <span>{year} :</span>
                                <span className="text-right">{compactQuantity(quantity)} pcs</span>
                              </div>
                            ))}
                          </td>
                          <td className={`border border-[#ddd] px-0.5 py-2 text-center align-top font-bold ${Number(product.incident_report_count || 0) > 0 ? 'text-red-600' : ''}`}>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProductHistoryReport(product, 'incident');
                              }}
                              className="rounded px-1 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                              title="Open this product's Incident Items Report for the last 12 months in a new tab"
                              aria-label={`Open incident report for ${product.part_no || product.item_code || product.description}`}
                            >
                              {Number(product.incident_report_count || 0)}
                            </button>
                          </td>
                          <td className={`border border-[#ddd] px-0.5 py-2 text-center align-top font-bold ${Number(product.return_report_count || 0) > 0 ? 'text-red-600' : ''}`}>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProductHistoryReport(product, 'return');
                              }}
                              className="rounded px-1 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                              title="Open this product's Sales Return Report for the last 12 months in a new tab"
                              aria-label={`Open return report for ${product.part_no || product.item_code || product.description}`}
                            >
                              {Number(product.return_report_count || 0)}
                            </button>
                          </td>
                          <td className="border border-[#ddd] px-1 py-2 text-center align-top">{formatBlueprintDate(product.last_price_update)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex min-h-[32px] items-center justify-between gap-3">
                <span>Showing {products.length.toLocaleString()} of {totalItems.toLocaleString()} records</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  {isLoading && hasLoadedOnce
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more items...</>
                    : page < totalPages
                      ? 'Scroll to the bottom to load more'
                      : 'All items loaded'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((current) => ({ ...current, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
        confirmLabel={confirmModal.confirmLabel}
      />
    </div>
  );
};

export default ProductDatabase;
