import { createClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../lib/database.types';

const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
const createdUserIds = new Set<string>();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canCleanupAuthUsers = Boolean(supabaseUrl && supabaseServiceRoleKey);

const adminSupabase = canCleanupAuthUsers
  ? createClient<Database>(supabaseUrl as string, supabaseServiceRoleKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

afterAll(async () => {
  if (!adminSupabase || createdUserIds.size === 0) return;

  const deletionErrors: string[] = [];
  for (const userId of createdUserIds) {
    const { error } = await adminSupabase.auth.admin.deleteUser(userId);
    if (error) deletionErrors.push(`${userId}: ${error.message}`);
  }

  createdUserIds.clear();
  if (deletionErrors.length > 0) {
    throw new Error(`Failed to cleanup test auth users: ${deletionErrors.join('; ')}`);
  }
});

describe('supabaseService createStaffAccount', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('rejects invalid email format', async () => {
    const { createStaffAccount } = await import('../supabaseService');
    const result = await createStaffAccount({
      email: 'invalid-email',
      password: 'Password1',
      fullName: 'Bad Email'
    });

    expect(result.success).toBe(false);
    expect(result.validationErrors?.email).toBeDefined();
  });

  it('rejects weak password', async () => {
    const { createStaffAccount } = await import('../supabaseService');
    const result = await createStaffAccount({
      email: uniqueEmail('weak'),
      password: 'weak',
      fullName: 'Weak Password'
    });

    expect(result.success).toBe(false);
    expect(result.validationErrors?.password).toBeDefined();
  });

  it('rejects invalid role selection', async () => {
    const { createStaffAccount } = await import('../supabaseService');
    const result = await createStaffAccount({
      email: uniqueEmail('role'),
      password: 'Password1',
      fullName: 'Role Test',
      role: 'NotARole'
    });

    expect(result.success).toBe(false);
    expect(result.validationErrors?.role).toBe('Invalid role');
  });

  it.runIf(canCleanupAuthUsers)('creates a staff account against real supabase', async () => {
    const { createStaffAccount } = await import('../supabaseService');
    const result = await createStaffAccount({
      email: uniqueEmail('integration'),
      password: 'StrongPass1!',
      fullName: 'Integration Staff'
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBeTruthy();
    if (result.userId) createdUserIds.add(result.userId);
  });
});

describe('supabaseService resetStaffPassword', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns a boolean result from the edge function call', async () => {
    const { resetStaffPassword } = await import('../supabaseService');
    const result = await resetStaffPassword('integration-user-id', 'StrongPass1!');

    expect(typeof result).toBe('boolean');
  });
});
