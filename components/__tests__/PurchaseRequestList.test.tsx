import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PurchaseRequestList from '../PurchaseRequest/PurchaseRequestList';

vi.mock('../ModuleRecordLink', () => ({
  default: ({ children, onOpen, ...props }: { children: React.ReactNode; onOpen?: () => void }) => <a {...props} href="#" onClick={event => { event.preventDefault(); onOpen?.(); }}>{children}</a>,
}));

describe('PurchaseRequestList', () => {
  it('renders the reference sidebar and applies filter controls', () => {
    const onSelect = vi.fn();
    const setFilterMonth = vi.fn();
    const setFilterYear = vi.fn();
    const setFilterStatus = vi.fn();
    const setSearch = vi.fn();
    render(<PurchaseRequestList requests={[{ id: 'ref-1', pr_number: 'PR-26126', request_date: '2026-03-25', status: 'Pending', items: [{}, {}], item_count: 2 } as any]} loading={false} onSelect={onSelect} onCreate={vi.fn()} filterMonth="03" setFilterMonth={setFilterMonth} filterYear="2026" setFilterYear={setFilterYear} filterStatus="All Statuses" setFilterStatus={setFilterStatus} search="" setSearch={setSearch} />);

    expect(screen.getByRole('button', { name: /new request/i })).toBeInTheDocument();
    expect(screen.getByText('PR-26126')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search PR #...'), { target: { value: 'PR-26' } });
    fireEvent.change(screen.getByLabelText('Filter by month'), { target: { value: '04' } });
    fireEvent.change(screen.getByLabelText('Filter by year'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'Approved' } });
    expect(setSearch).toHaveBeenCalledWith('PR-26');
    expect(setFilterMonth).toHaveBeenCalledWith('04');
    expect(setFilterYear).toHaveBeenCalledWith('2025');
    expect(setFilterStatus).toHaveBeenCalledWith('Approved');

    fireEvent.click(screen.getByText('PR-26126'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ref-1' }));
  });
});
