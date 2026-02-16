import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Search, Trash2, MapPin, Users } from 'lucide-react';
import { UserProfile, Product } from '../types';
import * as promotionService from '../services/promotionService';
import { supabase } from '../lib/supabaseClient';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

interface Props {
    currentUser: UserProfile | null;
    onClose: () => void;
    onCreated: () => void;
}

interface SelectedProduct {
    product: Product;
    promo_price_aa?: number;
    promo_price_bb?: number;
    promo_price_cc?: number;
    promo_price_dd?: number;
    promo_price_vip1?: number;
    promo_price_vip2?: number;
}

const CreatePromotionModal: React.FC<Props> = ({ currentUser, onClose, onCreated }) => {
    const { addToast } = useToast();
    // Form state
    const [campaignTitle, setCampaignTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [assignTo, setAssignTo] = useState<'all' | 'specific'>('all');
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [platforms, setPlatforms] = useState<string[]>([]);
    const [platformInput, setPlatformInput] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

    // UI state
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Client Targeting state
    const [targetAllClients, setTargetAllClients] = useState<'all' | 'specific'>('all');
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [clientList, setClientList] = useState<Array<{ id: string; company: string; city: string }>>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [citySearch, setCitySearch] = useState('');

    // Fetch products and staff
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch products
                const { data: productsData } = await supabase
                    .from('products')
                    .select('*')
                    .eq('status', 'Active')
                    .order('description');
                setProducts(productsData || []);

                // Fetch staff (sales agents)
                const { data: staffData } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .in('role', ['Sales Agent', 'sales_agent', 'Senior Agent'])
                    .order('full_name');
                setStaffList(staffData || []);

                // Fetch clients (contacts) for targeting
                const { data: contactsData } = await supabase
                    .from('contacts')
                    .select('id, company, city')
                    .eq('is_deleted', false)
                    .order('company');
                setClientList(contactsData || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Get unique cities from client list
    const availableCities = useMemo(() => {
        const cities = new Set(clientList.map(c => c.city).filter(Boolean));
        return Array.from(cities).sort();
    }, [clientList]);

    // Filter clients for search
    const filteredClients = useMemo(() => {
        return clientList.filter(c =>
            c.company?.toLowerCase().includes(clientSearch.toLowerCase()) ||
            c.city?.toLowerCase().includes(clientSearch.toLowerCase())
        );
    }, [clientList, clientSearch]);

    // Filter cities for search
    const filteredCities = useMemo(() => {
        return availableCities.filter(c =>
            c.toLowerCase().includes(citySearch.toLowerCase())
        );
    }, [availableCities, citySearch]);

    const handleAddPlatform = () => {
        if (platformInput.trim() && !platforms.includes(platformInput.trim())) {
            setPlatforms([...platforms, platformInput.trim()]);
            setPlatformInput('');
        }
    };

    const handleRemovePlatform = (platform: string) => {
        setPlatforms(platforms.filter((p) => p !== platform));
    };

    const handleAddProduct = (product: Product) => {
        if (!selectedProducts.find((sp) => sp.product.id === product.id)) {
            setSelectedProducts([
                ...selectedProducts,
                {
                    product,
                    promo_price_aa: product.price_aa,
                    promo_price_bb: product.price_bb,
                    promo_price_cc: product.price_cc,
                    promo_price_dd: product.price_dd,
                    promo_price_vip1: product.price_vip1,
                    promo_price_vip2: product.price_vip2,
                },
            ]);
        }
        setShowProductPicker(false);
        setProductSearch('');
    };

    const handleRemoveProduct = (productId: string) => {
        setSelectedProducts(selectedProducts.filter((sp) => sp.product.id !== productId));
    };

    const handleProductPriceChange = (
        productId: string,
        tier: string,
        value: number | undefined
    ) => {
        setSelectedProducts(
            selectedProducts.map((sp) =>
                sp.product.id === productId ? { ...sp, [tier]: value } : sp
            )
        );
    };

    const handleSubmit = async () => {
        if (!campaignTitle.trim()) {
            alert('Campaign title is required');
            return;
        }
        if (!endDate) {
            alert('End date is required');
            return;
        }
        if (selectedProducts.length === 0) {
            alert('At least one product is required');
            return;
        }
        if (platforms.length === 0) {
            alert('At least one platform is required');
            return;
        }

        setSaving(true);
        try {
            await promotionService.createPromotion(
                {
                    campaign_title: campaignTitle.trim(),
                    description: description.trim() || undefined,
                    start_date: startDate || undefined,
                    end_date: endDate,
                    assigned_to: assignTo === 'all' ? [] : selectedStaff,
                    target_platforms: platforms,
                    // Client targeting
                    target_all_clients: targetAllClients === 'all',
                    target_client_ids: targetAllClients === 'specific' ? selectedClients : [],
                    target_cities: selectedCities,
                    products: selectedProducts.map((sp) => ({
                        product_id: sp.product.id,
                        promo_price_aa: sp.promo_price_aa,
                        promo_price_bb: sp.promo_price_bb,
                        promo_price_cc: sp.promo_price_cc,
                        promo_price_dd: sp.promo_price_dd,
                        promo_price_vip1: sp.promo_price_vip1,
                        promo_price_vip2: sp.promo_price_vip2,
                    })),
                },
                currentUser?.id || ''
            );
            addToast({
                type: 'success',
                title: 'Promotion created',
                description: 'Promotion has been created successfully.',
                durationMs: 4000,
            });
            onCreated();
        } catch (error) {
            console.error('Error creating promotion:', error);
            addToast({
                type: 'error',
                title: 'Unable to create promotion',
                description: parseSupabaseError(error, 'promotion'),
                durationMs: 6000,
            });
        } finally {
            setSaving(false);
        }
    };

    const filteredProducts = products.filter(
        (p) =>
            p.description?.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.item_code?.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.part_no?.toLowerCase().includes(productSearch.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Campaign</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Campaign Details */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                            Campaign Details
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Campaign Title *
                                </label>
                                <input
                                    type="text"
                                    value={campaignTitle}
                                    onChange={(e) => setCampaignTitle(e.target.value)}
                                    placeholder="e.g., Summer Sale 2024"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Description / Notes
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Internal notes about this promotion..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Start Date (Optional)
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products & Pricing */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                            Products & Pricing
                        </h3>
                        <button
                            onClick={() => setShowProductPicker(true)}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Products
                        </button>

                        {selectedProducts.length > 0 && (
                            <div className="mt-4 space-y-3">
                                {selectedProducts.map((sp) => (
                                    <div
                                        key={sp.product.id}
                                        className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="font-medium text-sm text-slate-900 dark:text-white">
                                                {sp.product.description} ({sp.product.item_code})
                                            </span>
                                            <button
                                                onClick={() => handleRemoveProduct(sp.product.id)}
                                                className="text-sm text-rose-500 hover:text-rose-700"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-6 gap-2">
                                            {(['promo_price_aa', 'promo_price_bb', 'promo_price_cc', 'promo_price_dd', 'promo_price_vip1', 'promo_price_vip2'] as const).map((tier) => (
                                                <div key={tier}>
                                                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                                        {tier.replace('promo_price_', '').toUpperCase()}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={sp[tier] || ''}
                                                        onChange={(e) =>
                                                            handleProductPriceChange(
                                                                sp.product.id,
                                                                tier,
                                                                e.target.value ? parseFloat(e.target.value) : undefined
                                                            )
                                                        }
                                                        placeholder="₱"
                                                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-xs text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Target Platforms */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                            Target Platforms
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={platformInput}
                                onChange={(e) => setPlatformInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPlatform()}
                                placeholder="Enter platform name"
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleAddPlatform}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Add
                            </button>
                        </div>
                        {platforms.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {platforms.map((platform) => (
                                    <span
                                        key={platform}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm"
                                    >
                                        {platform}
                                        <button
                                            onClick={() => handleRemovePlatform(platform)}
                                            className="hover:text-blue-900 dark:hover:text-blue-200"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Client Targeting */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Client Targeting
                        </h3>

                        {/* All or Specific Clients */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Apply To
                            </label>
                            <select
                                value={targetAllClients}
                                onChange={(e) => setTargetAllClients(e.target.value as 'all' | 'specific')}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">All Clients</option>
                                <option value="specific">Selected Clients Only</option>
                            </select>
                        </div>

                        {/* Specific Client Selection */}
                        {targetAllClients === 'specific' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Select Clients ({selectedClients.length} selected)
                                </label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                        placeholder="Search clients..."
                                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                                    {filteredClients.slice(0, 50).map((client) => (
                                        <label key={client.id} className="flex items-center gap-2 py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedClients.includes(client.id)}
                                                onChange={(e) =>
                                                    setSelectedClients(
                                                        e.target.checked
                                                            ? [...selectedClients, client.id]
                                                            : selectedClients.filter((id) => id !== client.id)
                                                    )
                                                }
                                                className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">
                                                {client.company}
                                            </span>
                                            {client.city && (
                                                <span className="text-xs text-slate-400">{client.city}</span>
                                            )}
                                        </label>
                                    ))}
                                    {filteredClients.length === 0 && (
                                        <p className="text-xs text-slate-400 text-center py-2">No clients found</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* City Filter */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                City Filter (Optional)
                            </label>
                            <div className="relative mb-2">
                                <input
                                    type="text"
                                    value={citySearch}
                                    onChange={(e) => setCitySearch(e.target.value)}
                                    placeholder="Search cities..."
                                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedCities.map((city) => (
                                    <span
                                        key={city}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs"
                                    >
                                        {city}
                                        <button
                                            onClick={() => setSelectedCities(selectedCities.filter((c) => c !== city))}
                                            className="hover:text-emerald-900 dark:hover:text-emerald-200"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                                {filteredCities.slice(0, 30).map((city) => (
                                    <button
                                        key={city}
                                        onClick={() => {
                                            if (!selectedCities.includes(city)) {
                                                setSelectedCities([...selectedCities, city]);
                                            }
                                        }}
                                        disabled={selectedCities.includes(city)}
                                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {city}
                                    </button>
                                ))}
                                {filteredCities.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center w-full py-1">No cities found</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Assignment */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                            Assignment
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Assign To
                            </label>
                            <select
                                value={assignTo}
                                onChange={(e) => setAssignTo(e.target.value as 'all' | 'specific')}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">All Sales Persons</option>
                                <option value="specific">Select Specific Staff</option>
                            </select>
                        </div>
                        {assignTo === 'specific' && (
                            <div className="mt-3 space-y-2">
                                {staffList.map((staff) => (
                                    <label key={staff.id} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedStaff.includes(staff.id)}
                                            onChange={(e) =>
                                                setSelectedStaff(
                                                    e.target.checked
                                                        ? [...selectedStaff, staff.id]
                                                        : selectedStaff.filter((id) => id !== staff.id)
                                                )
                                            }
                                            className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            {staff.full_name || staff.email}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Creating...' : 'Create Campaign'}
                    </button>
                </div>
            </div>

            {/* Product Picker Modal */}
            {showProductPicker && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="font-semibold text-slate-900 dark:text-white">Select Product</h3>
                            <button
                                onClick={() => {
                                    setShowProductPicker(false);
                                    setProductSearch('');
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {filteredProducts.slice(0, 50).map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleAddProduct(product)}
                                    disabled={!!selectedProducts.find((sp) => sp.product.id === product.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                                        {product.description}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {product.item_code} • {product.brand}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatePromotionModal;
