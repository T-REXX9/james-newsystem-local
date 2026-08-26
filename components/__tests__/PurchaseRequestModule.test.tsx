import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowHistoryState } from '../../utils/workflowHistory';

const service = {
  getPurchaseRequests: vi.fn(),
  getSuppliers: vi.fn(),
  getProducts: vi.fn(),
  getPurchaseRequestById: vi.fn(),
  generatePRNumber: vi.fn(),
  createPurchaseRequest: vi.fn(),
  updatePurchaseRequest: vi.fn(),
  updatePRItem: vi.fn(),
  deletePRItem: vi.fn(),
  addPRItem: vi.fn(),
  convertToPO: vi.fn(),
};

vi.mock('../../services/purchaseRequestService', () => ({ purchaseRequestService: service }));
vi.mock('../PurchaseRequest/PurchaseRequestList', () => ({ default: ({ loading, onCreate, onSelect }: { loading: boolean; onCreate: () => void; onSelect: (request: unknown) => void }) => <div>{loading && <span>Sidebar loading</span>}<button type="button" onClick={onCreate}>New PR</button><button type="button" onClick={() => onSelect({ id: 'PRREF-1', pr_number: 'PR-2601' })}>Select PR</button></div> }));
vi.mock('../PurchaseRequest/PurchaseRequestForm', () => ({ default: ({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: unknown) => void }) => <div><button type="button" onClick={() => onSubmit({ pr_number: 'PR-2601', request_date: '2026-08-23', items: [] })}>Submit PR</button><button type="button" onClick={onCancel}>Cancel PR</button></div> }));
vi.mock('../PurchaseRequest/PurchaseRequestView', () => ({ default: ({ onBack, onUpdate, onUpdateItem, onDeleteItem, onAddItem, onConvert, onPrint }: { onBack: () => void; onUpdate: (...args: unknown[]) => void; onUpdateItem: (...args: unknown[]) => void; onDeleteItem: (...args: unknown[]) => void; onAddItem: (...args: unknown[]) => void; onConvert: () => void; onPrint: () => void }) => <div><button type="button" onClick={onBack}>Back PR</button><button type="button" onClick={() => onUpdate('PRREF-1', { status: 'Approved' })}>Update PR</button><button type="button" onClick={() => onUpdateItem('ITEM-1', { quantity: 2 })}>Update PR item</button><button type="button" onClick={() => onDeleteItem('ITEM-1')}>Delete PR item</button><button type="button" onClick={() => onAddItem({ item_id: 'P1', quantity: 1 })}>Add PR item</button><button type="button" onClick={onConvert}>Convert PR</button><button type="button" onClick={onPrint}>Print PR</button></div> }));
vi.mock('../PurchaseRequest/PurchaseRequestPrint', () => ({ default: ({ onClose }: { onClose: () => void }) => <div><button type="button" onClick={onClose}>Close PR print</button></div> }));

const request = { id: 'PRREF-1', pr_number: 'PR-2601', request_date: '2026-08-23', status: 'Pending', items: [] };

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
  service.getPurchaseRequests.mockResolvedValue([request]);
  service.getSuppliers.mockResolvedValue([]);
  service.getProducts.mockResolvedValue([]);
  service.getPurchaseRequestById.mockResolvedValue(request);
  service.generatePRNumber.mockResolvedValue('PR-2601');
  service.createPurchaseRequest.mockResolvedValue(request);
  service.updatePurchaseRequest.mockResolvedValue(undefined);
  service.updatePRItem.mockResolvedValue(undefined);
  service.deletePRItem.mockResolvedValue(undefined);
  service.addPRItem.mockResolvedValue(undefined);
  service.convertToPO.mockResolvedValue('POREF-1');
});

afterEach(() => cleanup());

describe('PurchaseRequestModule', () => {
  it('shows clear progress while opening a deep-linked request', async () => {
    let resolveRequest: ((value: typeof request) => void) | undefined;
    service.getPurchaseRequestById.mockImplementationOnce(() => new Promise(resolve => {
      resolveRequest = resolve;
    }));
    service.getPurchaseRequests.mockResolvedValueOnce([]);
    const { default: PurchaseRequestModule } = await import('../PurchaseRequest');
    render(<PurchaseRequestModule initialPRId="PRREF-1" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading purchase request...');
    expect(screen.getByText('Sidebar loading')).toBeInTheDocument();
    expect(screen.queryByText('Select a Purchase Request')).not.toBeInTheDocument();

    resolveRequest?.(request);
    expect(await screen.findByRole('button', { name: 'Update PR' })).toBeInTheDocument();
  });

  it('finishes opening a deep-linked request under React Strict Mode', async () => {
    const { default: PurchaseRequestModule } = await import('../PurchaseRequest');
    render(<React.StrictMode><PurchaseRequestModule initialPRId="PRREF-1" /></React.StrictMode>);

    expect(await screen.findByRole('button', { name: 'Update PR' })).toBeInTheDocument();
    expect(screen.queryByText('Loading purchase request...')).not.toBeInTheDocument();
  });

  it('shows a retry state when a deep-linked request fails', async () => {
    service.getPurchaseRequestById.mockRejectedValueOnce(new Error('Request timed out'));
    const { default: PurchaseRequestModule } = await import('../PurchaseRequest');
    render(<PurchaseRequestModule initialPRId="PRREF-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open purchase request');
    expect(screen.getByText('Request timed out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('loads the list, creates a request, and opens the saved detail', async () => {
    const { default: PurchaseRequestModule } = await import('../PurchaseRequest');
    render(<PurchaseRequestModule />);
    fireEvent.click(await screen.findByRole('button', { name: 'New PR' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit PR' }));
    expect(await screen.findByRole('button', { name: 'Update PR' })).toBeInTheDocument();
    expect(service.createPurchaseRequest).toHaveBeenCalled();
  });

  it('runs detail mutations, print navigation, conversion, and back navigation', async () => {
    service.getPurchaseRequests.mockResolvedValueOnce([]);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { default: PurchaseRequestModule } = await import('../PurchaseRequest');
    render(<PurchaseRequestModule initialPRId="PRREF-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update PR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update PR item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete PR item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add PR item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Print PR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close PR print' }));
    fireEvent.click(screen.getByRole('button', { name: 'Convert PR' }));
    await waitFor(() => expect(service.convertToPO).toHaveBeenCalledWith(['PRREF-1'], ''));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'workflow:navigate' }));
    expect(service.updatePurchaseRequest).toHaveBeenCalled();
    expect(service.updatePRItem).toHaveBeenCalled();
    expect(service.deletePRItem).toHaveBeenCalled();
    expect(service.addPRItem).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back PR' }));
    expect(await screen.findByRole('button', { name: 'New PR' })).toBeInTheDocument();
  });

  it('retraces the previous workflow when a linked request uses Back', async () => {
    window.history.replaceState(createWorkflowHistoryState('#/warehouse-reports-reorder-report'), '', '/#/warehouse-purchasing-purchase-request?prId=PRREF-1');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { default: PurchaseRequestModule } = await import('../PurchaseRequest');
    render(<PurchaseRequestModule initialPRId="PRREF-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Back PR' }));
    expect(backSpy).toHaveBeenCalledOnce();
    backSpy.mockRestore();
  });
});
