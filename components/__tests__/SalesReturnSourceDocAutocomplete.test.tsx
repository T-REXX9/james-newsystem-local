import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SourceDocAutocomplete } from '../SalesReturnPage';
import type { Contact } from '../../types';
import type { SalesReturnSourceDocument } from '../../services/salesReturnLocalApiService';

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

describe('Sales Return source-document autocomplete', () => {
  it('searches, displays, and selects historical order slip D24116', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const source: SalesReturnSourceDocument = {
      id: '200807081917831971',
      doc_no: 'D24116',
      type: 'OR',
      contact_id: '82481553820200807132657',
      customer_name: 'Test Customer',
      sales_person: 'Agent',
      sales_date: '2020-02-24',
      status: 'Posted',
      grand_total: 1800,
      item_count: 1,
    };
    const customer = {
      id: source.contact_id,
      company: 'Test Customer',
    } as Contact;
    const onSearch = vi.fn().mockResolvedValue([source]);

    render(
      <SourceDocAutocomplete
        documents={[]}
        customers={[customer]}
        selectedDoc={null}
        onSelect={onSelect}
        onSearch={onSearch}
      />
    );

    await user.type(screen.getByPlaceholderText('Search invoice or OR number...'), 'D24116');

    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('D24116'));
    expect(await screen.findByText('D24116')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getByText('Test Customer')).toBeInTheDocument();

    await user.click(screen.getByText('D24116'));
    expect(onSelect).toHaveBeenCalledWith(source);
  });
});
