import React, { useState } from 'react';
import { useRealtimeList } from '../hooks/useRealtimeList';
import { fetchContacts, bulkUpdateContacts, createContact, updateContact } from '../services/customerDatabaseLocalApiService';
import { Contact } from '../types';
import CustomerListSidebar from './CustomerListSidebar';
import CustomerDetailPanel from './CustomerDetailPanel';
import BulkAssignAgentModal from './BulkAssignAgentModal';
import BulkSetPriceGroupModal from './BulkSetPriceGroupModal';
import { Users, UserPlus, EyeOff, Tag, CheckSquare, X } from 'lucide-react';
import AddContactModal from './AddContactModal';
import { ACTIVE_PRICING_GROUP_OPTIONS } from '../constants/pricingGroups';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';
import { EmptyState, PageHeader } from './common/PageScaffold';

const CustomerDatabase: React.FC = () => {
  const { addToast } = useToast();
  // Data Fetching
  const { data: customers, setData: setCustomers, refetch: reload } = useRealtimeList<Contact>({
    tableName: 'contacts',
    initialFetchFn: fetchContacts,
    sortFn: (a, b) => (a.company || a.name || '').localeCompare(b.company || b.name || ''),
    realtimeEnabled: false,
  });

  // UI State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterVisibility, setFilterVisibility] = useState<string>('Unhidden');

  // Selection State (Multi-select)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAssignAgentModal, setShowAssignAgentModal] = useState(false);
  const [showSetPriceGroupModal, setShowSetPriceGroupModal] = useState(false);
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
      addToast({
        type: 'success',
        title: hide ? 'Customers hidden' : 'Customers restored',
        description: `${selectedIds.size} customer${selectedIds.size === 1 ? '' : 's'} updated successfully.`,
      });
      reload();
      setSelectedIds(new Set());
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Unable to update visibility',
        description: e instanceof Error ? e.message : 'Failed to update visibility.',
      });
    }
  };

  const handleBulkAssignAgent = async (agentName: string) => {
    if (!agentName || selectedIds.size === 0) return;

    try {
      await bulkUpdateContacts(Array.from(selectedIds), { assignedAgent: agentName, salesman: agentName });
      addToast({
        type: 'success',
        title: 'Agent assigned',
        description: `${agentName} was assigned to ${selectedIds.size} customer${selectedIds.size === 1 ? '' : 's'}.`,
      });
      reload();
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Bulk assign agent error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Unable to assign agent',
        description: errorMessage,
      });
    }
  };

  const handleBulkSetPriceGroup = async (priceGroup: string) => {
    if (!priceGroup || selectedIds.size === 0) return;

    const selectedOption = ACTIVE_PRICING_GROUP_OPTIONS.find((option) => option.value === priceGroup);
    if (!selectedOption) return;

    try {
      await bulkUpdateContacts(Array.from(selectedIds), { priceGroup });
      addToast({
        type: 'success',
        title: 'Price group updated',
        description: `${selectedOption.label} was applied to ${selectedIds.size} customer${selectedIds.size === 1 ? '' : 's'}.`,
      });
      reload();
      setShowSetPriceGroupModal(false);
      setSelectedIds(new Set());
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Unable to set price group',
        description: e instanceof Error ? e.message : 'Failed to set price group.',
      });
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
    <div className="flex h-full w-full flex-col bg-slate-50 p-4 dark:bg-slate-950 overflow-hidden relative">
      <PageHeader
        eyebrow="Sales Database"
        title="Customer Database"
        subtitle="Search customers, maintain account details, assign agents, and review business history from one workspace."
        icon={<Users className="h-6 w-6 text-brand-blue" />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {customers.length.toLocaleString()} customers
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {filterVisibility}
            </span>
            {selectedIds.size > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        }
        actions={
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </button>
        }
      />
      <div className="flex min-h-0 flex-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
          <EmptyState
            title="Select a customer"
            description="Choose a customer from the list to view account details, history, financial status, and related activity."
            icon={<Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
          />
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
              <button onClick={() => setShowSetPriceGroupModal(true)} className="p-2 hover:bg-slate-800 rounded-lg tooltip" title="Set Price Group">
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

        <BulkSetPriceGroupModal
          isOpen={showSetPriceGroupModal}
          onClose={() => setShowSetPriceGroupModal(false)}
          onSubmit={handleBulkSetPriceGroup}
          selectedCount={selectedIds.size}
        />
      </main>
      </div>
    </div>
  );
};

export default CustomerDatabase;
