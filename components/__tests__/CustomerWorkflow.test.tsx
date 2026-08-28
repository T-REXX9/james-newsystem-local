import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerHistoryTab from '../CustomerHistoryTab';
import CustomerRequestsTab from '../CustomerRequestsTab';
import { fetchCustomerInquiries, fetchCustomerReturns, fetchCustomerRequests, reviewCustomerRequest, CustomerRequest } from '../../services/customerWorkflowLocalApiService';
import type { UserProfile } from '../../types';
vi.mock('../../services/customerWorkflowLocalApiService', () => ({ fetchCustomerInquiries: vi.fn(), fetchCustomerReturns: vi.fn(), fetchCustomerRequests: vi.fn(), reviewCustomerRequest: vi.fn() }));
const pending: CustomerRequest = { id: 'r1', contact_id: 'c1', kind: 'customer_update', payload: { company: 'New company' }, status: 'pending', submitted_by_name: 'Agent', submitted_at: '2026-08-29', reviewed_at: null, review_note: '' };
const owner = { id: '1', role: 'Company Owner' } as UserProfile;
beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);
describe('customer workflow screens', () => {
  it('distinguishes a failed history request from an empty database and supports retry', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCustomerReturns).mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce([]);
    render(<CustomerHistoryTab contactId="c1" kind="returns" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByText('No sales returns for this customer.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('No sales returns for this customer.')).toBeInTheDocument();
  });
  it('does not show a stale response after switching customers', async () => {
    let resolveFirst!: (value: []) => void;
    vi.mocked(fetchCustomerInquiries).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce([{ id: 'i2', number: 'NEW', date: '', status: 'Pending', amount: 5, notes: '' }]);
    const view = render(<CustomerHistoryTab contactId="c1" kind="inquiries" />);
    view.rerender(<CustomerHistoryTab contactId="c2" kind="inquiries" />);
    expect(await screen.findByText('NEW')).toBeInTheDocument();
    resolveFirst([]);
    await waitFor(() => expect(screen.getByText('NEW')).toBeInTheDocument());
  });
  it('lets an owner approve a persisted request and reloads the recorded result', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCustomerRequests).mockResolvedValueOnce([pending]).mockResolvedValueOnce([{ ...pending, status: 'approved' }]);
    vi.mocked(reviewCustomerRequest).mockResolvedValue({ id: 'r1', status: 'approved' });
    render(<CustomerRequestsTab contactId="c1" currentUser={owner} />);
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(reviewCustomerRequest).toHaveBeenCalledWith('c1', 'r1', 'approved', '');
    expect(await screen.findByText('approved')).toBeInTheDocument();
  });
  it('keeps a request pending when the server rejects approval', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCustomerRequests).mockResolvedValue([pending]);
    vi.mocked(reviewCustomerRequest).mockRejectedValue(new Error('Customer details changed'));
    render(<CustomerRequestsTab contactId="c1" currentUser={owner} />);
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Customer details changed');
    expect(screen.getByText('pending')).toBeInTheDocument();
  });
  it('lets agents see their request status without approval controls', async () => {
    vi.mocked(fetchCustomerRequests).mockResolvedValue([pending]);
    render(<CustomerRequestsTab contactId="c1" currentUser={{ ...owner, role: 'Sales Agent' }} />);
    expect(await screen.findByText('pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
