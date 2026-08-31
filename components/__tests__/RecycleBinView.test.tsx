import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import RecycleBinView from '../RecycleBinView';
import { getAllRecycleBinItems, restoreRecycleBinItem } from '../../services/recycleBinService';

vi.mock('../../services/recycleBinService', () => ({ getAllRecycleBinItems: vi.fn(), restoreRecycleBinItem: vi.fn() }));

const customerRow = {
  id: 'contact:c1',
  item_type: 'contact' as const,
  item_id: 'c1',
  label: 'Deleted customer',
  record_number: 'Deleted customer',
  module: 'Customer',
  status: 'Deleted',
  delete_reason: 'Duplicate account',
  deleted_at: '2026-08-29',
};

const purchaseOrderRow = {
  id: 'purchase_order:POREF-1',
  item_type: 'purchase_order' as const,
  item_id: 'POREF-1',
  label: 'PO-22103',
  record_number: 'PO-22103',
  module: 'Purchase Order',
  status: 'Deleted',
  delete_reason: 'Duplicate',
  deleted_at: '2026-08-30 10:15:00',
};

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it('lists soft-deleted records with source-table restore actions', async () => {
  vi.mocked(getAllRecycleBinItems).mockResolvedValue([customerRow, purchaseOrderRow]);
  render(<RecycleBinView />);

  expect(await screen.findByText('Deleted customer')).toBeInTheDocument();
  expect(screen.getByText('PO-22103')).toBeInTheDocument();
  expect(screen.getByText('Duplicate account')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /restore/i })).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument();
});

it('restores a soft-deleted record and reloads the bin', async () => {
  vi.mocked(getAllRecycleBinItems)
    .mockResolvedValueOnce([customerRow])
    .mockResolvedValueOnce([]);
  vi.mocked(restoreRecycleBinItem).mockResolvedValue({ restored: true });
  render(<RecycleBinView />);

  await screen.findByText('Deleted customer');
  fireEvent.click(screen.getByRole('button', { name: /restore/i }));

  expect(restoreRecycleBinItem).toHaveBeenCalledWith(customerRow);
  expect(await screen.findByText('No deleted records found.')).toBeInTheDocument();
});

it('filters deleted records by type', async () => {
  vi.mocked(getAllRecycleBinItems).mockResolvedValue([customerRow, purchaseOrderRow]);
  render(<RecycleBinView />);

  await screen.findByText('Deleted customer');
  fireEvent.change(screen.getByLabelText('Filter deleted record type'), { target: { value: 'purchase_order' } });

  expect(screen.getByText('PO-22103')).toBeInTheDocument();
  expect(screen.queryByText('Deleted customer')).not.toBeInTheDocument();
  expect(within(screen.getByLabelText('Filter deleted record type')).getByText('Purchase Orders (1)')).toBeInTheDocument();
});

it('shows an empty state for no deleted records', async () => {
  vi.mocked(getAllRecycleBinItems).mockResolvedValue([]);
  render(<RecycleBinView />);
  expect(await screen.findByText('No deleted records found.')).toBeInTheDocument();
});
