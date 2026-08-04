import React, { useState, useEffect, useMemo, useRef } from 'react';
import { purchaseRequestService } from '../../services/purchaseRequestService';
import { PurchaseRequestWithItems, CreatePRPayload, Product, Contact, PRStatus } from '../../purchaseRequest.types';

import PurchaseRequestList from './PurchaseRequestList';
import PurchaseRequestForm from './PurchaseRequestForm';
import PurchaseRequestDetail from './PurchaseRequestView'; // Filename is PurchaseRequestView.tsx, Component is PurchaseRequestView
import PurchaseRequestPrint from './PurchaseRequestPrint';

interface PurchaseRequestModuleProps {
    initialPRId?: string;
}

const PurchaseRequestModule: React.FC<PurchaseRequestModuleProps> = ({ initialPRId }) => {
    // Mode State
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail' | 'print'>('list');

    // Data State
    const [requests, setRequests] = useState<PurchaseRequestWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Contact[]>([]);

    // Selected / Active Item State
    const [selectedRequest, setSelectedRequest] = useState<PurchaseRequestWithItems | null>(null);
    const [nextPRNumber, setNextPRNumber] = useState('');

    // Filter State
    const currentDate = new Date();
    const [filterMonth, setFilterMonth] = useState(String(currentDate.getMonth() + 1).padStart(2, '0'));
    const [filterYear, setFilterYear] = useState(String(currentDate.getFullYear()));
    const consumedDeepLinkRef = useRef('');

    // Initial Data Fetch
    useEffect(() => {
        fetchRequests();
        fetchMetadata();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await purchaseRequestService.getPurchaseRequests();
            setRequests(data);
        } catch (err) {
            console.error('Failed to fetch requests', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const target = String(initialPRId || '').trim();
        if (!target || loading) return;
        if (consumedDeepLinkRef.current === target) return;

        const match = requests.find((pr) => String(pr.id) === target || String(pr.pr_number) === target);
        if (!match) return;

        consumedDeepLinkRef.current = target;
        handleSelectRequest(match).catch((err) => {
            console.error('Failed to open purchase request from deep link', err);
        });
    }, [initialPRId, requests, loading]);

    const fetchMetadata = async () => {
        try {
            const fetchedSuppliers = await purchaseRequestService.getSuppliers();
            setSuppliers(fetchedSuppliers as unknown as Contact[]);
        } catch (err) {
            console.error('Failed to fetch metadata', err);
        }
    };

    const ensureProductsLoaded = async () => {
        if (products.length > 0) return;
        try {
            const fetchedProducts = await purchaseRequestService.getProducts();
            setProducts(fetchedProducts as unknown as Product[]);
        } catch (err) {
            console.error('Failed to fetch products', err);
        }
    };

    // The legacy page filters its record table by month and year.
    const filteredRequests = useMemo(() => {
        return requests.filter(pr => {
            const date = new Date(pr.request_date || '');
            if (Number.isNaN(date.getTime())) return false;
            return String(date.getFullYear()) === filterYear
                && String(date.getMonth() + 1).padStart(2, '0') === filterMonth;
        });
    }, [requests, filterMonth, filterYear]);

    // Handlers
    const handleCreateStart = async () => {
        try {
            const prNum = await purchaseRequestService.generatePRNumber();
            setNextPRNumber(prNum);
            setViewMode('create');
        } catch (err: any) {
            alert('Error generating PR Number: ' + err.message);
        }
    };

    const handleCreateSubmit = async (payload: CreatePRPayload) => {
        try {
            const newPR = await purchaseRequestService.createPurchaseRequest(payload);
            await fetchRequests();
            await ensureProductsLoaded();
            setSelectedRequest(newPR);
            setViewMode('detail');
        } catch (err) {
            throw err; // Form catches this
        }
    };

    const handleSelectRequest = async (pr: PurchaseRequestWithItems) => {
        // Fetch full details to ensure fresh items
        const [fullPR] = await Promise.all([
            purchaseRequestService.getPurchaseRequestById(pr.id),
            ensureProductsLoaded()
        ]);
        setSelectedRequest(fullPR);
        setViewMode('detail');
    };

    const handleUpdate = async (id: string, updates: any) => {
        try {
            await purchaseRequestService.updatePurchaseRequest(id, updates);
            // Refresh
            const updated = await purchaseRequestService.getPurchaseRequestById(id);
            setSelectedRequest(updated);
            // Update list implicitly via fetchRequests eventually, or optimistic?
            // For now simple refresh list
            fetchRequests();
        } catch (err: any) {
            alert('Update failed: ' + err.message);
        }
    };

    const handleUpdateItem = async (itemId: string, updates: any) => {
        try {
            await purchaseRequestService.updatePRItem(itemId, updates);
            if (selectedRequest) {
                const updated = await purchaseRequestService.getPurchaseRequestById(selectedRequest.id);
                setSelectedRequest(updated);
            }
        } catch (err: any) {
            console.error(err);
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        try {
            await purchaseRequestService.deletePRItem(itemId);
            if (selectedRequest) {
                const updated = await purchaseRequestService.getPurchaseRequestById(selectedRequest.id);
                setSelectedRequest(updated);
            }
        } catch (err: any) {
            alert('Delete item failed: ' + err.message);
        }
    };

    const handleAddItem = async (item: any) => {
        if (!selectedRequest) return;
        try {
            await purchaseRequestService.addPRItem(selectedRequest.id, item);
            const updated = await purchaseRequestService.getPurchaseRequestById(selectedRequest.id);
            setSelectedRequest(updated);
        } catch (err: any) {
            alert('Add item failed: ' + err.message);
        }
    };

    const handleConvertPO = async () => {
        if (!selectedRequest) return;
        try {
            const poId = await purchaseRequestService.convertToPO([selectedRequest.id], 'user-id-placeholder');
            alert(`Converted to PO! (ID: ${poId}) - Logic pending full PO implementation integration.`);
            // Eventually redirect to PO page
        } catch (err: any) {
            alert('Conversion failed: ' + err.message);
        }
    };


    return (
        <div className="h-full overflow-y-auto bg-[#f4f4f4]">
            {viewMode === 'list' && (
                <PurchaseRequestList
                    requests={filteredRequests}
                    loading={loading}
                    onSelect={handleSelectRequest}
                    onCreate={handleCreateStart}
                    filterMonth={filterMonth}
                    setFilterMonth={setFilterMonth}
                    filterYear={filterYear}
                    setFilterYear={setFilterYear}
                />
            )}

            {viewMode === 'detail' && selectedRequest && (
                <PurchaseRequestDetail
                    request={selectedRequest}
                    onBack={() => {
                        setSelectedRequest(null);
                        setViewMode('list');
                    }}
                    onUpdate={handleUpdate}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                    onAddItem={handleAddItem}
                    onConvert={handleConvertPO}
                    onPrint={() => setViewMode('print')}
                    products={products}
                    suppliers={suppliers}
                />
            )}

            {viewMode === 'create' && (
                <PurchaseRequestForm
                    onCancel={() => {
                        setViewMode('list');
                        setSelectedRequest(null);
                    }}
                    onSubmit={handleCreateSubmit}
                    suppliers={suppliers}
                    initialPRNumber={nextPRNumber}
                />
            )}

            {viewMode === 'print' && selectedRequest && (
                <PurchaseRequestPrint
                    request={selectedRequest}
                    onClose={() => setViewMode('detail')}
                />
            )}
        </div>
    );
};

export default PurchaseRequestModule;
