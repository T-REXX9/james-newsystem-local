import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Product, UserProfile } from '../types';
import { canExportProductImages } from '../utils/productImageExportAccess';
import { fetchProductsPage } from '../services/productLocalApiService';
import ProductImageExportActions from './ProductImageExportActions';

interface Props {
  customerName: string;
  assignedAgentId?: string;
  currentUser: UserProfile | null;
}

const asImageSource = (value: string) => {
  const image = value.trim();
  if (/^(data:image\/|https?:\/\/|blob:)/i.test(image)) return image;
  return `data:image/jpeg;base64,${image}`;
};

const DailyCallProductImageExport: React.FC<Props> = ({ customerName, assignedAgentId, currentUser }) => {
  const canExport = canExportProductImages(currentUser, assignedAgentId);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductsById, setSelectedProductsById] = useState<Map<string, Product>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        <ProductImageExportActions products={selectedProducts} customerName={customerName} />
      </div>
      {selectedProducts.length > 0 && (
        <ul aria-label="Selected products" className="flex flex-wrap gap-2">
          {selectedProducts.map((product) => (
            <li key={product.id} className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-xs text-slate-700">
              <span className="max-w-56 truncate">{product.description || product.part_no || product.item_code}</span>
              <button type="button" aria-label={`Remove ${product.description || product.part_no || product.item_code} from selection`} onClick={() => setSelectedProductsById((current) => {
                const next = new Map(current);
                next.delete(product.id);
                return next;
              })} className="rounded-full px-1.5 py-0.5 font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-900">×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default DailyCallProductImageExport;
