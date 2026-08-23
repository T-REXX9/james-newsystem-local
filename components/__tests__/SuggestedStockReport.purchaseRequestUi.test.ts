import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/SuggestedStockReport.tsx'),
  'utf8'
);

describe('Suggested Stock PR controls', () => {
  it('offers one multi-select PR action and lists existing PR numbers for the selected period', () => {
    expect(source).toContain('Create PR for Selected');
    expect(source).toContain('createPurchaseRequestFromSuggestions(selectedSuggestions)');
    expect(source).toContain('PR Numbers');
    expect(source).toContain("purchaseRequestService.getPurchaseRequests({ status: 'All' })");
    expect(source).toContain('pr.pr_number');
  });

  it('links PR numbers to Purchase Request and opens missing items in a separate Product Database tab', () => {
    expect(source).toContain("payload={{ prId: pr.id }}");
    expect(source).toContain('ModuleRecordLink');
    expect(source).toContain("window.open(productDatabaseUrl.toString(), '_blank'");
    expect(source).toContain("create: '1'");
    expect(source).toContain('partNo: item.partNo');
    expect(source).toContain('description: item.description');
    expect(source).not.toContain("import AddToPurchaseRequestModal");
  });
});
