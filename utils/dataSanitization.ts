export type SanitizationType = 'string' | 'number' | 'date' | 'boolean' | 'object' | 'array';

export interface FieldSanitizationConfig {
  type: SanitizationType;
  placeholder?: unknown;
  required?: boolean;
  config?: Record<string, FieldSanitizationConfig>;
  itemSanitizer?: (value: unknown) => unknown;
}

export type SanitizationConfig<T> = Partial<Record<keyof T, FieldSanitizationConfig>>;

const isEmptyString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length === 0;

const isMissingValue = (value: unknown): boolean =>
  value === null || value === undefined || isEmptyString(value);

export const sanitizeString = (value: unknown, placeholder = 'n/a'): string => {
  if (isMissingValue(value)) return String(placeholder);
  return typeof value === 'string' ? value.trim() : String(value);
};

export const sanitizeNumber = (value: unknown, placeholder = 0): number => {
  if (value === null || value === undefined || value === '') return Number(placeholder);
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? Number(placeholder) : parsed;
};

export const sanitizeDate = (value: unknown, placeholder: string | null = null): string | null => {
  if (isMissingValue(value)) return placeholder;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return placeholder;
};

export const sanitizeArray = <T>(
  arr: unknown,
  itemSanitizer: (value: unknown) => T
): T[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(itemSanitizer);
};

export const sanitizeObject = <T extends Record<string, unknown>>(
  obj: T,
  fieldConfig: SanitizationConfig<T>,
  options?: { enforceRequired?: boolean; onlyProvided?: boolean }
): T => {
  const sanitized = { ...obj } as T;
  const enforceRequired = options?.enforceRequired ?? true;
  const onlyProvided = options?.onlyProvided ?? false;

  Object.entries(fieldConfig).forEach(([key, config]) => {
    if (!config) return;
    if (onlyProvided && !Object.prototype.hasOwnProperty.call(obj, key)) return;
    const value = sanitized[key as keyof T];

    if (config.required && enforceRequired && isMissingValue(value)) {
      throw new Error(`Please provide a value for ${key}. This field cannot be empty.`);
    }

    switch (config.type) {
      case 'string':
        sanitized[key as keyof T] = sanitizeString(value, config.placeholder ?? 'n/a') as T[keyof T];
        break;
      case 'number':
        sanitized[key as keyof T] = sanitizeNumber(value, config.placeholder ?? 0) as T[keyof T];
        break;
      case 'date':
        sanitized[key as keyof T] = sanitizeDate(
          value,
          (config.placeholder as string | null) ?? null
        ) as T[keyof T];
        break;
      case 'boolean':
        sanitized[key as keyof T] = Boolean(value) as T[keyof T];
        break;
      case 'object': {
        const nestedValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
        const nestedConfig = config.config ?? {};
        sanitized[key as keyof T] = sanitizeObject(nestedValue, nestedConfig) as T[keyof T];
        break;
      }
      case 'array': {
        const itemSanitizer = config.itemSanitizer ?? ((item: unknown) => item as unknown);
        sanitized[key as keyof T] = sanitizeArray(value, itemSanitizer) as T[keyof T];
        break;
      }
      default:
        break;
    }
  });

  return sanitized;
};
