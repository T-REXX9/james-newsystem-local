export interface ValidationResult {
  isValid: boolean;
  message: string;
}

const normalizeString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
};

export const buildValidationMessage = (
  fieldName: string,
  issue: string,
  suggestion?: string
): string => {
  const base = `Please enter a valid ${fieldName}. ${issue}`.trim();
  if (!suggestion) return base;
  return `${base} ${suggestion}`.trim();
};

export const validateRequired = (value: unknown, fieldName: string): ValidationResult => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return {
      isValid: false,
      message: `Please enter ${fieldName}. This field is required to proceed.`,
    };
  }
  return { isValid: true, message: '' };
};

export const validateEmail = (value: unknown): ValidationResult => {
  const normalized = normalizeString(value);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!normalized || !emailRegex.test(normalized)) {
    return {
      isValid: false,
      message: 'Please enter a valid email address (e.g., user@example.com)',
    };
  }
  return { isValid: true, message: '' };
};

export const validatePhone = (value: unknown): ValidationResult => {
  const normalized = normalizeString(value);
  const digits = normalized.replace(/\D/g, '');
  const isValid = digits.length >= 10 && digits.length <= 12;
  if (!normalized || !isValid) {
    return {
      isValid: false,
      message: 'Please enter a valid phone number (e.g., 09XX-XXX-XXXX)',
    };
  }
  return { isValid: true, message: '' };
};

export const validateNumeric = (
  value: unknown,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult => {
  const numericValue = typeof value === 'number' ? value : Number(normalizeString(value));
  if (Number.isNaN(numericValue)) {
    return {
      isValid: false,
      message: `Please enter a valid ${fieldName} number.`,
    };
  }
  if (min !== undefined && numericValue < min) {
    return {
      isValid: false,
      message: `Please enter a valid ${fieldName} greater than or equal to ${min}.`,
    };
  }
  if (max !== undefined && numericValue > max) {
    return {
      isValid: false,
      message: `Please enter a valid ${fieldName} less than or equal to ${max}.`,
    };
  }
  return { isValid: true, message: '' };
};

export const validateMinLength = (
  value: unknown,
  fieldName: string,
  minLength: number
): ValidationResult => {
  const normalized = normalizeString(value);
  if (normalized.length < minLength) {
    return {
      isValid: false,
      message: `Please enter at least ${minLength} characters for ${fieldName}.`,
    };
  }
  return { isValid: true, message: '' };
};

export const validateMaxLength = (
  value: unknown,
  fieldName: string,
  maxLength: number
): ValidationResult => {
  const normalized = normalizeString(value);
  if (normalized.length > maxLength) {
    return {
      isValid: false,
      message: `Please keep ${fieldName} under ${maxLength} characters.`,
    };
  }
  return { isValid: true, message: '' };
};

export const validateOptionalEmail = (value: unknown): ValidationResult => {
  const normalized = normalizeString(value);
  if (!normalized) return { isValid: true, message: '' };
  return validateEmail(normalized);
};

export const validateOptionalPhone = (value: unknown): ValidationResult => {
  const normalized = normalizeString(value);
  if (!normalized) return { isValid: true, message: '' };
  return validatePhone(normalized);
};
