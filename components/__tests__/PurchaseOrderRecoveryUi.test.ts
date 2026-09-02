import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const poSource = readFileSync(resolve(process.cwd(), 'components/PurchaseOrderView.tsx'), 'utf8');
const prSource = readFileSync(resolve(process.cwd(), 'components/PurchaseRequest/PurchaseRequestView.tsx'), 'utf8');
const prModuleSource = readFileSync(resolve(process.cwd(), 'components/PurchaseRequest/index.tsx'), 'utf8');
const receivingSource = readFileSync(resolve(process.cwd(), 'components/ReceivingStock/ReceivingView.tsx'), 'utf8');

describe('purchase order generation and recovery controls', () => {
  it('labels approved PR conversion as Generate Purchase Order', () => {
    expect(prSource).toContain('Generate Purchase Order');
    expect(prSource).toMatch(/request\.status === ['"]Approved['"]/);
  });

  it('shows Unpost only to permitted roles for posted or completed POs', () => {
    expect(poSource).toContain("['Posted', 'Completed'].includes(selectedPO.status) && canUnpost");
    expect(poSource).toContain('purchaseOrderService.unpostPurchaseOrder');
  });

  it('uses application dialogs instead of browser dialogs for recovery actions', () => {
    for (const source of [poSource, prSource, prModuleSource, receivingSource]) {
      expect(source).not.toContain('window.prompt');
      expect(source).not.toContain('window.confirm');
      expect(source).not.toContain('window.alert');
    }
    expect(poSource).toContain('RecoveryReasonModal');
    expect(prSource).toContain('RecoveryReasonModal');
    expect(receivingSource).toContain('RecoveryReasonModal');
  });
});
