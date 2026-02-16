import { supabase } from '../lib/supabaseClient';
import { RecycleBinItem, RecycleBinItemType } from '../types';
import { ENTITY_TYPES, logActivity, logRestore } from './activityLogService';

/**
 * Get all recycle bin items (Owner/Developer only)
 */
export const getAllRecycleBinItems = async (): Promise<RecycleBinItem[]> => {
  try {
    // Check user role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can access recycle bin');
    }

    const { data, error } = await supabase
      .from('recycle_bin_items')
      .select('*')
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching recycle bin items:', err);
    throw err;
  }
};

/**
 * Get recycle bin items filtered by type (Owner/Developer only)
 */
export const getRecycleBinItemsByType = async (type: RecycleBinItemType): Promise<RecycleBinItem[]> => {
  try {
    // Check user role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can access recycle bin');
    }

    const { data, error } = await supabase
      .from('recycle_bin_items')
      .select('*')
      .eq('item_type', type)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching recycle bin items by type:', err);
    throw err;
  }
};

/**
 * Restore an item from recycle bin (Owner/Developer only)
 */
export const restoreItem = async (itemType: RecycleBinItemType, itemId: string): Promise<boolean> => {
  try {
    // Check user role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can restore items');
    }

    // Restore the item in its original table FIRST
    // This will call the specific restore function based on item type
    switch (itemType) {
      case RecycleBinItemType.INQUIRY:
        // Import dynamically to avoid circular dependencies
        const { restoreSalesInquiry } = await import('./salesInquiryService');
        await restoreSalesInquiry(itemId);
        break;
      case RecycleBinItemType.ORDER:
        const { restoreSalesOrder } = await import('./salesOrderService');
        await restoreSalesOrder(itemId);
        break;
      case RecycleBinItemType.ORDERSLIP:
        const { restoreOrderSlip } = await import('./orderSlipService');
        await restoreOrderSlip(itemId);
        break;
      case RecycleBinItemType.INVOICE:
        const { restoreInvoice } = await import('./invoiceService');
        await restoreInvoice(itemId);
        break;
      case RecycleBinItemType.TASK:
        const { restoreTask } = await import('./supabaseService');
        await restoreTask(itemId);
        break;
      case RecycleBinItemType.PRODUCT:
        const { restoreProduct } = await import('./supabaseService');
        await restoreProduct(itemId);
        break;
      case RecycleBinItemType.TEAM_MESSAGE:
        const { restoreTeamMessage } = await import('./supabaseService');
        await restoreTeamMessage(itemId);
        break;
      case RecycleBinItemType.NOTIFICATION:
        const { restoreNotification } = await import('./supabaseService');
        await restoreNotification(itemId);
        break;
      case RecycleBinItemType.CONTACT:
        const { restoreContact } = await import('./supabaseService');
        await restoreContact(itemId);
        break;
      default:
        throw new Error(`Unsupported item type for restore: ${itemType}`);
    }

    // Only mark as restored in recycle bin AFTER successful restore
    const { error: updateError } = await supabase
      .from('recycle_bin_items')
      .update({
        is_restored: true,
        restored_at: new Date().toISOString(),
        restored_by: user.id,
      })
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .eq('is_restored', false);

    if (updateError) throw updateError;

    try {
      await logRestore(resolveEntityType(itemType), itemId, { restored_from: 'recycle_bin' });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return true;
  } catch (err) {
    console.error('Error restoring item:', err);
    throw err;
  }
};

/**
 * Permanently delete an item from recycle bin (Owner/Developer only)
 */
export const permanentlyDeleteItem = async (itemType: RecycleBinItemType, itemId: string): Promise<boolean> => {
  try {
    // Check user role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can permanently delete items');
    }

    // Delete from recycle bin
    const { error } = await supabase
      .from('recycle_bin_items')
      .delete()
      .eq('item_id', itemId)
      .eq('item_type', itemType);

    if (error) throw error;

    // Also permanently delete from the original table
    // Note: This is a hard delete - use with caution
    switch (itemType) {
      case RecycleBinItemType.CONTACT:
        await supabase.from('contacts').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.INQUIRY:
        await supabase.from('sales_inquiries').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.ORDER:
        await supabase.from('sales_orders').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.ORDERSLIP:
        await supabase.from('order_slips').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.INVOICE:
        await supabase.from('invoices').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.TASK:
        await supabase.from('tasks').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.PRODUCT:
        await supabase.from('products').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.TEAM_MESSAGE:
        await supabase.from('team_messages').delete().eq('id', itemId);
        break;
      case RecycleBinItemType.NOTIFICATION:
        await supabase.from('notifications').delete().eq('id', itemId);
        break;
      // No action for COMMENT as it's handled differently
    }

    try {
      await logActivity('PERMANENT_DELETE', resolveEntityType(itemType), itemId, {
        warning: 'irreversible',
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    return true;
  } catch (err) {
    console.error('Error permanently deleting item:', err);
    throw err;
  }
};

/**
 * Get recycle bin statistics (Owner/Developer only)
 */
export const getRecycleBinStats = async (): Promise<{
  total: number;
  by_type: Record<RecycleBinItemType, number>;
}> => {
  try {
    // Check user role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['Owner', 'Developer'].includes(profile.role)) {
      throw new Error('Only Owner or Developer can access recycle bin statistics');
    }

    const { data, error } = await supabase
      .from('recycle_bin_items')
      .select('item_type')
      .eq('is_restored', false);

    if (error) throw error;

    const stats = {
      total: data.length,
      by_type: {} as Record<RecycleBinItemType, number>,
    };

    // Count by type
    data.forEach(item => {
      const type = item.item_type as RecycleBinItemType;
      stats.by_type[type] = (stats.by_type[type] || 0) + 1;
    });

    return stats;
  } catch (err) {
    console.error('Error fetching recycle bin stats:', err);
    throw err;
  }
};

/**
 * Helper function to get table name for item type
 */
const getTableNameForItemType = (itemType: RecycleBinItemType): string | null => {
  switch (itemType) {
    case RecycleBinItemType.CONTACT:
      return 'contacts';
    case RecycleBinItemType.INQUIRY:
      return 'sales_inquiries';
    case RecycleBinItemType.ORDER:
      return 'sales_orders';
    case RecycleBinItemType.ORDERSLIP:
      return 'order_slips';
    case RecycleBinItemType.INVOICE:
      return 'invoices';
    case RecycleBinItemType.TASK:
      return 'tasks';
    case RecycleBinItemType.PRODUCT:
      return 'products';
    case RecycleBinItemType.TEAM_MESSAGE:
      return 'team_messages';
    case RecycleBinItemType.NOTIFICATION:
      return 'notifications';
    default:
      return null;
  }
};

const resolveEntityType = (itemType: RecycleBinItemType): string => {
  switch (itemType) {
    case RecycleBinItemType.ORDER:
      return ENTITY_TYPES.SALES_ORDER;
    case RecycleBinItemType.INQUIRY:
      return ENTITY_TYPES.SALES_INQUIRY;
    case RecycleBinItemType.ORDERSLIP:
      return ENTITY_TYPES.ORDER_SLIP;
    case RecycleBinItemType.INVOICE:
      return ENTITY_TYPES.INVOICE;
    case RecycleBinItemType.PRODUCT:
      return ENTITY_TYPES.PRODUCT;
    case RecycleBinItemType.CONTACT:
      return ENTITY_TYPES.CONTACT;
    default:
      return String(itemType);
  }
};
