import { supabase } from '../lib/supabaseClient';

export const ENTITY_TYPES = {
  SALES_ORDER: 'Sales Order',
  SALES_INQUIRY: 'Sales Inquiry',
  ORDER_SLIP: 'Order Slip',
  INVOICE: 'Invoice',
  PURCHASE_ORDER: 'Purchase Order',
  PURCHASE_REQUEST: 'Purchase Request',
  RECEIVING_STOCK: 'Receiving Stock',
  RETURN_TO_SUPPLIER: 'Return to Supplier',
  STOCK_ADJUSTMENT: 'Stock Adjustment',
  TRANSFER_STOCK: 'Transfer Stock',
  INVENTORY_LOG: 'Inventory Log',
  PRODUCT: 'Product',
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  CONTACT: 'Contact',
  USER_PROFILE: 'User Profile',
  ACCESS_CONTROL: 'Access Control',
  TEAM: 'Team',
  AUTH: 'Authentication',
} as const;

type ActivityLogDetails = Record<string, unknown> | null | undefined;

const resolveIpAddress = (): string | null => {
  if (typeof window === 'undefined') return null;
  return null;
};

export const logActivity = async (
  action: string,
  entityType: string,
  entityId: string,
  details?: ActivityLogDetails
): Promise<boolean> => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return false;

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details ?? null,
        ip_address: resolveIpAddress(),
      });

    if (error) {
      console.error('Failed to log activity:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to log activity:', error);
    return false;
  }
};

export const logCreate = async (
  entityType: string,
  entityId: string,
  details?: ActivityLogDetails
): Promise<boolean> => logActivity('CREATE', entityType, entityId, details);

export const logUpdate = async (
  entityType: string,
  entityId: string,
  details?: ActivityLogDetails
): Promise<boolean> => logActivity('UPDATE', entityType, entityId, details);

export const logDelete = async (
  entityType: string,
  entityId: string,
  details?: ActivityLogDetails
): Promise<boolean> => logActivity('DELETE', entityType, entityId, details);

export const logRestore = async (
  entityType: string,
  entityId: string,
  details?: ActivityLogDetails
): Promise<boolean> => logActivity('RESTORE', entityType, entityId, details);

export const logStatusChange = async (
  entityType: string,
  entityId: string,
  oldStatus: string,
  newStatus: string
): Promise<boolean> =>
  logActivity('STATUS_CHANGE', entityType, entityId, {
    old_status: oldStatus,
    new_status: newStatus,
  });

export const logAuth = async (
  action: 'LOGIN' | 'LOGOUT' | 'SIGNUP',
  details?: ActivityLogDetails
): Promise<boolean> => logActivity(action, ENTITY_TYPES.AUTH, 'session', details);
