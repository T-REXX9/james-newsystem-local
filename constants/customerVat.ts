import type { CustomerVatType } from '../types';

// Keep valid VAT values centralized for customer database forms and API payloads.
export const CUSTOMER_VAT_TYPES: CustomerVatType[] = ['Exclusive', 'Inclusive', 'Zero-Rated'];

export const DEFAULT_CUSTOMER_VAT_TYPE: CustomerVatType = 'Zero-Rated';
