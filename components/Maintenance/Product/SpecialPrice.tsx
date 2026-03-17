import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Search, Trash2, X } from 'lucide-react';
import ConfirmModal from '../../ConfirmModal';
import { useToast } from '../../ToastProvider';
import { useDebounce } from '../../../hooks/useDebounce';
import {
    SpecialPriceArea,
    SpecialPriceAreaPicker,
    SpecialPriceCategory,
    SpecialPriceCategoryPicker,
    SpecialPriceCustomer,
    SpecialPriceCustomerPicker,
    SpecialPriceDetail,
    SpecialPriceProduct,
    SpecialPriceRecord,
} from '../../../maintenance.types';
import {
    addArea,
    addCategory,
    addCustomer,
    createSpecialPrice,
    deleteSpecialPrice,
    fetchAreaPicker,
    fetchCategoryPicker,
    fetchCustomerPicker,
    fetchProducts,
    fetchSpecialPriceDetail,
    fetchSpecialPrices,
    PaginationMeta,
    removeArea,
    removeCategory,
    removeCustomer,
    updateSpecialPrice,
} from '../../../services/specialPriceService';

interface ConfirmState {
    open: boolean;
    refno: string | null;
}

interface SubDeleteState {
    open: boolean;
    refno: string | null;
    targetId: string | null;
    label: string;
}

interface PickerModalShellProps {
    isOpen: boolean;
    title: string;
    search: string;
    onSearchChange: (value: string) => void;
    loading: boolean;
    confirmLabel: string;
    confirmDisabled: boolean;
    onClose: () => void;
    onConfirm: () => void;
    children: React.ReactNode;
}

interface AddCustomerModalProps {
    isOpen: boolean;
    refno: string | null;
    onClose: () => void;
    onAdded: () => Promise<void>;
}

interface AddAreaModalProps {
    isOpen: boolean;
    refno: string | null;
    onClose: () => void;
    onAdded: () => Promise<void>;
}

interface AddCategoryModalProps {
    isOpen: boolean;
    refno: string | null;
    onClose: () => void;
    onAdded: () => Promise<void>;
}

const PRICE_TYPES = ['Fix Amount', 'Percentage'];
const RECORDS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const PRODUCT_PER_PAGE_OPTIONS = [10, 20, 50];

const createDefaultMeta = (): PaginationMeta => ({
    page: 1,
    per_page: 100,
    total: 0,
    total_pages: 0,
});

const formatAmount = (amount: number): string => {
    if (!Number.isFinite(amount)) return '0.00';
    return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const PaginationControls: React.FC<{
    meta: PaginationMeta;
    perPage: number;
    perPageOptions: number[];
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
    disabled?: boolean;
}> = ({ meta, perPage, perPageOptions, onPageChange, onPerPageChange, disabled = false }) => {
    const canGoPrev = !disabled && meta.page > 1;
    const canGoNext = !disabled && meta.page < Math.max(1, meta.total_pages);

    return (
        <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
                Page {meta.page} of {Math.max(1, meta.total_pages || 1)} · {meta.total} total item(s)
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span>Per page</span>
                    <select
                        value={perPage}
                        onChange={(event) => onPerPageChange(Number(event.target.value))}
                        disabled={disabled}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
                    >
                        {perPageOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPageChange(meta.page - 1)}
                        disabled={!canGoPrev}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        onClick={() => onPageChange(meta.page + 1)}
                        disabled={!canGoNext}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

const PickerModalShell: React.FC<PickerModalShellProps> = ({
    isOpen,
    title,
    search,
    onSearchChange,
    loading,
    confirmLabel,
    confirmDisabled,
    onClose,
    onConfirm,
    children,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="max-h-80 overflow-y-auto">{children}</div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={confirmDisabled || loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, refno, onClose, onAdded }) => {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [items, setItems] = useState<SpecialPriceCustomerPicker[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setSelected(null);
            setItems([]);
            return;
        }

        let active = true;
        const loadItems = async () => {
            setLoading(true);
            try {
                const result = await fetchCustomerPicker(debouncedSearch, 1, 100);
                if (active) {
                    setItems(result.items);
                }
            } catch (error) {
                if (active) {
                    addToast({
                        type: 'error',
                        title: 'Unable to load customers',
                        description: error instanceof Error ? error.message : 'Unable to load customers.',
                        durationMs: 6000,
                    });
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadItems();
        return () => {
            active = false;
        };
    }, [addToast, debouncedSearch, isOpen]);

    const handleConfirm = async () => {
        if (!refno || !selected) return;

        setSubmitting(true);
        try {
            await addCustomer(refno, selected);
            addToast({
                type: 'success',
                title: 'Customer added',
                description: 'Customer has been added successfully.',
                durationMs: 4000,
            });
            onClose();
            await onAdded();
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to add customer',
                description: error instanceof Error ? error.message : 'Unable to add customer.',
                durationMs: 6000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PickerModalShell
            isOpen={isOpen}
            title="Add Customer"
            search={search}
            onSearchChange={setSearch}
            loading={submitting}
            confirmLabel="Add Customer"
            confirmDisabled={!selected}
            onClose={onClose}
            onConfirm={handleConfirm}
        >
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                        <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">
                                Loading...
                            </td>
                        </tr>
                    ) : items.length === 0 ? (
                        <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">
                                No customers found
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => (
                            <tr
                                key={item.lsessionid}
                                onClick={() => setSelected(item.lsessionid)}
                                className={`cursor-pointer transition-colors ${
                                    selected === item.lsessionid
                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.lpatient_code || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.lcompany || '-'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </PickerModalShell>
    );
};

const AddAreaModal: React.FC<AddAreaModalProps> = ({ isOpen, refno, onClose, onAdded }) => {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [items, setItems] = useState<SpecialPriceAreaPicker[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setSelected(null);
            setItems([]);
            return;
        }

        let active = true;
        const loadItems = async () => {
            setLoading(true);
            try {
                const result = await fetchAreaPicker(debouncedSearch, 1, 100);
                if (active) {
                    setItems(result.items);
                }
            } catch (error) {
                if (active) {
                    addToast({
                        type: 'error',
                        title: 'Unable to load areas',
                        description: error instanceof Error ? error.message : 'Unable to load areas.',
                        durationMs: 6000,
                    });
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadItems();
        return () => {
            active = false;
        };
    }, [addToast, debouncedSearch, isOpen]);

    const handleConfirm = async () => {
        if (!refno || !selected) return;

        setSubmitting(true);
        try {
            await addArea(refno, selected);
            addToast({
                type: 'success',
                title: 'Area added',
                description: 'Area has been added successfully.',
                durationMs: 4000,
            });
            onClose();
            await onAdded();
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to add area',
                description: error instanceof Error ? error.message : 'Unable to add area.',
                durationMs: 6000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PickerModalShell
            isOpen={isOpen}
            title="Add Area"
            search={search}
            onSearchChange={setSearch}
            loading={submitting}
            confirmLabel="Add Area"
            confirmDisabled={!selected}
            onClose={onClose}
            onConfirm={handleConfirm}
        >
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area Name</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                        <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">
                                Loading...
                            </td>
                        </tr>
                    ) : items.length === 0 ? (
                        <tr>
                            <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">
                                No areas found
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => (
                            <tr
                                key={item.code}
                                onClick={() => setSelected(item.code)}
                                className={`cursor-pointer transition-colors ${
                                    selected === item.code
                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.code || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.name || '-'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </PickerModalShell>
    );
};

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, refno, onClose, onAdded }) => {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [items, setItems] = useState<SpecialPriceCategoryPicker[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setSelected(null);
            setItems([]);
            return;
        }

        let active = true;
        const loadItems = async () => {
            setLoading(true);
            try {
                const result = await fetchCategoryPicker(debouncedSearch, 1, 100);
                if (active) {
                    setItems(result.items);
                }
            } catch (error) {
                if (active) {
                    addToast({
                        type: 'error',
                        title: 'Unable to load categories',
                        description: error instanceof Error ? error.message : 'Unable to load categories.',
                        durationMs: 6000,
                    });
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadItems();
        return () => {
            active = false;
        };
    }, [addToast, debouncedSearch, isOpen]);

    const handleConfirm = async () => {
        if (!refno || !selected) return;

        setSubmitting(true);
        try {
            await addCategory(refno, selected);
            addToast({
                type: 'success',
                title: 'Category added',
                description: 'Category has been added successfully.',
                durationMs: 4000,
            });
            onClose();
            await onAdded();
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to add category',
                description: error instanceof Error ? error.message : 'Unable to add category.',
                durationMs: 6000,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PickerModalShell
            isOpen={isOpen}
            title="Add Category"
            search={search}
            onSearchChange={setSearch}
            loading={submitting}
            confirmLabel="Add Category"
            confirmDisabled={!selected}
            onClose={onClose}
            onConfirm={handleConfirm}
        >
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category Name</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                        <tr>
                            <td className="px-4 py-6 text-center text-sm text-gray-500">Loading...</td>
                        </tr>
                    ) : items.length === 0 ? (
                        <tr>
                            <td className="px-4 py-6 text-center text-sm text-gray-500">No categories found</td>
                        </tr>
                    ) : (
                        items.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => setSelected(item.id)}
                                className={`cursor-pointer transition-colors ${
                                    selected === item.id
                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{item.name || '-'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </PickerModalShell>
    );
};

const DetailTableSection: React.FC<{
    title: string;
    columns: string[];
    loading: boolean;
    emptyMessage: string;
    children: React.ReactNode;
}> = ({ title, columns, loading, emptyMessage, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                                Loading...
                            </td>
                        </tr>
                    ) : React.Children.count(children) === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        children
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

export default function SpecialPrice() {
    const { addToast } = useToast();
    const [records, setRecords] = useState<SpecialPriceRecord[]>([]);
    const [meta, setMeta] = useState<PaginationMeta>(createDefaultMeta());
    const [loading, setLoading] = useState(true);
    const [listSearch, setListSearch] = useState('');
    const [recordPage, setRecordPage] = useState(1);
    const [recordPerPage, setRecordPerPage] = useState(25);
    const debouncedListSearch = useDebounce(listSearch, 300);
    const [selectedRefno, setSelectedRefno] = useState<string | null>(null);
    const [detail, setDetail] = useState<SpecialPriceDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [editType, setEditType] = useState('Fix Amount');
    const [editAmount, setEditAmount] = useState('');
    const [addCustomerOpen, setAddCustomerOpen] = useState(false);
    const [addAreaOpen, setAddAreaOpen] = useState(false);
    const [addCategoryOpen, setAddCategoryOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<ConfirmState>({ open: false, refno: null });
    const [confirmRemoveCustomer, setConfirmRemoveCustomer] = useState<SubDeleteState>({
        open: false,
        refno: null,
        targetId: null,
        label: '',
    });
    const [confirmRemoveArea, setConfirmRemoveArea] = useState<SubDeleteState>({
        open: false,
        refno: null,
        targetId: null,
        label: '',
    });
    const [confirmRemoveCategory, setConfirmRemoveCategory] = useState<SubDeleteState>({
        open: false,
        refno: null,
        targetId: null,
        label: '',
    });
    const [products, setProducts] = useState<SpecialPriceProduct[]>([]);
    const [productMeta, setProductMeta] = useState<PaginationMeta>(createDefaultMeta());
    const [productsLoading, setProductsLoading] = useState(true);
    const [productSearch, setProductSearch] = useState('');
    const [productPage, setProductPage] = useState(1);
    const [productPerPage, setProductPerPage] = useState(20);
    const [createItemSession, setCreateItemSession] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<SpecialPriceProduct | null>(null);
    const [createType, setCreateType] = useState('Fix Amount');
    const [createAmount, setCreateAmount] = useState('');
    const [submittingCreate, setSubmittingCreate] = useState(false);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);
    const debouncedProductSearch = useDebounce(productSearch, 300);

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchSpecialPrices(debouncedListSearch, recordPage, recordPerPage);
            setRecords(result.items);
            setMeta(result.meta);
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to load special prices',
                description: error instanceof Error ? error.message : 'Unable to load special prices.',
                durationMs: 6000,
            });
        } finally {
            setLoading(false);
        }
    }, [addToast, debouncedListSearch, recordPage, recordPerPage]);

    const loadProducts = useCallback(async () => {
        setProductsLoading(true);
        try {
            const result = await fetchProducts(debouncedProductSearch, productPage, productPerPage);
            setProducts(result.items);
            setProductMeta(result.meta);
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to load products',
                description: error instanceof Error ? error.message : 'Unable to load products.',
                durationMs: 6000,
            });
        } finally {
            setProductsLoading(false);
        }
    }, [addToast, debouncedProductSearch, productPage, productPerPage]);

    const loadDetail = useCallback(
        async (refno: string) => {
            setDetailLoading(true);
            try {
                const result = await fetchSpecialPriceDetail(refno);
                setDetail(result);
                setEditType(result.type || 'Fix Amount');
                setEditAmount(String(result.amount ?? ''));
            } catch (error) {
                addToast({
                    type: 'error',
                    title: 'Unable to load special price details',
                    description: error instanceof Error ? error.message : 'Unable to load details.',
                    durationMs: 6000,
                });
            } finally {
                setDetailLoading(false);
            }
        },
        [addToast]
    );

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    useEffect(() => {
        setRecordPage(1);
    }, [debouncedListSearch]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useEffect(() => {
        setProductPage(1);
    }, [debouncedProductSearch]);

    useEffect(() => {
        if (!selectedRefno) {
            setDetail(null);
            setEditType('Fix Amount');
            setEditAmount('');
            return;
        }

        loadDetail(selectedRefno);
    }, [loadDetail, selectedRefno]);

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!createItemSession || createAmount.trim() === '') return;

        setSubmittingCreate(true);
        try {
            const created = await createSpecialPrice(createItemSession, createType, Number(createAmount));
            addToast({
                type: 'success',
                title: 'Special price created',
                description: 'Special price has been created successfully.',
                durationMs: 4000,
            });
            setCreateItemSession('');
            setSelectedProduct(null);
            setCreateType('Fix Amount');
            setCreateAmount('');
            await loadRecords();
            setSelectedRefno(created.refno);
            setDetail(created);
            setEditType(created.type || 'Fix Amount');
            setEditAmount(String(created.amount ?? ''));
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to create special price',
                description: error instanceof Error ? error.message : 'Unable to create special price.',
                durationMs: 6000,
            });
        } finally {
            setSubmittingCreate(false);
        }
    };

    const handleUpdate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedRefno || editAmount.trim() === '') return;

        setSubmittingUpdate(true);
        try {
            const updated = await updateSpecialPrice(selectedRefno, editType, Number(editAmount));
            setDetail(updated);
            setEditType(updated.type || 'Fix Amount');
            setEditAmount(String(updated.amount ?? ''));
            await loadRecords();
            addToast({
                type: 'success',
                title: 'Special price updated',
                description: 'Special price has been updated successfully.',
                durationMs: 4000,
            });
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Unable to update special price',
                description: error instanceof Error ? error.message : 'Unable to update special price.',
                durationMs: 6000,
            });
        } finally {
            setSubmittingUpdate(false);
        }
    };

    const refreshDetail = useCallback(async () => {
        if (!selectedRefno) return;
        await loadDetail(selectedRefno);
        await loadRecords();
    }, [loadDetail, loadRecords, selectedRefno]);

    const handleSelectProduct = (product: SpecialPriceProduct) => {
        setCreateItemSession(product.lsession);
        setSelectedProduct(product);
    };

    const customerRows = detail?.customers ?? [];
    const areaRows = detail?.areas ?? [];
    const categoryRows = detail?.categories ?? [];

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 overflow-auto">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 min-h-full">
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SPECIAL PRICE</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {selectedRefno ? 'Edit existing special price details' : 'Create a new special price record'}
                            </p>
                        </div>
                        {selectedRefno ? (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRefno(null)}
                                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                                >
                                    <ArrowLeft size={18} />
                                    Add New
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete({ open: true, refno: selectedRefno })}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    Delete
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="p-6 space-y-6">
                        {selectedRefno === null ? (
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Database</label>
                                        <div className="mt-1 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                                            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input
                                                        type="text"
                                                        value={productSearch}
                                                        onChange={(event) => setProductSearch(event.target.value)}
                                                        placeholder="Search products by code, part no, or description..."
                                                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-72 overflow-auto">
                                                <table className="w-full">
                                                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Item Code</th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Part No</th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                        {productsLoading ? (
                                                            <tr>
                                                                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                                                                    Loading products...
                                                                </td>
                                                            </tr>
                                                        ) : products.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                                                                    No products found
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            products.map((product) => (
                                                                <tr
                                                                    key={product.lsession}
                                                                    onClick={() => handleSelectProduct(product)}
                                                                    className={`cursor-pointer transition-colors ${
                                                                        createItemSession === product.lsession
                                                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                                    }`}
                                                                >
                                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{product.litemcode || '-'}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{product.lpartno || '-'}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{product.ldescription || '-'}</td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <PaginationControls
                                                meta={productMeta}
                                                perPage={productPerPage}
                                                perPageOptions={PRODUCT_PER_PAGE_OPTIONS}
                                                onPageChange={setProductPage}
                                                onPerPageChange={(value) => {
                                                    setProductPerPage(value);
                                                    setProductPage(1);
                                                }}
                                                disabled={productsLoading}
                                            />
                                        </div>
                                        {selectedProduct ? (
                                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                <div>Part No: {selectedProduct.lpartno || '-'}</div>
                                                <div>Description: {selectedProduct.ldescription || '-'}</div>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                                            <select
                                                value={createType}
                                                onChange={(event) => setCreateType(event.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                                            >
                                                {PRICE_TYPES.map((type) => (
                                                    <option key={type} value={type}>
                                                        {type}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                                            <input
                                                required
                                                type="number"
                                                step="0.01"
                                                value={createAmount}
                                                onChange={(event) => setCreateAmount(event.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submittingCreate || productsLoading}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Plus size={18} />
                                        {submittingCreate ? 'Saving...' : 'Submit'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Item Code</div>
                                        <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">{detail?.item_code || '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Part No</div>
                                        <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">{detail?.part_no || '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</div>
                                        <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">{detail?.description || '-'}</div>
                                    </div>
                                </div>

                                <form onSubmit={handleUpdate} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                                            <select
                                                value={editType}
                                                onChange={(event) => setEditType(event.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                                                disabled={detailLoading}
                                            >
                                                {PRICE_TYPES.map((type) => (
                                                    <option key={type} value={type}>
                                                        {type}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editAmount}
                                                onChange={(event) => setEditAmount(event.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white"
                                                disabled={detailLoading}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            type="submit"
                                            disabled={submittingUpdate || detailLoading}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                                        >
                                            {submittingUpdate ? 'Saving...' : 'Update Changes'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAddCustomerOpen(true)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                        >
                                            Add Customer
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAddAreaOpen(true)}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                                        >
                                            Add Area
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAddCategoryOpen(true)}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                                        >
                                            Add Category
                                        </button>
                                    </div>
                                </form>

                                <DetailTableSection
                                    title="Customers"
                                    columns={['', 'Customer Code', 'Customer Name']}
                                    loading={detailLoading}
                                    emptyMessage="No customers found"
                                >
                                    {customerRows.map((customer: SpecialPriceCustomer) => (
                                        <tr key={`${customer.patient_refno}-${customer.patient_code}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 text-sm">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setConfirmRemoveCustomer({
                                                            open: true,
                                                            refno: selectedRefno,
                                                            targetId: customer.patient_refno,
                                                            label: customer.company || customer.patient_code,
                                                        })
                                                    }
                                                    className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{customer.patient_code || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{customer.company || '-'}</td>
                                        </tr>
                                    ))}
                                </DetailTableSection>

                                <DetailTableSection
                                    title="Areas"
                                    columns={['', 'Area Code', 'Area Name']}
                                    loading={detailLoading}
                                    emptyMessage="No areas found"
                                >
                                    {areaRows.map((area: SpecialPriceArea) => (
                                        <tr key={`${area.area_code}-${area.area_name}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 text-sm">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setConfirmRemoveArea({
                                                            open: true,
                                                            refno: selectedRefno,
                                                            targetId: area.area_code,
                                                            label: area.area_name || area.area_code,
                                                        })
                                                    }
                                                    className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{area.area_code || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{area.area_name || '-'}</td>
                                        </tr>
                                    ))}
                                </DetailTableSection>

                                <DetailTableSection
                                    title="Categories"
                                    columns={['', 'Category Name']}
                                    loading={detailLoading}
                                    emptyMessage="No categories found"
                                >
                                    {categoryRows.map((category: SpecialPriceCategory) => (
                                        <tr key={`${category.category_id}-${category.name}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 text-sm">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setConfirmRemoveCategory({
                                                            open: true,
                                                            refno: selectedRefno,
                                                            targetId: category.category_id,
                                                            label: category.name,
                                                        })
                                                    }
                                                    className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{category.name || '-'}</td>
                                        </tr>
                                    ))}
                                </DetailTableSection>
                            </div>
                        )}
                    </div>
                </section>

                <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col min-h-[520px]">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">RECORD LIST</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {meta.total > 0 ? `${meta.total} record(s) found` : 'Browse available special price records'}
                        </p>
                    </div>
                    <div className="p-6 flex-1 overflow-hidden flex flex-col">
                        <div className="mb-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search records..."
                                value={listSearch}
                                onChange={(event) => setListSearch(event.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-x-auto overflow-y-auto flex-1">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Item Code
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Type
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Fixed Amount
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                                    Loading...
                                                </td>
                                            </tr>
                                        ) : records.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                                    No records found
                                                </td>
                                            </tr>
                                        ) : (
                                            records.map((record: SpecialPriceRecord) => (
                                                <tr
                                                    key={record.refno}
                                                    onClick={() => setSelectedRefno(record.refno)}
                                                    className={`cursor-pointer transition-colors ${
                                                        selectedRefno === record.refno
                                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                    }`}
                                                >
                                                    <td className="px-6 py-4 text-sm">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setSelectedRefno(record.refno);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                                        >
                                                            {record.item_code || '-'}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{record.type || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{formatAmount(record.amount)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls
                                meta={meta}
                                perPage={recordPerPage}
                                perPageOptions={RECORDS_PER_PAGE_OPTIONS}
                                onPageChange={setRecordPage}
                                onPerPageChange={(value) => {
                                    setRecordPerPage(value);
                                    setRecordPage(1);
                                }}
                                disabled={loading}
                            />
                        </div>
                    </div>
                </section>
            </div>

            <AddCustomerModal
                isOpen={addCustomerOpen}
                refno={selectedRefno}
                onClose={() => setAddCustomerOpen(false)}
                onAdded={refreshDetail}
            />
            <AddAreaModal
                isOpen={addAreaOpen}
                refno={selectedRefno}
                onClose={() => setAddAreaOpen(false)}
                onAdded={refreshDetail}
            />
            <AddCategoryModal
                isOpen={addCategoryOpen}
                refno={selectedRefno}
                onClose={() => setAddCategoryOpen(false)}
                onAdded={refreshDetail}
            />

            <ConfirmModal
                isOpen={confirmDelete.open}
                onClose={() => setConfirmDelete({ open: false, refno: null })}
                onConfirm={async () => {
                    if (!confirmDelete.refno) return;

                    try {
                        await deleteSpecialPrice(confirmDelete.refno);
                        addToast({
                            type: 'success',
                            title: 'Special price deleted',
                            description: 'Special price has been deleted successfully.',
                            durationMs: 4000,
                        });
                        setSelectedRefno(null);
                        setDetail(null);
                        await loadRecords();
                    } catch (error) {
                        addToast({
                            type: 'error',
                            title: 'Unable to delete special price',
                            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                            durationMs: 6000,
                        });
                    }
                }}
                title="Delete special price?"
                message="This will remove the selected special price record and its related entries."
                confirmLabel="Delete"
                variant="danger"
            />

            <ConfirmModal
                isOpen={confirmRemoveCustomer.open}
                onClose={() =>
                    setConfirmRemoveCustomer({
                        open: false,
                        refno: null,
                        targetId: null,
                        label: '',
                    })
                }
                onConfirm={async () => {
                    if (!confirmRemoveCustomer.refno || !confirmRemoveCustomer.targetId) return;

                    try {
                        await removeCustomer(confirmRemoveCustomer.refno, confirmRemoveCustomer.targetId);
                        addToast({
                            type: 'success',
                            title: 'Customer removed',
                            description: 'Customer has been removed successfully.',
                            durationMs: 4000,
                        });
                        await refreshDetail();
                    } catch (error) {
                        addToast({
                            type: 'error',
                            title: 'Unable to remove customer',
                            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                            durationMs: 6000,
                        });
                    }
                }}
                title="Remove customer?"
                message={`Remove ${confirmRemoveCustomer.label || 'this customer'} from the special price list?`}
                confirmLabel="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={confirmRemoveArea.open}
                onClose={() =>
                    setConfirmRemoveArea({
                        open: false,
                        refno: null,
                        targetId: null,
                        label: '',
                    })
                }
                onConfirm={async () => {
                    if (!confirmRemoveArea.refno || !confirmRemoveArea.targetId) return;

                    try {
                        await removeArea(confirmRemoveArea.refno, confirmRemoveArea.targetId);
                        addToast({
                            type: 'success',
                            title: 'Area removed',
                            description: 'Area has been removed successfully.',
                            durationMs: 4000,
                        });
                        await refreshDetail();
                    } catch (error) {
                        addToast({
                            type: 'error',
                            title: 'Unable to remove area',
                            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                            durationMs: 6000,
                        });
                    }
                }}
                title="Remove area?"
                message={`Remove ${confirmRemoveArea.label || 'this area'} from the special price list?`}
                confirmLabel="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={confirmRemoveCategory.open}
                onClose={() =>
                    setConfirmRemoveCategory({
                        open: false,
                        refno: null,
                        targetId: null,
                        label: '',
                    })
                }
                onConfirm={async () => {
                    if (!confirmRemoveCategory.refno || !confirmRemoveCategory.targetId) return;

                    try {
                        await removeCategory(confirmRemoveCategory.refno, confirmRemoveCategory.targetId);
                        addToast({
                            type: 'success',
                            title: 'Category removed',
                            description: 'Category has been removed successfully.',
                            durationMs: 4000,
                        });
                        await refreshDetail();
                    } catch (error) {
                        addToast({
                            type: 'error',
                            title: 'Unable to remove category',
                            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
                            durationMs: 6000,
                        });
                    }
                }}
                title="Remove category?"
                message={`Remove ${confirmRemoveCategory.label || 'this category'} from the special price list?`}
                confirmLabel="Remove"
                variant="danger"
            />
        </div>
    );
}
