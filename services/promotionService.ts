import { dispatchWorkflowNotification, supabase } from './supabaseService';
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

const PROMOTION_ACTION_URL = (promotionId: string): string =>
    `/sales-transaction-product-promotions?promotionId=${promotionId}`;

type PromotionNotificationContext = Pick<
    Promotion,
    'id' | 'campaign_title' | 'status' | 'assigned_to' | 'end_date'
>;

const normalizeUserIds = (userIds: string[] = []): string[] =>
    Array.from(new Set(userIds.filter(Boolean)));

const areSameUserSets = (a: string[] = [], b: string[] = []): boolean => {
    const left = normalizeUserIds(a).sort();
    const right = normalizeUserIds(b).sort();

    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
};

const isSevenDaysFromExpiry = (endDate?: string): boolean => {
    if (!endDate) return false;

    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const msPerDay = 24 * 60 * 60 * 1000;
    const dayDiff = Math.round((end.getTime() - today.getTime()) / msPerDay);

    return dayDiff === 7;
};

async function resolveAssignedSalesUserIds(assignedTo: string[] = []): Promise<string[]> {
    const normalizedAssigned = normalizeUserIds(assignedTo);
    if (normalizedAssigned.length > 0) {
        return normalizedAssigned;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'Sales Agent');

    if (error) {
        console.error('Error resolving assigned sales users:', error);
        return [];
    }

    return normalizeUserIds((data || []).map((profile) => String(profile.id)));
}

async function getPromotionNotificationContext(
    promotionId: string
): Promise<PromotionNotificationContext | null> {
    const { data, error } = await supabase
        .from('promotions')
        .select('id, campaign_title, status, assigned_to, end_date')
        .eq('id', promotionId)
        .eq('is_deleted', false)
        .maybeSingle();

    if (error || !data) {
        if (error) {
            console.error('Error loading promotion notification context:', error);
        }
        return null;
    }

    return data as PromotionNotificationContext;
}

async function notifyPromotionLifecycleEvent(input: {
    title: string;
    message: string;
    type: NotificationType;
    action: string;
    status: string;
    promotion: PromotionNotificationContext;
    actorId?: string;
    actorRole?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const assignedSalesUserIds = await resolveAssignedSalesUserIds(input.promotion.assigned_to);
    const actionUrl = PROMOTION_ACTION_URL(input.promotion.id);

    await dispatchWorkflowNotification({
        title: input.title,
        message: input.message,
        type: input.type,
        action: input.action,
        status: input.status,
        entityType: 'promotion',
        entityId: input.promotion.id,
        actionUrl,
        actorId: input.actorId,
        actorRole: input.actorRole,
        targetRoles: ['Owner'],
        targetUserIds: assignedSalesUserIds,
        includeActor: true,
        metadata: {
            promotion_id: input.promotion.id,
            current_status: input.promotion.status,
            action: input.action,
            action_url: actionUrl,
            ...input.metadata,
        },
    });
}

async function notifyPromotionAssignment(
    promotion: PromotionNotificationContext,
    actorId?: string,
    actorRole?: string
): Promise<void> {
    const assignmentLabel =
        promotion.assigned_to.length === 0
            ? 'all sales users'
            : `${promotion.assigned_to.length} assigned sales user(s)`;

    await notifyPromotionLifecycleEvent({
        title: 'Promotion Assigned',
        message: `Promotion "${promotion.campaign_title}" was assigned to ${assignmentLabel}.`,
        type: 'info',
        action: 'promotion_assigned',
        status: 'assigned',
        promotion,
        actorId,
        actorRole,
        metadata: {
            assignment_scope: promotion.assigned_to.length === 0 ? 'all_sales_users' : 'specific_sales_users',
            assigned_user_ids: promotion.assigned_to,
        },
    });
}

async function notifyPromotionProofEvent(input: {
    promotion: PromotionNotificationContext;
    posting: Pick<PromotionPosting, 'id' | 'platform_name' | 'status' | 'rejection_reason'>;
    action: 'promotion_proof_uploaded' | 'promotion_proof_approved' | 'promotion_proof_rejected';
    title: string;
    message: string;
    type: NotificationType;
    status: string;
    actorId?: string;
    actorRole?: string;
}): Promise<void> {
    await notifyPromotionLifecycleEvent({
        title: input.title,
        message: input.message,
        type: input.type,
        action: input.action,
        status: input.status,
        promotion: input.promotion,
        actorId: input.actorId,
        actorRole: input.actorRole,
        metadata: {
            posting_id: input.posting.id,
            posting_platform: input.posting.platform_name,
            posting_status: input.posting.status,
            rejection_reason: input.posting.rejection_reason,
        },
    });
}

async function notifyPromotionSevenDayExpiryWarning(
    promotion: PromotionNotificationContext,
    actorId?: string,
    actorRole?: string
): Promise<void> {
    if (!isSevenDaysFromExpiry(promotion.end_date) || promotion.status !== 'Active') {
        return;
    }

    await notifyPromotionLifecycleEvent({
        title: 'Promotion Expiry Warning',
        message: `Promotion "${promotion.campaign_title}" expires in 7 days.`,
        type: 'warning',
        action: 'promotion_expiry_warning_7_day',
        status: 'expiring_in_7_days',
        promotion,
        actorId,
        actorRole,
        metadata: {
            expiry_date: promotion.end_date,
        },
    });
}

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
    // Determine initial status
    const now = new Date();
    const startDate = dto.start_date ? new Date(dto.start_date) : null;
    const initialStatus: PromotionStatus =
        !startDate || startDate <= now ? 'Active' : 'Draft';

    // Insert promotion
    const { data: promotion, error: promotionError } = await supabase
        .from('promotions')
        .insert({
            campaign_title: dto.campaign_title,
            description: dto.description,
            start_date: dto.start_date,
            end_date: dto.end_date,
            status: initialStatus,
            created_by: createdBy,
            assigned_to: dto.assigned_to,
            target_platforms: dto.target_platforms,
            // Client/City Targeting
            target_all_clients: dto.target_all_clients ?? true,
            target_client_ids: dto.target_client_ids ?? [],
            target_cities: dto.target_cities ?? [],
        })
        .select()
        .single();

    if (promotionError) {
        console.error('Error creating promotion:', promotionError);
        throw new Error(`Failed to create promotion: ${promotionError.message}`);
    }

    // Insert promotion products
    if (dto.products.length > 0) {
        const productInserts = dto.products.map((p) => ({
            promotion_id: promotion.id,
            product_id: p.product_id,
            promo_price_aa: p.promo_price_aa,
            promo_price_bb: p.promo_price_bb,
            promo_price_cc: p.promo_price_cc,
            promo_price_dd: p.promo_price_dd,
            promo_price_vip1: p.promo_price_vip1,
            promo_price_vip2: p.promo_price_vip2,
        }));

        const { error: productsError } = await supabase
            .from('promotion_products')
            .insert(productInserts);

        if (productsError) {
            console.error('Error adding promotion products:', productsError);
            // Rollback promotion
            await supabase.from('promotions').delete().eq('id', promotion.id);
            throw new Error(`Failed to add products: ${productsError.message}`);
        }
    }

    // Create posting entries for each platform (initially "Not Posted")
    if (dto.target_platforms.length > 0) {
        const postingInserts = dto.target_platforms.map((platform) => ({
            promotion_id: promotion.id,
            platform_name: platform,
            status: 'Not Posted' as PostingStatus,
        }));

        const { error: postingsError } = await supabase
            .from('promotion_postings')
            .insert(postingInserts);

        if (postingsError) {
            console.error('Error creating posting entries:', postingsError);
            // Don't rollback - postings can be added later
        }
    }

    await notifyPromotionAssignment(promotion as PromotionNotificationContext, createdBy);

    return promotion as unknown as Promotion;
}

/**
 * Get a single promotion by ID with optional relations
 */
export async function getPromotion(
    id: string,
    includeProducts = true,
    includePostings = true
): Promise<Promotion | null> {
    let query = supabase
        .from('promotions')
        .select(`
      *,
      creator:profiles!promotions_created_by_fkey(id, full_name, email, avatar_url)
      ${includeProducts ? ',products:promotion_products(*, product:products(*))' : ''}
      ${includePostings ? ',postings:promotion_postings(*, poster:profiles!promotion_postings_posted_by_fkey(id, full_name, avatar_url), reviewer:profiles!promotion_postings_reviewed_by_fkey(id, full_name))' : ''}
    `)
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching promotion:', error);
        return null;
    }

    return data as unknown as Promotion;
}

/**
 * Get all promotions with optional filtering
 */
export async function getAllPromotions(
    filters?: PromotionFilters
): Promise<Promotion[]> {
    let query = supabase
        .from('promotions')
        .select(`
      *,
      creator:profiles!promotions_created_by_fkey(id, full_name, email, avatar_url),
      products:promotion_products(id, product_id),
      postings:promotion_postings(id, platform_name, status)
    `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
        if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
        } else {
            query = query.eq('status', filters.status);
        }
    }

    if (filters?.created_by) {
        query = query.eq('created_by', filters.created_by);
    }

    if (filters?.search) {
        query = query.ilike('campaign_title', `%${filters.search}%`);
    }

    if (filters?.expiring_within_days) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + filters.expiring_within_days);
        query = query
            .eq('status', 'Active')
            .lte('end_date', futureDate.toISOString())
            .gte('end_date', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching promotions:', error);
        return [];
    }

    return (data || []) as unknown as Promotion[];
}

/**
 * Update a promotion
 */
export async function updatePromotion(
    id: string,
    updates: UpdatePromotionDTO
): Promise<Promotion | null> {
    const { data: previousPromotion } = await supabase
        .from('promotions')
        .select('id, campaign_title, status, assigned_to, end_date')
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle();

    const { data, error } = await supabase
        .from('promotions')
        .update(updates)
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

    if (error) {
        console.error('Error updating promotion:', error);
        return null;
    }

    const updatedPromotion = data as PromotionNotificationContext;
    if (
        updates.assigned_to !== undefined &&
        !areSameUserSets(
            (previousPromotion as PromotionNotificationContext | null)?.assigned_to || [],
            updatedPromotion.assigned_to || []
        )
    ) {
        await notifyPromotionAssignment(updatedPromotion);
    }

    return data as unknown as Promotion;
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
    }>
): Promise<Promotion | null> {
    // Update end date and ensure status is Active
    const { data: promotion, error: promoError } = await supabase
        .from('promotions')
        .update({
            end_date: newEndDate,
            status: 'Active'
        })
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

    if (promoError) {
        console.error('Error extending promotion:', promoError);
        return null;
    }

    // Update prices if provided
    if (priceUpdates && priceUpdates.length > 0) {
        for (const update of priceUpdates) {
            await supabase
                .from('promotion_products')
                .update({
                    promo_price_aa: update.promo_price_aa,
                    promo_price_bb: update.promo_price_bb,
                    promo_price_cc: update.promo_price_cc,
                    promo_price_dd: update.promo_price_dd,
                    promo_price_vip1: update.promo_price_vip1,
                    promo_price_vip2: update.promo_price_vip2,
                })
                .eq('promotion_id', id)
                .eq('product_id', update.product_id);
        }
    }

    return promotion as unknown as Promotion;
}

/**
 * Soft delete a promotion
 */
export async function deletePromotion(id: string): Promise<boolean> {
    // First add to recycle bin
    const { data: promotion } = await supabase
        .from('promotions')
        .select('campaign_title')
        .eq('id', id)
        .single();

    if (promotion) {
        await (supabase as any).from('recycle_bin').insert({
            item_type: 'promotion',
            item_id: id,
            item_name: promotion.campaign_title,
            item_data: promotion,
        });
    }

    // Soft delete
    const { error } = await supabase
        .from('promotions')
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            status: 'Cancelled'
        })
        .eq('id', id);

    if (error) {
        console.error('Error deleting promotion:', error);
        return false;
    }

    return true;
}

// ============================================================================
// Promotion Products Operations
// ============================================================================

/**
 * Get products for a promotion
 */
export async function getPromotionProducts(
    promotionId: string
): Promise<PromotionProduct[]> {
    const { data, error } = await supabase
        .from('promotion_products')
        .select('*, product:products(*)')
        .eq('promotion_id', promotionId);

    if (error) {
        console.error('Error fetching promotion products:', error);
        return [];
    }

    return (data || []) as unknown as PromotionProduct[];
}

/**
 * Add products to a promotion
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
    }>
): Promise<boolean> {
    const inserts = products.map((p) => ({
        promotion_id: promotionId,
        ...p,
    }));

    const { error } = await supabase
        .from('promotion_products')
        .upsert(inserts, { onConflict: 'promotion_id,product_id' });

    if (error) {
        console.error('Error adding promotion products:', error);
        return false;
    }

    return true;
}

/**
 * Remove a product from a promotion
 */
export async function removePromotionProduct(
    promotionId: string,
    productId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('promotion_products')
        .delete()
        .eq('promotion_id', promotionId)
        .eq('product_id', productId);

    if (error) {
        console.error('Error removing promotion product:', error);
        return false;
    }

    return true;
}

// ============================================================================
// Promotion Postings (Proof) Operations
// ============================================================================

/**
 * Get postings for a promotion
 */
export async function getPromotionPostings(
    promotionId: string
): Promise<PromotionPosting[]> {
    const { data, error } = await supabase
        .from('promotion_postings')
        .select(`
      *,
      poster:profiles!promotion_postings_posted_by_fkey(id, full_name, avatar_url),
      reviewer:profiles!promotion_postings_reviewed_by_fkey(id, full_name)
    `)
        .eq('promotion_id', promotionId)
        .order('platform_name');

    if (error) {
        console.error('Error fetching postings:', error);
        return [];
    }

    return (data || []) as unknown as PromotionPosting[];
}

/**
 * Upload screenshot to Supabase Storage
 */
export async function uploadScreenshot(
    file: File,
    promotionId: string,
    platform: string
): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${promotionId}/${platform}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('promotion-screenshots')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
        });

    if (error) {
        console.error('Error uploading screenshot:', error);
        return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('promotion-screenshots')
        .getPublicUrl(data.path);

    return urlData.publicUrl;
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
    const { data, error } = await supabase
        .from('promotion_postings')
        .update({
            screenshot_url: screenshotUrl,
            post_url: postUrl,
            posted_by: postedBy,
            status: 'Pending Review' as PostingStatus,
        })
        .eq('id', postingId)
        .select()
        .single();

    if (error) {
        console.error('Error submitting proof:', error);
        return null;
    }

    const promotion = await getPromotionNotificationContext(data.promotion_id);
    if (promotion) {
        await notifyPromotionProofEvent({
            promotion,
            posting: data as PromotionPosting,
            action: 'promotion_proof_uploaded',
            title: 'Promotion Proof Uploaded',
            message: `Proof uploaded for "${promotion.campaign_title}" on ${data.platform_name}.`,
            type: 'info',
            status: 'pending_review',
            actorId: postedBy,
        });
    }

    return data as unknown as PromotionPosting;
}

/**
 * Approve a proof
 */
export async function approveProof(
    postingId: string,
    reviewerId: string
): Promise<PromotionPosting | null> {
    const { data, error } = await supabase
        .from('promotion_postings')
        .update({
            status: 'Approved' as PostingStatus,
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', postingId)
        .select()
        .single();

    if (error) {
        console.error('Error approving proof:', error);
        return null;
    }

    const promotion = await getPromotionNotificationContext(data.promotion_id);
    if (promotion) {
        await notifyPromotionProofEvent({
            promotion,
            posting: data as PromotionPosting,
            action: 'promotion_proof_approved',
            title: 'Promotion Proof Approved',
            message: `Proof for "${promotion.campaign_title}" on ${data.platform_name} was approved.`,
            type: 'success',
            status: 'approved',
            actorId: reviewerId,
        });
    }

    return data as unknown as PromotionPosting;
}

/**
 * Reject a proof
 */
export async function rejectProof(
    postingId: string,
    reviewerId: string,
    reason: string
): Promise<PromotionPosting | null> {
    const { data, error } = await supabase
        .from('promotion_postings')
        .update({
            status: 'Rejected' as PostingStatus,
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
        })
        .eq('id', postingId)
        .select()
        .single();

    if (error) {
        console.error('Error rejecting proof:', error);
        return null;
    }

    const promotion = await getPromotionNotificationContext(data.promotion_id);
    if (promotion) {
        await notifyPromotionProofEvent({
            promotion,
            posting: data as PromotionPosting,
            action: 'promotion_proof_rejected',
            title: 'Promotion Proof Rejected',
            message: `Proof for "${promotion.campaign_title}" on ${data.platform_name} was rejected. Reason: ${reason}`,
            type: 'warning',
            status: 'rejected',
            actorId: reviewerId,
        });
    }

    return data as unknown as PromotionPosting;
}

/**
 * Dispatch one 7-day expiry warning for a single promotion.
 * Intended for realtime hooks and scheduled jobs.
 */
export async function dispatchPromotionSevenDayExpiryWarning(
    promotionId: string,
    actorId = 'system',
    actorRole = 'system'
): Promise<void> {
    const promotion = await getPromotionNotificationContext(promotionId);
    if (!promotion) return;

    await notifyPromotionSevenDayExpiryWarning(promotion, actorId, actorRole);
}

/**
 * Dispatch 7-day expiry warnings for all active promotions.
 * Intended for scheduled/cron execution.
 */
export async function dispatchScheduledPromotionExpiryWarnings(): Promise<number> {
    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);
    targetDate.setDate(targetDate.getDate() + 7);

    const startOfTargetDay = new Date(targetDate);
    const endOfTargetDay = new Date(targetDate);
    endOfTargetDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
        .from('promotions')
        .select('id')
        .eq('status', 'Active')
        .eq('is_deleted', false)
        .gte('end_date', startOfTargetDay.toISOString())
        .lte('end_date', endOfTargetDay.toISOString());

    if (error) {
        console.error('Error fetching promotions for scheduled expiry warnings:', error);
        return 0;
    }

    let dispatchedCount = 0;
    for (const promotion of data || []) {
        await dispatchPromotionSevenDayExpiryWarning(String(promotion.id));
        dispatchedCount += 1;
    }

    return dispatchedCount;
}

// ============================================================================
// Statistics and Performance
// ============================================================================

/**
 * Get promotion statistics for dashboard
 */
export async function getPromotionStats(): Promise<PromotionStats> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Get active count
    const { count: activeCount } = await supabase
        .from('promotions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active')
        .eq('is_deleted', false);

    // Get pending reviews count
    const { count: pendingCount } = await supabase
        .from('promotion_postings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending Review');

    // Get expiring soon count
    const { count: expiringCount } = await supabase
        .from('promotions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active')
        .eq('is_deleted', false)
        .lte('end_date', sevenDaysFromNow.toISOString())
        .gte('end_date', now.toISOString());

    return {
        total_active: activeCount || 0,
        pending_reviews: pendingCount || 0,
        expiring_soon: expiringCount || 0,
    };
}

/**
 * Get promotions assigned to a specific user or all sales persons
 */
export async function getAssignedPromotions(
    userId: string
): Promise<Promotion[]> {
    const { data, error } = await supabase
        .from('promotions')
        .select(`
      *,
      products:promotion_products(id, product_id, product:products(id, description, item_code)),
      postings:promotion_postings(id, platform_name, status, screenshot_url, rejection_reason)
    `)
        .eq('is_deleted', false)
        .in('status', ['Active', 'Draft'])
        .or(`assigned_to.cs.{${userId}},assigned_to.eq.{}`)
        .order('end_date', { ascending: true });

    if (error) {
        console.error('Error fetching assigned promotions:', error);
        return [];
    }

    return (data || []) as unknown as Promotion[];
}

/**
 * Get pending review counts for notifications
 */
export async function getPendingReviewsForUser(
    userId: string
): Promise<{ promotionId: string; count: number }[]> {
    const { data, error } = await supabase
        .from('promotion_postings')
        .select('promotion_id')
        .eq('status', 'Pending Review');

    if (error) {
        console.error('Error fetching pending reviews:', error);
        return [];
    }

    // Group by promotion_id
    const grouped = (data || []).reduce((acc, item) => {
        acc[item.promotion_id] = (acc[item.promotion_id] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([promotionId, count]) => ({
        promotionId,
        count,
    }));
}
