import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/SuggestedStockReport.tsx'),
  'utf8'
);

describe('Suggested Stock unlisted-only workflow controls', () => {
  it('is a create-to-catalog queue without Create PR or listing-status filters', () => {
    expect(source).not.toContain('Create PR for Selected');
    expect(source).not.toContain('createPurchaseRequestFromSuggestions');
    expect(source).not.toContain('Filter by listing status');
    expect(source).not.toContain('Already listed');
    expect(source).toContain('Open Reorder Report');
    expect(source).toContain('Catalog gaps only');
  });

  it('opens Product Database create with suggested-stock handoff params', () => {
    expect(source).toContain("window.open(productDatabaseUrl.toString(), '_blank'");
    expect(source).toContain("create: '1'");
    expect(source).toContain("suggestedFrom: '1'");
    expect(source).toContain('suggestedInquiryItemId: item.id');
    expect(source).toContain('partNo: item.partNo');
    expect(source).toContain('description: item.description');
    expect(source).not.toContain("import AddToPurchaseRequestModal");
  });
});
