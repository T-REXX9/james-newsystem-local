export const CUSTOMER_STAR_UPDATED_EVENT = 'customer-star-updated';
export const CUSTOMER_IDENTIFIERS_UPDATED_EVENT = 'customer-identifiers-updated';

export interface CustomerStarUpdatedDetail {
  customerId: string;
  isStarred: boolean;
}
