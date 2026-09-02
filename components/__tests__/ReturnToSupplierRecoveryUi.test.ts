import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const viewSource = readFileSync(resolve(process.cwd(), 'components/ReturnToSupplier/ReturnToSupplierView.tsx'), 'utf8');
const serviceSource = readFileSync(resolve(process.cwd(), 'services/returnToSupplierService.ts'), 'utf8');

describe('return to supplier recovery controls', () => {
  it('allows posted returns to be unposted', () => {
    expect(viewSource).toContain("const isPosted = returnRecord.status === 'Posted'");
    expect(viewSource).toContain('setUnpostModalOpen(true)');
    expect(serviceSource).toContain('/actions/unpost');
  });

  it('allows pending returns to be edited and posted again', () => {
    expect(viewSource).toContain("const isEditable = returnRecord.status === 'Pending'");
    expect(viewSource).toContain('Save Changes');
    expect(viewSource).toContain('Post Return to Supplier');
    expect(serviceSource).toContain('updateReturnItem');
    expect(serviceSource).toContain('deleteReturnItem');
  });
});
