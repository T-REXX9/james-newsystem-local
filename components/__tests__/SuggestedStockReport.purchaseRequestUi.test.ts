import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/SuggestedStockReport.tsx'),
  'utf8'
);

describe('Suggested Stock PR controls', () => {
  it('offers one multi-select PR action and displays the generated PR in the left activity panel', () => {
    expect(source).toContain('Create PR for Selected');
    expect(source).toContain('createPurchaseRequestFromSuggestions(selectedSuggestions)');
    expect(source).toContain('PR History');
    expect(source).toContain('pr.pr_number');
  });

  it('links the generated number to Purchase Request and does not bypass PR with the old PO modal', () => {
    expect(source).toContain("payload={{ prId: pr.id }}");
    expect(source).toContain('ModuleRecordLink');
    expect(source).not.toContain("import AddToPurchaseRequestModal");
  });
});
