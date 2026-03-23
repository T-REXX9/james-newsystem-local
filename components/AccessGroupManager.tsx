import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FolderPlus, Lock, Save, Trash2, Users } from 'lucide-react';
import { AVAILABLE_APP_MODULES, MODULE_ID_ALIASES } from '../constants';
import { AccessGroup } from '../types';
import ConfirmModal from './ConfirmModal';

interface AccessGroupManagerProps {
  groups: AccessGroup[];
  onCreateGroup: (data: { name: string; description: string; access_rights: string[] }) => Promise<void>;
  onUpdateGroup: (
    id: string,
    data: { name: string; description: string; access_rights: string[] }
  ) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  home: 'General',
  warehouse: 'Warehouse',
  sales: 'Sales',
  accounting: 'Accounting',
  maintenance: 'Maintenance',
  communication: 'Communication',
};

const canonicalizeRights = (rights: string[] | null | undefined): string[] => {
  const normalized = new Set<string>();

  (rights || []).forEach((right) => {
    if (right === '*') {
      normalized.add(right);
      return;
    }

    normalized.add(MODULE_ID_ALIASES[right] || right);
  });

  return Array.from(normalized);
};

const moduleGroups = AVAILABLE_APP_MODULES.filter((module) => module.id !== 'settings').reduce<Record<string, typeof AVAILABLE_APP_MODULES>>(
  (acc, module) => {
    const prefix = module.id.split('-')[0] || 'general';
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(module);
    return acc;
  },
  {}
);

const AccessGroupManager: React.FC<AccessGroupManagerProps> = ({
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groups[0]?.id || null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftRights, setDraftRights] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetGroup, setDeleteTargetGroup] = useState<AccessGroup | null>(null);

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId(null);
      setDraftName('');
      setDraftDescription('');
      setDraftRights([]);
      return;
    }

    const selected = groups.find((group) => group.id === selectedGroupId) || groups[0];
    if (selected.id !== selectedGroupId) {
      setSelectedGroupId(selected.id);
    }
    setDraftName(selected.name);
    setDraftDescription(selected.description || '');
    setDraftRights(canonicalizeRights(selected.access_rights));
  }, [groups, selectedGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const toggleRight = (moduleId: string) => {
    setDraftRights((current) => {
      const canonical = MODULE_ID_ALIASES[moduleId] || moduleId;
      return current.includes(canonical)
        ? current.filter((id) => id !== canonical)
        : [...current, canonical];
    });
  };

  const handleCreate = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      await onCreateGroup({
        name,
        description: newGroupDescription.trim(),
        access_rights: [],
      });
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedGroup) return;

    setIsSaving(true);
    try {
      await onUpdateGroup(selectedGroup.id, {
        name: draftName.trim(),
        description: draftDescription.trim(),
        access_rights: canonicalizeRights(draftRights),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetGroup) return;
    setDeletingId(deleteTargetGroup.id);
    try {
      await onDeleteGroup(deleteTargetGroup.id);
    } finally {
      setDeletingId(null);
      setDeleteTargetGroup(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setShowCreateForm((current) => !current)}
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <FolderPlus className="h-4 w-4" />
          Add New Group
        </button>

        {showCreateForm && (
          <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Group name"
              className="input-field"
            />
            <textarea
              value={newGroupDescription}
              onChange={(event) => setNewGroupDescription(event.target.value)}
              placeholder="Short description"
              rows={3}
              className="input-field resize-none"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !newGroupName.trim()}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isCreating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {groups.map((group) => {
            const isSelected = group.id === selectedGroupId;
            const hasAssignedStaff = (group.assigned_staff_count || 0) > 0;

            return (
              <div
                key={group.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGroupId(group.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedGroupId(group.id);
                  }
                }}
                className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-brand-blue bg-blue-50 dark:border-brand-blue dark:bg-blue-950/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{group.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {group.description || 'No description'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTargetGroup(group);
                    }}
                    disabled={hasAssignedStaff || deletingId === group.id}
                    title={hasAssignedStaff ? 'Remove assigned staff before deleting this group' : 'Delete group'}
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium dark:bg-slate-800">
                    <Users className="h-3.5 w-3.5" />
                    {group.assigned_staff_count || 0}
                  </span>
                </div>
              </div>
            );
          })}

          {!groups.length && (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No access groups yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {selectedGroup ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Group Name
                </label>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="input-field border border-slate-200 rounded-lg px-3 py-2 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Description
                </label>
                <input
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  className="input-field border border-slate-200 rounded-lg px-3 py-2 dark:border-slate-700"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Set Access For: {selectedGroup.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Choose which modules this group can access. Staff assigned to this group can inherit these permissions.
              </p>
            </div>

            <div className="space-y-5">
              {Object.entries(moduleGroups).map(([categoryKey, modules]) => (
                <section key={categoryKey} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {CATEGORY_LABELS[categoryKey] || categoryKey}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {modules.map((module) => {
                      const checked = draftRights.includes(module.id);
                      return (
                        <label
                          key={module.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            checked
                              ? 'border-brand-blue bg-blue-50 dark:border-brand-blue dark:bg-blue-950/30'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRight(module.id)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                          />
                          <span className="text-slate-700 dark:text-slate-200">{module.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>Staff can inherit these rights and still receive individual overrides later.</span>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !draftName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Group Permissions'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 text-center dark:border-slate-700">
            <AlertTriangle className="mb-3 h-8 w-8 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">No group selected</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Create a group on the left to start defining shared module access.
            </p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteTargetGroup !== null}
        onClose={() => setDeleteTargetGroup(null)}
        onConfirm={handleDelete}
        title="Delete Access Group"
        message={`Are you sure you want to delete "${deleteTargetGroup?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default AccessGroupManager;
