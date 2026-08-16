import { canonicalizeRoleName, isCompanyOwnerRole, ROLE_NAMES } from '../../constants';
import { describe, expect, it } from 'vitest';

describe('legacy owner role mapping', () => {
  it('treats the legacy main account role as the company owner', () => {
    expect(canonicalizeRoleName('main')).toBe(ROLE_NAMES.COMPANY_OWNER);
    expect(isCompanyOwnerRole('main')).toBe(true);
  });
});
