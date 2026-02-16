export type ErrorToast = {
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  durationMs?: number;
};

const errorMessages: Record<string, string> = {
  duplicate_key: 'This {field} already exists. Please use a different value.',
  foreign_key_violation: 'Cannot complete this action. The referenced {entity} does not exist.',
  not_null_violation: 'Please provide a value for {field}. This field cannot be empty.',
  unique_violation: 'This {field} is already in use. Please choose a different one.',
  check_violation: 'The value for {field} does not meet the required criteria.',
  invalid_input: 'The provided value for {field} is invalid. Please review and try again.',
};

const SUPABASE_CODE_MAP: Record<string, string> = {
  '23505': 'unique_violation',
  '23503': 'foreign_key_violation',
  '23502': 'not_null_violation',
  '23514': 'check_violation',
};

const extractFieldFromMessage = (message?: string): string | null => {
  if (!message) return null;
  const match = message.match(/Key \(([^)]+)\)=/i);
  if (match?.[1]) return match[1];
  const columnMatch = message.match(/column "([^"]+)"/i);
  if (columnMatch?.[1]) return columnMatch[1];
  return null;
};

const toFriendlyField = (rawField?: string | null): string => {
  if (!rawField) return 'field';
  return rawField.replace(/_/g, ' ');
};

export const getFieldErrorMessage = (fieldName: string, errorType: string): string => {
  const template = errorMessages[errorType] || errorMessages.invalid_input;
  return template.replace('{field}', fieldName).replace('{entity}', fieldName);
};

export const parseSupabaseError = (error: unknown, entityName?: string): string => {
  if (!error) return `Unable to process the ${entityName || 'request'}. Please try again.`;

  const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string };
  const errorCode = supabaseError.code ? SUPABASE_CODE_MAP[supabaseError.code] : undefined;
  const message = supabaseError.message || supabaseError.details || '';

  if (message.toLowerCase().includes('duplicate key') || message.toLowerCase().includes('unique')) {
    const field = toFriendlyField(extractFieldFromMessage(message) || 'value');
    return getFieldErrorMessage(field, 'unique_violation');
  }

  if (errorCode) {
    const field = toFriendlyField(extractFieldFromMessage(message) || entityName || 'field');
    return getFieldErrorMessage(field, errorCode);
  }

  if (message) {
    return message;
  }

  return `Unable to process the ${entityName || 'request'}. Please try again.`;
};

export const parseValidationErrors = (errors: Record<string, string>): string => {
  const messages = Object.values(errors).filter(Boolean);
  if (messages.length === 0) return '';
  return messages.join('\n');
};

export const buildErrorToast = (error: unknown, context?: string): ErrorToast => {
  const description = parseSupabaseError(error, context);
  return {
    type: 'error',
    title: context ? `Unable to save ${context}` : 'Unable to complete action',
    description,
    durationMs: 6000,
  };
};
