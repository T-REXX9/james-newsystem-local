export const CUSTOMER_STAR_UPDATED_EVENT = 'customer-star-updated';

export interface CustomerStarUpdatedDetail {
  customerId: string;
  isStarred: boolean;
}
