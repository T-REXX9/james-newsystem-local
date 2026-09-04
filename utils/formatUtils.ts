export const formatCurrency = (value: number, withDecimals: boolean = false) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(value);

const parseDisplayDate = (value: string | Date): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // Date-only values are calendar dates, not UTC timestamps. Parsing them at
  // local noon prevents a user's timezone from moving the displayed day.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** The single date format used in all customer-facing screens and printouts. */
export const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const parsed = parseDisplayDate(value);
  if (!parsed) return '—';
  return parsed.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatDateFull = (value?: string | Date | null) => {
  return formatDate(value);
};

/** Use this for records where the time is meaningful; the date remains standardized. */
export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '—';
  const parsed = parseDisplayDate(value);
  if (!parsed) return '—';
  return parsed.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'No activity yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No activity yet';
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
};

export const getDaysSince = (value?: string | null) => {
  if (!value) return 999;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 999;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
};

export const formatComment = (value?: string | null) => {
  if (!value) return 'No notes provided';
  const trimmed = value.trim();
  if (!trimmed) return 'No notes provided';
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}...` : trimmed;
};

export const matchesSearch = (contact: { company?: string | null; name?: string | null; province?: string | null; city?: string | null; id?: string | null }, query: string) => {
  if (!query) return true;

  const normalized = query.toLowerCase();

  // Smart search: detect if query looks like a reference number (contains numbers/dashes)
  const isRefNoLike = /[\d-]/g.test(normalized);

  // Always search company and name
  const companyMatch = (contact.company || '').toLowerCase().includes(normalized);
  const nameMatch = (contact.name || '').toLowerCase().includes(normalized);

  if (companyMatch || nameMatch) return true;

  // For reference number-like searches, also check ID field
  if (isRefNoLike && contact.id) {
    const idMatch = (contact.id || '').toLowerCase().includes(normalized);
    if (idMatch) return true;
  }

  // For text-based searches, also check location fields
  if (!isRefNoLike) {
    const provinceMatch = (contact.province || '').toLowerCase().includes(normalized);
    const cityMatch = (contact.city || '').toLowerCase().includes(normalized);
    if (provinceMatch || cityMatch) return true;
  }

  return false;
};

export const getPhoneNumber = (contact: { mobile?: string | null; phone?: string | null; contactPersons?: Array<{ mobile?: string | null; telephone?: string | null }> }) => {
  return contact.mobile || contact.phone || contact.contactPersons[0]?.mobile || contact.contactPersons[0]?.telephone || null;
};
