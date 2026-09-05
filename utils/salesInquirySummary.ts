import { VipTierConfig } from '../types';
import { normalizeVipTierConfig } from './vipTierConfig';

export type SalesInquirySummaryCell = {
  label: string;
  value: number | string | null;
  isCurrency: boolean;
};

export type SalesInquirySummaryInput = {
  selected: boolean;
  ishinomotoSales: number | null;
  currentMonthSales: number | null;
  customerSince: string | null;
  creditLimit: number | null;
  terms: string | null;
  balance: number | null;
  preferredBrand: string | null;
  monthLabel: string;
  vipConfig: VipTierConfig;
};

const remainingToThreshold = (currentMonthSales: number | null, threshold: number): number | null => {
  if (currentMonthSales === null) return null;
  const spend = Number(currentMonthSales);
  if (!Number.isFinite(spend)) return null;
  return Math.max(0, threshold - spend);
};

export const buildSalesInquiryCustomerSummary = (
  input: SalesInquirySummaryInput
): SalesInquirySummaryCell[] => {
  const selected = input.selected;
  const thresholds = normalizeVipTierConfig(input.vipConfig);
  const currentMonthSales = selected ? input.currentMonthSales : null;

  return [
    { label: 'Ishinomoto Sales', value: selected ? input.ishinomotoSales : null, isCurrency: true },
    {
      label: 'VIP Silver remaining',
      value: remainingToThreshold(currentMonthSales, thresholds.one_time_discount_threshold),
      isCurrency: true,
    },
    {
      label: 'VIP Gold remaining',
      value: remainingToThreshold(currentMonthSales, thresholds.unlimited_discount_threshold),
      isCurrency: true,
    },
    { label: `Total Sales for ${input.monthLabel}`, value: currentMonthSales, isCurrency: true },
    { label: 'Customer Since', value: input.customerSince, isCurrency: false },
    { label: 'Credit Limit', value: input.creditLimit, isCurrency: true },
    { label: 'Terms', value: input.terms, isCurrency: false },
    { label: 'Balance', value: input.balance, isCurrency: true },
    { label: 'Preferred Brand', value: input.preferredBrand, isCurrency: false },
  ];
};
