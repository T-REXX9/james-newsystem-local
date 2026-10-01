import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductImageExportActions from '../ProductImageExportActions';

const exportMocks = vi.hoisted(() => ({ pdfs: [] as any[], zips: [] as any[] }));

vi.mock('jspdf', () => ({
  jsPDF: class {
    calls: Array<[string, unknown[]]> = [];
    constructor() { exportMocks.pdfs.push(this); }
    addPage() { this.calls.push(['addPage', []]); }
    setFontSize(...args: unknown[]) { this.calls.push(['setFontSize', args]); }
    text(...args: unknown[]) { this.calls.push(['text', args]); }
    splitTextToSize(...args: unknown[]) { this.calls.push(['splitTextToSize', args]); return ['Fits diesel engines']; }
    addImage(...args: unknown[]) { this.calls.push(['addImage', args]); }
    save(...args: unknown[]) { this.calls.push(['save', args]); }
  },
}));

vi.mock('jszip', () => ({
  default: class {
    files: Record<string, Blob | string> = {};
    constructor() { exportMocks.zips.push(this); }
    file(name: string, content: Blob | string) { this.files[name] = content; }
    async generateAsync() { return new Blob(['zip-file'], { type: 'application/zip' }); }
  },
}));

class LoadedImage {
  naturalWidth = 120;
  naturalHeight = 80;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) { queueMicrotask(() => this.onload?.()); }
}

const product = {
  id: 'product-1',
  part_no: 'PART-1',
  item_code: 'ITEM-1',
  description: 'Sample diesel injector',
  descriptive_inquiry: 'Fits diesel engines',
  recordImage: 'image-data',
} as any;

describe('ProductImageExportActions', () => {
  beforeEach(() => {
    exportMocks.pdfs.length = 0;
    exportMocks.zips.length = 0;
    vi.stubGlobal('Image', LoadedImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '#fff' } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['jpeg-image'], { type: 'image/jpeg' })));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:product-export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloads JPG files with product-identifying filenames', async () => {
    render(<ProductImageExportActions products={[product]} customerName="Acme" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download JPG' }));

    await screen.findByText(/Downloaded 1 JPG image/);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/jpeg' }));
    expect((HTMLAnchorElement.prototype.click as any).mock.contexts?.[0]?.download).toMatch(/PART-1-Sample-diesel-injector-product-1\.jpg$/);
  });

  it('puts multiple product pictures and product details in a ZIP', async () => {
    const secondProduct = { ...product, id: 'product-2', part_no: 'PART-2', description: 'Second injector' };
    render(<ProductImageExportActions products={[product, secondProduct]} customerName="Acme Diesel" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download ZIP' }));

    await screen.findByText(/Downloaded 2 product images in a ZIP file/);
    expect(Object.keys(exportMocks.zips[0].files)).toEqual([
      'PART-1-Sample-diesel-injector-product-1.jpg',
      'PART-2-Second-injector-product-2.jpg',
      'product-details.csv',
    ]);
    expect(exportMocks.zips[0].files['product-details.csv']).toContain('Fits diesel engines');
  });

  it('creates a PDF with the product name, description, and image', async () => {
    render(<ProductImageExportActions products={[product]} customerName="Acme Diesel" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(exportMocks.pdfs).toHaveLength(1));
    await waitFor(() => expect(exportMocks.pdfs[0].calls.some(([name]) => name === 'save')).toBe(true));
    expect(exportMocks.pdfs[0].calls.some(([name, args]) => name === 'text' && args[0] === 'Sample diesel injector')).toBe(true);
    expect(exportMocks.pdfs[0].calls.some(([name]) => name === 'addImage')).toBe(true);
  });
});
