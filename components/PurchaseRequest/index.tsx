import React, { useCallback, useEffect, useRef, useState } from 'react';
import { purchaseRequestService } from '../../services/purchaseRequestService';
import type { Contact, CreatePRPayload, Product, PurchaseRequestWithItems } from '../../purchaseRequest.types';
import PurchaseRequestList from './PurchaseRequestList';
import PurchaseRequestForm from './PurchaseRequestForm';
import PurchaseRequestDetail from './PurchaseRequestView';
import PurchaseRequestPrint from './PurchaseRequestPrint';

interface PurchaseRequestModuleProps {
  initialPRId?: string;
}

type ViewMode = 'list' | 'create' | 'detail' | 'print';

const PurchaseRequestModule: React.FC<PurchaseRequestModuleProps> = ({ initialPRId }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [requests, setRequests] = useState<PurchaseRequestWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequestWithItems | null>(null);
  const [nextPRNumber, setNextPRNumber] = useState('');
  const [search, setSearch] = useState('');
  const currentDate = new Date();
  const [filterMonth, setFilterMonth] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(String(currentDate.getFullYear()));
  const [filterStatus, setFilterStatus] = useState('All Statuses');
  const consumedDeepLinkRef = useRef('');

  const fetchRequests = useCallback(async () => {
    const year = Number(filterYear);
    const month = Number(filterMonth);
    setLoading(true);
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
      setRequests([]);
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
    if (!target || consumedDeepLinkRef.current === target) return;
    consumedDeepLinkRef.current = target;
    void purchaseRequestService.getPurchaseRequestById(target).then(async request => {
      await ensureProductsLoaded();
      setSelectedRequest(request);
      setViewMode('detail');
    }).catch(error => console.error('Failed to open purchase request from deep link', error));
  }, [initialPRId]);

  const handleCreateStart = async () => {
    try {
      const prNum = await purchaseRequestService.generatePRNumber();
      setNextPRNumber(prNum);
      setViewMode('create');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate a Purchase Request number.';
      window.alert(`Error generating PR Number: ${message}`);
    }
  };

  const handleCreateSubmit = async (payload: CreatePRPayload) => {
    const newPR = await purchaseRequestService.createPurchaseRequest(payload);
    await fetchRequests();
    await ensureProductsLoaded();
    setSelectedRequest(newPR);
    setViewMode('detail');
  };

  const handleSelectRequest = async (request: PurchaseRequestWithItems) => {
    const [fullPR] = await Promise.all([purchaseRequestService.getPurchaseRequestById(request.id), ensureProductsLoaded()]);
    setSelectedRequest(fullPR);
    setViewMode('detail');
  };

  const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
    try {
      await purchaseRequestService.updatePurchaseRequest(id, updates);
      const updated = await purchaseRequestService.getPurchaseRequestById(id);
      setSelectedRequest(updated);
      await fetchRequests();
    } catch (error) {
      window.alert(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Record<string, unknown>) => {
    try {
      await purchaseRequestService.updatePRItem(itemId, updates);
      if (selectedRequest) setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    } catch (error) {
      console.error('Failed to update Purchase Request item', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await purchaseRequestService.deletePRItem(itemId);
      if (selectedRequest) setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    } catch (error) {
      window.alert(`Delete item failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddItem = async (item: Record<string, unknown>) => {
    if (!selectedRequest) return;
    try {
      await purchaseRequestService.addPRItem(selectedRequest.id, item);
      setSelectedRequest(await purchaseRequestService.getPurchaseRequestById(selectedRequest.id));
    } catch (error) {
      window.alert(`Add item failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConvertPO = async () => {
    if (!selectedRequest) return;
    try {
      const poId = await purchaseRequestService.convertToPO([selectedRequest.id], '');
      window.dispatchEvent(new CustomEvent('workflow:navigate', { detail: { tab: 'warehouse-purchasing-purchase-order', payload: { poId } } }));
    } catch (error) {
      window.alert(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const backToList = () => {
    setSelectedRequest(null);
    setViewMode('list');
    void fetchRequests();
  };

  if (viewMode === 'create') {
    return <PurchaseRequestForm onCancel={backToList} onSubmit={handleCreateSubmit} suppliers={suppliers} initialPRNumber={nextPRNumber} />;
  }

  if (viewMode === 'detail' && selectedRequest) {
    return <PurchaseRequestDetail request={selectedRequest} onBack={backToList} onUpdate={handleUpdate} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} onAddItem={handleAddItem} onConvert={handleConvertPO} onPrint={() => setViewMode('print')} products={products} suppliers={suppliers} />;
  }

  if (viewMode === 'print' && selectedRequest) {
    return <PurchaseRequestPrint request={selectedRequest} onClose={() => setViewMode('detail')} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f9fc] lg:flex-row">
      <PurchaseRequestList requests={requests} loading={loading} onSelect={handleSelectRequest} onCreate={handleCreateStart} filterMonth={filterMonth} setFilterMonth={setFilterMonth} filterYear={filterYear} setFilterYear={setFilterYear} filterStatus={filterStatus} setFilterStatus={setFilterStatus} search={search} setSearch={setSearch} />
      <main className="hidden min-w-0 flex-1 items-center justify-center p-8 text-center text-slate-500 lg:flex"><div><p className="text-lg font-bold text-slate-700">Select a Purchase Request</p><p className="mt-1 text-sm">Choose a request from the list or create a new one to begin.</p></div></main>
    </div>
  );
};

export default PurchaseRequestModule;
