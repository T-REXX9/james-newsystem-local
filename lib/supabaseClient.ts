import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
  getLocalAuthSession,
  localAuthChangedEventName,
  loginWithLocalApi,
  logoutFromLocalApi,
} from '../services/localAuthService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const shouldSeedMockData =
  import.meta.env.DEV === true || String(import.meta.env.VITE_SEED_MOCK_DATA || '').toLowerCase() === 'true';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

const rawSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

const toAuthUser = () => {
  const session = getLocalAuthSession();
  if (!session) return null;

  const user = session.userProfile;
  return {
    id: user.id,
    email: user.email,
    user_metadata: {
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
      access_rights: user.access_rights || [],
    },
  };
};

const toAuthSession = () => {
  const authUser = toAuthUser();
  const session = getLocalAuthSession();
  if (!authUser || !session) return null;

  return {
    access_token: session.token,
    refresh_token: '',
    token_type: 'bearer',
    user: authUser,
  };
};

const authBridge = {
  ...rawSupabase.auth,
  getSession: async () => ({
    data: { session: toAuthSession() },
    error: null,
  }),
  getUser: async () => ({
    data: { user: toAuthUser() },
    error: null,
  }),
  signOut: async () => {
    await logoutFromLocalApi();
    return { error: null };
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    try {
      await loginWithLocalApi(email, password);
      return {
        data: {
          user: toAuthUser(),
          session: toAuthSession(),
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: {
          message: error instanceof Error ? error.message : 'Unable to sign in',
        },
      };
    }
  },
  signUp: async () => ({
    data: { user: null, session: null },
    error: {
      message: 'Sign up is disabled in local API mode.',
    },
  }),
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    if (typeof window === 'undefined') {
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || null;
      const status = detail ? 'SIGNED_IN' : 'SIGNED_OUT';
      callback(status, toAuthSession());
    };

    window.addEventListener(localAuthChangedEventName, handler as EventListener);

    return {
      data: {
        subscription: {
          unsubscribe: () => window.removeEventListener(localAuthChangedEventName, handler as EventListener),
        },
      },
    };
  },
};

// Preserve native Supabase client methods/prototype (including .from),
// then override only the auth surface with local API-backed behavior.
const bridgedSupabase = rawSupabase as typeof rawSupabase & { auth: typeof authBridge };
bridgedSupabase.auth = authBridge as typeof rawSupabase.auth;

export const supabase = bridgedSupabase;
