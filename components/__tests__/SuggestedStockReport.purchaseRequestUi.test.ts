import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/SuggestedStockReport.tsx'),
  'utf8'
);

describe('Suggested Stock product-to-PR workflow controls', () => {
  it('keeps product-created suggestions available for direct PR creation', () => {
    expect(source).toContain('createPurchaseRequestFromSuggestions');
    expect(source).toContain('markSuggestedStockItemsAddedToPr');
    expect(source).toContain('Add Selected Items to PR');
    expect(source).toContain('Product Created');
    expect(source).toContain('PR Qty');
    expect(source).not.toContain('Filter by listing status');
    expect(source).not.toContain('Already listed');
    expect(source).not.toContain('Open Reorder Report');
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
