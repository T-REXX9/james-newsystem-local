import React, { useState, useEffect, useMemo } from 'react';
import { purchaseRequestService } from '../../services/purchaseRequestService';
import { PurchaseRequestWithItems, CreatePRPayload, Product, Contact, PRStatus } from '../../purchaseRequest.types';

import PurchaseRequestList from './PurchaseRequestList';
import PurchaseRequestForm from './PurchaseRequestForm';
import PurchaseRequestDetail from './PurchaseRequestView'; // Filename is PurchaseRequestView.tsx, Component is PurchaseRequestView
import PurchaseRequestPrint from './PurchaseRequestPrint';

const PurchaseRequestModule: React.FC = () => {
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
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Initial Data Fetch
    useEffect(() => {
        fetchRequests();
        fetchMetadata();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await purchaseRequestService.getPurchaseRequests({ status: filterStatus || undefined });
            setRequests(data);
        } catch (err) {
            console.error('Failed to fetch requests', err);
        } finally {
            setLoading(false);
        }
    };

    // Refetch when filter changes
    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    const fetchMetadata = async () => {
        try {
            const [fetchedProducts, fetchedSuppliers] = await Promise.all([
                purchaseRequestService.getProducts(),
                purchaseRequestService.getSuppliers()
            ]);
            setProducts(fetchedProducts as unknown as Product[]);
            setSuppliers(fetchedSuppliers as unknown as Contact[]);
        } catch (err) {
            console.error('Failed to fetch metadata', err);
        }
    };

    // Filter Logic (Client-side search)
    const filteredRequests = useMemo(() => {
        return requests.filter(pr => {
            if (!searchTerm) return true;
            return pr.pr_number.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [requests, searchTerm]);

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
            setSelectedRequest(newPR);
            setViewMode('detail');
        } catch (err) {
            throw err; // Form catches this
        }
    };

    const handleSelectRequest = async (pr: PurchaseRequestWithItems) => {
        // Fetch full details to ensure fresh items
        const fullPR = await purchaseRequestService.getPurchaseRequestById(pr.id);
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
        if (!confirm('Remove this item?')) return;
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
        if (!confirm(`Convert PR ${selectedRequest.pr_number} items to a new Purchase Order?`)) return;
        try {
            const poId = await purchaseRequestService.convertToPO([selectedRequest.id], 'user-id-placeholder');
            alert(`Converted to PO! (ID: ${poId}) - Logic pending full PO implementation integration.`);
            // Eventually redirect to PO page
        } catch (err: any) {
            alert('Conversion failed: ' + err.message);
        }
    };


    return (
        <div className="h-full">
            {viewMode === 'list' && (
                <PurchaseRequestList
                    requests={filteredRequests}
                    loading={loading}
                    onSelect={handleSelectRequest}
                    onCreate={handleCreateStart}
                    filterStatus={filterStatus}
                    setFilterStatus={setFilterStatus}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                />
            )}

            {viewMode === 'create' && (
                <PurchaseRequestForm
                    onCancel={() => setViewMode('list')}
                    onSubmit={handleCreateSubmit}
                    products={products}
                    suppliers={suppliers}
                    initialPRNumber={nextPRNumber}
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
