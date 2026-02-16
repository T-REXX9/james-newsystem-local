import { describe, expect, it } from 'vitest';
import { buildErrorToast, parseSupabaseError, parseValidationErrors } from '../errorHandler';

describe('errorHandler', () => {
  it('parses supabase error codes', () => {
    const message = parseSupabaseError({ code: '23505', message: 'duplicate key value violates unique constraint' }, 'contact');
    expect(message.toLowerCase()).toContain('already');
  });

  it('formats validation error messages', () => {
    const message = parseValidationErrors({ name: 'Name is required', email: 'Email invalid' });
    expect(message).toContain('Name is required');
    expect(message).toContain('Email invalid');
  });

  it('builds error toast payload', () => {
    const toast = buildErrorToast({ message: 'oops' }, 'contact');
    expect(toast.type).toBe('error');
    expect(toast.description).toContain('oops');
  });
});
