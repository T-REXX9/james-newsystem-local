import React from 'react';
import type { VipDiscountLevel } from '../utils/vipDocumentDiscount';

type VipStandingBadgeProps = {
  tier?: VipDiscountLevel | string | null;
  print?: boolean;
};

const normalizeTier = (tier?: VipStandingBadgeProps['tier']): VipDiscountLevel => {
  const normalized = String(tier || '').trim().toLowerCase();
  if (normalized === 'silver') return 'silver';
  if (normalized === 'gold') return 'gold';
  return 'regular';
};

export const vipStandingLabel = (tier?: VipStandingBadgeProps['tier']): string => {
  const normalized = normalizeTier(tier);
  if (normalized === 'silver') return 'VIP Silver';
  if (normalized === 'gold') return 'VIP Gold';
  return 'Regular';
};

const VipStandingBadge: React.FC<VipStandingBadgeProps> = ({ tier, print = false }) => {
  const normalized = normalizeTier(tier);
  const label = vipStandingLabel(normalized);
  const colors = normalized === 'gold'
    ? 'border-amber-300 bg-amber-50 text-amber-800'
    : normalized === 'silver'
      ? 'border-slate-300 bg-slate-100 text-slate-700'
      : 'border-slate-200 bg-white text-slate-600';

  return (
    <span
      data-testid="vip-standing"
      className={`${print ? 'vip-standing-print' : ''} inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${colors}`}
    >
      VIP Status: {label}
    </span>
  );
};

export default VipStandingBadge;
