import React from 'react';
import { VipDocumentDiscount, vipTierPrintLabel } from '../utils/vipDocumentDiscount';

type VipDocumentTotalsProps = {
  discount: VipDocumentDiscount;
  formatMoney: (value: number) => string;
  grandTotalColSpan: number;
  amountClassName?: string;
  labelClassName?: string;
  variant?: 'sales' | 'invoice';
  amountDue?: number;
};

const VipDocumentTotals: React.FC<VipDocumentTotalsProps> = ({
  discount,
  formatMoney,
  grandTotalColSpan,
  amountClassName,
  labelClassName,
  variant = 'sales',
  amountDue,
}) => {
  if (!discount.applied || !discount.lineLabel) return null;

  const discountLabel =
    variant === 'invoice'
      ? `Less: Discount (${vipTierPrintLabel(discount.tier)})`
      : discount.lineLabel;
  const payLabel = variant === 'invoice' ? 'TOTAL AMOUNT DUE' : 'TOTAL to pay :';
  const dueAmount = amountDue == null ? discount.totalToPay : amountDue;

  return (
    <>
      <tr>
        <td colSpan={grandTotalColSpan} className={labelClassName} style={{ textAlign: 'right' }}>
          {discountLabel}
        </td>
        <td className={amountClassName} style={{ textAlign: 'right' }}>
          {formatMoney(discount.discountAmount)}
        </td>
      </tr>
      <tr>
        <td colSpan={grandTotalColSpan} className={labelClassName} style={{ textAlign: 'right' }}>
          <strong>{payLabel}</strong>
        </td>
        <td className={amountClassName} style={{ textAlign: 'right' }}>
          <strong>{formatMoney(dueAmount)}</strong>
        </td>
      </tr>
    </>
  );
};

export default VipDocumentTotals;
