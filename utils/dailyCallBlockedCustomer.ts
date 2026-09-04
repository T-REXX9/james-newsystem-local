import { Contact, CustomerStatus, DailyCallCustomerRow, DailyCallMasterCustomerRow } from '../types';

export const isBlockedDailyCallMasterRow = (
  row: Pick<DailyCallMasterCustomerRow, 'customerStatus' | 'debtType'>
): boolean =>
  Number(row.customerStatus) === 4 || String(row.debtType || '').trim().toLowerCase() === 'bad';

export const isBlockedDailyCallCustomerRow = (row: Pick<DailyCallCustomerRow, 'status'>): boolean =>
  row.status === CustomerStatus.BLACKLISTED;

export const isBlockedContact = (contact: Pick<Contact, 'status' | 'debtType'>): boolean =>
  contact.status === CustomerStatus.BLACKLISTED || String(contact.debtType || '').trim().toLowerCase() === 'bad';

export const DO_NOT_CONTACT_LABEL = 'blacklisted/rejected -do not contact';
