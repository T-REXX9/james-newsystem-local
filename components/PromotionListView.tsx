import React, { useState, useEffect, useCallback } from 'react';
import {
    Tag,
    Search,
    Calendar,
    Package,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Upload,
    RefreshCw,
    Filter,
} from 'lucide-react';
import {
    Promotion,
    PromotionPosting,
    UserProfile,
    PostingStatus,
} from '../types';
import * as promotionService from '../services/promotionService';
import { subscribeToPromotions, subscribeToPromotionPostings } from '../services/promotionRealtimeService';
import UploadProofModal from './UploadProofModal';

interface Props {
    currentUser: UserProfile | null;
}

type FilterType = 'all' | 'active' | 'pending';

const PromotionListView: React.FC<Props> = ({ currentUser }) => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('active');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [uploadingPosting, setUploadingPosting] = useState<{
        posting: PromotionPosting;
        promotionTitle: string;
    } | null>(null);

    // Fetch promotions assigned to current user
    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const data = await promotionService.getAssignedPromotions(currentUser.id);
            setPromotions(data);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchData();

        // Real-time subscriptions
        const unsubPromo = subscribeToPromotions({
            onUpdate: () => fetchData(),
            onInsert: () => fetchData(),
        });

        const unsubPosting = subscribeToPromotionPostings(null, {
            onUpdate: () => fetchData(),
        });

        return () => {
            unsubPromo();
            unsubPosting();
        };
    }, [fetchData]);

    // Filter promotions
    const filteredPromotions = promotions.filter((p) => {
        // Filter by status
        if (filter === 'active' && p.status !== 'Active') return false;
        if (filter === 'pending') {
            const hasPendingOrNotPosted = p.postings?.some(
                (post) => post.status === 'Not Posted' || post.status === 'Rejected'
            );
            if (!hasPendingOrNotPosted) return false;
        }

        // Search
        if (searchQuery) {
            return p.campaign_title.toLowerCase().includes(searchQuery.toLowerCase());
        }

        return true;
    });

    // Get status badge
    const getPostingStatusBadge = (status: PostingStatus) => {
        switch (status) {
            case 'Approved':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                );
            case 'Pending Review':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                        <Clock className="w-3 h-3" /> Pending
                    </span>
                );
            case 'Rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-medium rounded-full">
                        <XCircle className="w-3 h-3" /> Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Not Posted
                    </span>
                );
        }
    };

    // Calculate days until expiry
    const getDaysUntilExpiry = (endDate: string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const handleUploadClick = (posting: PromotionPosting, promotionTitle: string) => {
        setUploadingPosting({ posting, promotionTitle });
    };

    const handleUploadComplete = () => {
        setUploadingPosting(null);
        fetchData();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Campaigns</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    View assigned campaigns and upload Product Promotion proof of posting
                </p>
            </div>

            {/* Filters and Search */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex gap-2">
                    {(['active', 'pending', 'all'] as FilterType[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            {f === 'active' && 'Active'}
                            {f === 'pending' && 'Needs Action'}
                            {f === 'all' && 'All'}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Promotions List */}
            <div className="flex-1 overflow-y-auto space-y-4">
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
                        const daysLeft = getDaysUntilExpiry(promotion.end_date);
                        const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;

                        return (
                            <div
                                key={promotion.id}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5"
                            >
                                {/* Promotion Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                                {promotion.campaign_title}
                                            </h3>
                                            {isExpiringSoon && (
                                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                                                    {daysLeft} days left
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Ends {new Date(promotion.end_date).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Package className="w-3.5 h-3.5" />
                                                {promotion.products?.length || 0} Products
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${promotion.status === 'Active'
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                    >
                                        {promotion.status}
                                    </span>
                                </div>

                                {/* Platform Postings */}
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Platform Postings
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {promotion.postings?.map((posting) => (
                                        <div
                                            key={posting.id}
                                            className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                                        >
                                            <div>
                                                <div className="font-medium text-sm text-slate-900 dark:text-white mb-1">
                                                    {posting.platform_name}
                                                </div>
                                                {getPostingStatusBadge(posting.status)}
                                                {posting.status === 'Rejected' && posting.rejection_reason && (
                                                    <p className="text-xs text-rose-500 mt-1 line-clamp-1">
                                                        {posting.rejection_reason}
                                                    </p>
                                                )}
                                            </div>

                                            {(posting.status === 'Not Posted' || posting.status === 'Rejected') && (
                                                <button
                                                    onClick={() => handleUploadClick(posting, promotion.campaign_title)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    {posting.status === 'Rejected' ? 'Re-upload' : 'Upload'}
                                                </button>
                                            )}

                                            {posting.status === 'Approved' && posting.screenshot_url && (
                                                <a
                                                    href={posting.screenshot_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    View Proof
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Upload Proof Modal */}
            {uploadingPosting && currentUser && (
                <UploadProofModal
                    posting={uploadingPosting.posting}
                    promotionTitle={uploadingPosting.promotionTitle}
                    currentUser={currentUser}
                    onClose={() => setUploadingPosting(null)}
                    onUploaded={handleUploadComplete}
                />
            )}
        </div>
    );
};

export default PromotionListView;
