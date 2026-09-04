import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { purchaseRequestService } from '../../services/purchaseRequestService';
import type { Contact, CreatePRPayload, Product, PurchaseRequestWithItems } from '../../purchaseRequest.types';
import PurchaseRequestList from './PurchaseRequestList';
import PurchaseRequestForm from './PurchaseRequestForm';
import PurchaseRequestDetail from './PurchaseRequestView';
import PurchaseRequestPrint from './PurchaseRequestPrint';
import { useToast } from '../ToastProvider';
import { retraceWorkflowHistory } from '../../utils/workflowHistory';

interface PurchaseRequestModuleProps {
  initialPRId?: string;
}

type ViewMode = 'list' | 'create' | 'detail' | 'print';

const PurchaseRequestModule: React.FC<PurchaseRequestModuleProps> = ({ initialPRId }) => {
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [requests, setRequests] = useState<PurchaseRequestWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequestWithItems | null>(null);
  const [nextPRNumber, setNextPRNumber] = useState('');
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Statuses');
  const [listError, setListError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const deepLinkRequestRef = useRef(0);
  const [deepLinkLoading, setDeepLinkLoading] = useState(Boolean(String(initialPRId || '').trim()));
  const [deepLinkError, setDeepLinkError] = useState('');
  const [deepLinkRetry, setDeepLinkRetry] = useState(0);

  const fetchRequests = useCallback(async () => {
    const year = Number(filterYear);
    const month = Number(filterMonth);
    setLoading(true);
    setListError('');
    try {
      const data = await purchaseRequestService.getPurchaseRequests({
        month: month >= 1 && month <= 12 ? month : undefined,
        year: year >= 2000 && year <= 2100 ? year : undefined,
        status: filterStatus,
        search,
      });
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch purchase requests', error);
      setListError(error instanceof Error ? error.message : 'Purchase request history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterStatus, search]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    void purchaseRequestService.getSuppliers().then(data => setSuppliers(data as unknown as Contact[])).catch(error => console.error('Failed to fetch suppliers', error));
  }, []);

  const ensureProductsLoaded = async () => {
    if (products.length > 0) return;
    try {
      const fetchedProducts = await purchaseRequestService.getProducts();
      setProducts(fetchedProducts as unknown as Product[]);
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  useEffect(() => {
    const target = String(initialPRId || '').trim();
    if (!target) return;
    const requestId = ++deepLinkRequestRef.current;
    let cancelled = false;
    setDeepLinkLoading(true);
    setDeepLinkError('');

    // Product lookup is useful for editing, but it must not block the requested
    // PR from appearing. Load both concurrently and show the PR as soon as its
    // own detail request finishes.
    void ensureProductsLoaded();
    void purchaseRequestService.getPurchaseRequestById(target).then(request => {
      if (cancelled || deepLinkRequestRef.current !== requestId) return;
      setSelectedRequest(request);
      setViewMode('detail');
    }).catch(error => {
      if (cancelled || deepLinkRequestRef.current !== requestId) return;
      console.error('Failed to open purchase request from deep link', error);
      setDeepLinkError(error instanceof Error ? error.message : 'The purchase request could not be loaded.');
    }).finally(() => {
      if (!cancelled && deepLinkRequestRef.current === requestId) setDeepLinkLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initialPRId, deepLinkRetry]);

  const retryDeepLink = () => {
    setDeepLinkRetry(current => current + 1);
  };

  const handleCreateStart = async () => {
    try {
      const prNum = await purchaseRequestService.generatePRNumber();
      setNextPRNumber(prNum);
      setViewMode('create');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate a Purchase Request number.';
      addToast({ type: 'error', title: 'Unable to generate PR number', description: message });
    }
  };

  const handleCreateSubmit = async (payload: CreatePRPayload) => {
    const newPR = await purchaseRequestService.createPurchaseRequest(payload);
    setRequests(current => [newPR, ...current.filter(request => request.id !== newPR.id)]);
    setSelectedRequest(newPR);
    setViewMode('detail');
    await Promise.all([fetchRequests(), ensureProductsLoaded()]);
  };

  const handleSelectRequest = async (request: PurchaseRequestWithItems) => {
    setDetailLoading(true);
    try {
      const [fullPR] = await Promise.all([purchaseRequestService.getPurchaseRequestById(request.id), ensureProductsLoaded()]);
      setSelectedRequest(fullPR);
      setViewMode('detail');
    } catch (error) {
      console.error('Failed to load purchase request detail', error);
      setSelectedRequest(request);
      setViewMode('detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
    try {
      await purchaseRequestService.updatePurchaseRequest(id, updates);
      const updated = await purchaseRequestService.getPurchaseRequestById(id);
      setSelectedRequest(updated);
      await fetchRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', title: 'Unable to update purchase request', description: message });
      throw error;
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Record<string, unknown>) => {
    try {
      await purchaseRequestService.updatePRItem(itemId, updates);
      if (selectedRequest) setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', title: 'Unable to update purchase request item', description: message });
      throw error;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await purchaseRequestService.deletePRItem(itemId);
      if (selectedRequest) setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', title: 'Unable to delete purchase request item', description: message });
      throw error;
    }
  };

  const handleUnpost = async (reason: string) => {
    if (!selectedRequest) return;
    await purchaseRequestService.unpostPurchaseRequest(selectedRequest.id, reason);
    setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    await fetchRequests();
  };

  const handleDeleteRequest = async (reason: string) => {
    if (!selectedRequest) return;
    await purchaseRequestService.deletePurchaseRequest(selectedRequest.id, reason);
    setSelectedRequest(null);
    setViewMode('list');
    await fetchRequests();
  };

  const handleAddItem = async (item: Record<string, unknown>) => {
    if (!selectedRequest) return;
    try {
      await purchaseRequestService.addPRItem(selectedRequest.id, item);
      setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', title: 'Unable to add purchase request item', description: message });
      throw error;
    }
  };

  const handleConvertPO = async (itemIds?: string[]) => {
    if (!selectedRequest) return;
    try {
      const selectedItemIds = Array.isArray(itemIds) ? itemIds : undefined;
      const poId = await purchaseRequestService.convertToPO([selectedRequest.id], '', { itemIds: selectedItemIds });
      window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab: 'warehouse-purchasing-purchase-order', payload: { poId } } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', title: 'Unable to generate purchase order', description: message });
      throw error;
    }
  };

  const backToList = () => {
    setSelectedRequest(null);
    setViewMode('list');
    void fetchRequests();
  };

  const handleDetailBack = () => {
    if (String(initialPRId || '').trim()) {
      retraceWorkflowHistory(backToList);
      return;
    }
    backToList();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f9fc] lg:flex-row">
      <PurchaseRequestList requests={requests} loading={loading} error={listError} onRetry={fetchRequests} onSelect={handleSelectRequest} onCreate={handleCreateStart} selectedRequestId={selectedRequest?.id} hideOnSmallScreens={viewMode !== 'list'} filterMonth={filterMonth} setFilterMonth={setFilterMonth} filterYear={filterYear} setFilterYear={setFilterYear} filterStatus={filterStatus} setFilterStatus={setFilterStatus} search={search} setSearch={setSearch} />
      <main className={`min-h-0 min-w-0 flex-1 overflow-hidden ${viewMode === 'list' && !detailLoading ? 'hidden items-center justify-center p-8 text-center text-slate-500 lg:flex' : 'flex items-center justify-center p-8'}`}>
        {detailLoading ? (
          <div role="status" aria-live="polite" className="flex max-w-md flex-col items-center">
            <Loader2 className="h-9 w-9 animate-spin text-[#175fd3]" aria-hidden="true" />
            <p className="mt-4 text-lg font-bold text-slate-700">Loading purchase request...</p>
            <p className="mt-1 text-sm text-slate-500">Fetching details and line items.</p>
          </div>
        ) : viewMode === 'create' ? (
          <div className="h-full w-full"><PurchaseRequestForm onCancel={backToList} onSubmit={handleCreateSubmit} suppliers={suppliers} initialPRNumber={nextPRNumber} /></div>
        ) : (viewMode === 'detail' || viewMode === 'print') && selectedRequest ? (
          <div className="h-full w-full overflow-auto"><PurchaseRequestDetail request={selectedRequest} onBack={handleDetailBack} onUpdate={handleUpdate} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} onAddItem={handleAddItem} onConvert={handleConvertPO} onPrint={() => setViewMode('print')} onUnpost={handleUnpost} onDelete={handleDeleteRequest} products={products} suppliers={suppliers} /></div>
        ) : deepLinkLoading ? (
          <div role="status" aria-live="polite" className="flex max-w-md flex-col items-center">
            <Loader2 className="h-9 w-9 animate-spin text-[#175fd3]" aria-hidden="true" />
            <p className="mt-4 text-lg font-bold text-slate-700">Loading purchase request...</p>
            <p className="mt-1 text-sm">Opening the selected request and its line items.</p>
          </div>
        ) : deepLinkError ? (
          <div role="alert" className="flex max-w-md flex-col items-center">
            <AlertCircle className="h-9 w-9 text-rose-500" aria-hidden="true" />
            <p className="mt-4 text-lg font-bold text-slate-700">Unable to open purchase request</p>
            <p className="mt-1 text-sm">{deepLinkError}</p>
            <button type="button" onClick={retryDeepLink} className="mt-4 rounded-md bg-[#175fd3] px-4 py-2 text-sm font-bold text-white hover:bg-[#0e4fb7]">Try again</button>
          </div>
        ) : (
          <div><p className="text-lg font-bold text-slate-700">Select a Purchase Request</p><p className="mt-1 text-sm">Choose a request from the list or create a new one to begin.</p></div>
        )}
      </main>
      {viewMode === 'print' && selectedRequest && <PurchaseRequestPrint request={selectedRequest} onClose={() => setViewMode('detail')} />}
    </div>
  );
};

export default PurchaseRequestModule;
