import { resolveVipDiscountLevel } from './vipStanding';
import { VipTierConfig } from '../types';
import { normalizeVipTierConfig } from './vipTierConfig';

export type VipDiscountLevel = 'regular' | 'silver' | 'gold';

export type VipDocumentDiscount = {
  applied: boolean;
  tier: VipDiscountLevel;
  percentage: number;
  discountAmount: number;
  totalToPay: number;
  lineLabel: string | null;
};

export type VipDealKind = 'sales_inquiry' | 'sales_order' | 'order_slip' | 'invoice';

export type VipDealDocument = {
  id: string;
  kind: VipDealKind;
  salesDate: string;
  cancelled: boolean;
  deleted: boolean;
  inquiryId?: string;
  orderId?: string;
};

const moneyLabel = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const roundMoney = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

export const readPersistedVip = (row?: {
  vip_applied?: unknown;
  vip_tier?: unknown;
  vip_percentage?: unknown;
  vip_discount_amount?: unknown;
  total_to_pay?: unknown;
} | null): {
  vip_applied: boolean;
  vip_tier: VipDiscountLevel;
  vip_percentage: number;
  vip_discount_amount: number;
  total_to_pay?: number;
} => ({
  vip_applied: Number(row?.vip_applied) > 0,
  vip_tier: (String(row?.vip_tier || 'regular').toLowerCase() as VipDiscountLevel) || 'regular',
  vip_percentage: Number(row?.vip_percentage || 0),
  vip_discount_amount: Number(row?.vip_discount_amount || 0),
  total_to_pay: row?.total_to_pay == null ? undefined : Number(row.total_to_pay),
});

export const toVipSavePayload = (discount: VipDocumentDiscount) => ({
  vip_applied: discount.applied,
  vip_tier: discount.tier,
  vip_percentage: discount.percentage,
  vip_discount_amount: discount.discountAmount,
  total_to_pay: discount.totalToPay,
});

export const persistedVipDiscount = (row: {
  grand_total?: number;
  vip_applied?: boolean;
  vip_tier?: VipDiscountLevel;
  vip_percentage?: number;
  vip_discount_amount?: number;
}): VipDocumentDiscount =>
  computeVipDocumentDiscount({
    grandTotal: Number(row.grand_total || 0),
    standing: row.vip_tier || 'regular',
    percentage: Number(row.vip_percentage || 0),
    apply: Boolean(row.vip_applied),
  });

export const billedAmountAfterVip = (preDiscountTotal: number, discountAmount: number): number =>
  roundMoney(Math.max(0, (Number(preDiscountTotal) || 0) - (Number(discountAmount) || 0)));

export const vipTierPrintLabel = (tier: VipDiscountLevel): string => {
  if (tier === 'gold') return 'VIP GOLD';
  if (tier === 'silver') return 'VIP SILVER';
  return '';
};

export const benefitMonthKey = (salesDate: string): string => {
  const trimmed = String(salesDate || '').trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const lastMonthSpendFromSummary = (
  salesDate: string,
  rows: Array<{ year: number; month: number; debit: number }>
): number => {
  const key = benefitMonthKey(salesDate);
  if (!key) return 0;
  const [yearText, monthText] = key.split('-');
  let year = Number(yearText);
  let month = Number(monthText) - 1;
  if (month <= 0) {
    month = 12;
    year -= 1;
  }
  const match = rows.find((row) => Number(row.year) === year && Number(row.month) === month);
  return roundMoney(match?.debit || 0);
};

export const resolveLastMonthSpendForVipDocument = (input: {
  salesDate: string;
  lastMonthSales?: number | null;
  summaryRows: Array<{ year: number; month: number; debit: number }>;
  today?: Date;
}): number => {
  const salesMonth = benefitMonthKey(input.salesDate);
  const reference = input.today || new Date();
  const currentMonth = benefitMonthKey(`${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}-01`);
  const metricSpend = input.lastMonthSales == null ? null : roundMoney(input.lastMonthSales);
  if (metricSpend !== null && salesMonth === currentMonth) return metricSpend;
  return lastMonthSpendFromSummary(input.salesDate, input.summaryRows);
};

export const computeVipDocumentDiscount = (input: {
  grandTotal: number;
  standing: VipDiscountLevel;
  percentage: number;
  apply: boolean;
}): VipDocumentDiscount => {
  const grandTotal = roundMoney(input.grandTotal);
  const percentage = Math.min(100, Math.max(0, Number(input.percentage) || 0));
  const standing = input.standing;
  const apply = Boolean(input.apply) && standing !== 'regular' && percentage > 0;

  if (!apply) {
    return {
      applied: false,
      tier: standing,
      percentage,
      discountAmount: 0,
      totalToPay: grandTotal,
      lineLabel: null,
    };
  }

  const discountAmount = roundMoney(grandTotal * (percentage / 100));
  const totalToPay = roundMoney(grandTotal - discountAmount);
  return {
    applied: true,
    tier: standing,
    percentage,
    discountAmount,
    totalToPay,
    lineLabel: `${percentage}% ${vipTierPrintLabel(standing)} = ${moneyLabel.format(discountAmount)}`,
  };
};

const isLive = (doc: VipDealDocument): boolean => !doc.cancelled && !doc.deleted;

const sortKey = (doc: VipDealDocument): string => `${doc.salesDate}|${doc.id}`;

const liveStarters = (docs: VipDealDocument[]): VipDealDocument[] => {
  const live = docs.filter(isLive);
  const inquiries = live.filter((doc) => doc.kind === 'sales_inquiry').sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  if (inquiries.length > 0) return inquiries;
  return live
    .filter((doc) => doc.kind === 'sales_order' && !String(doc.inquiryId || '').trim())
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
};

const firstLiveStarter = (docs: VipDealDocument[]): VipDealDocument | null => liveStarters(docs)[0] || null;

const ordersInChain = (starter: VipDealDocument, docs: VipDealDocument[]): Set<string> => {
  const ids = new Set<string>();
  if (starter.kind === 'sales_order') ids.add(starter.id);
  docs.forEach((doc) => {
    if (doc.kind !== 'sales_order' || !isLive(doc)) return;
    if (starter.kind === 'sales_inquiry' && doc.inquiryId === starter.id) ids.add(doc.id);
    if (starter.kind === 'sales_order' && doc.id === starter.id) ids.add(doc.id);
  });
  return ids;
};

export const shouldApplyVipOnDocument = (input: {
  standing: VipDiscountLevel;
  current: VipDealDocument;
  customerDocumentsInBenefitMonth: VipDealDocument[];
}): boolean => {
  if (input.standing === 'regular') return false;
  if (input.standing === 'gold') return true;
  if (input.current.cancelled || input.current.deleted) return false;

  const pool = input.customerDocumentsInBenefitMonth.some((doc) => doc.id === input.current.id)
    ? input.customerDocumentsInBenefitMonth
    : [...input.customerDocumentsInBenefitMonth, input.current];

  const starter = firstLiveStarter(pool);
  if (!starter) {
    if (input.current.kind === 'sales_order' && !String(input.current.inquiryId || '').trim()) return true;
    return false;
  }

  if (input.current.id === starter.id) return true;
  const chainOrders = ordersInChain(starter, pool);
  if (input.current.kind === 'sales_order' && input.current.inquiryId === starter.id) return true;
  if ((input.current.kind === 'order_slip' || input.current.kind === 'invoice') && chainOrders.has(String(input.current.orderId || ''))) {
    return true;
  }
  return false;
};

export const resolveDocumentVipDiscount = (input: {
  grandTotal: number;
  lastMonthSpend: number;
  vipConfig: VipTierConfig;
  current: VipDealDocument;
  customerDocumentsInBenefitMonth: VipDealDocument[];
}): VipDocumentDiscount => {
  const config = normalizeVipTierConfig(input.vipConfig);
  const standing = resolveVipDiscountLevel(input.lastMonthSpend, config);
  const apply = shouldApplyVipOnDocument({
    standing,
    current: input.current,
    customerDocumentsInBenefitMonth: input.customerDocumentsInBenefitMonth,
  });
  return computeVipDocumentDiscount({
    grandTotal: input.grandTotal,
    standing,
    percentage: config.discount_percentage,
    apply,
  });
};
