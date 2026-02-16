import React, { useState, useEffect } from 'react';
import {
    X,
    ExternalLink,
    Check,
    XCircle,
    Image as ImageIcon,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Package,
    Calendar,
    Users,
} from 'lucide-react';
import {
    Promotion,
    PromotionPosting,
    UserProfile,
    PostingStatus,
} from '../types';
import * as promotionService from '../services/promotionService';
import { subscribeToPromotionPostings } from '../services/promotionRealtimeService';

interface Props {
    promotion: Promotion;
    currentUser: UserProfile | null;
    onClose: () => void;
    onProofUpdated: () => void;
}

type TabType = 'overview' | 'proofs' | 'performance';

const PromotionDetailsModal: React.FC<Props> = ({
    promotion,
    currentUser,
    onClose,
    onProofUpdated,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [postings, setPostings] = useState<PromotionPosting[]>(promotion.postings || []);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    // Real-time subscription for postings
    useEffect(() => {
        const unsubscribe = subscribeToPromotionPostings(promotion.id, {
            onUpdate: (posting) => {
                setPostings((prev) =>
                    prev.map((p) => (p.id === posting.id ? { ...p, ...posting } : p))
                );
                onProofUpdated();
            },
            onInsert: (posting) => {
                setPostings((prev) => [...prev, posting]);
                onProofUpdated();
            },
        });

        return () => unsubscribe();
    }, [promotion.id, onProofUpdated]);

    const handleApprove = async (postingId: string) => {
        if (!currentUser) return;
        setProcessing(postingId);
        try {
            await promotionService.approveProof(postingId, currentUser.id);
            onProofUpdated();
        } catch (error) {
            console.error('Error approving proof:', error);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (postingId: string) => {
        if (!currentUser || !rejectReason.trim()) {
            alert('Please provide a rejection reason');
            return;
        }
        setProcessing(postingId);
        try {
            await promotionService.rejectProof(postingId, currentUser.id, rejectReason.trim());
            setRejectingId(null);
            setRejectReason('');
            onProofUpdated();
        } catch (error) {
            console.error('Error rejecting proof:', error);
        } finally {
            setProcessing(null);
        }
    };

    const getStatusBadge = (status: PostingStatus) => {
        switch (status) {
            case 'Approved':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                );
            case 'Pending Review':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                        <Clock className="w-3 h-3" /> Pending Review
                    </span>
                );
            case 'Rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-medium rounded-full">
                        <XCircle className="w-3 h-3" /> Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Not Posted
                    </span>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {promotion.campaign_title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800 -mb-4">
                        {(['overview', 'proofs', 'performance'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                        ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                                        : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                        Campaign Period
                                    </h4>
                                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        {promotion.start_date
                                            ? new Date(promotion.start_date).toLocaleDateString()
                                            : 'Immediate'}{' '}
                                        - {new Date(promotion.end_date).toLocaleDateString()}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                        Status
                                    </h4>
                                    <span
                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${promotion.status === 'Active'
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : promotion.status === 'Draft'
                                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                            }`}
                                    >
                                        {promotion.status}
                                    </span>
                                </div>
                            </div>

                            {promotion.description && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                        Description
                                    </h4>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                        {promotion.description}
                                    </p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Target Platforms
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {promotion.target_platforms.map((platform) => (
                                        <span
                                            key={platform}
                                            className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm"
                                        >
                                            {platform}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Products ({promotion.products?.length || 0})
                                </h4>
                                <div className="space-y-2">
                                    {promotion.products?.map((pp) => (
                                        <div
                                            key={pp.id}
                                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                                        >
                                            <Package className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                                {pp.product?.description || pp.product_id}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Assignment
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    {promotion.assigned_to.length === 0
                                        ? 'All Sales Persons'
                                        : `${promotion.assigned_to.length} Specific Staff`}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Proofs Tab */}
                    {activeTab === 'proofs' && (
                        <div className="space-y-4">
                            {postings.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                    No posting proofs yet
                                </div>
                            ) : (
                                postings.map((posting) => (
                                    <div
                                        key={posting.id}
                                        className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
                                    >
                                        {/* Thumbnail */}
                                        <div
                                            onClick={() => posting.screenshot_url && setSelectedImage(posting.screenshot_url)}
                                            className={`w-28 h-28 flex-shrink-0 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden ${posting.screenshot_url ? 'cursor-pointer' : ''
                                                }`}
                                        >
                                            {posting.screenshot_url ? (
                                                <img
                                                    src={posting.screenshot_url}
                                                    alt="Screenshot"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-slate-400" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-semibold text-slate-900 dark:text-white">
                                                    {posting.platform_name}
                                                </h4>
                                                {getStatusBadge(posting.status)}
                                            </div>

                                            {posting.posted_by && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                                    Posted by {posting.poster?.full_name || 'Unknown'} •{' '}
                                                    {new Date(posting.updated_at).toLocaleDateString()}
                                                </p>
                                            )}

                                            {posting.post_url && (
                                                <a
                                                    href={posting.post_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
                                                >
                                                    View Post <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}

                                            {posting.status === 'Rejected' && posting.rejection_reason && (
                                                <p className="text-sm text-rose-600 dark:text-rose-400 mt-2">
                                                    Reason: {posting.rejection_reason}
                                                </p>
                                            )}

                                            {/* Actions for pending */}
                                            {posting.status === 'Pending Review' && (
                                                <div className="flex gap-2 mt-3">
                                                    {rejectingId === posting.id ? (
                                                        <div className="flex gap-2 flex-1">
                                                            <input
                                                                type="text"
                                                                value={rejectReason}
                                                                onChange={(e) => setRejectReason(e.target.value)}
                                                                placeholder="Rejection reason..."
                                                                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                                            />
                                                            <button
                                                                onClick={() => handleReject(posting.id)}
                                                                disabled={processing === posting.id}
                                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setRejectingId(null);
                                                                    setRejectReason('');
                                                                }}
                                                                className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => posting.screenshot_url && setSelectedImage(posting.screenshot_url)}
                                                                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                            >
                                                                View Full Screenshot
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprove(posting.id)}
                                                                disabled={processing === posting.id}
                                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                                                            >
                                                                <Check className="w-4 h-4" /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => setRejectingId(posting.id)}
                                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                                                            >
                                                                <XCircle className="w-4 h-4" /> Reject
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Performance Tab */}
                    {activeTab === 'performance' && (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Performance tracking will show sales data for promoted products</p>
                            <p className="text-sm mt-1">during the campaign period</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Screenshot"
                        className="max-w-full max-h-full object-contain rounded-lg"
                    />
                </div>
            )}
        </div>
    );
};

export default PromotionDetailsModal;
