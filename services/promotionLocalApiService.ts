import {
    Promotion,
    PromotionProduct,
    PromotionPosting,
    CreatePromotionDTO,
    UpdatePromotionDTO,
    PromotionFilters,
    PromotionStats,
    PromotionStatus,
    PostingStatus,
    NotificationType,
} from '../types';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

const parseApiErrorMessage = async (response: Response): Promise<string> => {
    try {
        const payload = await response.json();
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
    } catch {
        // Ignore JSON parse issues and fall back to status text.
    }

    return `API request failed (${response.status}${response.statusText ? `: ${response.statusText}` : ''})`;
};

// ============================================================================
// Promotion CRUD Operations
// ============================================================================

/**
 * Create a new promotion with products and postings
 */
export async function createPromotion(
    dto: CreatePromotionDTO,
    createdBy: string
): Promise<Promotion> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                campaign_title: dto.campaign_title,
                description: dto.description,
                start_date: dto.start_date,
                end_date: dto.end_date,
                status: !dto.start_date || new Date(dto.start_date) <= new Date() ? 'Active' : 'Draft',
                created_by: createdBy,
                assigned_to: dto.assigned_to,
                target_platforms: dto.target_platforms,
                target_all_clients: dto.target_all_clients ?? true,
                target_client_ids: dto.target_client_ids ?? [],
                target_cities: dto.target_cities ?? [],
                products: dto.products ?? [],
            }),
        });

        if (!response.ok) {
            throw new Error(await parseApiErrorMessage(response));
        }

        const result = await response.json();
        return (result.data || result) as Promotion;
    } catch (error) {
        console.error('Error creating promotion:', error);
        throw error;
    }
}

/**
 * Get a single promotion by ID
 */
export async function getPromotion(
    id: string,
    includeProducts = true,
    includePostings = true
): Promise<Promotion | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotions/${encodeURIComponent(id)}`);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error fetching promotion:', response.statusText);
            return null;
        }

        const rawPromotion = await response.json();
        let promotion = (rawPromotion.data || rawPromotion) as Promotion;

        // Load products if requested
        if (includeProducts) {
            const productsResponse = await fetch(
                `${API_BASE_URL}/promotions/${encodeURIComponent(id)}/products?per_page=500`
            );
            if (productsResponse.ok) {
                const productsResult = await productsResponse.json();
                const productsInner = productsResult.data || productsResult;
                (promotion as any).products = productsInner.data || productsInner || [];
            }
        }

        // Load postings if requested
        if (includePostings) {
            const postingsResponse = await fetch(
                `${API_BASE_URL}/promotions/${encodeURIComponent(id)}/postings?per_page=500`
            );
            if (postingsResponse.ok) {
                const postingsResult = await postingsResponse.json();
                const postingsInner = postingsResult.data || postingsResult;
                (promotion as any).postings = postingsInner.data || postingsInner || [];
            }
        }

        return promotion;
    } catch (error) {
        console.error('Error fetching promotion:', error);
        return null;
    }
}

/**
 * Get all promotions with optional filtering
 */
export async function getAllPromotions(
    filters?: PromotionFilters
): Promise<Promotion[]> {
    try {
        const params = new URLSearchParams({
            page: '1',
            per_page: '500',
        });

        if (filters?.status) {
            if (Array.isArray(filters.status)) {
                params.append('status', filters.status[0]);
            } else {
                params.append('status', filters.status);
            }
        }

        if (filters?.search) {
            params.append('search', filters.search);
        }

        const response = await fetch(`${API_BASE_URL}/promotions?${params}`);

        if (!response.ok) {
            console.error('Error fetching promotions:', response.statusText);
            return [];
        }

        const result = await response.json();
        // API Router wraps responses in { ok, data }, and listPromotions returns { data: [...], pagination }
        const inner = result.data || result;
        return (inner.data || inner || []) as Promotion[];
    } catch (error) {
        console.error('Error fetching promotions:', error);
        return [];
    }
}

/**
 * Update a promotion
 */
export async function updatePromotion(
    id: string,
    dto: UpdatePromotionDTO
): Promise<Promotion | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error updating promotion:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as Promotion;
    } catch (error) {
        console.error('Error updating promotion:', error);
        return null;
    }
}

/**
 * Delete a promotion (soft delete)
 */
export async function deletePromotion(id: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });

        if (response.status === 404) {
            return false;
        }

        return response.ok;
    } catch (error) {
        console.error('Error deleting promotion:', error);
        return false;
    }
}

/**
 * Get promotions by status
 */
export async function getPromotionsByStatus(
    status: PromotionStatus,
    limit = 100
): Promise<Promotion[]> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/status/${encodeURIComponent(status)}?limit=${limit}`
        );

        if (!response.ok) {
            console.error('Error fetching promotions by status:', response.statusText);
            return [];
        }

        const result = await response.json();
        const inner = result.data || result;
        return (inner.data || inner || []) as Promotion[];
    } catch (error) {
        console.error('Error fetching promotions by status:', error);
        return [];
    }
}

/**
 * Get active promotions
 */
export async function getActivePromotions(limit = 50): Promise<Promotion[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotions/active/list?limit=${limit}`);

        if (!response.ok) {
            console.error('Error fetching active promotions:', response.statusText);
            return [];
        }

        const result = await response.json();
        const inner = result.data || result;
        return (inner.data || inner || []) as Promotion[];
    } catch (error) {
        console.error('Error fetching active promotions:', error);
        return [];
    }
}

// ============================================================================
// Promotion Products
// ============================================================================

/**
 * Get products for a promotion
 */
export async function getPromotionProducts(
    promotionId: string,
    page = 1,
    perPage = 100
): Promise<{ data: PromotionProduct[]; pagination: any }> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(promotionId)}/products?page=${page}&per_page=${perPage}`
        );

        if (!response.ok) {
            console.error('Error fetching promotion products:', response.statusText);
            return { data: [], pagination: {} };
        }

        const result = await response.json();
        const inner = result.data || result;
        return { data: inner.data || [], pagination: inner.pagination || {} };
    } catch (error) {
        console.error('Error fetching promotion products:', error);
        return { data: [], pagination: {} };
    }
}

/**
 * Add product to promotion
 */
export async function addPromotionProduct(
    promotionId: string,
    product: Omit<PromotionProduct, 'id' | 'created_at'>
): Promise<PromotionProduct | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(promotionId)}/products`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product),
            }
        );

        if (!response.ok) {
            console.error('Error adding promotion product:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as PromotionProduct;
    } catch (error) {
        console.error('Error adding promotion product:', error);
        return null;
    }
}

/**
 * Update promotion product
 */
export async function updatePromotionProduct(
    productId: string,
    prices: Partial<PromotionProduct>
): Promise<PromotionProduct | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotion-products/${encodeURIComponent(productId)}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prices),
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error updating promotion product:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as PromotionProduct;
    } catch (error) {
        console.error('Error updating promotion product:', error);
        return null;
    }
}

/**
 * Delete promotion product
 */
export async function deletePromotionProduct(productId: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotion-products/${encodeURIComponent(productId)}`,
            { method: 'DELETE' }
        );

        if (response.status === 404) {
            return false;
        }

        return response.ok;
    } catch (error) {
        console.error('Error deleting promotion product:', error);
        return false;
    }
}

// ============================================================================
// Promotion Postings
// ============================================================================

/**
 * Get postings for a promotion
 */
export async function getPromotionPostings(
    promotionId: string,
    status = '',
    page = 1,
    perPage = 100
): Promise<{ data: PromotionPosting[]; pagination: any }> {
    try {
        const params = new URLSearchParams({
            page: String(page),
            per_page: String(perPage),
        });

        if (status) {
            params.append('status', status);
        }

        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(promotionId)}/postings?${params}`
        );

        if (!response.ok) {
            console.error('Error fetching promotion postings:', response.statusText);
            return { data: [], pagination: {} };
        }

        const result = await response.json();
        const inner = result.data || result;
        return { data: inner.data || [], pagination: inner.pagination || {} };
    } catch (error) {
        console.error('Error fetching promotion postings:', error);
        return { data: [], pagination: {} };
    }
}

/**
 * Create posting entry
 */
export async function createPromotionPosting(
    promotionId: string,
    posting: Omit<PromotionPosting, 'id' | 'created_at' | 'updated_at'>
): Promise<PromotionPosting | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(promotionId)}/postings`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(posting),
            }
        );

        if (!response.ok) {
            console.error('Error creating posting:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as PromotionPosting;
    } catch (error) {
        console.error('Error creating posting:', error);
        return null;
    }
}

/**
 * Update posting proof
 */
export async function updatePromotionPosting(
    postingId: string,
    updates: Partial<PromotionPosting>
): Promise<PromotionPosting | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotion-postings/${encodeURIComponent(postingId)}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error updating posting:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as PromotionPosting;
    } catch (error) {
        console.error('Error updating posting:', error);
        return null;
    }
}

/**
 * Review posting (approve or reject)
 */
export async function reviewPromotionPosting(
    postingId: string,
    status: PostingStatus,
    reviewedBy: string,
    rejectionReason = ''
): Promise<PromotionPosting | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotion-postings/${encodeURIComponent(postingId)}/review`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    reviewed_by: reviewedBy,
                    rejection_reason: rejectionReason,
                }),
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error reviewing posting:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as PromotionPosting;
    } catch (error) {
        console.error('Error reviewing posting:', error);
        return null;
    }
}

/**
 * Get postings pending review
 */
export async function getPendingReviewPostings(limit = 50): Promise<PromotionPosting[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotion-postings/review/pending?limit=${limit}`);

        if (!response.ok) {
            console.error('Error fetching pending postings:', response.statusText);
            return [];
        }

        const result = await response.json();
        const inner = result.data || result;
        return (Array.isArray(inner) ? inner : inner.data || []) as PromotionPosting[];
    } catch (error) {
        console.error('Error fetching pending postings:', error);
        return [];
    }
}

/**
 * Delete posting
 */
export async function deletePromotionPosting(postingId: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotion-postings/${encodeURIComponent(postingId)}`,
            { method: 'DELETE' }
        );

        if (response.status === 404) {
            return false;
        }

        return response.ok;
    } catch (error) {
        console.error('Error deleting posting:', error);
        return false;
    }
}

// ============================================================================
// Extended Operations (matching old promotionService signatures)
// ============================================================================

/**
 * Get promotion statistics for dashboard
 */
export async function getPromotionStats(): Promise<PromotionStats> {
    try {
        const response = await fetch(`${API_BASE_URL}/promotions/stats/summary`);

        if (!response.ok) {
            console.error('Error fetching promotion stats:', response.statusText);
            return { total_active: 0, pending_reviews: 0, expiring_soon: 0 };
        }

        const result = await response.json();
        return (result.data || result) as PromotionStats;
    } catch (error) {
        console.error('Error fetching promotion stats:', error);
        return { total_active: 0, pending_reviews: 0, expiring_soon: 0 };
    }
}

/**
 * Get promotions assigned to a specific user or all sales persons
 */
export async function getAssignedPromotions(userId: string): Promise<Promotion[]> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/assigned/list?user_id=${encodeURIComponent(userId)}`
        );

        if (!response.ok) {
            console.error('Error fetching assigned promotions:', response.statusText);
            return [];
        }

        const result = await response.json();
        const inner = result.data || result;
        return (Array.isArray(inner) ? inner : inner.data || []) as Promotion[];
    } catch (error) {
        console.error('Error fetching assigned promotions:', error);
        return [];
    }
}

/**
 * Extend a promotion with optional price updates
 */
export async function extendPromotion(
    id: string,
    newEndDate: string,
    priceUpdates?: Array<{
        product_id: string;
        promo_price_aa?: number;
        promo_price_bb?: number;
        promo_price_cc?: number;
        promo_price_dd?: number;
        promo_price_vip1?: number;
        promo_price_vip2?: number;
        promo_price_platinum?: number;
    }>
): Promise<Promotion | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(id)}/extend`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Note: promo_price_bb/cc/dd retained for legacy compatibility only; prefer aa/vip1/vip2/platinum
                body: JSON.stringify({
                    end_date: newEndDate,
                    price_updates: priceUpdates || [],
                }),
            }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error('Error extending promotion:', response.statusText);
            return null;
        }

        const result = await response.json();
        return (result.data || result) as Promotion;
    } catch (error) {
        console.error('Error extending promotion:', error);
        return null;
    }
}

/**
 * Upload screenshot to local server
 */
export async function uploadScreenshot(
    file: File,
    promotionId: string,
    platform: string
): Promise<string | null> {
    try {
        // Convert file to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const response = await fetch(`${API_BASE_URL}/promotions/upload-screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_data: base64,
                promotion_id: promotionId,
                platform,
            }),
        });

        if (!response.ok) {
            console.error('Error uploading screenshot:', response.statusText);
            return null;
        }

        const result = await response.json();
        const inner = result.data || result;
        return inner.url || null;
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        return null;
    }
}

/**
 * Submit proof for a posting
 */
export async function submitProof(
    postingId: string,
    screenshotUrl: string,
    postedBy: string,
    postUrl?: string
): Promise<PromotionPosting | null> {
    return updatePromotionPosting(postingId, {
        screenshot_url: screenshotUrl,
        post_url: postUrl,
        posted_by: postedBy,
        status: 'Pending Review' as PostingStatus,
    } as Partial<PromotionPosting>);
}

/**
 * Approve a proof
 */
export async function approveProof(
    postingId: string,
    reviewerId: string
): Promise<PromotionPosting | null> {
    return reviewPromotionPosting(postingId, 'Approved' as PostingStatus, reviewerId);
}

/**
 * Reject a proof
 */
export async function rejectProof(
    postingId: string,
    reviewerId: string,
    reason: string
): Promise<PromotionPosting | null> {
    return reviewPromotionPosting(postingId, 'Rejected' as PostingStatus, reviewerId, reason);
}

/**
 * Add products to a promotion (batch)
 */
export async function addPromotionProducts(
    promotionId: string,
    products: Array<{
        product_id: string;
        promo_price_aa?: number;
        promo_price_bb?: number;
        promo_price_cc?: number;
        promo_price_dd?: number;
        promo_price_vip1?: number;
        promo_price_vip2?: number;
        promo_price_platinum?: number;
    }>
): Promise<boolean> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(promotionId)}/products/batch`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Note: promo_price_bb/cc/dd retained for legacy compatibility only; prefer aa/vip1/vip2/platinum
                body: JSON.stringify({ products }),
            }
        );

        return response.ok;
    } catch (error) {
        console.error('Error adding promotion products:', error);
        return false;
    }
}

/**
 * Remove a product from a promotion
 */
export async function removePromotionProduct(
    promotionId: string,
    productId: string
): Promise<boolean> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/promotions/${encodeURIComponent(promotionId)}/products/by-product/${encodeURIComponent(productId)}`,
            { method: 'DELETE' }
        );

        return response.ok;
    } catch (error) {
        console.error('Error removing promotion product:', error);
        return false;
    }
}

/**
 * Get pending review counts for notifications
 */
export async function getPendingReviewsForUser(
    _userId: string
): Promise<{ promotionId: string; count: number }[]> {
    try {
        const postings = await getPendingReviewPostings(500);

        const grouped = postings.reduce((acc, item) => {
            const pid = (item as any).promotion_id || '';
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped).map(([promotionId, count]) => ({
            promotionId,
            count,
        }));
    } catch (error) {
        console.error('Error fetching pending reviews:', error);
        return [];
    }
}

/**
 * Dispatch 7-day expiry warning - no-op for local API (handled server-side)
 */
export async function dispatchPromotionSevenDayExpiryWarning(
    _promotionId: string,
    _actorId = 'system',
    _actorRole = 'system'
): Promise<void> {
    // Notifications are handled server-side in the local API
}

/**
 * Dispatch scheduled expiry warnings - no-op for local API
 */
export async function dispatchScheduledPromotionExpiryWarnings(): Promise<number> {
    return 0;
}
