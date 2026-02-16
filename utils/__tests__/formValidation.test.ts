import { describe, expect, it } from 'vitest';
import {
  buildValidationMessage,
  validateEmail,
  validateMinLength,
  validateNumeric,
  validatePhone,
  validateRequired,
} from '../formValidation';

describe('formValidation', () => {
  it('validates required fields', () => {
    expect(validateRequired('', 'name').isValid).toBe(false);
    expect(validateRequired('Alice', 'name').isValid).toBe(true);
  });

  it('validates email format', () => {
    expect(validateEmail('not-an-email').isValid).toBe(false);
    expect(validateEmail('user@example.com').isValid).toBe(true);
  });

  it('validates phone format', () => {
    expect(validatePhone('123').isValid).toBe(false);
    expect(validatePhone('0917-123-4567').isValid).toBe(true);
  });

  it('validates numeric ranges', () => {
    expect(validateNumeric('abc', 'value').isValid).toBe(false);
    expect(validateNumeric(5, 'value', 1, 10).isValid).toBe(true);
    expect(validateNumeric(0, 'value', 1).isValid).toBe(false);
  });

  it('validates minimum length', () => {
    expect(validateMinLength('hi', 'description', 3).isValid).toBe(false);
    expect(validateMinLength('hello', 'description', 3).isValid).toBe(true);
  });

  it('builds friendly validation messages', () => {
    const message = buildValidationMessage('deal value', 'must be greater than 0.', 'Enter a positive amount.');
    expect(message).toContain('deal value');
    expect(message).toContain('greater than 0');
  });
});
