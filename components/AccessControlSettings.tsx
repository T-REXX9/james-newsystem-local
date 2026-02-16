


import React, { useState, useEffect, useMemo } from 'react';
import { CreateStaffAccountInput, StaffAccountValidationError, UserProfile } from '../types';
import { createStaffAccount, fetchProfiles, getCurrentNotificationActor, notifyAccessRightsChange, notifyStaffAccountCreated, updateProfile } from '../services/supabaseService';
import { parseSupabaseError } from '../utils/errorHandler';
import {
  AVAILABLE_APP_MODULES,
  DEFAULT_STAFF_ACCESS_RIGHTS,
  DEFAULT_STAFF_ROLE,
  STAFF_ROLES,
  MODULE_ID_ALIASES,
} from '../constants';
import { Loader2, Shield, Save, CheckCircle, AlertTriangle, User, UserPlus, X } from 'lucide-react';
import CustomLoadingSpinner from './CustomLoadingSpinner';
import { useToast } from './ToastProvider';
import { ENTITY_TYPES, logActivity } from '../services/activityLogService';

const AccessControlSettings: React.FC = () => {
  const { addToast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [originalProfiles, setOriginalProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add Account Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    role: DEFAULT_STAFF_ROLE,
    password: '',
    birthday: '',
    mobile: ''
  });
  const [formErrors, setFormErrors] = useState<StaffAccountValidationError>({});
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  const CANONICAL_TO_ALIASES: Record<string, string[]> = useMemo(
    () =>
      Object.entries(MODULE_ID_ALIASES).reduce(
        (acc, [alias, canonical]) => {
          if (!acc[canonical]) acc[canonical] = [];
          acc[canonical].push(alias);
          return acc;
        },
        {} as Record<string, string[]>
      ),
    []
  );

  const getEffectiveCanonicalRights = (rights: string[] | null | undefined): Set<string> => {
    const result = new Set<string>();
    if (!rights) return result;

    rights.forEach((id) => {
      if (id === '*' || id === 'settings') {
        result.add(id);
        return;
      }

      const canonical = MODULE_ID_ALIASES[id] || id;
      result.add(canonical);
    });

    return result;
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setIsLoading(true);
    const data = await fetchProfiles();
    setProfiles(data);
    setOriginalProfiles(data);
    setIsLoading(false);
  };

  const togglePermission = (userId: string, moduleId: string) => {
    setProfiles(prevProfiles => prevProfiles.map(profile => {
      if (profile.id !== userId) return profile;

      // Ensure access_rights array exists
      const currentRights = profile.access_rights || [];
      const canonical = MODULE_ID_ALIASES[moduleId] || moduleId;
      let newRights: string[];

      if (currentRights.includes('*')) {
        // If they had full access, converting to granular means giving all modules except the one being toggled off.
        const allIds = AVAILABLE_APP_MODULES.map(m => m.id);
        newRights = allIds.filter(id => id !== canonical);
      } else {
        const aliases = CANONICAL_TO_ALIASES[canonical] || [];
        const idsForModule = [canonical, ...aliases];
        const hasModule = currentRights.some(id => idsForModule.includes(id));

        if (hasModule) {
          // Remove all representations (canonical + any legacy aliases) for this module
          newRights = currentRights.filter(id => !idsForModule.includes(id));
        } else {
          // Add canonical ID and let alias layer handle backwards compatibility
          newRights = [...currentRights, canonical];
        }
      }

      return { ...profile, access_rights: newRights };
    }));
  };

  const savePermissions = async (user: UserProfile) => {
    setSavingId(user.id);
    const original = originalProfiles.find(profile => profile.id === user.id);
    try {
        await updateProfile(user.id, { access_rights: user.access_rights });
        const actorContext = await getCurrentNotificationActor();
        await notifyAccessRightsChange({
          actorId: actorContext?.actorId,
          actorRole: actorContext?.actorRole,
          targetUserId: user.id,
          targetUserRole: user.role,
          beforeRights: original?.access_rights || [],
          afterRights: user.access_rights || [],
        });
        try {
          await logActivity('UPDATE_ACCESS_RIGHTS', ENTITY_TYPES.USER_PROFILE, user.id, {
            old_rights: original?.access_rights || [],
            new_rights: user.access_rights || [],
            role: user.role,
          });
        } catch (logError) {
          console.error('Failed to log activity:', logError);
        }
        setOriginalProfiles(prev =>
          prev.map(profile =>
            profile.id === user.id ? { ...profile, access_rights: user.access_rights } : profile
          )
        );
        // Simulating delay for UX
        await new Promise(resolve => setTimeout(resolve, 500)); 
        addToast({ 
          type: 'success', 
          title: 'Permissions updated',
          description: 'Access permissions have been updated successfully.',
          durationMs: 4000,
        });
    } catch (e) {
        console.error(e);
        addToast({ 
          type: 'error', 
          title: 'Unable to update permissions',
          description: parseSupabaseError(e, 'permissions'),
          durationMs: 6000,
        });
    } finally {
        setSavingId(null);
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage({ type: null, text: '' });
    if (!validateForm()) return;

    const payload: CreateStaffAccountInput = {
      fullName: newUserForm.fullName.trim(),
      email: newUserForm.email.trim(),
      password: newUserForm.password,
      role: newUserForm.role,
      birthday: newUserForm.birthday || undefined,
      mobile: newUserForm.mobile || undefined,
      accessRights: DEFAULT_STAFF_ACCESS_RIGHTS
    };

    setIsCreatingUser(true);
    try {
      const result = await createStaffAccount(payload);

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

      const actorContext = await getCurrentNotificationActor();
      if (result.userId) {
        await notifyStaffAccountCreated({
          actorId: actorContext?.actorId,
          actorRole: actorContext?.actorRole,
          targetUserId: result.userId,
          targetUserRole: payload.role,
          email: payload.email,
        });
      }

      await loadProfiles();
      setIsAddUserModalOpen(false);
      setNewUserForm({ fullName: '', email: '', role: DEFAULT_STAFF_ROLE, password: '', birthday: '', mobile: '' });
      setFormErrors({});
      setFormMessage({ type: 'success', text: `Account created for ${payload.fullName}` });
      addToast({
        type: 'success',
        title: 'User created',
        description: 'Account has been created successfully.',
        durationMs: 4000,
      });
    } catch (err: any) {
      console.error('Unexpected error creating staff account:', err);
      setFormMessage({ type: 'error', text: err?.message || 'Something went wrong while creating the account.' });
      addToast({
        type: 'error',
        title: 'Unable to create user',
        description: parseSupabaseError(err, 'user'),
        durationMs: 6000,
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CustomLoadingSpinner label="Loading" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto animate-fadeIn relative">
       <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-brand-blue" />
                Access Control & Permissions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage page visibility and access rights for staff members.
            </p>
          </div>
          <button 
            onClick={() => {
              setIsAddUserModalOpen(true);
              setFormErrors({});
              setFormMessage({ type: null, text: '' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Add New Account
          </button>
       </div>

       {!isAddUserModalOpen && formMessage.type && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${formMessage.type === 'success' ? 'bg-green-50 text-green-800 border-green-100 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800' : 'bg-red-50 text-red-800 border-red-100 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800'}`}>
            {formMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{formMessage.text}</span>
          </div>
       )}

       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  <th className="p-4 w-64 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700">Staff Member</th>
                  {AVAILABLE_APP_MODULES.filter(m => m.id !== 'settings').map(module => (
                      <th key={module.id} className="p-4 text-center min-w-[100px] border-l border-slate-100 dark:border-slate-800">
                          {module.label}
                      </th>
                  ))}
                  <th className="p-4 text-center w-32 sticky right-0 bg-slate-50 dark:bg-slate-800 z-10 border-l border-slate-200 dark:border-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {profiles.map(user => {
	                    const isOwner = user.role === 'Owner';
	                    const userRights = user.access_rights || [];
	                    const hasFullAccess = userRights.includes('*');
	                    const effectiveCanonicalRights = getEffectiveCanonicalRights(userRights);

                    return (
                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-4 h-4 text-slate-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{user.full_name || 'Unknown'}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                                isOwner 
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {user.role}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{user.email}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            
	                            {AVAILABLE_APP_MODULES.filter(m => m.id !== 'settings').map(module => {
	                                const isAllowed = isOwner || hasFullAccess || effectiveCanonicalRights.has(module.id);
                                return (
                                    <td key={module.id} className="p-4 text-center border-l border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-center">
                                            <input 
                                                type="checkbox" 
                                                checked={isAllowed}
                                                disabled={isOwner}
                                                onChange={() => togglePermission(user.id, module.id)}
                                                className={`w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue ${
                                                    isOwner ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                                }`}
                                            />
                                        </div>
                                    </td>
                                );
                            })}

                            <td className="p-4 text-center sticky right-0 bg-white dark:bg-slate-900 z-10 border-l border-slate-200 dark:border-slate-800">
                                {isOwner ? (
                                    <span className="text-xs text-slate-400 italic">Full Access</span>
                                ) : (
                                    <button 
                                        onClick={() => savePermissions(user)}
                                        disabled={savingId === user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-70"
                                    >
                                        {savingId === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
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
       
       <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex gap-3 text-sm text-blue-800 dark:text-blue-300">
           <AlertTriangle className="w-5 h-5 shrink-0" />
           <p>
               <strong>Note:</strong> The "Owner" role automatically has full access to all modules and cannot be modified here. 
               Changes to other staff members take effect immediately upon saving, but they may need to refresh their page to see menu changes.
           </p>
       </div>

       {/* Add User Modal */}
       {isAddUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Create Staff Account</h2>
                    <button onClick={() => setIsAddUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleCreateUser} noValidate className="p-6 space-y-4">
                    {formMessage.type === 'error' && (
                      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">
                        <AlertTriangle className="w-4 h-4" />
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
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                        <input 
                            required 
                            className="input-field" 
                            value={newUserForm.fullName}
                            onChange={e => setNewUserForm({...newUserForm, fullName: e.target.value})}
                            placeholder="e.g. John Doe"
                        />
                        {formErrors.fullName && <p className="mt-1 text-xs text-red-500">{formErrors.fullName}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                        <select 
                            className="input-field"
                            value={newUserForm.role}
                            onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}
                        >
                            {STAFF_ROLES.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        {formErrors.role && <p className="mt-1 text-xs text-red-500">{formErrors.role}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input 
                            required 
                            type="email"
                            className="input-field" 
                            value={newUserForm.email}
                            onChange={e => setNewUserForm({...newUserForm, email: e.target.value})}
                            placeholder="staff@company.com"
                        />
                        {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Birthday</label>
                            <input 
                                type="date"
                                className="input-field" 
                                value={newUserForm.birthday}
                                onChange={e => setNewUserForm({...newUserForm, birthday: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
                            <input 
                                className="input-field" 
                                value={newUserForm.mobile}
                                onChange={e => setNewUserForm({...newUserForm, mobile: e.target.value})}
                                placeholder="0917..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                        <input 
                            required 
                            type="password"
                            className="input-field" 
                            value={newUserForm.password}
                            onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                            placeholder="Set initial password"
                            minLength={8}
                        />
                        {passwordStrength.label && (
                          <p className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                            <span>Password strength:</span>
                            <span className={`font-bold ${passwordStrength.level >= 3 ? 'text-green-600' : passwordStrength.level === 2 ? 'text-amber-500' : 'text-red-500'}`}>
                              {passwordStrength.label}
                            </span>
                          </p>
                        )}
                        {formErrors.password && <p className="mt-1 text-xs text-red-500">{formErrors.password}</p>}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsAddUserModalOpen(false)}
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isCreatingUser}
                            className="flex-1 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                        >
                            {isCreatingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Account
                        </button>
                    </div>
                </form>
                <style>{`
                .input-field {
                  width: 100%;
                  background-color: rgb(248 250 252);
                  border: 1px solid rgb(226 232 240);
                  border-radius: 0.5rem;
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: rgb(30 41 59);
                  outline: none;
                  transition: all 0.2s;
                }
                .dark .input-field {
                  background-color: rgb(30 41 59);
                  border-color: rgb(51 65 85);
                  color: white;
                }
                .input-field:focus {
                  border-color: #0F5298;
                  box-shadow: 0 0 0 1px #0F5298;
                }
                `}</style>
            </div>
          </div>
       )}
    </div>
  );
};

export default AccessControlSettings;
