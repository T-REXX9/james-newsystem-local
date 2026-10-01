import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InquiryItemImageExportButton from '../InquiryItemImageExportButton';

const mocks = vi.hoisted(() => ({ fetchProduct: vi.fn(), exportJpg: vi.fn() }));

vi.mock('../../services/productLocalApiService', () => ({
  fetchProductById: (...args: unknown[]) => mocks.fetchProduct(...args),
}));

vi.mock('../ProductImageExportActions', () => ({
  exportProductImageAsJpg: (...args: unknown[]) => mocks.exportJpg(...args),
}));

describe('InquiryItemImageExportButton', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('fetches the catalog product and exports its image as JPG', async () => {
    const product = { id: 'product-1', recordImage: 'image-data' };
    mocks.fetchProduct.mockResolvedValue(product);
    mocks.exportJpg.mockResolvedValue(undefined);
    render(<InquiryItemImageExportButton productId="product-1" productLabel="Plunger" />);

    fireEvent.click(screen.getByRole('button', { name: 'Export image for Plunger' }));

    await waitFor(() => expect(mocks.fetchProduct).toHaveBeenCalledWith('product-1'));
    await waitFor(() => expect(mocks.exportJpg).toHaveBeenCalledWith(product));
    expect(screen.getByRole('button', { name: 'Export image for Plunger' })).toBeEnabled();
  });

  it('shows an inline message when the product cannot be loaded', async () => {
    mocks.fetchProduct.mockResolvedValue(null);
    render(<InquiryItemImageExportButton productId="missing-product" productLabel="Unknown product" />);

    fireEvent.click(screen.getByRole('button', { name: 'Export image for Unknown product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Product details could not be loaded.');
    expect(mocks.exportJpg).not.toHaveBeenCalled();
  });
});
