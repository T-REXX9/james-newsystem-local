import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileArchive, FileImage, FileText, Search } from 'lucide-react';
import type { Product, UserProfile } from '../types';
import { canonicalizeRoleName, isMasterUserAccount, ROLE_NAMES } from '../constants';
import { fetchProductsPage } from '../services/productLocalApiService';

interface Props {
  customerName: string;
  assignedAgentId?: string;
  currentUser: UserProfile | null;
}

const safeFilename = (value: string) => value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';

const asImageSource = (value: string) => {
  const image = value.trim();
  if (/^(data:image\/|https?:\/\/|blob:)/i.test(image)) return image;
  return `data:image/jpeg;base64,${image}`;
};

const imageToJpeg = (source: string): Promise<Blob> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return reject(new Error('This browser could not prepare the product image.'));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export this product image as JPG.')), 'image/jpeg', 0.92);
  };
  image.onerror = () => reject(new Error('A product image could not be loaded.'));
  image.src = source;
});

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const DailyCallProductImageExport: React.FC<Props> = ({ customerName, assignedAgentId, currentUser }) => {
  const isSalesAgent = canonicalizeRoleName(currentUser?.role) === ROLE_NAMES.SALES_AGENT || String(currentUser?.user_type ?? '') === '2';
  const canExport = Boolean(currentUser?.id) && (isMasterUserAccount(currentUser) || (!isSalesAgent || String(currentUser?.id) === String(assignedAgentId || '')));
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductsById, setSelectedProductsById] = useState<Map<string, Product>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setProducts([]);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void fetchProductsPage({ search, status: 'all', page: 1, perPage: 50 })
        .then((result) => { if (active) setProducts(result.items.filter((product) => product.recordImage?.trim())); })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not search products.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [query]);

  const selectedProducts = useMemo(() => Array.from(selectedProductsById.values()), [selectedProductsById]);

  const downloadJpgs = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      for (const product of selectedProducts) {
        const blob = await imageToJpeg(asImageSource(product.recordImage || ''));
        downloadBlob(blob, `${safeFilename(product.part_no || product.item_code || product.description)}.jpg`);
      }
      setMessage(`Downloaded ${selectedProducts.length} JPG image${selectedProducts.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export the selected images.');
    } finally { setBusy(false); }
  };

  const downloadZip = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const [{ default: JSZip }] = await Promise.all([import('jszip')]);
      const zip = new JSZip();
      const details: string[] = ['Part No,Product Name,Description'];
      for (const product of selectedProducts) {
        const blob = await imageToJpeg(asImageSource(product.recordImage || ''));
        zip.file(`${safeFilename(product.part_no || product.item_code || product.description)}-${safeFilename(product.id)}.jpg`, blob);
        details.push([product.part_no, product.description, product.descriptive_inquiry].map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(','));
      }
      zip.file('product-details.csv', details.join('\r\n'));
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeFilename(customerName)}-product-images.zip`);
      setMessage(`Downloaded ${selectedProducts.length} product image${selectedProducts.length === 1 ? '' : 's'} in a ZIP file.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the ZIP export.');
    } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const [{ jsPDF }] = await Promise.all([import('jspdf')]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (const [index, product] of selectedProducts.entries()) {
        if (index) pdf.addPage();
        pdf.setFontSize(17);
        pdf.text(product.description || product.part_no || 'Product image', 18, 22, { maxWidth: 174 });
        pdf.setFontSize(10);
        pdf.text(`Part No: ${product.part_no || product.item_code || '—'}`, 18, 32, { maxWidth: 174 });
        const descriptionLines = product.descriptive_inquiry ? pdf.splitTextToSize(product.descriptive_inquiry.replace(/\s+/g, ' ').trim(), 174).slice(0, 4) : [];
        if (descriptionLines.length) pdf.text(descriptionLines, 18, 40);
        const blob = await imageToJpeg(asImageSource(product.recordImage || ''));
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not prepare an image for the PDF.'));
          reader.readAsDataURL(blob);
        });
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const preview = new Image();
          preview.onload = () => resolve(preview);
          preview.onerror = () => reject(new Error('Could not measure a product image for the PDF.'));
          preview.src = dataUrl;
        });
        const imageTop = descriptionLines.length ? 58 : 46;
        const scale = Math.min(174 / image.naturalWidth, (252 - imageTop) / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        pdf.addImage(dataUrl, 'JPEG', 18 + (174 - width) / 2, imageTop, width, height, undefined, 'FAST');
      }
      pdf.save(`${safeFilename(customerName)}-product-images.pdf`);
      setMessage(`Downloaded a PDF with ${selectedProducts.length} product image${selectedProducts.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the PDF export.');
    } finally { setBusy(false); }
  };

  if (!canExport) {
    return <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Product image export is available to staff and this customer’s assigned sales agent.</div>;
  }

  return (
    <section className="space-y-4 p-4" aria-labelledby="product-image-export-title">
      <div>
        <h3 id="product-image-export-title" className="text-sm font-bold text-slate-900">Export product images</h3>
        <p className="mt-1 text-xs text-slate-600">Search for products, select the images requested by {customerName}, then download JPG, PDF, or ZIP.</p>
      </div>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="sr-only">Search products</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by part number or product name" className="min-w-0 flex-1 text-sm outline-none" />
      </label>
      {loading && <p className="text-sm text-slate-600" role="status">Searching products…</p>}
      {query.trim().length < 2 && <p className="text-sm text-slate-600">Enter at least 2 characters to find products with images.</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {!loading && query.trim().length >= 2 && !error && products.length === 0 && <p className="text-sm text-slate-600">No matching products with images were found.</p>}
      {products.length > 0 && (
        <div className="max-h-96 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200">
          {products.map((product) => (
            <label key={product.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50">
              <input type="checkbox" checked={selectedProductsById.has(product.id)} onChange={(event) => setSelectedProductsById((current) => {
                const next = new Map(current);
                if (event.target.checked) next.set(product.id, product); else next.delete(product.id);
                return next;
              })} />
              <img src={asImageSource(product.recordImage || '')} alt="" className="h-14 w-14 shrink-0 rounded border border-slate-200 bg-white object-contain" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{product.description || product.part_no || product.item_code || 'Unnamed product'}</span><span className="block truncate text-xs text-slate-600">{product.part_no || product.item_code || 'No part number'}{product.descriptive_inquiry ? ` · ${product.descriptive_inquiry}` : ''}</span></span>
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-xs text-slate-600">{selectedProducts.length} selected</span>
        <button type="button" disabled={!selectedProducts.length || busy} onClick={() => void downloadJpgs()} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><FileImage className="h-4 w-4" />Download JPG</button>
        <button type="button" disabled={!selectedProducts.length || busy} onClick={() => void downloadPdf()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><FileText className="h-4 w-4" />Download PDF</button>
        <button type="button" disabled={!selectedProducts.length || busy} onClick={() => void downloadZip()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><FileArchive className="h-4 w-4" />Download ZIP</button>
        {busy && <span className="inline-flex items-center gap-1 text-xs text-slate-600" role="status"><Download className="h-3.5 w-3.5 animate-bounce" />Preparing export…</span>}
      </div>
      {message && <p className="text-sm text-emerald-800" role="status">{message}</p>}
    </section>
  );
};

export default DailyCallProductImageExport;
