import { UserProfile } from '../types';
import { DEFAULT_STAFF_ACCESS_RIGHTS, MODULE_ID_ALIASES } from '../constants';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';
const AUTH_STORAGE_KEY = 'local_api_auth_session';
const AUTH_CHANGED_EVENT = 'local-auth-changed';

type ApiPermissionWeb = {
  lpageno?: string | number;
  lstatus?: string | number;
  ladd_action?: string | number;
  ledit_action?: string | number;
  ldelete_action?: string | number;
};

type ApiPermissionPackage = {
  lpageno?: string | number;
  lstatus?: string | number;
};

type ApiAuthUser = {
  id: number;
  main_userid: number;
  email: string;
  first_name?: string;
  last_name?: string;
  type?: string;
  status?: number;
  activation?: number;
  branch?: string;
  industry?: string;
  service_package?: string;
  sales_quota?: number;
  access_rights?: string[] | null;
  group_id?: string | null;
};

type ApiAuthPayload = {
  token: string | null;
  user: ApiAuthUser;
  main_userid: number;
  user_type: string;
  session_branch: string;
  logintype: string;
  industry: string;
  permissions?: {
    web?: ApiPermissionWeb[];
    package?: ApiPermissionPackage[];
  };
};

export type LocalAuthSession = {
  token: string;
  context: ApiAuthPayload;
  userProfile: UserProfile;
};

const isBrowser = typeof window !== 'undefined';

const getStoredSession = (): LocalAuthSession | null => {
  if (!isBrowser) return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalAuthSession;
    if (!parsed?.token || !parsed?.context?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistSession = (session: LocalAuthSession | null) => {
  if (!isBrowser) return;
  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const dispatchAuthChanged = (session: LocalAuthSession | null) => {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
};

const mapRoleFromUserType = (userType?: string): string => {
  if (userType === '1') return 'Owner';
  if (userType === '2') return 'Sales Agent';
  if (userType === '3') return 'Accountant';
  if (userType === '4') return 'Warehouse';
  return 'Staff';
};

const normalizeModuleId = (id: string): string => MODULE_ID_ALIASES[id] ?? id;

const mapAccessRights = (userType?: string, persisted?: string[] | null): string[] => {
  if (userType === '1') return ['*'];
  if (Array.isArray(persisted) && persisted.length > 0) {
    return persisted.map(normalizeModuleId);
  }
  return [...DEFAULT_STAFF_ACCESS_RIGHTS];
};

const mapUserProfile = (context: ApiAuthPayload): UserProfile => {
  const user = context.user;
  const fullName = [user.first_name || '', user.last_name || ''].join(' ').trim();
  const role = mapRoleFromUserType(context.user_type || user.type);
  const quota = Number(user.sales_quota || 0);

  return {
    id: String(user.id),
    email: user.email || '',
    main_id: Number(context.main_userid || user.main_userid || 0) || undefined,
    main_userid: Number(context.main_userid || user.main_userid || 0) || undefined,
    full_name: fullName || user.email || `User ${user.id}`,
    role,
    access_rights: mapAccessRights(context.user_type || user.type, user.access_rights),
    group_id: user.group_id || null,
    monthly_quota: Number.isFinite(quota) ? quota : 0,
  };
};

const toErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload?.error) return String(payload.error);
  } catch {
    // ignore
  }
  return `API request failed (${response.status})`;
};

export const getLocalAuthToken = (): string | null => {
  const session = getStoredSession();
  return session?.token || null;
};

export const getLocalAuthSession = (): LocalAuthSession | null => getStoredSession();

export const loginWithLocalApi = async (email: string, password: string): Promise<LocalAuthSession> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  const payload = await response.json();
  const context = (payload?.data || null) as ApiAuthPayload | null;
  const token = context?.token || '';
  if (!context || !token) {
    throw new Error('Invalid login response from API');
  }

  const session: LocalAuthSession = {
    token,
    context,
    userProfile: mapUserProfile(context),
  };

  persistSession(session);
  dispatchAuthChanged(session);
  return session;
};

export const restoreLocalAuthSession = async (): Promise<LocalAuthSession | null> => {
  const existing = getStoredSession();
  if (!existing?.token) return null;

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${existing.token}` },
  });

  if (!response.ok) {
    persistSession(null);
    dispatchAuthChanged(null);
    return null;
  }

  const payload = await response.json();
  const context = (payload?.data || null) as ApiAuthPayload | null;
  if (!context) {
    persistSession(null);
    dispatchAuthChanged(null);
    return null;
  }

  const session: LocalAuthSession = {
    token: existing.token,
    context: { ...context, token: existing.token },
    userProfile: mapUserProfile({ ...context, token: existing.token }),
  };

  persistSession(session);
  return session;
};

export const logoutFromLocalApi = async (): Promise<void> => {
  const token = getLocalAuthToken();
  try {
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // best effort logout
  } finally {
    persistSession(null);
    dispatchAuthChanged(null);
  }
};

export const localAuthChangedEventName = AUTH_CHANGED_EVENT;
