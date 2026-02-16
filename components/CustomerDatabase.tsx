import React, { useState } from 'react';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { fetchContacts, bulkUpdateContacts, createContact, updateContact } from '../services/supabaseService';
import { Contact } from '../types';
import CustomerListSidebar from './CustomerListSidebar';
import CustomerDetailPanel from './CustomerDetailPanel';
import BulkAssignAgentModal from './BulkAssignAgentModal';
import { Users, UserPlus, EyeOff, Tag, CheckSquare, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import AddContactModal from './AddContactModal';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';

const CustomerDatabase: React.FC = () => {
  const { addToast } = useToast();
  // Data Fetching
  const { data: customers, setData: setCustomers, refetch: reload } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
    sortFn: (a, b) => (a.company || a.name || '').localeCompare(b.company || b.name || '')
  });

  // UI State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterVisibility, setFilterVisibility] = useState<string>('Unhidden');

  // Selection State (Multi-select)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAssignAgentModal, setShowAssignAgentModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Contact | null>(null);

  // Handlers
  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
  };

  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleToggleAll = () => {
    if (selectedIds.size === customers.length && customers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map(c => c.id)));
    }
  };

  const handleUpdateContact = (updated: Contact) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Bulk Actions
  const handleBulkHide = async (hide: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdateContacts(Array.from(selectedIds), { isHidden: hide });
      toast.success(`Successfully ${hide ? 'hidden' : 'unhidden'} ${selectedIds.size} customers`);
      reload();
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Failed to update visibility');
    }
  };

  const handleBulkAssignAgent = async (agentName: string) => {
    if (!agentName || selectedIds.size === 0) return;

    try {
      await bulkUpdateContacts(Array.from(selectedIds), { assignedAgent: agentName, salesman: agentName });
      toast.success(`Assigned ${agentName} to ${selectedIds.size} customers`);
      reload();
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Bulk assign agent error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Failed to assign agent: ${errorMessage}`);
    }
  };

  const handleBulkSetPriceGroup = async () => {
    const group = prompt("Enter Price Group (e.g. Retail, Wholesale, Distributor):");
    if (!group || selectedIds.size === 0) return;

    try {
      await bulkUpdateContacts(Array.from(selectedIds), { priceGroup: group });
      toast.success(`Set price group to ${group} for ${selectedIds.size} customers`);
      reload();
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Failed to set price group');
    }
  };

  const handleCreateNew = () => {
    setShowAddCustomerModal(true);
  };

  const handleEditCustomer = (contact: Contact) => {
    setEditingCustomer(contact);
    setShowEditCustomerModal(true);
  };

  const handleSubmitNewCustomer = async (data: Omit<Contact, 'id'>) => {
    try {
      const created = await createContact(data);
      // Optimistically add/merge in case realtime hasn't delivered yet
      setCustomers((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      setSelectedCustomerId(created.id);
      addToast({ 
        type: 'success', 
        title: 'Customer created',
        description: 'New customer has been added to the database.',
        durationMs: 4000,
      });
      await reload();
      return created;
    } catch (e) {
      addToast({ 
        type: 'error', 
        title: 'Unable to create customer',
        description: parseSupabaseError(e, 'customer'),
        durationMs: 6000,
      });
      throw e;
    }
  };

  const handleSubmitEditCustomer = async (data: Omit<Contact, 'id'>) => {
    if (!editingCustomer) return;
    try {
      await updateContact(editingCustomer.id, data);
      const updated = { ...editingCustomer, ...data, id: editingCustomer.id };
      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? updated : c));
      setSelectedCustomerId(editingCustomer.id);
      addToast({ 
        type: 'success', 
        title: 'Customer updated',
        description: 'Customer information has been updated successfully.',
        durationMs: 4000,
      });
      await reload();
      setShowEditCustomerModal(false);
      setEditingCustomer(null);
      return updated;
    } catch (e) {
      addToast({ 
        type: 'error', 
        title: 'Unable to update customer',
        description: parseSupabaseError(e, 'customer'),
        durationMs: 6000,
      });
      throw e;
    }
  };

  // Layout
  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      <Toaster position="top-right" richColors />

      <AddContactModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSubmit={handleSubmitNewCustomer}
        mode="create"
      />

      <AddContactModal
        isOpen={showEditCustomerModal}
        onClose={() => {
          setShowEditCustomerModal(false);
          setEditingCustomer(null);
        }}
        onSubmit={handleSubmitEditCustomer}
        mode="edit"
        initialData={editingCustomer || undefined}
      />

      {/* Left Sidebar */}
      <CustomerListSidebar
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={handleSelectCustomer}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterVisibility={filterVisibility}
        onFilterVisibilityChange={setFilterVisibility}
        selectedIds={selectedIds}
        onToggleSelection={handleToggleSelection}
        onToggleAll={handleToggleAll}
        onCreateNew={handleCreateNew}
      />

      {/* Main Content (Detail Panel) */}
      <main className="flex-1 h-full overflow-hidden relative">
        {selectedCustomerId ? (
          <CustomerDetailPanel
            contactId={selectedCustomerId}
            initialData={customers.find(c => c.id === selectedCustomerId)}
            onClose={() => setSelectedCustomerId(null)}
            onUpdate={handleUpdateContact}
            onEditContact={handleEditCustomer}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-600 dark:text-slate-300">Select a Customer</h2>
            <p className="max-w-md text-center mt-2 text-slate-500">
              Click on any customer from the list to view their comprehensive details, history, and financial status.
            </p>
          </div>
        )}

        {/* Floating Bulk Action Bar (Overlay) */}
        {selectedIds.size > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
              <CheckSquare className="w-4 h-4 text-brand-blue" />
              <span className="font-bold">{selectedIds.size} Selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowAssignAgentModal(true)} className="p-2 hover:bg-slate-800 rounded-lg tooltip" title="Assign Agent">
                <UserPlus className="w-4 h-4" />
              </button>
              <button onClick={() => handleBulkSetPriceGroup()} className="p-2 hover:bg-slate-800 rounded-lg tooltip" title="Set Price Group">
                <Tag className="w-4 h-4" />
              </button>
              <button onClick={() => handleBulkHide(true)} className="p-2 hover:bg-slate-800 rounded-lg tooltip" title="Hide Customers">
                <EyeOff className="w-4 h-4" />
              </button>
            </div>

            <button onClick={() => setSelectedIds(new Set())} className="ml-2 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bulk Assign Agent Modal */}
        <BulkAssignAgentModal
          isOpen={showAssignAgentModal}
          onClose={() => setShowAssignAgentModal(false)}
          onAssign={handleBulkAssignAgent}
          selectedCount={selectedIds.size}
        />
      </main>
    </div>
  );
};

export default CustomerDatabase;
