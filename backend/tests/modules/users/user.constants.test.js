import { describe, expect, it } from 'vitest';

import * as userConstants from '../../../src/modules/users/user.constants.js';
import { USER_ROLE, USER_STATUS } from '../../../src/modules/users/user.constants.js';

describe('user constants', () => {
  it('exports exactly the role and status constants', () => {
    expect(Object.keys(userConstants).sort()).toEqual(['USER_ROLE', 'USER_STATUS']);
  });

  it('defines only frozen user roles', () => {
    expect(Object.isFrozen(USER_ROLE)).toBe(true);
    expect(USER_ROLE).toEqual({
      SUPER_ADMIN: 'super_admin',
      ORGANIZATION_ADMIN: 'organization_admin',
      CLIENT: 'client',
    });
  });

  it('defines only frozen user statuses', () => {
    expect(Object.isFrozen(USER_STATUS)).toBe(true);
    expect(USER_STATUS).toEqual({
      ACTIVE: 'active',
      INVITED: 'invited',
      SUSPENDED: 'suspended',
    });
  });

  it('uses lowercase stored values', () => {
    for (const value of [...Object.values(USER_ROLE), ...Object.values(USER_STATUS)]) {
      expect(value).toBe(value.toLowerCase());
    }
  });
});
