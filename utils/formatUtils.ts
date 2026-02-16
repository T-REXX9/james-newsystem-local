export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

export const formatDateFull = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
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

export const matchesSearch = (contact: { company?: string | null; name?: string | null; province?: string | null; city?: string | null }, query: string) => {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const fields = [contact.company, contact.name, contact.province, contact.city];
  return fields.some((field) => (field || '').toLowerCase().includes(normalized));
};

export const getPhoneNumber = (contact: { mobile?: string | null; phone?: string | null; contactPersons?: Array<{ mobile?: string | null; telephone?: string | null }> }) => {
  return contact.mobile || contact.phone || contact.contactPersons[0]?.mobile || contact.contactPersons[0]?.telephone || null;
};
