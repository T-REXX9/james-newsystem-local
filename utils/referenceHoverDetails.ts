type ReferenceHoverDetails = {
  reference: string;
  documentNumber?: string;
  documentDate?: string;
  createdAt?: string;
  createdAtSource?: string;
  isBackdated?: number | null;
  status?: string;
};

export const formatReferenceHoverDetails = (details: ReferenceHoverDetails): string => {
  const lines = [`Reference: ${details.reference || 'Unavailable'}`];
  if (details.documentNumber) lines.push(`Document: ${details.documentNumber}`);
  lines.push(`Document date: ${details.documentDate || 'Unavailable'}`);
  lines.push(`Created at: ${details.createdAt || 'Unavailable in the database'}`);
  if (details.createdAtSource) lines.push(`Creation timestamp source: ${details.createdAtSource}`);
  lines.push(`Backdated: ${details.isBackdated === 1 ? 'Yes' : details.isBackdated === 0 ? 'No' : 'Cannot determine'}`);
  if (details.status) lines.push(`Status: ${details.status}`);
  return lines.join('\n');
};
