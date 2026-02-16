import React from 'react';

const DERIVATION_KEYS = [
  'pastName',
  'past_name',
  'pastname',
  'formerName',
  'former_name',
  'formername'
] as const;

interface CompanyNameProps {
  name?: string | null;
  pastName?: string | null;
  entity?: Record<string, any> | null;
  className?: string;
  formerNameClassName?: string;
  showFormerLabel?: boolean;
  wrapFormerName?: boolean;
  formerLabel?: string;
  fallback?: string;
}

/**
 * Consistently renders a company's current and former names side-by-side.
 * Keeps formatting synchronized across views so any past name changes only need to happen once.
 */
const CompanyName: React.FC<CompanyNameProps> = ({
  name,
  pastName,
  entity,
  className,
  formerNameClassName,
  showFormerLabel = true,
  wrapFormerName = true,
  formerLabel = 'formerly',
  fallback = 'Unknown Company'
}) => {
  const normalizedName = (name || '').trim();
  const normalizedPastName = (() => {
    const direct = (pastName || '').trim();
    if (direct) return direct;
    if (!entity) return '';
    for (const key of DERIVATION_KEYS) {
      const value = entity[key as string];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return '';
  })();
  const displayName = normalizedName || normalizedPastName || fallback;

  return (
    <span className={className}>
      {displayName}
      {normalizedPastName && (
        <span className={formerNameClassName || 'text-xs text-slate-500 font-medium ml-1'}>
          {wrapFormerName ? '(' : ''}
          {showFormerLabel ? `${formerLabel} ${normalizedPastName}` : normalizedPastName}
          {wrapFormerName ? ')' : ''}
        </span>
      )}
    </span>
  );
};

export default CompanyName;
