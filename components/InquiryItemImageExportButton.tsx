import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { fetchProductById } from '../services/productLocalApiService';
import { exportProductImageAsJpg } from './ProductImageExportActions';

interface Props {
  productId: string;
  productLabel: string;
}

const InquiryItemImageExportButton: React.FC<Props> = ({ productId, productLabel }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!productId || busy) return;
    setBusy(true);
    setError('');
    try {
      const product = await fetchProductById(productId);
      if (!product) throw new Error('Product details could not be loaded.');
      await exportProductImageAsJpg(product);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export this product image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={busy}
        aria-label={`Export image for ${productLabel}`}
        title="Export product image as JPG"
        className="inline-flex items-center gap-1 rounded border border-[#b8c9d8] bg-white px-2 py-1 text-[11px] font-medium text-[#337ab7] hover:bg-[#f2f7fb] disabled:cursor-wait disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? 'Preparing…' : 'Export image'}
      </button>
      {error && <span role="alert" className="mt-1 max-w-36 text-[10px] text-red-700">{error}</span>}
    </span>
  );
};

export default InquiryItemImageExportButton;
