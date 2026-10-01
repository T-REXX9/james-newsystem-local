import React, { useState } from 'react';
import { Download, FileArchive, FileImage, FileText } from 'lucide-react';
import type { Product } from '../types';

interface Props {
  products: Product[];
  customerName?: string;
  compact?: boolean;
}

const safeFilename = (value: string) => value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
const productFilename = (product: Product) => `${safeFilename(product.part_no || product.item_code)}-${safeFilename(product.description)}-${safeFilename(product.id)}`;

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

const ProductImageExportActions: React.FC<Props> = ({ products, customerName, compact = false }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const hasImages = products.length > 0 && products.every((product) => product.recordImage?.trim());
  const canDownloadJpg = hasImages && products.length === 1;

  const exportAsJpg = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      for (const product of products) {
        const blob = await imageToJpeg(asImageSource(product.recordImage || ''));
        downloadBlob(blob, `${productFilename(product)}.jpg`);
      }
      setMessage(`Downloaded ${products.length} JPG image${products.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export the selected images.');
    } finally { setBusy(false); }
  };

  const exportAsZip = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const [{ default: JSZip }] = await Promise.all([import('jszip')]);
      const zip = new JSZip();
      const details: string[] = ['Part No,Product Name,Description'];
      for (const product of products) {
        const blob = await imageToJpeg(asImageSource(product.recordImage || ''));
        zip.file(`${productFilename(product)}.jpg`, blob);
        details.push([product.part_no, product.description, product.descriptive_inquiry].map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(','));
      }
      zip.file('product-details.csv', details.join('\r\n'));
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeFilename(customerName || 'product')}-product-images.zip`);
      setMessage(`Downloaded ${products.length} product image${products.length === 1 ? '' : 's'} in a ZIP file.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the ZIP export.');
    } finally { setBusy(false); }
  };

  const exportAsPdf = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const [{ jsPDF }] = await Promise.all([import('jspdf')]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (const [index, product] of products.entries()) {
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
      pdf.save(`${safeFilename(customerName || 'product')}-product-images.pdf`);
      setMessage(`Downloaded a PDF with ${products.length} product image${products.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the PDF export.');
    } finally { setBusy(false); }
  };

  const buttonClass = compact
    ? 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

  const jpgLabel = compact ? 'JPG' : 'Download JPG';
  const pdfLabel = compact ? 'PDF' : 'Download PDF';
  const zipLabel = compact ? 'ZIP' : 'Download ZIP';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!canDownloadJpg || busy} onClick={() => void exportAsJpg()} className={`${buttonClass} ${!compact ? 'bg-blue-700 text-white hover:bg-blue-800' : ''}`}><FileImage className="inline h-4 w-4" />{jpgLabel}</button>
        <button type="button" disabled={!hasImages || busy} onClick={() => void exportAsPdf()} className={buttonClass}><FileText className="inline h-4 w-4" />{pdfLabel}</button>
        <button type="button" disabled={!hasImages || busy} onClick={() => void exportAsZip()} className={buttonClass}><FileArchive className="inline h-4 w-4" />{zipLabel}</button>
        {busy && <span className="inline-flex items-center gap-1 text-xs text-slate-600" role="status"><Download className="h-3.5 w-3.5 animate-bounce" />Preparing…</span>}
      </div>
      {hasImages && products.length > 1 && <p className="text-[11px] text-slate-500">JPG downloads one image at a time. Use PDF or ZIP to export multiple images together.</p>}
      {error && <p className="text-xs text-red-800" role="alert">{error}</p>}
      {message && <p className="text-xs text-emerald-800" role="status">{message}</p>}
    </div>
  );
};

export default ProductImageExportActions;
