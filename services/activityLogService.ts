import { requestLocalApi } from './localApiClient';
import { getLocalAuthSession } from './localAuthService';
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

export const logActivity = async (
  action: string,
  entityType: string,
  entityId: string,
  details?: ActivityLogDetails
): Promise<boolean> => {
  if (!getLocalAuthSession()?.token) return false;
  try {
    const result = await requestLocalApi<{ saved: boolean }>('/activity-logs', 'POST', { action, entity_type: entityType, entity_id: entityId });
    return result.saved === true;
  } catch (error) {
    console.error('Unable to persist client activity log:', error);
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
