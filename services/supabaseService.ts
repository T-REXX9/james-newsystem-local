



import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannelStatus } from '@supabase/supabase-js';
import { DEFAULT_STAFF_ACCESS_RIGHTS, DEFAULT_STAFF_ROLE, generateAvatarUrl, STAFF_ROLES } from '../constants';
import { Contact, ContactPerson, PipelineDeal, Product, Task, UserProfile, CallLogEntry, Inquiry, Purchase, ReorderReportEntry, TeamMessage, CreateStaffAccountInput, CreateStaffAccountResult, StaffAccountValidationError, Notification, CreateNotificationInput, NotificationType, RecycleBinItemType, CreateIncidentReportInput, AgentSalesData, AgentPerformanceSummary, TopCustomer, StandardNotificationPayload } from '../types';
import { sanitizeObject, SanitizationConfig } from '../utils/dataSanitization';
import { parseSupabaseError } from '../utils/errorHandler';
import { ENTITY_TYPES, logCreate, logDelete, logUpdate } from './activityLogService';

// Helper to generate restore token and expiry for recycle bin items
const generateRecycleBinMeta = () => ({
  restore_token: crypto.randomUUID(),
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
});

const contactPersonSanitizationConfig: SanitizationConfig<Omit<ContactPerson, 'id'>> = {
  name: { type: 'string', placeholder: 'n/a' },
  position: { type: 'string', placeholder: 'n/a' },
  birthday: { type: 'string', placeholder: 'n/a' },
  telephone: { type: 'string', placeholder: 'n/a' },
  mobile: { type: 'string', placeholder: 'n/a' },
  email: { type: 'string', placeholder: 'n/a' },
};

const contactSanitizationConfig: SanitizationConfig<Omit<Contact, 'id'>> = {
  company: { type: 'string', placeholder: 'n/a', required: true },
  address: { type: 'string', placeholder: 'n/a' },
  deliveryAddress: { type: 'string', placeholder: 'n/a' },
  province: { type: 'string', placeholder: 'n/a' },
  city: { type: 'string', placeholder: 'n/a' },
  area: { type: 'string', placeholder: 'n/a' },
  tin: { type: 'string', placeholder: 'n/a' },
  businessLine: { type: 'string', placeholder: 'n/a' },
  terms: { type: 'string', placeholder: 'n/a' },
  transactionType: { type: 'string', placeholder: 'n/a' },
  vatType: { type: 'string', placeholder: 'n/a' },
  vatPercentage: { type: 'string', placeholder: 'n/a' },
  dealershipTerms: { type: 'string', placeholder: 'n/a' },
  dealershipSince: { type: 'string', placeholder: 'n/a' },
  creditLimit: { type: 'number', placeholder: 0 },
  dealershipQuota: { type: 'number', placeholder: 0 },
  dealValue: { type: 'number', placeholder: 0 },
  email: { type: 'string', placeholder: 'n/a' },
  phone: { type: 'string', placeholder: 'n/a' },
  mobile: { type: 'string', placeholder: 'n/a' },
  name: { type: 'string', placeholder: 'n/a' },
  title: { type: 'string', placeholder: 'n/a' },
  status: { type: 'string', placeholder: 'n/a' },
  debtType: { type: 'string', placeholder: 'n/a' },
  comment: { type: 'string', placeholder: 'n/a' },
  contactPersons: {
    type: 'array',
    itemSanitizer: (person) =>
      sanitizeObject(
        (person || {}) as Omit<ContactPerson, 'id'>,
        contactPersonSanitizationConfig,
        { enforceRequired: false }
      ),
  },
};

const dealSanitizationConfig: SanitizationConfig<Omit<PipelineDeal, 'id' | 'createdAt' | 'updatedAt'>> = {
  title: { type: 'string', placeholder: 'n/a', required: true },
  company: { type: 'string', placeholder: 'n/a' },
  contactName: { type: 'string', placeholder: 'n/a' },
  value: { type: 'number', placeholder: 0 },
  currency: { type: 'string', placeholder: '₱' },
  ownerName: { type: 'string', placeholder: 'n/a' },
  ownerId: { type: 'string', placeholder: 'n/a' },
  customerType: { type: 'string', placeholder: 'n/a' },
  nextStep: { type: 'string', placeholder: 'n/a' },
  entryEvidence: { type: 'string', placeholder: 'n/a' },
  exitEvidence: { type: 'string', placeholder: 'n/a' },
  riskFlag: { type: 'string', placeholder: 'n/a' },
  avatar: { type: 'string', placeholder: 'n/a' },
};

const productSanitizationConfig: SanitizationConfig<Omit<Product, 'id'>> = {
  part_no: { type: 'string', placeholder: 'n/a', required: true },
  description: { type: 'string', placeholder: 'n/a', required: true },
  item_code: { type: 'string', placeholder: 'n/a' },
  oem_no: { type: 'string', placeholder: 'n/a' },
  brand: { type: 'string', placeholder: 'n/a' },
  category: { type: 'string', placeholder: 'n/a' },
  cost: { type: 'number', placeholder: 0 },
  price_aa: { type: 'number', placeholder: 0 },
  price_bb: { type: 'number', placeholder: 0 },
  price_cc: { type: 'number', placeholder: 0 },
  price_dd: { type: 'number', placeholder: 0 },
  price_vip1: { type: 'number', placeholder: 0 },
  price_vip2: { type: 'number', placeholder: 0 },
};

// With our local mock DB, we can just query directly.
// The Mock DB handles the seeding from constants, so we trust it returns data.

export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('is_deleted', false);
    if (error) throw error;
    return (data as unknown as Contact[]) || [];
  } catch (err) {
    console.error("Error fetching contacts:", err);
    return [];
  }
};

export const createContact = async (contact: Omit<Contact, 'id'>): Promise<Contact> => {
  try {
    const sanitizedContact = sanitizeObject(contact as Omit<Contact, 'id'>, contactSanitizationConfig);
    const { data, error } = await supabase
      .from('contacts')
      .insert(sanitizedContact as any)
      .select('*')
      .single();
    if (error) throw error;
    try {
      await logCreate(ENTITY_TYPES.CONTACT, data.id, {
        company: data.company,
        contact_type: data.transactionType,
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }
    return data as unknown as Contact;
  } catch (err) {
    console.error('Error creating contact:', err);
    throw new Error(parseSupabaseError(err, 'contact'));
  }
};

export const updateContact = async (id: string, updates: Partial<Contact>): Promise<void> => {
  try {
    const sanitizedUpdates = sanitizeObject(
      updates as Contact,
      contactSanitizationConfig,
      { enforceRequired: false, onlyProvided: true }
    );
    const { error } = await supabase.from('contacts').update(sanitizedUpdates as any).eq('id', id);
    if (error) throw error;
    try {
      await logUpdate(ENTITY_TYPES.CONTACT, id, {
        updated_fields: Object.keys(sanitizedUpdates),
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }
  } catch (err) {
    console.error("Error updating contact:", err);
    throw new Error(parseSupabaseError(err, 'contact'));
  }
};

export const bulkUpdateContacts = async (ids: string[], updates: Partial<Contact>): Promise<void> => {
  try {
    const sanitizedUpdates = sanitizeObject(
      updates as Contact,
      contactSanitizationConfig,
      { enforceRequired: false, onlyProvided: true }
    );
    // Use Supabase's .in() method for efficient bulk updates
    const { error } = await supabase
      .from('contacts')
      .update(sanitizedUpdates as any)
      .in('id', ids);

    if (error) throw error;
  } catch (err) {
    console.error("Error bulk updating contacts:", err);
    throw new Error(parseSupabaseError(err, 'contact'));
  }
}

export const fetchDeals = async (): Promise<PipelineDeal[]> => {
  try {
    const { data, error } = await supabase.from('deals').select('*');
    if (error) throw error;
    const deals = (data as PipelineDeal[]) || [];
    return deals.filter(d => !d.is_deleted);
  } catch (err) {
    console.error("Error fetching deals:", err);
    return [];
  }
};

export const createDeal = async (
  deal: Omit<PipelineDeal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PipelineDeal> => {
  try {
    const sanitizedDeal = sanitizeObject(
      deal as Omit<PipelineDeal, 'id' | 'createdAt' | 'updatedAt'>,
      dealSanitizationConfig
    );
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const payload = {
      ...sanitizedDeal,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      daysInStage: 0,
      is_deleted: false,
      created_by: user?.id || null,
    };
    const { data, error } = await supabase
      .from('deals')
      .insert(payload)
      .select()
      .single();
    if (error || !data) throw error || new Error('Failed to create deal');
    return data as PipelineDeal;
  } catch (err) {
    console.error('Error creating deal:', err);
    throw new Error(parseSupabaseError(err, 'deal'));
  }
};

export const updateDeal = async (
  id: string,
  updates: Partial<PipelineDeal>
): Promise<PipelineDeal | null> => {
  try {
    const sanitizedUpdates = sanitizeObject(
      updates as PipelineDeal,
      dealSanitizationConfig,
      { enforceRequired: false, onlyProvided: true }
    );
    const payload: Record<string, unknown> = { ...sanitizedUpdates, updatedAt: new Date().toISOString() };
    delete payload.id;
    delete payload.createdAt;
    const { data, error } = await supabase
      .from('deals')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as PipelineDeal;
  } catch (err) {
    console.error('Error updating deal:', err);
    throw new Error(parseSupabaseError(err, 'deal'));
  }
};

export const moveDealToStage = async (
  id: string,
  stageId: string
): Promise<PipelineDeal | null> => {
  try {
    const { data, error } = await supabase
      .from('deals')
      .update({ stageId, daysInStage: 0, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as PipelineDeal;
  } catch (err) {
    console.error('Error moving deal to stage:', err);
    return null;
  }
};

export const deleteDeal = async (id: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .single();

    if (!deal) throw new Error('Deal not found');

    const { error: recycleError } = await supabase.from('recycle_bin_items').insert({
      item_type: RecycleBinItemType.DEAL,
      item_id: id,
      original_data: deal,
      deleted_by: user.id,
      deleted_at: new Date().toISOString(),
      ...generateRecycleBinMeta(),
    });

    if (recycleError) throw recycleError;

    const { error } = await supabase
      .from('deals')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting deal:', err);
    return false;
  }
};

export const restoreDeal = async (id: string): Promise<PipelineDeal | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await supabase
      .from('recycle_bin_items')
      .update({ is_restored: true, restored_at: new Date().toISOString(), restored_by: user.id })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.DEAL);

    const { data, error } = await supabase
      .from('deals')
      .update({ is_deleted: false, deleted_at: null, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as PipelineDeal;
  } catch (err) {
    console.error('Error restoring deal:', err);
    return null;
  }
};

export const bulkUpdateDeals = async (
  ids: string[],
  updates: Partial<PipelineDeal>
): Promise<boolean> => {
  try {
    for (const id of ids) {
      await updateDeal(id, updates);
    }
    return true;
  } catch (err) {
    console.error('Error bulk updating deals:', err);
    return false;
  }
};

// --- PRODUCT SERVICE ---

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_deleted', false);
    if (error) throw error;
    return (data as Product[]) || [];
  } catch (err) {
    console.error("Error fetching products:", err);
    return [];
  }
};

// --- REORDER REPORT SERVICE ---

export const fetchReorderReportEntries = async (): Promise<ReorderReportEntry[]> => {
  try {
    // Fetch base reorder report data
    const { data, error } = await supabase.from('reorder-report').select('*');
    if (error) throw error;

    const entries = (data as ReorderReportEntry[]) || [];

    // If no entries, return empty
    if (entries.length === 0) return [];

    // Get all product IDs to fetch related data
    const productIds = entries.map(e => e.product_id).filter(Boolean);

    // Fetch complaint counts from incident_reports where issue_type is product_quality
    // We'll join via part_no matching in description or a related_transactions lookup
    const { data: incidentData } = await supabase
      .from('incident_reports')
      .select('description, notes')
      .eq('issue_type', 'product_quality');

    // Build a map of part_no -> complaint count by searching descriptions
    const complaintMap: Record<string, number> = {};
    if (incidentData) {
      entries.forEach(entry => {
        const partNo = entry.part_no?.toLowerCase() || '';
        const matchCount = incidentData.filter(incident => {
          const desc = (incident.description || '').toLowerCase();
          const notes = (incident.notes || '').toLowerCase();
          return desc.includes(partNo) || notes.includes(partNo);
        }).length;
        if (matchCount > 0) {
          complaintMap[entry.part_no] = matchCount;
        }
      });
    }

    // Calculate movement classification based on stock_snapshot changes
    // For now, we'll use a heuristic: if replenish qty is high relative to reorder point = fast moving
    // If total_stock is consistently at or above reorder_point = slow moving
    const enrichedEntries = entries.map(entry => {
      // Movement classification heuristic:
      // Fast: replenish_quantity > reorder_point * 1.5 (high turnover)
      // Slow: total_stock >= reorder_point * 0.8 AND replenish_quantity < reorder_point * 0.5
      // Normal: everything else
      const replenishRatio = entry.replenish_quantity / Math.max(entry.reorder_point, 1);
      const stockRatio = entry.total_stock / Math.max(entry.reorder_point, 1);

      let movement_classification: 'fast' | 'slow' | 'normal' = 'normal';

      if (replenishRatio > 1.5) {
        movement_classification = 'fast';
      } else if (stockRatio >= 0.8 && replenishRatio < 0.5) {
        movement_classification = 'slow';
      }

      // If marked critical with very low stock, likely fast-moving
      if (entry.status === 'critical' && entry.total_stock < entry.reorder_point * 0.3) {
        movement_classification = 'fast';
      }

      return {
        ...entry,
        movement_classification,
        complaint_count: complaintMap[entry.part_no] || 0,
      };
    });

    return enrichedEntries;
  } catch (err) {
    console.error('Error fetching reorder report entries:', err);
    return [];
  }
};


export const createProduct = async (product: Omit<Product, 'id'>): Promise<void> => {
  try {
    const sanitizedProduct = sanitizeObject(product as Omit<Product, 'id'>, productSanitizationConfig);
    const { data, error } = await supabase.from('products').insert(sanitizedProduct).select().single();
    if (error) throw error;
    try {
      if (data) {
        await logCreate(ENTITY_TYPES.PRODUCT, data.id, {
          part_no: data.part_no,
          item_code: data.item_code,
          description: data.description,
        });
      }
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }
  } catch (err) {
    console.error("Error creating product:", err);
    throw new Error(parseSupabaseError(err, 'product'));
  }
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<void> => {
  try {
    const sanitizedUpdates = sanitizeObject(
      updates as Product,
      productSanitizationConfig,
      { enforceRequired: false, onlyProvided: true }
    );
    const { error } = await supabase.from('products').update(sanitizedUpdates).eq('id', id);
    if (error) throw error;
    try {
      await logUpdate(ENTITY_TYPES.PRODUCT, id, {
        updated_fields: Object.keys(sanitizedUpdates),
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }
  } catch (err) {
    console.error("Error updating product:", err);
    throw new Error(parseSupabaseError(err, 'product'));
  }
};

export const bulkUpdateProducts = async (
  ids: string[],
  updates: Partial<Product>
): Promise<void> => {
  try {
    const sanitizedUpdates = sanitizeObject(
      updates as Product,
      productSanitizationConfig,
      { enforceRequired: false, onlyProvided: true }
    );
    const { error } = await supabase
      .from('products')
      .update(sanitizedUpdates)
      .in('id', ids);

    if (error) throw error;
  } catch (err) {
    console.error("Error bulk updating products:", err);
    throw new Error(parseSupabaseError(err, 'product'));
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the product data before deletion
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (!product) throw new Error('Product not found');

    // Insert into recycle bin
    const { error: recycleError } = await supabase
      .from('recycle_bin_items')
      .insert({
        item_type: RecycleBinItemType.PRODUCT,
        item_id: id,
        original_data: product,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        ...generateRecycleBinMeta(),
      });

    if (recycleError) throw recycleError;

    // Soft delete the product
    const { error } = await supabase
      .from('products')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    try {
      await logDelete(ENTITY_TYPES.PRODUCT, id, {
        part_no: product.part_no,
        item_code: product.item_code,
        description: product.description,
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }
  } catch (err) {
    console.error("Error deleting product:", err);
    throw err;
  }
};

export const restoreProduct = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check user role (Owner/Developer only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Update recycle bin item as restored
    await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.PRODUCT);

    // Restore the product
    const { error } = await supabase
      .from('products')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Error restoring product:', err);
    throw err;
  }
};

// --- USER PROFILE SERVICE ---

export const fetchProfiles = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data as UserProfile[]) || [];
  } catch (err) {
    console.error("Error fetching profiles:", err);
    return [];
  }
};

export const fetchSalesAgents = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'Sales Agent')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data as UserProfile[]) || [];
  } catch (err) {
    console.error("Error fetching sales agents:", err);
    return [];
  }
};

export const updateProfile = async (id: string, updates: Partial<UserProfile>): Promise<void> => {
  try {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error("Error updating profile:", err);
    throw err;
  }
};

export interface AccessRightsChangeNotificationInput {
  actorId?: string;
  actorRole?: string;
  targetUserId: string;
  targetUserRole?: string;
  beforeRights: string[];
  afterRights: string[];
}

export const notifyAccessRightsChange = async (input: AccessRightsChangeNotificationInput): Promise<void> => {
  const actionUrl = `/settings?section=access-control&userId=${input.targetUserId}`;
  const sharedMetadata = {
    before_rights: input.beforeRights,
    after_rights: input.afterRights,
    target_user_id: input.targetUserId,
    target_user_role: input.targetUserRole || 'Unknown',
  };

  await dispatchWorkflowNotification({
    title: 'Access Rights Updated',
    message: `Access rights were updated for user ${input.targetUserId}.`,
    type: 'warning',
    action: 'update_access_rights',
    status: 'success',
    entityType: 'user_profile',
    entityId: input.targetUserId,
    actionUrl,
    actorId: input.actorId,
    actorRole: input.actorRole,
    targetRoles: ['Owner', 'Manager'],
    includeActor: true,
    metadata: sharedMetadata,
  });

  await dispatchWorkflowNotification({
    title: 'Your Access Rights Changed',
    message: 'Your access permissions were updated. Please review your available modules.',
    type: 'info',
    action: 'notify_access_rights_change',
    status: 'success',
    entityType: 'user_profile',
    entityId: input.targetUserId,
    actionUrl,
    actorId: input.actorId,
    actorRole: input.actorRole,
    targetUserIds: [input.targetUserId],
    includeActor: false,
    metadata: sharedMetadata,
  });
};

export interface StaffCreationNotificationInput {
  actorId?: string;
  actorRole?: string;
  targetUserId: string;
  targetUserRole?: string;
  email?: string;
}

export const notifyStaffAccountCreated = async (input: StaffCreationNotificationInput): Promise<void> => {
  const actionUrl = `/settings?section=access-control&userId=${input.targetUserId}`;
  await dispatchWorkflowNotification({
    title: 'Staff Account Created',
    message: `A new staff account (${input.email || input.targetUserId}) was created with role ${input.targetUserRole || 'Unknown'}.`,
    type: 'success',
    action: 'create_staff_account',
    status: 'success',
    entityType: 'user_profile',
    entityId: input.targetUserId,
    actionUrl,
    actorId: input.actorId,
    actorRole: input.actorRole,
    targetRoles: ['Owner', 'Manager'],
    includeActor: true,
    metadata: {
      target_user_id: input.targetUserId,
      target_user_role: input.targetUserRole || 'Unknown',
      target_user_email: input.email || '',
    },
  });
};

// --- STAFF ACCOUNT CREATION ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const validateStaffAccountInput = (input: CreateStaffAccountInput): StaffAccountValidationError => {
  const errors: StaffAccountValidationError = {};

  if (!input.fullName?.trim()) {
    errors.fullName = 'Full name is required';
  }

  if (!input.email?.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = 'Please provide a valid email address';
  }

  if (!input.password) {
    errors.password = 'Password is required';
  } else {
    const hasLength = input.password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(input.password);
    const hasNumber = /\d/.test(input.password);
    if (!hasLength || !hasLetter || !hasNumber) {
      errors.password = 'Password must be at least 8 characters and include letters and numbers';
    }
  }

  if (input.role && !STAFF_ROLES.includes(input.role)) {
    errors.role = 'Invalid role';
  }

  if (input.accessRights && !input.accessRights.length) {
    errors.accessRights = 'At least one access right is required';
  }

  return errors;
};

const normalizeAccessRights = (accessRights?: string[]) => {
  if (!accessRights || !accessRights.length) {
    return DEFAULT_STAFF_ACCESS_RIGHTS;
  }
  return Array.from(new Set(accessRights));
};

const mapAuthError = (message?: string) => {
  if (!message) return 'Unable to create account right now. Please try again.';
  if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('already registered')) {
    return 'An account with this email already exists.';
  }
  if (message.toLowerCase().includes('password')) {
    return 'Password does not meet security requirements.';
  }
  return message;
};

const fetchProfileById = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return (data as UserProfile) || null;
  } catch (err) {
    console.error('Error fetching profile by id:', err);
    return null;
  }
};

export const verifyProfileExists = async (userId: string): Promise<boolean> => {
  const profile = await fetchProfileById(userId);
  return Boolean(profile);
};

export const createProfileManually = async (profile: UserProfile): Promise<UserProfile | null> => {
  try {
    const payload = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: profile.role || DEFAULT_STAFF_ROLE,
      access_rights: profile.access_rights || DEFAULT_STAFF_ACCESS_RIGHTS,
      birthday: profile.birthday || null,
      mobile: profile.mobile || null
    };
    const { data, error } = await supabase.from('profiles').insert(payload).select().maybeSingle();
    if (error) throw error;
    return (data as UserProfile) || null;
  } catch (err) {
    console.error('Error creating profile manually:', err);
    return null;
  }
};

export const createStaffAccount = async (input: CreateStaffAccountInput): Promise<CreateStaffAccountResult> => {
  const validationErrors = validateStaffAccountInput(input);
  if (Object.keys(validationErrors).length) {
    return { success: false, error: 'Validation failed', validationErrors };
  }

  const role = input.role && STAFF_ROLES.includes(input.role) ? input.role : DEFAULT_STAFF_ROLE;
  const accessRights = normalizeAccessRights(input.accessRights);
  const avatarUrl = generateAvatarUrl(input.fullName, input.email);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          role,
          avatar_url: avatarUrl,
          access_rights: accessRights,
          birthday: input.birthday || null,
          mobile: input.mobile || null
        }
      }
    });

    if (error) {
      const friendly = mapAuthError(error.message);
      console.error('Auth signup failed:', error);
      return { success: false, error: friendly };
    }

    const userId = data?.user?.id;
    let profile: UserProfile | null = null;

    if (userId) {
      await wait(300);
      const profileReady = await verifyProfileExists(userId);
      profile = profileReady ? await fetchProfileById(userId) : null;

      if (!profile) {
        console.warn('Profile not found after trigger, attempting manual creation', { userId });
        await createProfileManually({
          id: userId,
          email: input.email,
          full_name: input.fullName,
          avatar_url: avatarUrl,
          role,
          access_rights: accessRights,
          birthday: input.birthday,
          mobile: input.mobile
        });
        await wait(150);
        profile = await fetchProfileById(userId);
      }
    }

    console.info('Staff account created', { email: input.email, userId });
    return { success: true, userId: userId || undefined, profile: profile || undefined };
  } catch (err: any) {
    console.error('Error creating staff account:', err);
    return { success: false, error: err?.message || 'Unable to create account' };
  }
};

export const bulkCreateStaffAccounts = async (inputs: CreateStaffAccountInput[]) => {
  const results: CreateStaffAccountResult[] = [];
  for (const input of inputs) {
    const result = await createStaffAccount(input);
    results.push(result);
  }
  return results;
};

const getAuthClientMetadata = () => ({
  ip_address: null,
  user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  platform: typeof navigator !== 'undefined' ? navigator.platform : null,
  language: typeof navigator !== 'undefined' ? navigator.language : null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  origin: typeof window !== 'undefined' ? window.location.origin : null,
});

export const resetStaffPassword = async (userId: string, newPassword: string) => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const actorUser = authData?.user;
    const { data: actorProfile } = actorUser
      ? await supabase
        .from('profiles')
        .select('role')
        .eq('id', actorUser.id)
        .maybeSingle()
      : { data: null };
    const actorRole = (actorProfile as { role?: string } | null)?.role || 'Unknown';

    const { data, error } = await supabase.functions.invoke('reset-staff-password', {
      body: { userId, newPassword },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Unable to reset password');

    const notificationMetadata = {
      actor_id: actorUser?.id || null,
      actor_email: actorUser?.email || null,
      target_user_id: userId,
      auth_provider: 'admin_reset',
      ...getAuthClientMetadata(),
    };

    await dispatchWorkflowNotification({
      title: 'Password Reset Initiated',
      message: `A password reset was initiated for user ${userId}.`,
      type: 'warning',
      action: 'password_reset_initiation',
      status: 'initiated',
      entityType: 'auth_event',
      entityId: userId,
      actionUrl: '/security/audit',
      actorId: actorUser?.id,
      actorRole,
      targetRoles: ['Owner', 'Manager', 'Security'],
      includeActor: true,
      metadata: notificationMetadata,
    });

    await dispatchWorkflowNotification({
      title: 'Password Reset Completed',
      message: `A password reset completed for user ${userId}.`,
      type: 'success',
      action: 'password_reset_completion',
      status: 'success',
      entityType: 'auth_event',
      entityId: userId,
      actionUrl: '/security/audit',
      actorId: actorUser?.id,
      actorRole,
      targetRoles: ['Owner', 'Manager', 'Security'],
      includeActor: true,
      metadata: notificationMetadata,
    });

    console.info('Password reset for user', { userId });
    return true;
  } catch (err) {
    console.error('Error resetting staff password:', err);
    return false;
  }
};

export const deactivateStaffAccount = async (userId: string) => {
  try {
    const { error } = await supabase.from('profiles').update({ access_rights: [] }).eq('id', userId);
    if (error) throw error;
    console.info('Staff account deactivated', { userId });
    return true;
  } catch (err) {
    console.error('Error deactivating staff account:', err);
    return false;
  }
};

export const updateStaffRole = async (userId: string, role: string) => {
  if (!STAFF_ROLES.includes(role)) {
    return false;
  }

  try {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    console.info('Staff role updated', { userId, role });
    return true;
  } catch (err) {
    console.error('Error updating staff role:', err);
    return false;
  }
};

// --- TASKS SERVICE ---

export const fetchTasks = async (): Promise<Task[]> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_deleted', false);
    if (error) throw error;
    return (data as Task[]) || [];
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return [];
  }
};

export const createTask = async (task: Omit<Task, 'id'>): Promise<void> => {
  try {
    const { error } = await supabase.from('tasks').insert(task);
    if (error) throw error;
  } catch (err) {
    console.error("Error creating task:", err);
    throw err;
  }
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<void> => {
  try {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error("Error updating task:", err);
    throw err;
  }
};

export const deleteTask = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the task data before deletion
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (!task) throw new Error('Task not found');

    // Insert into recycle bin
    const { error: recycleError } = await supabase
      .from('recycle_bin_items')
      .insert({
        item_type: RecycleBinItemType.TASK,
        item_id: id,
        original_data: task,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        ...generateRecycleBinMeta(),
      });

    if (recycleError) throw recycleError;

    // Soft delete the task
    const { error } = await supabase
      .from('tasks')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error("Error deleting task:", err);
    throw err;
  }
};

export const restoreTask = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check user role (Owner/Developer only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Update recycle bin item as restored
    await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.TASK);

    // Restore the task
    const { error } = await supabase
      .from('tasks')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Error restoring task:', err);
    throw err;
  }
};

// --- TEAM MESSAGES SERVICE ---

export const fetchTeamMessages = async (): Promise<TeamMessage[]> => {
  try {
    const { data, error } = await (supabase
      .from('team_messages') as any)
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as TeamMessage[]) || [];
  } catch (err) {
    console.error('Error fetching team messages:', err);
    return [];
  }
};

export const createTeamMessage = async (message: Omit<TeamMessage, 'id'>): Promise<void> => {
  try {
    const payload = { ...message, created_at: message.created_at || new Date().toISOString() };
    const { error } = await supabase.from('team_messages').insert(payload);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating team message:', err);
    throw err;
  }
};

export const updateTeamMessage = async (id: string, updates: Partial<TeamMessage>): Promise<void> => {
  try {
    const { error } = await supabase.from('team_messages').update(updates).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('Error updating team message:', err);
    throw err;
  }
};

export const deleteTeamMessage = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the team message data before deletion
    const { data: teamMessage } = await supabase
      .from('team_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (!teamMessage) throw new Error('Team message not found');

    // Insert into recycle bin
    const { error: recycleError } = await supabase
      .from('recycle_bin_items')
      .insert({
        item_type: RecycleBinItemType.TEAM_MESSAGE,
        item_id: id,
        original_data: teamMessage,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        ...generateRecycleBinMeta(),
      });

    if (recycleError) throw recycleError;

    // Soft delete the team message (using type assertion as table may not have soft delete columns)
    const { error } = await supabase
      .from('team_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Error deleting team message:', err);
    throw err;
  }
};

export const restoreTeamMessage = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check user role (Owner/Developer only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Update recycle bin item as restored
    await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.TEAM_MESSAGE);

    // Restore the team message (using type assertion as table may not have soft delete columns)
    const { error } = await supabase
      .from('team_messages')
      .update({
        is_deleted: false,
        deleted_at: null,
      } as any)
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Error restoring team message:', err);
    throw err;
  }
};

// --- CALL MONITORING SERVICE ---

export const fetchCallLogs = async (): Promise<CallLogEntry[]> => {
  try {
    const { data, error } = await supabase.from('call_logs').select('*').order('occurred_at', { ascending: false });
    if (error) throw error;
    return (data as CallLogEntry[]) || [];
  } catch (err) {
    console.error('Error fetching call logs:', err);
    throw err;
  }
};

export const fetchInquiries = async (): Promise<Inquiry[]> => {
  try {
    const { data, error } = await supabase.from('inquiries').select('*').order('occurred_at', { ascending: false });
    if (error) throw error;
    return (data as Inquiry[]) || [];
  } catch (err) {
    console.error('Error fetching inquiries:', err);
    throw err;
  }
};

export const fetchPurchases = async (): Promise<Purchase[]> => {
  try {
    const { data, error } = await supabase.from('purchases').select('*').order('purchased_at', { ascending: false });
    if (error) throw error;
    return (data as Purchase[]) || [];
  } catch (err) {
    console.error('Error fetching purchases:', err);
    throw err;
  }
};

export const createInquiry = async (payload: Omit<Inquiry, 'id'>): Promise<void> => {
  try {
    const { error } = await supabase.from('inquiries').insert(payload);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating inquiry:', err);
    throw err;
  }
};

export const subscribeToCallMonitoringUpdates = (onChange: () => void) => {
  const channel = supabase.channel('call-monitoring-realtime');
  const tables = ['call_logs', 'inquiries', 'purchases', 'contacts'];
  tables.forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      onChange();
    });
  });

  channel.subscribe();

  return () => {
    if (typeof supabase.removeChannel === 'function') {
      supabase.removeChannel(channel);
    }
  };
};

// --- CUSTOMER DATABASE ENHANCEMENTS ---

// Personal Comments
export const fetchPersonalComments = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('personal_comments')
      .select('*')
      .eq('contact_id', contactId)
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching personal comments:', err);
    return [];
  }
};

export const createPersonalComment = async (contactId: string, authorId: string, authorName: string, text: string, authorAvatar?: string) => {
  try {
    const { error } = await supabase.from('personal_comments').insert({
      contact_id: contactId,
      author_id: authorId,
      author_name: authorName,
      author_avatar: authorAvatar,
      text,
      timestamp: new Date().toISOString()
    });
    if (error) throw error;
  } catch (err) {
    console.error('Error creating personal comment:', err);
    throw err;
  }
};

// Sales Reports
export const fetchSalesReports = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('sales_reports')
      .select('*')
      .eq('contact_id', contactId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sales reports:', err);
    return [];
  }
};

export const createSalesReport = async (report: any) => {
  try {
    const { error } = await supabase.from('sales_reports').insert(report);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating sales report:', err);
    throw err;
  }
};

export const updateSalesReportApproval = async (reportId: string, approvalStatus: string, approvedBy?: string) => {
  try {
    const { error } = await supabase
      .from('sales_reports')
      .update({
        approval_status: approvalStatus,
        approved_by: approvedBy,
        approval_date: new Date().toISOString()
      })
      .eq('id', reportId);
    if (error) throw error;
  } catch (err) {
    console.error('Error updating sales report approval:', err);
    throw err;
  }
};

// Discount Requests
export const fetchDiscountRequests = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('discount_requests')
      .select('*')
      .eq('contact_id', contactId)
      .order('request_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching discount requests:', err);
    return [];
  }
};

export const createDiscountRequest = async (request: any) => {
  try {
    const { error } = await supabase.from('discount_requests').insert(request);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating discount request:', err);
    throw err;
  }
};

export const updateDiscountRequestApproval = async (requestId: string, status: string, approvedBy?: string) => {
  try {
    const { error } = await supabase
      .from('discount_requests')
      .update({
        status,
        approved_by: approvedBy,
        approval_date: new Date().toISOString()
      })
      .eq('id', requestId);
    if (error) throw error;
  } catch (err) {
    console.error('Error updating discount request:', err);
    throw err;
  }
};

// Updated Contact Details
export const fetchUpdatedContactDetails = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('updated_contact_details')
      .select('*')
      .eq('contact_id', contactId)
      .order('submitted_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching updated contact details:', err);
    return [];
  }
};

export const fetchPendingContactUpdates = async () => {
  try {
    const { data, error } = await supabase
      .from('updated_contact_details')
      .select('*, contacts:contact_id (id, company, name)')
      .eq('approval_status', 'pending')
      .order('submitted_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching pending contact updates:', err);
    return [];
  }
};

export const createUpdatedContactDetails = async (details: any) => {
  try {
    const { error } = await supabase.from('updated_contact_details').insert(details);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating updated contact details:', err);
    throw err;
  }
};

export const approveContactDetailsUpdate = async (updateId: string, approvedBy: string) => {
  try {
    const { error } = await supabase
      .from('updated_contact_details')
      .update({
        approval_status: 'approved',
        approved_by: approvedBy,
        approval_date: new Date().toISOString()
      })
      .eq('id', updateId);
    if (error) throw error;
  } catch (err) {
    console.error('Error approving contact details update:', err);
    throw err;
  }
};

// Sales Progress
export const fetchSalesProgress = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('sales_progress')
      .select('*')
      .eq('contact_id', contactId)
      .order('inquiry_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sales progress:', err);
    return [];
  }
};

export const createSalesProgress = async (progress: any) => {
  try {
    const { error } = await supabase.from('sales_progress').insert(progress);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating sales progress:', err);
    throw err;
  }
};

export const updateSalesProgress = async (progressId: string, updates: any) => {
  try {
    const { error } = await supabase
      .from('sales_progress')
      .update(updates)
      .eq('id', progressId);
    if (error) throw error;
  } catch (err) {
    console.error('Error updating sales progress:', err);
    throw err;
  }
};

// Incident Reports
export const fetchIncidentReports = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('incident_reports')
      .select('*')
      .eq('contact_id', contactId)
      .order('report_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching incident reports:', err);
    return [];
  }
};

export const createIncidentReport = async (report: CreateIncidentReportInput) => {
  try {
    const { error } = await supabase.from('incident_reports').insert(report);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating incident report:', err);
    throw err;
  }
};

// Fetch all transactions for a contact (for incident report attachment and customer history)
export const fetchContactTransactions = async (contactId: string) => {
  try {
    const transactions: any[] = [];

    // Fetch Sales Inquiries
    const { data: inquiries } = await supabase
      .from('sales_inquiries')
      .select('id, inquiry_no, sales_date, grand_total, status')
      .eq('contact_id', contactId)
      .eq('is_deleted', false)
      .order('sales_date', { ascending: false });

    if (inquiries) {
      transactions.push(...inquiries.map(inq => ({
        id: inq.id,
        type: 'sales_inquiry',
        number: inq.inquiry_no,
        date: inq.sales_date,
        amount: inq.grand_total,
        status: inq.status, // e.g. 'Draft', 'Converted'
        label: `Inquiry ${inq.inquiry_no}`
      })));
    }

    // Fetch Sales Orders
    const { data: orders } = await supabase
      .from('sales_orders')
      .select('id, order_no, sales_date, grand_total, status')
      .eq('contact_id', contactId)
      .eq('is_deleted', false)
      .order('sales_date', { ascending: false });

    if (orders) {
      transactions.push(...orders.map(order => ({
        id: order.id,
        type: 'sales_order',
        number: order.order_no,
        date: order.sales_date,
        amount: order.grand_total,
        status: order.status,
        label: `Order ${order.order_no}`
      })));
    }

    // Fetch Order Slips
    const { data: slips } = await (supabase
      .from('order_slips')
      .select('id, slip_no, sales_date, grand_total, status') as any) // Type assertion to bypass incorrect schema inference
      .eq('contact_id', contactId)
      .eq('is_deleted', false)
      .order('sales_date', { ascending: false });

    if (slips) {
      transactions.push(...(slips as any[]).map(slip => ({
        id: slip.id,
        type: 'order_slip',
        number: slip.slip_no,
        date: slip.sales_date,
        amount: slip.grand_total,
        status: slip.status,
        label: `Order Slip ${slip.slip_no}`
      })));
    }

    // Fetch Invoices
    // Note: invoices schema uses invoice_no, sales_date, grand_total (see supabase migrations)
    const { data: invoices } = await (supabase
      .from('invoices')
      .select('id, invoice_no, sales_date, grand_total, status') as any) // Type assertion to bypass incorrect schema inference
      .eq('contact_id', contactId)
      .eq('is_deleted', false)
      .order('sales_date', { ascending: false });

    if (invoices) {
      transactions.push(...(invoices as any[]).map(inv => ({
        id: inv.id,
        type: 'invoice',
        number: inv.invoice_no,
        date: inv.sales_date,
        amount: inv.grand_total,
        status: inv.status,
        label: `Invoice ${inv.invoice_no}`
      })));
    }

    // Fetch Purchase History (Legacy/Manual entries)
    const { data: purchases } = await supabase
      .from('purchase_history')
      .select('id, invoice_number, purchase_date, total_amount, payment_status')
      .eq('contact_id', contactId)
      .order('purchase_date', { ascending: false });

    if (purchases) {
      transactions.push(...purchases.map(purchase => ({
        id: purchase.id,
        type: 'purchase_history',
        number: purchase.invoice_number || `PH-${purchase.id.substring(0, 8)}`,
        date: purchase.purchase_date,
        amount: purchase.total_amount,
        status: purchase.payment_status,
        label: `Purchase ${purchase.invoice_number || purchase.id.substring(0, 8)}`
      })));
    }

    // Sort all transactions by date (most recent first)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return transactions;
  } catch (err) {
    console.error('Error fetching contact transactions:', err);
    return [];
  }
};

export const approveIncidentReport = async (reportId: string, approvedBy: string) => {
  try {
    const { error } = await supabase
      .from('incident_reports')
      .update({
        approval_status: 'approved',
        approved_by: approvedBy,
        approval_date: new Date().toISOString()
      })
      .eq('id', reportId);
    if (error) throw error;
  } catch (err) {
    console.error('Error approving incident report:', err);
    throw err;
  }
};

export const rejectIncidentReport = async (reportId: string, rejectedBy: string, notes?: string) => {
  try {
    const updateData: any = {
      approval_status: 'rejected',
      approved_by: rejectedBy,
      approval_date: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { error } = await supabase
      .from('incident_reports')
      .update(updateData)
      .eq('id', reportId);
    if (error) throw error;
  } catch (err) {
    console.error('Error rejecting incident report:', err);
    throw err;
  }
};

export const fetchAllPendingIncidentReports = async () => {
  try {
    const { data, error } = await supabase
      .from('incident_reports')
      .select(`
        *,
        contacts (
          company,
          city,
          salesman
        )
      `)
      .eq('approval_status', 'pending')
      .order('report_date', { ascending: false });

    if (error) throw error;

    // Transform the data to flatten the customer information
    return data?.map(report => ({
      ...report,
      customer_company: report.contacts?.company || 'Unknown',
      customer_city: report.contacts?.city || 'Unknown',
      customer_salesman: report.contacts?.salesman || 'Unknown'
    })) || [];
  } catch (err) {
    console.error('Error fetching pending incident reports:', err);
    throw err;
  }
};

// Sales Returns
export const fetchSalesReturns = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('sales_returns')
      .select('*')
      .eq('contact_id', contactId)
      .order('return_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sales returns:', err);
    return [];
  }
};

export const createSalesReturn = async (returnData: any) => {
  try {
    const { error } = await supabase.from('sales_returns').insert(returnData);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating sales return:', err);
    throw err;
  }
};

export const processSalesReturn = async (returnId: string, processedBy: string) => {
  try {
    const { error } = await supabase
      .from('sales_returns')
      .update({
        status: 'processed',
        processed_by: processedBy,
        processed_date: new Date().toISOString()
      })
      .eq('id', returnId);
    if (error) throw error;
  } catch (err) {
    console.error('Error processing sales return:', err);
    throw err;
  }
};

// Purchase History
export const fetchPurchaseHistory = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('purchase_history')
      .select('*')
      .eq('contact_id', contactId)
      .order('purchase_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching purchase history:', err);
    return [];
  }
};

export const createPurchaseHistoryEntry = async (entry: any) => {
  try {
    const { error } = await supabase.from('purchase_history').insert(entry);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating purchase history entry:', err);
    throw err;
  }
};

// Inquiry History
export const fetchInquiryHistory = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('inquiry_history')
      .select('*')
      .eq('contact_id', contactId)
      .order('inquiry_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching inquiry history:', err);
    return [];
  }
};

export const createInquiryHistoryEntry = async (entry: any) => {
  try {
    const { error } = await supabase.from('inquiry_history').insert(entry);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating inquiry history entry:', err);
    throw err;
  }
};

// Payment Terms
export const fetchPaymentTerms = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('payment_terms')
      .select('*')
      .eq('contact_id', contactId)
      .order('changed_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching payment terms:', err);
    return [];
  }
};

export const createPaymentTerms = async (terms: any) => {
  try {
    const { error } = await supabase.from('payment_terms').insert(terms);
    if (error) throw error;
  } catch (err) {
    console.error('Error creating payment terms:', err);
    throw err;
  }
};

// Customer Metrics
export const fetchCustomerMetrics = async (contactId: string) => {
  try {
    const { data, error } = await supabase
      .from('customer_metrics')
      .select('*')
      .eq('contact_id', contactId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (err) {
    console.error('Error fetching customer metrics:', err);
    return null;
  }
};

export const updateCustomerMetrics = async (contactId: string, metrics: any) => {
  try {
    const { data: existing } = await supabase
      .from('customer_metrics')
      .select('id')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('customer_metrics')
        .update(metrics)
        .eq('contact_id', contactId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('customer_metrics')
        .insert({ contact_id: contactId, ...metrics });
      if (error) throw error;
    }
  } catch (err) {
    console.error('Error updating customer metrics:', err);
    throw err;
  }
};

// Management Page Functions
export const fetchInactiveCustomers = async (inactiveDays: number = 30): Promise<any[]> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('contacts')
      .select('*, customer_metrics(*)')
      .eq('status', 'Inactive')
      .lte('customer_metrics.last_purchase_date', cutoffDateStr);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching inactive customers:', err);
    return [];
  }
};

export const fetchInactiveCriticalCustomers = async (inactiveDays: number = 30): Promise<any[]> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('contacts')
      .select('*, customer_metrics(*)')
      .eq('status', 'Inactive')
      .lte('customer_metrics.last_purchase_date', cutoffDateStr)
      .gt('customer_metrics.outstanding_balance', 0);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching inactive critical customers:', err);
    return [];
  }
};

export const fetchInquiryOnlyCustomers = async (minRatio: number = 2): Promise<any[]> => {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*');

    if (error) throw error;

    // Fetch inquiry and purchase data for each contact
    const inquiryOnlyCustomers = [];
    for (const contact of contacts || []) {
      const { data: inquiries } = await supabase
        .from('inquiry_history')
        .select('*')
        .eq('contact_id', contact.id);

      const { data: purchases } = await supabase
        .from('purchase_history')
        .select('*')
        .eq('contact_id', contact.id);

      const inquiryCount = inquiries?.length || 0;
      const purchaseCount = purchases?.length || 0;

      if (purchaseCount > 0 && inquiryCount / purchaseCount >= minRatio) {
        inquiryOnlyCustomers.push({
          ...contact,
          totalInquiries: inquiryCount,
          totalPurchases: purchaseCount,
          inquiryToPurchaseRatio: (inquiryCount / purchaseCount).toFixed(2)
        });
      } else if (purchaseCount === 0 && inquiryCount > 0) {
        inquiryOnlyCustomers.push({
          ...contact,
          totalInquiries: inquiryCount,
          totalPurchases: 0,
          inquiryToPurchaseRatio: 'Infinity'
        });
      }
    }

    return inquiryOnlyCustomers;
  } catch (err) {
    console.error('Error fetching inquiry-only customers:', err);
    return [];
  }
};

export const fetchMonthlySalesPerformanceBySalesperson = async (year: number, month: number): Promise<any[]> => {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*, purchase_history(*)')
      .order('salesman');

    if (error) throw error;

    const performanceMap = new Map();

    for (const contact of contacts || []) {
      const salesman = contact.salesman || 'Unassigned';
      const purchases = contact.purchase_history || [];

      // Filter purchases for the specific month/year
      let monthSales = 0;
      let prevMonthSales = 0;

      for (const purchase of purchases) {
        const purchaseDate = new Date(purchase.purchase_date);
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === month) {
          monthSales += (purchase.total_amount as number) || 0;
        }
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === (month === 1 ? 12 : month - 1)) {
          prevMonthSales += (purchase.total_amount as number) || 0;
        }
      }

      if (monthSales > 0 || prevMonthSales > 0) {
        if (!performanceMap.has(salesman)) {
          performanceMap.set(salesman, {
            salesPersonName: salesman,
            currentMonthSales: 0,
            previousMonthSales: 0,
            customerCount: 0
          });
        }

        const perf = performanceMap.get(salesman);
        perf.currentMonthSales += monthSales;
        perf.previousMonthSales += prevMonthSales;
        perf.customerCount += 1;
      }
    }

    // Calculate deltas
    const results = Array.from(performanceMap.values()).map((perf: any) => ({
      ...perf,
      salesChange: perf.currentMonthSales - perf.previousMonthSales,
      percentageChange: perf.previousMonthSales > 0
        ? ((perf.currentMonthSales - perf.previousMonthSales) / perf.previousMonthSales * 100)
        : 0
    }));

    return results;
  } catch (err) {
    console.error('Error fetching sales performance by salesperson:', err);
    return [];
  }
};

export const fetchMonthlySalesPerformanceByCity = async (year: number, month: number): Promise<any[]> => {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*, purchase_history(*)')
      .order('city');

    if (error) throw error;

    const performanceMap = new Map();

    for (const contact of contacts || []) {
      const city = contact.city || 'Unknown';
      const purchases = contact.purchase_history || [];

      let monthSales = 0;
      let prevMonthSales = 0;

      for (const purchase of purchases) {
        const purchaseDate = new Date(purchase.purchase_date);
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === month) {
          monthSales += (purchase.total_amount as number) || 0;
        }
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === (month === 1 ? 12 : month - 1)) {
          prevMonthSales += (purchase.total_amount as number) || 0;
        }
      }

      if (monthSales > 0 || prevMonthSales > 0) {
        if (!performanceMap.has(city)) {
          performanceMap.set(city, {
            city,
            currentMonthSales: 0,
            previousMonthSales: 0,
            customerCount: 0
          });
        }

        const perf = performanceMap.get(city);
        perf.currentMonthSales += monthSales;
        perf.previousMonthSales += prevMonthSales;
        perf.customerCount += 1;
      }
    }

    const results = Array.from(performanceMap.values()).map((perf: any) => ({
      ...perf,
      salesChange: perf.currentMonthSales - perf.previousMonthSales,
      percentageChange: perf.previousMonthSales > 0
        ? ((perf.currentMonthSales - perf.previousMonthSales) / perf.previousMonthSales * 100)
        : 0
    }));

    return results;
  } catch (err) {
    console.error('Error fetching sales performance by city:', err);
    return [];
  }
};

export const fetchSalesPerformanceByCustomerStatus = async (year: number, month: number): Promise<any[]> => {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*, purchase_history(*)');

    if (error) throw error;

    const performanceMap = new Map();
    const statusOrder = ['Active', 'Inactive', 'Prospective', 'Blacklisted'];

    for (const contact of contacts || []) {
      const status = contact.status || 'Unknown';
      const purchases = contact.purchase_history || [];

      let monthSales = 0;
      let prevMonthSales = 0;

      for (const purchase of purchases) {
        const purchaseDate = new Date(purchase.purchase_date);
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === month) {
          monthSales += (purchase.total_amount as number) || 0;
        }
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === (month === 1 ? 12 : month - 1)) {
          prevMonthSales += (purchase.total_amount as number) || 0;
        }
      }

      if (monthSales > 0 || prevMonthSales > 0) {
        if (!performanceMap.has(status)) {
          performanceMap.set(status, {
            status,
            currentMonthSales: 0,
            previousMonthSales: 0,
            customerCount: 0
          });
        }

        const perf = performanceMap.get(status);
        perf.currentMonthSales += monthSales;
        perf.previousMonthSales += prevMonthSales;
        perf.customerCount += 1;
      }
    }

    const results = statusOrder
      .filter(s => performanceMap.has(s))
      .map(s => {
        const perf = performanceMap.get(s);
        return {
          ...perf,
          salesChange: perf.currentMonthSales - perf.previousMonthSales,
          percentageChange: perf.previousMonthSales > 0
            ? ((perf.currentMonthSales - perf.previousMonthSales) / perf.previousMonthSales * 100)
            : 0
        };
      });

    return results;
  } catch (err) {
    console.error('Error fetching sales performance by customer status:', err);
    return [];
  }
};

export const fetchSalesPerformanceByPaymentType = async (year: number, month: number): Promise<any[]> => {
  try {
    const { data: paymentTerms, error } = await supabase
      .from('payment_terms')
      .select('*, purchase_history(*)');

    if (error) throw error;

    const performanceMap = new Map(['cash', 'credit', 'term'].map(t => [t, {
      paymentType: t,
      currentMonthSales: 0,
      previousMonthSales: 0,
      customerCount: new Set()
    }]));

    for (const term of paymentTerms || []) {
      const termType = term.terms_type || 'cash';
      const purchases = term.purchase_history || [];

      for (const purchase of purchases) {
        const purchaseDate = new Date(purchase.purchase_date);
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === month) {
          performanceMap.get(termType).currentMonthSales += parseFloat(purchase.total_amount) || 0;
          performanceMap.get(termType).customerCount.add(term.contact_id);
        }
        if (purchaseDate.getFullYear() === year && purchaseDate.getMonth() + 1 === (month === 1 ? 12 : month - 1)) {
          performanceMap.get(termType).previousMonthSales += parseFloat(purchase.total_amount) || 0;
        }
      }
    }

    const results = Array.from(performanceMap.values()).map((perf: any) => ({
      paymentType: perf.paymentType,
      currentMonthSales: perf.currentMonthSales,
      previousMonthSales: perf.previousMonthSales,
      customerCount: perf.customerCount.size,
      salesChange: perf.currentMonthSales - perf.previousMonthSales,
      percentageChange: perf.previousMonthSales > 0
        ? ((perf.currentMonthSales - perf.previousMonthSales) / perf.previousMonthSales * 100)
        : 0
    }));

    return results;
  } catch (err) {
    console.error('Error fetching sales performance by payment type:', err);
    return [];
  }
};

// --- NOTIFICATIONS SERVICE ---

export const fetchNotifications = async (userId: string, limit: number = 50): Promise<Notification[]> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as Notification[]) || [];
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return [];
  }
};

export const fetchUnreadNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .eq('is_deleted', false)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Notification[]) || [];
  } catch (err) {
    console.error('Error fetching unread notifications:', err);
    return [];
  }
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('recipient_id', userId)
      .eq('is_deleted', false)
      .eq('is_read', false);
    if (error) throw error;
    return data?.length || 0;
  } catch (err) {
    console.error('Error getting unread count:', err);
    return 0;
  }
};

const NOTIFICATION_RETRY_ATTEMPTS = 3;
const NOTIFICATION_BACKOFF_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withNotificationRetry = async <T>(operation: () => Promise<T>, context: string): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= NOTIFICATION_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < NOTIFICATION_RETRY_ATTEMPTS) {
        await sleep(NOTIFICATION_BACKOFF_MS * Math.pow(2, attempt - 1));
      }
    }
  }
  throw new Error(`Notification dispatch failed: ${context}. ${String(lastError)}`);
};

const buildDefaultIdempotencyKey = (
  recipientId: string,
  title: string,
  action: string,
  entityType: string,
  entityId: string,
  status?: string
) => [recipientId, action, entityType, entityId, status || 'unknown', title].join(':');

const normalizeNotificationPayload = (
  recipientId: string,
  title: string,
  type: NotificationType,
  actionUrl?: string,
  metadata?: Partial<StandardNotificationPayload> & Record<string, unknown>
): StandardNotificationPayload => {
  const action = String(metadata?.action || title || 'notify');
  const entityType = String(metadata?.entity_type || 'system');
  const entityId = String(metadata?.entity_id || recipientId);
  const status = metadata?.status ? String(metadata.status) : 'created';
  const normalizedActionUrl = actionUrl || metadata?.action_url ? String(actionUrl || metadata?.action_url) : undefined;

  return {
    ...metadata,
    actor_id: String(metadata?.actor_id || 'system'),
    actor_role: String(metadata?.actor_role || 'system'),
    entity_type: entityType,
    entity_id: entityId,
    org_id: metadata?.org_id ? String(metadata.org_id) : undefined,
    tenant: metadata?.tenant ? String(metadata.tenant) : undefined,
    severity: (metadata?.severity as NotificationType) || type,
    action,
    status,
    action_url: normalizedActionUrl,
    idempotency_key: String(
      metadata?.idempotency_key ||
      buildDefaultIdempotencyKey(recipientId, title, action, entityType, entityId, status)
    ),
    correlation_id: metadata?.correlation_id ? String(metadata.correlation_id) : undefined,
  };
};

const findExistingNotificationByIdempotency = async (
  recipientId: string,
  idempotencyKey: string
): Promise<Notification | null> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .contains('metadata', { idempotency_key: idempotencyKey })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Notification) || null;
};

export const createNotification = async (input: CreateNotificationInput): Promise<Notification | null> => {
  try {
    const metadata = normalizeNotificationPayload(
      input.recipient_id,
      input.title,
      input.type,
      input.action_url,
      input.metadata
    );
    const existing = await findExistingNotificationByIdempotency(input.recipient_id, metadata.idempotency_key);
    if (existing) return existing;

    const payload: CreateNotificationInput = {
      ...input,
      action_url: input.action_url || metadata.action_url,
      metadata,
    };

    const created = await withNotificationRetry(async () => {
      const { data, error } = await supabase
        .from('notifications')
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as Notification) || null;
    }, `create notification for recipient ${input.recipient_id}`);

    return created;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
};

export const createBulkNotifications = async (inputs: CreateNotificationInput[]): Promise<Notification[]> => {
  try {
    const settled = await Promise.all(inputs.map((input) => createNotification(input)));
    return settled.filter((notification): notification is Notification => Boolean(notification));
  } catch (err) {
    console.error('Error creating bulk notifications:', err);
    return [];
  }
};

export const markAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return false;
  }
};

export const markAllAsRead = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return false;
  }
};

export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the notification data before deletion
    const { data: notification } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (!notification) throw new Error('Notification not found');

    // Insert into recycle bin
    const { error: recycleError } = await supabase
      .from('recycle_bin_items')
      .insert({
        item_type: RecycleBinItemType.NOTIFICATION,
        item_id: notificationId,
        original_data: notification,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        ...generateRecycleBinMeta(),
      });

    if (recycleError) throw recycleError;

    // Soft delete the notification
    const { error } = await supabase
      .from('notifications')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting notification:', err);
    return false;
  }
};

export const restoreNotification = async (id: string): Promise<boolean> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check user role (Owner/Developer only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Update recycle bin item as restored
    await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.NOTIFICATION);

    // Restore the notification
    const { error } = await supabase
      .from('notifications')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error restoring notification:', err);
    return false;
  }
};

export interface NotificationSubscriptionCallbacks {
  onInsert: (notification: Notification) => void;
  onStatusChange?: (status: RealtimeChannelStatus) => void;
  onError?: (error: Error) => void;
}

export const subscribeToNotifications = (
  userId: string,
  callbacks: NotificationSubscriptionCallbacks
): (() => void) => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        try {
          callbacks.onInsert(payload.new as Notification);
        } catch (error) {
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe((status) => {
      callbacks.onStatusChange?.(status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks.onError?.(new Error(`Notification subscription status: ${status}`));
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// --- NOTIFICATION HELPER FUNCTIONS ---

export interface NotificationActorContext {
  actorId: string;
  actorRole: string;
}

export interface NotifyWorkflowEventInput {
  title: string;
  message: string;
  type: NotificationType;
  action: string;
  status: string;
  entityType: string;
  entityId: string;
  actionUrl?: string;
  includeActor?: boolean;
  actorId?: string;
  actorRole?: string;
  targetRoles?: string[];
  targetUserIds?: string[];
  orgId?: string;
  tenant?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

const fetchRoleRecipientIds = async (roles: string[]): Promise<string[]> => {
  if (!roles.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .in('role', roles);
  if (error) throw error;
  return ((data as Array<{ id: string; role: string }>) || []).map((profile) => profile.id);
};

export const getCurrentNotificationActor = async (): Promise<NotificationActorContext | null> => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const actor = authData?.user;
    if (!actor) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', actor.id)
      .maybeSingle();

    return {
      actorId: actor.id,
      actorRole: (profile as { role?: string } | null)?.role || 'Unknown',
    };
  } catch (err) {
    console.error('Unable to resolve notification actor context:', err);
    return null;
  }
};

export const dispatchWorkflowNotification = async (input: NotifyWorkflowEventInput): Promise<Notification[]> => {
  try {
    const actorContext = input.actorId
      ? {
        actorId: input.actorId,
        actorRole: input.actorRole || 'Unknown',
      }
      : await getCurrentNotificationActor();

    const actorId = actorContext?.actorId || 'system';
    const actorRole = actorContext?.actorRole || 'system';
    const roleRecipients = await fetchRoleRecipientIds(input.targetRoles || []);
    const recipients = new Set<string>([...(input.targetUserIds || []), ...roleRecipients]);
    if (input.includeActor !== false) recipients.add(actorId);

    const notificationInputs: CreateNotificationInput[] = Array.from(recipients).map((recipientId) => ({
      recipient_id: recipientId,
      title: input.title,
      message: input.message,
      type: input.type,
      action_url: input.actionUrl,
      metadata: normalizeNotificationPayload(
        recipientId,
        input.title,
        input.type,
        input.actionUrl,
        {
          actor_id: actorId,
          actor_role: actorRole,
          entity_type: input.entityType,
          entity_id: input.entityId,
          action: input.action,
          status: input.status,
          action_url: input.actionUrl,
          org_id: input.orgId,
          tenant: input.tenant,
          severity: input.type,
          correlation_id: input.correlationId,
          ...input.metadata,
        }
      )
    }));

    return createBulkNotifications(notificationInputs);
  } catch (err) {
    console.error('Error dispatching workflow notification:', err);
    return [];
  }
};

export const notifyUser = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  actionUrl?: string,
  metadata?: Partial<StandardNotificationPayload> & Record<string, unknown>
): Promise<Notification | null> => {
  return createNotification({
    recipient_id: userId,
    title,
    message,
    type,
    action_url: actionUrl,
    metadata: normalizeNotificationPayload(userId, title, type, actionUrl, metadata)
  });
};

export const notifyRole = async (
  role: string,
  title: string,
  message: string,
  type: NotificationType,
  actionUrl?: string,
  metadata?: Partial<StandardNotificationPayload> & Record<string, unknown>
): Promise<Notification[]> => {
  try {
    const recipientIds = await fetchRoleRecipientIds([role]);
    const inputs: CreateNotificationInput[] = recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      title,
      message,
      type,
      action_url: actionUrl,
      metadata: normalizeNotificationPayload(recipientId, title, type, actionUrl, metadata),
    }));
    return createBulkNotifications(inputs);
  } catch (err) {
    console.error('Error notifying role:', err);
    return [];
  }
};

export const notifyAll = async (
  title: string,
  message: string,
  type: NotificationType,
  actionUrl?: string,
  metadata?: Partial<StandardNotificationPayload> & Record<string, unknown>
): Promise<Notification[]> => {
  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id');

    if (profileError) throw profileError;

    const inputs: CreateNotificationInput[] = ((profiles as Array<{ id: string }> | null) || []).map((profile) => ({
      recipient_id: profile.id,
      title,
      message,
      type,
      action_url: actionUrl,
      metadata: normalizeNotificationPayload(profile.id, title, type, actionUrl, metadata)
    }));

    return createBulkNotifications(inputs);
  } catch (err) {
    console.error('Error notifying all:', err);
    return [];
  }
};

// --- Sales Performance Leaderboard Services ---

export const fetchAgentPerformanceLeaderboard = async (startDate: string, endDate: string): Promise<AgentSalesData[]> => {
  try {
    const { data, error } = await supabase
      .from('agent_sales_summary')
      .select(`
        agent_id,
        total_sales,
        profiles:agent_id (
          full_name,
          avatar_url
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    // Aggregate by agent and sort
    const agentMap = new Map<string, { total_sales: number; profile: any }>();
    (data || []).forEach((row: any) => {
      const existing = agentMap.get(row.agent_id);
      if (existing) {
        existing.total_sales += row.total_sales;
      } else {
        agentMap.set(row.agent_id, {
          total_sales: row.total_sales,
          profile: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        });
      }
    });

    // Convert to array and sort
    const leaderboard: AgentSalesData[] = Array.from(agentMap.entries())
      .map(([agent_id, { total_sales, profile }], idx) => ({
        agent_id,
        agent_name: profile?.full_name || 'Unknown',
        avatar_url: profile?.avatar_url,
        total_sales,
        rank: idx + 1
      }))
      .sort((a, b) => b.total_sales - a.total_sales)
      .map((agent, idx) => ({ ...agent, rank: idx + 1 }));

    return leaderboard;
  } catch (err) {
    console.error('Error fetching agent performance leaderboard:', err);
    return [];
  }
};

export const fetchAgentPerformanceSummary = async (agentId: string, startDate: string, endDate: string): Promise<AgentPerformanceSummary | null> => {
  try {
    // Fetch agent profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', agentId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) return null;

    // Fetch aggregated sales from purchases
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .select(`
        amount,
        purchased_at,
        contacts:contact_id (
          id,
          company,
          status,
          salesman
        )
      `)
      .gte('purchased_at', startDate)
      .lte('purchased_at', endDate);

    if (purchaseError) throw purchaseError;

    // Fetch sales returns
    const { data: returnsData, error: returnsError } = await supabase
      .from('supplier_returns' as any)
      .select('*')
      .select('*')
      .eq('supplier_id', agentId); // Assuming agent ID might be used, or we need another way to link returns to agents if needed.
    // However, for the agent summary, we usually focus on sales.
    // If we need returns for the agent, we might need to look at returns linked to their customers.

    // For now, let's stick to the purchase data for sales.


    // Filter purchases by agent (salesman field)
    const agentPurchases = (purchaseData || []).filter((p: any) => {
      const contact = Array.isArray(p.contacts) ? p.contacts[0] : p.contacts;
      return contact?.salesman === profileData.full_name || contact?.salesman === agentId;
    });

    const totalSales = agentPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Calculate sales breakdown by customer status
    let activeSales = 0;
    let prospectiveSales = 0;
    let inactiveSales = 0;

    agentPurchases.forEach((p: any) => {
      const contact = Array.isArray(p.contacts) ? p.contacts[0] : p.contacts;
      const status = (contact?.status || 'Unknown').toLowerCase();
      const amount = Number(p.amount) || 0;

      if (status === 'active') {
        activeSales += amount;
      } else if (status === 'prospective') {
        prospectiveSales += amount;
      } else if (status === 'inactive') {
        inactiveSales += amount;
      }
    });

    // Fetch customer breakdown from agent_customer_breakdown table
    const { data: breakdownData, error: breakdownError } = await supabase
      .from('agent_customer_breakdown')
      .select('*')
      .eq('agent_id', agentId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (breakdownError) throw breakdownError;

    const prospectiveCount = (breakdownData || []).reduce((sum, b) => sum + b.prospective_count, 0);
    const activeCount = (breakdownData || []).reduce((sum, b) => sum + b.active_count, 0);
    const inactiveCount = (breakdownData || []).reduce((sum, b) => sum + b.inactive_count, 0);

    // Fetch top 5 customers
    const { data: topCustomersData, error: topCustomersError } = await supabase
      .from('agent_top_customers')
      .select(`
        *,
        contacts:contact_id (
          id,
          company
        )
      `)
      .eq('agent_id', agentId)
      .order('rank', { ascending: true })
      .limit(5);

    if (topCustomersError) throw topCustomersError;

    const topCustomers: TopCustomer[] = (topCustomersData || []).map((tc: any) => ({
      id: tc.contact_id,
      company: (Array.isArray(tc.contacts) ? tc.contacts[0] : tc.contacts)?.company || 'Unknown',
      total_sales: tc.total_sales,
      last_purchase_date: tc.last_purchase_date
    }));

    const monthlyQuota = profileData.monthly_quota || 0;
    const remainingQuota = Math.max(0, monthlyQuota - totalSales);
    const achievementPercentage = monthlyQuota > 0 ? (totalSales / monthlyQuota) * 100 : 0;

    return {
      agent_id: agentId,
      agent_name: profileData.full_name || 'Unknown',
      avatar_url: profileData.avatar_url,
      monthly_quota: monthlyQuota,
      current_achievement: totalSales,
      remaining_quota: remainingQuota,
      achievement_percentage: achievementPercentage,
      prospective_count: prospectiveCount,
      active_count: activeCount,
      inactive_count: inactiveCount,
      active_sales: activeSales,
      prospective_sales: prospectiveSales,
      inactive_sales: inactiveSales,
      top_customers: topCustomers
    };
  } catch (err) {
    console.error('Error fetching agent performance summary:', err);
    return null;
  }
};

// --- CONTACT SOFT DELETE FUNCTIONS ---

export const deleteContact = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the contact data before deletion
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (!contact) throw new Error('Contact not found');

    // Insert into recycle bin
    const { error: recycleError } = await supabase
      .from('recycle_bin_items')
      .insert({
        item_type: RecycleBinItemType.CONTACT,
        item_id: id,
        original_data: contact,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        ...generateRecycleBinMeta(),
      });

    if (recycleError) throw recycleError;

    // Soft delete the contact
    const { error } = await supabase
      .from('contacts')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    try {
      await logDelete(ENTITY_TYPES.CONTACT, id, {
        company: contact.company,
        contact_type: contact.transactionType,
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }
  } catch (err) {
    console.error("Error deleting contact:", err);
    throw err;
  }
};

export const restoreContact = async (id: string): Promise<void> => {
  try {
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check user role (Owner/Developer only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Update recycle bin item as restored
    await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', id)
      .eq('item_type', RecycleBinItemType.CONTACT);

    // Restore the contact
    const { error } = await supabase
      .from('contacts')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Error restoring contact:', err);
    throw err;
  }
};

// --- REAL-TIME SUBSCRIPTION FUNCTIONS ---

export interface TableSubscriptionCallbacks<T = any> {
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
}

export function subscribeToTable<T = any>(
  tableName: string,
  callbacks: TableSubscriptionCallbacks<T>
): () => void {
  const channelName = `${tableName}-realtime-${Date.now()}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
      },
      (payload) => {
        try {
          switch (payload.eventType) {
            case 'INSERT':
              callbacks.onInsert?.(payload.new as T);
              break;
            case 'UPDATE':
              callbacks.onUpdate?.(payload.new as T);
              break;
            case 'DELETE':
              callbacks.onDelete?.({ id: (payload.old as any).id });
              break;
          }
        } catch (error) {
          console.error(`Error handling ${tableName} event:`, error);
          callbacks.onError?.(error as Error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToContacts(callbacks: TableSubscriptionCallbacks<Contact>): () => void {
  return subscribeToTable<Contact>('contacts', callbacks);
}

export function subscribeToProducts(callbacks: TableSubscriptionCallbacks<Product>): () => void {
  return subscribeToTable<Product>('products', callbacks);
}

export function subscribeToTasks(callbacks: TableSubscriptionCallbacks<Task>): () => void {
  return subscribeToTable<Task>('tasks', callbacks);
}

export function subscribeToNotificationsRealtime(callbacks: TableSubscriptionCallbacks<Notification>): () => void {
  return subscribeToTable<Notification>('notifications', callbacks);
}

export function subscribeToTeamMessages(callbacks: TableSubscriptionCallbacks<TeamMessage>): () => void {
  return subscribeToTable<TeamMessage>('team_messages', callbacks);
}

export function subscribeToDeals(callbacks: TableSubscriptionCallbacks<PipelineDeal>): () => void {
  return subscribeToTable<PipelineDeal>('deals', callbacks);
}

export const createCallLog = async (log: Omit<CallLogEntry, 'id'>): Promise<CallLogEntry | null> => {
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .insert([log])
      .select()
      .single();

    if (error) throw error;
    return data as CallLogEntry;
  } catch (error) {
    console.error('Error creating call log:', error);
    return null;
  }
};

export const fetchCallLogsByContact = async (contactId: string): Promise<CallLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as CallLogEntry[]) || [];
  } catch (error) {
    console.error('Error fetching call logs for contact:', error);
    return [];
  }
};

export const fetchInquiriesByContact = async (contactId: string): Promise<Inquiry[]> => {
  try {
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as Inquiry[]) || [];
  } catch (error) {
    console.error('Error fetching inquiries for contact:', error);
    return [];
  }
};

export { supabase };
