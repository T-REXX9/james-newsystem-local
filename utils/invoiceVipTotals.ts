import {
  billedAmountAfterVip,
  persistedVipDiscount,
  type VipDocumentDiscount,
} from './vipDocumentDiscount';

const roundMoney = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

export type InvoiceVipSummary = {
  taxName: string;
  totalSales: number;
  lessVat: number;
  total: number;
  discount: VipDocumentDiscount;
  totalAmountDue: number;
  vatableSale: number;
  addVat: number;
  finalTotal: number;
};

export const buildInvoiceVipSummary = (input: {
  lineGrandTotal: number;
  vatType?: string;
  vip_applied?: boolean;
  vip_tier?: 'regular' | 'silver' | 'gold';
  vip_percentage?: number;
  vip_discount_amount?: number;
}): InvoiceVipSummary => {
  const lineGrandTotal = roundMoney(input.lineGrandTotal);
  const vatType = String(input.vatType || '').trim().toLowerCase();
  const discount = persistedVipDiscount({
    grand_total: lineGrandTotal,
    vip_applied: input.vip_applied,
    vip_tier: input.vip_tier,
    vip_percentage: input.vip_percentage,
    vip_discount_amount: input.vip_discount_amount,
  });

  if (vatType === 'inclusive') {
    const lessVat = roundMoney(lineGrandTotal - lineGrandTotal / 1.12);
    const total = roundMoney(lineGrandTotal - lessVat);
    const totalAmountDue = billedAmountAfterVip(lineGrandTotal, discount.discountAmount);
    return {
      taxName: '(VAT Inclusive)',
      totalSales: lineGrandTotal,
      lessVat,
      total,
      discount,
      totalAmountDue,
      vatableSale: total,
      addVat: Math.abs(lessVat),
      finalTotal: totalAmountDue,
    };
  }

  if (vatType === 'exclusive') {
    const addVat = roundMoney(lineGrandTotal * 0.12);
    const preDue = roundMoney(lineGrandTotal + addVat);
    const totalAmountDue = billedAmountAfterVip(preDue, discount.discountAmount);
    return {
      taxName: '(VAT Exclusive)',
      totalSales: lineGrandTotal,
      lessVat: 0,
      total: lineGrandTotal,
      discount,
      totalAmountDue,
      vatableSale: lineGrandTotal,
      addVat,
      finalTotal: totalAmountDue,
    };
  }

  const totalAmountDue = billedAmountAfterVip(lineGrandTotal, discount.discountAmount);
  return {
    taxName: '( )',
    totalSales: lineGrandTotal,
    lessVat: 0,
    total: lineGrandTotal,
    discount,
    totalAmountDue,
    vatableSale: lineGrandTotal,
    addVat: 0,
    finalTotal: totalAmountDue,
  };
};
