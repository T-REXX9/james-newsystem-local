import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Search,
    Calendar,
    Package,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Eye,
    Edit2,
    Trash2,
    MoreHorizontal,
    Tag,
    RefreshCw,
    X,
} from 'lucide-react';
import {
    Promotion,
    PromotionStats,
    UserProfile,
    PromotionStatus,
} from '../types';
import * as promotionService from '../services/promotionService';
import { subscribeToPromotions } from '../services/promotionRealtimeService';
import CreatePromotionModal from './CreatePromotionModal';
import PromotionDetailsModal from './PromotionDetailsModal';
import ExtendPromotionModal from './ExtendPromotionModal';

interface Props {
    currentUser: UserProfile | null;
}

type TabType = 'active' | 'expired' | 'pending';

const PromotionManagementView: React.FC<Props> = ({ currentUser }) => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [stats, setStats] = useState<PromotionStats>({
        total_active: 0,
        pending_reviews: 0,
        expiring_soon: 0,
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState(false);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, promotionsData] = await Promise.all([
                promotionService.getPromotionStats(),
                promotionService.getAllPromotions(),
            ]);
            setStats(statsData);
            setPromotions(promotionsData);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Real-time subscription
        const unsubscribe = subscribeToPromotions({
            onInsert: (promotion) => {
                setPromotions((prev) => [promotion, ...prev]);
                fetchData(); // Refresh stats
            },
            onUpdate: (promotion) => {
                setPromotions((prev) =>
                    prev.map((p) => (p.id === promotion.id ? { ...p, ...promotion } : p))
                );
                fetchData(); // Refresh stats
            },
            onDelete: ({ id }) => {
                setPromotions((prev) => prev.filter((p) => p.id !== id));
                fetchData(); // Refresh stats
            },
        });

        return () => unsubscribe();
    }, [fetchData]);

    // Filter promotions based on tab and search
    const filteredPromotions = promotions.filter((p) => {
        // Tab filter
        if (activeTab === 'active' && p.status !== 'Active' && p.status !== 'Draft') return false;
        if (activeTab === 'expired' && p.status !== 'Expired') return false;
        if (activeTab === 'pending') {
            const hasPending = p.postings?.some((post) => post.status === 'Pending Review');
            if (!hasPending) return false;
        }

        // Search filter
        if (searchQuery) {
            return p.campaign_title.toLowerCase().includes(searchQuery.toLowerCase());
        }

        return true;
    });

    // Get posting status summary
    const getPostingStatusSummary = (promotion: Promotion) => {
        const postings = promotion.postings || [];
        if (postings.length === 0) return null;

        const approved = postings.filter((p) => p.status === 'Approved').length;
        const total = postings.length;

        return { approved, total };
    };

    // Calculate days until expiration
    const getDaysUntilExpiry = (endDate: string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const handleViewDetails = async (promotion: Promotion) => {
        // Fetch full promotion with relations
        const fullPromotion = await promotionService.getPromotion(promotion.id);
        if (fullPromotion) {
            setSelectedPromotion(fullPromotion);
            setShowDetailsModal(true);
        }
    };

    const handleExtend = (promotion: Promotion) => {
        setSelectedPromotion(promotion);
        setShowExtendModal(true);
    };

    const handleDelete = async (promotion: Promotion) => {
        if (!confirm(`Are you sure you want to delete "${promotion.campaign_title}"?`)) return;

        const success = await promotionService.deletePromotion(promotion.id);
        if (success) {
            fetchData();
        }
    };

    const handlePromotionCreated = () => {
        setShowCreateModal(false);
        fetchData();
    };

    const handleProofUpdated = () => {
        fetchData();
        if (selectedPromotion) {
            // Refresh the selected promotion
            promotionService.getPromotion(selectedPromotion.id).then((updated) => {
                if (updated) setSelectedPromotion(updated);
            });
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marketing Campaign</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage promotional campaigns and track posting compliance
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Active Promotions
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total_active}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Currently running</div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Pending Reviews
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.pending_reviews}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Proofs awaiting approval</div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Expiring Soon
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.expiring_soon}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Within 7 days</div>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                {/* Tabs and Actions */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex gap-6">
                        {(['active', 'expired', 'pending'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${activeTab === tab
                                    ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                                    : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {tab === 'active' && 'Active'}
                                {tab === 'expired' && 'Expired'}
                                {tab === 'pending' && 'Pending Review'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search campaigns..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 w-64 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Campaign
                        </button>
                    </div>
                </div>

                {/* Promotions List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                        </div>
                    ) : filteredPromotions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400">
                            <Tag className="w-10 h-10 mb-2 opacity-50" />
                            <p>No campaigns found</p>
                        </div>
                    ) : (
                        filteredPromotions.map((promotion) => {
                            const postingStatus = getPostingStatusSummary(promotion);
                            const daysLeft = getDaysUntilExpiry(promotion.end_date);
                            const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;

                            return (
                                <div
                                    key={promotion.id}
                                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                                {promotion.campaign_title}
                                            </h3>
                                            {isExpiringSoon && (
                                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                                                    {daysLeft} days left
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(promotion.start_date || promotion.created_at).toLocaleDateString()} -{' '}
                                                {new Date(promotion.end_date).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Package className="w-3.5 h-3.5" />
                                                {promotion.products?.length || 0} Products
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${promotion.status === 'Active'
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                    : promotion.status === 'Draft'
                                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                        : promotion.status === 'Expired'
                                                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                                            : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                                    }`}
                                            >
                                                {promotion.status}
                                                {postingStatus && ` - ${postingStatus.approved}/${postingStatus.total} Posted`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewDetails(promotion)}
                                            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        {promotion.status === 'Active' && (
                                            <button
                                                onClick={() => handleExtend(promotion)}
                                                className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            >
                                                Extend
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(promotion)}
                                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modals */}
            {showCreateModal && (
                <CreatePromotionModal
                    currentUser={currentUser}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handlePromotionCreated}
                />
            )}

            {showDetailsModal && selectedPromotion && (
                <PromotionDetailsModal
                    promotion={selectedPromotion}
                    currentUser={currentUser}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedPromotion(null);
                    }}
                    onProofUpdated={handleProofUpdated}
                />
            )}

            {showExtendModal && selectedPromotion && (
                <ExtendPromotionModal
                    promotion={selectedPromotion}
                    onClose={() => {
                        setShowExtendModal(false);
                        setSelectedPromotion(null);
                    }}
                    onExtended={() => {
                        setShowExtendModal(false);
                        setSelectedPromotion(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

export default PromotionManagementView;
