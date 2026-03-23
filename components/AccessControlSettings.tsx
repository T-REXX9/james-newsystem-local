import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Shield,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AVAILABLE_APP_MODULES,
  DEFAULT_STAFF_ACCESS_RIGHTS,
  DEFAULT_STAFF_ROLE,
  MODULE_ID_ALIASES,
  ROLE_DEFAULT_ACCESS_RIGHTS,
  STAFF_ROLES,
} from '../constants';
import {
  createStaffAccountLocal,
  fetchProfilesLocal,
  updateProfileLocal,
} from '../services/accessLocalApiService';
import {
  createAccessGroup,
  deleteAccessGroup,
  fetchAccessGroups,
  updateAccessGroup,
} from '../services/accessGroupApiService';
import { parseSupabaseError } from '../utils/errorHandler';
import {
  AccessGroup,
  CreateStaffAccountInput,
  StaffAccountValidationError,
  UserProfile,
} from '../types';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import AccessGroupManager from './AccessGroupManager';
import { useToast } from './ToastProvider';

const STAFF_PER_PAGE = 50;
const STAFF_MEMBER_COLUMN_WIDTH = 288;
const GROUP_COLUMN_WIDTH = 220;
const INITIAL_NEW_USER_FORM = {
  fullName: '',
  email: '',
  role: DEFAULT_STAFF_ROLE,
  password: '',
  birthday: '',
  mobile: '',
};

const getEffectiveCanonicalRights = (rights: string[] | null | undefined): Set<string> => {
  const result = new Set<string>();

  (rights || []).forEach((id) => {
    if (id === '*' || id === 'settings') {
      result.add(id);
      return;
    }

    result.add(MODULE_ID_ALIASES[id] || id);
  });

  return result;
};

const AccessControlSettings: React.FC = () => {
  const { addToast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [originalProfiles, setOriginalProfiles] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'groups' | 'staff'>('staff');
  const [isLoading, setIsLoading] = useState(true);
  const [isGroupsLoading, setIsGroupsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProfiles, setTotalProfiles] = useState(0);

  const [permissionChanges, setPermissionChanges] = useState<Record<string, boolean>>({}); // tracks per-user whether access_rights were manually edited

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState(INITIAL_NEW_USER_FORM);
  const [formErrors, setFormErrors] = useState<StaffAccountValidationError>({});
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({
    type: null,
    text: '',
  });

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((group) => [group.id, group])),
    [groups]
  );

  const passwordStrength = useMemo(() => {
    const value = newUserForm.password;
    if (!value) return { label: '', level: 0 };

    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    const levels = ['Weak', 'Fair', 'Good', 'Strong'];
    return { label: levels[Math.min(score - 1, levels.length - 1)] || 'Weak', level: score };
  }, [newUserForm.password]);

  useEffect(() => {
    loadProfiles();
  }, [page]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadProfiles = async (targetPage = page) => {
    setIsLoading(true);
    try {
      const data = await fetchProfilesLocal({ page: targetPage, perPage: STAFF_PER_PAGE });
      setProfiles(data.items);
      setOriginalProfiles(data.items);
      setPage(data.meta.page);
      setTotalPages(Math.max(1, data.meta.total_pages || 1));
      setTotalProfiles(Math.max(0, data.meta.total || 0));
    } catch (error) {
      console.error('Unable to load staff profiles:', error);
      setProfiles([]);
      setOriginalProfiles([]);
      setTotalPages(1);
      setTotalProfiles(0);
      addToast({
        type: 'error',
        title: 'Unable to load staff profiles',
        description: parseSupabaseError(error, 'staff profiles'),
        durationMs: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    setIsGroupsLoading(true);
    try {
      const data = await fetchAccessGroups();
      setGroups(data);
    } catch (error) {
      console.error('Unable to load access groups:', error);
      setGroups([]);
      addToast({
        type: 'error',
        title: 'Unable to load access groups',
        description: parseSupabaseError(error, 'access groups'),
        durationMs: 6000,
      });
    } finally {
      setIsGroupsLoading(false);
    }
  };

  const handleGroupAssignmentChange = (userId: string, nextGroupId: string | null) => {
    setProfiles((prevProfiles) =>
      prevProfiles.map((profile) => {
        if (profile.id !== userId) return profile;

        const groupRights = nextGroupId ? groupMap[nextGroupId]?.access_rights || [] : profile.access_rights || [];
        return {
          ...profile,
          group_id: nextGroupId,
          access_rights: [...groupRights],
          access_override: false,
        };
      })
    );
    setPermissionChanges((prev) => ({ ...prev, [userId]: false }));
  };

  const handlePermissionToggle = (userId: string, moduleId: string, currentlyAllowed: boolean) => {
    setProfiles((prevProfiles) =>
      prevProfiles.map((profile) => {
        if (profile.id !== userId) return profile;

        const currentRights = new Set(profile.access_rights || []);

        if (currentlyAllowed) {
          // If has wildcard, expand to all modules minus the toggled one
          if (currentRights.has('*')) {
            currentRights.delete('*');
            AVAILABLE_APP_MODULES.forEach((mod) => {
              if (mod.id !== 'settings' && mod.id !== moduleId) {
                currentRights.add(mod.id);
              }
            });
          } else {
            currentRights.delete(moduleId);
            // Also remove any aliases that map to this module
            Object.entries(MODULE_ID_ALIASES).forEach(([alias, canonical]) => {
              if (canonical === moduleId) currentRights.delete(alias);
            });
          }
        } else {
          currentRights.add(moduleId);
        }

        return {
          ...profile,
          access_rights: Array.from(currentRights),
          access_override: true,
        };
      })
    );
    setPermissionChanges((prev) => ({ ...prev, [userId]: true }));
  };

  const savePermissions = async (user: UserProfile) => {
    const hasPermOverride = permissionChanges[user.id] || false;
    setSavingId(user.id);
    try {
      await updateProfileLocal(user.id, {
        group_id: user.group_id ?? null,
        access_rights: user.access_rights || [],
        access_override: hasPermOverride,
      });
      setOriginalProfiles((prev) =>
        prev.map((profile) =>
          profile.id === user.id
            ? { ...profile, access_rights: user.access_rights, access_override: hasPermOverride, group_id: user.group_id ?? null }
            : profile
        )
      );
      setPermissionChanges((prev) => ({ ...prev, [user.id]: false }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      await loadGroups();
      addToast({
        type: 'success',
        title: 'Permissions updated',
        description: 'Staff access and group assignment were saved successfully.',
        durationMs: 4000,
      });
    } catch (error) {
      console.error(error);
      addToast({
        type: 'error',
        title: 'Unable to update permissions',
        description: parseSupabaseError(error, 'permissions'),
        durationMs: 6000,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateGroup = async (data: { name: string; description: string; access_rights: string[] }) => {
    try {
      const created = await createAccessGroup(data.name, data.description, data.access_rights);
      setGroups((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      addToast({
        type: 'success',
        title: 'Group created',
        description: `${data.name} is ready for permission setup.`,
        durationMs: 4000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to create group',
        description: parseSupabaseError(error, 'access group'),
        durationMs: 6000,
      });
      throw error;
    }
  };

  const handleUpdateGroup = async (
    id: string,
    data: { name: string; description: string; access_rights: string[] }
  ) => {
    try {
      const updated = await updateAccessGroup(id, data);
      setGroups((prev) => prev.map((group) => (group.id === id ? updated : group)));
      await loadProfiles();
      addToast({
        type: 'success',
        title: 'Group saved',
        description: 'Group permissions were updated and synced to inheriting staff.',
        durationMs: 4000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to save group',
        description: parseSupabaseError(error, 'access group'),
        durationMs: 6000,
      });
      throw error;
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteAccessGroup(id);
      setGroups((prev) => prev.filter((group) => group.id !== id));
      setProfiles((prev) =>
        prev.map((profile) => (profile.group_id === id ? { ...profile, group_id: null } : profile))
      );
      setOriginalProfiles((prev) =>
        prev.map((profile) => (profile.group_id === id ? { ...profile, group_id: null } : profile))
      );
      addToast({
        type: 'success',
        title: 'Group deleted',
        description: 'The access group was removed successfully.',
        durationMs: 4000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Unable to delete group',
        description: parseSupabaseError(error, 'access group'),
        durationMs: 6000,
      });
      throw error;
    }
  };

  const validateForm = () => {
    const errors: StaffAccountValidationError = {};

    if (!newUserForm.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }
    if (!newUserForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserForm.email)) {
      errors.email = 'Enter a valid email address';
    }
    if (!newUserForm.password) {
      errors.password = 'Password is required';
    } else if (newUserForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (newUserForm.role && !STAFF_ROLES.includes(newUserForm.role)) {
      errors.role = 'Please select a valid role';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetNewUserModalState = () => {
    setNewUserForm(INITIAL_NEW_USER_FORM);
    setFormErrors({});
    setFormMessage({ type: null, text: '' });
  };

  const closeNewUserModal = () => {
    setIsAddUserModalOpen(false);
    resetNewUserModalState();
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormMessage({ type: null, text: '' });
    if (!validateForm()) return;

    const payload: CreateStaffAccountInput = {
      fullName: newUserForm.fullName.trim(),
      email: newUserForm.email.trim(),
      password: newUserForm.password,
      role: newUserForm.role,
      birthday: newUserForm.birthday || undefined,
      mobile: newUserForm.mobile || undefined,
      accessRights: ROLE_DEFAULT_ACCESS_RIGHTS[newUserForm.role] || ROLE_DEFAULT_ACCESS_RIGHTS['Staff'] || ['home'],
    };

    setIsCreatingUser(true);
    try {
      const result = await createStaffAccountLocal(payload);

      if (!result.success) {
        setFormErrors(result.validationErrors || {});
        setFormMessage({ type: 'error', text: result.error || 'Unable to create account. Please try again.' });
        addToast({
          type: 'error',
          title: 'Unable to create user',
          description: result.error || 'Unable to create account. Please try again.',
          durationMs: 6000,
        });
        return;
      }

      setPage(1);
      await loadProfiles(1);
      await loadGroups();
      setIsAddUserModalOpen(false);
      resetNewUserModalState();
      setFormMessage({ type: 'success', text: `Account created for ${payload.fullName}` });
      addToast({
        type: 'success',
        title: 'User created',
        description: 'Account has been created successfully.',
        durationMs: 4000,
      });
    } catch (error: any) {
      console.error('Unexpected error creating staff account:', error);
      setFormMessage({ type: 'error', text: error?.message || 'Something went wrong while creating the account.' });
      addToast({
        type: 'error',
        title: 'Unable to create user',
        description: parseSupabaseError(error, 'user'),
        durationMs: 6000,
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (isLoading && isGroupsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  const rangeStart = totalProfiles === 0 ? 0 : (page - 1) * STAFF_PER_PAGE + 1;
  const rangeEnd = totalProfiles === 0 ? 0 : Math.min(totalProfiles, page * STAFF_PER_PAGE);
  const stickyStaffColumnStyle = {
    width: `${STAFF_MEMBER_COLUMN_WIDTH}px`,
    minWidth: `${STAFF_MEMBER_COLUMN_WIDTH}px`,
    maxWidth: `${STAFF_MEMBER_COLUMN_WIDTH}px`,
  } as const;
  const stickyGroupColumnStyle = {
    left: `${STAFF_MEMBER_COLUMN_WIDTH}px`,
    width: `${GROUP_COLUMN_WIDTH}px`,
    minWidth: `${GROUP_COLUMN_WIDTH}px`,
    maxWidth: `${GROUP_COLUMN_WIDTH}px`,
  } as const;
  const permissionTableMinWidth =
    STAFF_MEMBER_COLUMN_WIDTH + GROUP_COLUMN_WIDTH + AVAILABLE_APP_MODULES.filter((module) => module.id !== 'settings').length * 112 + 140;

  return (
    <div className="relative h-full overflow-y-auto p-8 animate-fadeIn">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <Shield className="h-6 w-6 text-brand-blue" />
            Access Control & Permissions
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage legacy role groups and the module access they grant.
          </p>
        </div>

        {activeTab === 'staff' && (
          <button
            onClick={() => {
              resetNewUserModalState();
              setIsAddUserModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" /> Add New Account
          </button>
        )}
      </div>

      {!isAddUserModalOpen && formMessage.type && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            formMessage.type === 'success'
              ? 'border-green-100 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'border-red-100 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}
        >
          {formMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{formMessage.text}</span>
        </div>
      )}

      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {[
          { id: 'groups', label: 'Groups' },
          { id: 'staff', label: 'Staff' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as 'groups' | 'staff')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-blue text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'groups' ? (
        <AccessGroupManager
          groups={groups}
          onCreateGroup={handleCreateGroup}
          onUpdateGroup={handleUpdateGroup}
          onDeleteGroup={handleDeleteGroup}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
              <p>
                Showing {rangeStart}-{rangeEnd} of {totalProfiles} staff members
              </p>
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="min-w-[92px] text-center font-medium text-slate-600 dark:text-slate-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table
                className="border-collapse text-left"
                style={{ minWidth: `${permissionTableMinWidth}px`, tableLayout: 'fixed' }}
              >
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <th
                      className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                      style={stickyStaffColumnStyle}
                    >
                      Staff Member
                    </th>
                    <th
                      className="sticky z-20 border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                      style={stickyGroupColumnStyle}
                    >
                      Group
                    </th>
                    {AVAILABLE_APP_MODULES.filter((module) => module.id !== 'settings').map((module) => (
                      <th
                        key={module.id}
                        className="border-l border-slate-100 p-4 text-center dark:border-slate-800"
                        style={{ minWidth: '112px', width: '112px' }}
                      >
                        {module.label}
                      </th>
                    ))}
                    <th className="sticky right-0 z-20 w-32 border-l border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {profiles.map((user) => {
                    const isOwner = user.role === 'Owner';
                    const userRights = user.access_rights || [];
                    const hasFullAccess = userRights.includes('*');
                    const effectiveCanonicalRights = getEffectiveCanonicalRights(userRights);
                    const assignedGroup = user.group_id ? groupMap[user.group_id] : undefined;
                    const originalProfile = originalProfiles.find((profile) => profile.id === user.id);
                    const groupChanged = (user.group_id || null) !== (originalProfile?.group_id || null);
                    const permissionsEdited = permissionChanges[user.id] || false;
                    const hasChanges = groupChanged || permissionsEdited;

                    return (
                      <tr key={user.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td
                          className="sticky left-0 z-10 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                          style={stickyStaffColumnStyle}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-white break-words">
                                {user.full_name || 'Unknown'}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    isOwner
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  {user.role}
                                </span>
                                {assignedGroup && (
                                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-brand-blue bg-blue-50 dark:bg-blue-950/40">
                                    {assignedGroup.name}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400">{user.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          className="sticky z-10 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                          style={stickyGroupColumnStyle}
                        >
                          <select
                            value={user.group_id || ''}
                            disabled={isOwner}
                            onChange={(event) => handleGroupAssignmentChange(user.id, event.target.value || null)}
                            className="input-field w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {AVAILABLE_APP_MODULES.filter((module) => module.id !== 'settings').map((module) => {
                          const isAllowed = isOwner || hasFullAccess || effectiveCanonicalRights.has(module.id);
                          const assignedGroupRights = assignedGroup
                            ? getEffectiveCanonicalRights(assignedGroup.access_rights)
                            : null;
                          const differsFromGroup = permissionsEdited && assignedGroupRights
                            ? isAllowed !== (assignedGroupRights.has(module.id) || assignedGroupRights.has('*'))
                            : false;
                          return (
                            <td
                              key={module.id}
                              className={`border-l border-slate-100 p-4 text-center dark:border-slate-800 ${
                                differsFromGroup
                                  ? 'bg-amber-50/70 dark:bg-amber-900/20'
                                  : 'bg-slate-50/70 dark:bg-slate-800/30'
                              }`}
                              title={isOwner ? 'Owner — full access' : differsFromGroup ? 'Modified from group permissions' : 'Click to toggle access'}
                            >
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  disabled={isOwner}
                                  onChange={() => {
                                    if (!isOwner) handlePermissionToggle(user.id, module.id, isAllowed);
                                  }}
                                  className={`h-4 w-4 rounded border-gray-300 text-brand-blue ${
                                    isOwner ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer opacity-100'
                                  }`}
                                />
                              </div>
                            </td>
                          );
                        })}

                        <td className="sticky right-0 z-10 border-l border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
                          {isOwner ? (
                            <span className="text-xs italic text-slate-400">Full Access</span>
                          ) : (
                            <button
                              onClick={() => savePermissions(user)}
                              disabled={savingId === user.id || !hasChanges}
                              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingId === user.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Save
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              <strong>Note:</strong> Owners always have full access. You can assign a group to set default permissions,
              or edit individual checkboxes directly. Cells highlighted in amber indicate permissions that differ from
              the assigned group. Click <strong>Save</strong> to apply changes.
            </p>
          </div>
        </>
      )}

      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="flex w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Create Staff Account</h2>
              <button
                aria-label="Close create staff modal"
                onClick={closeNewUserModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} noValidate className="space-y-4 p-6">
              {formMessage.type === 'error' && (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="flex-1">{formMessage.text}</span>
                  <button
                    type="button"
                    onClick={() => setFormMessage({ type: null, text: '' })}
                    className="text-xs font-bold underline decoration-red-400 hover:text-red-600"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Full Name</label>
                <input
                  required
                  className="input-field"
                  value={newUserForm.fullName}
                  onChange={(event) => setNewUserForm({ ...newUserForm, fullName: event.target.value })}
                  placeholder="e.g. John Doe"
                />
                {formErrors.fullName && <p className="mt-1 text-xs text-red-500">{formErrors.fullName}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Role</label>
                <select
                  className="input-field"
                  value={newUserForm.role}
                  onChange={(event) => setNewUserForm({ ...newUserForm, role: event.target.value })}
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                {formErrors.role && <p className="mt-1 text-xs text-red-500">{formErrors.role}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Email</label>
                <input
                  required
                  type="email"
                  className="input-field"
                  value={newUserForm.email}
                  onChange={(event) => setNewUserForm({ ...newUserForm, email: event.target.value })}
                  placeholder="staff@company.com"
                />
                {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Birthday</label>
                  <input
                    type="date"
                    className="input-field"
                    value={newUserForm.birthday}
                    onChange={(event) => setNewUserForm({ ...newUserForm, birthday: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mobile Number</label>
                  <input
                    className="input-field"
                    value={newUserForm.mobile}
                    onChange={(event) => setNewUserForm({ ...newUserForm, mobile: event.target.value })}
                    placeholder="0917..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Password</label>
                <input
                  required
                  type="password"
                  className="input-field"
                  value={newUserForm.password}
                  onChange={(event) => setNewUserForm({ ...newUserForm, password: event.target.value })}
                  placeholder="Set initial password"
                  minLength={8}
                />
                {passwordStrength.label && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span>Password strength:</span>
                    <span
                      className={
                        passwordStrength.level >= 4
                          ? 'font-semibold text-green-600'
                          : passwordStrength.level >= 3
                            ? 'font-semibold text-blue-600'
                            : passwordStrength.level >= 2
                              ? 'font-semibold text-amber-600'
                              : 'font-semibold text-red-600'
                      }
                    >
                      {passwordStrength.label}
                    </span>
                  </p>
                )}
                {formErrors.password && <p className="mt-1 text-xs text-red-500">{formErrors.password}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeNewUserModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessControlSettings;
