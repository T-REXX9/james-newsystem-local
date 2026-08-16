import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const poSource = readFileSync(resolve(process.cwd(), 'components/PurchaseOrderView.tsx'), 'utf8');
const prSource = readFileSync(resolve(process.cwd(), 'components/PurchaseRequest/PurchaseRequestView.tsx'), 'utf8');

describe('purchase order generation and recovery controls', () => {
  it('labels approved PR conversion as Generate Purchase Order', () => {
    expect(prSource).toContain('Generate Purchase Order');
    expect(prSource).toContain("request.status === 'Approved'");
  });

  it('shows Unpost only to permitted roles for a posted PO', () => {
    expect(poSource).toContain("selectedPO.status === 'Posted' && canUnpost");
    expect(poSource).toContain('purchaseOrderService.unpostPurchaseOrder');
  });
});
