import { describe, expect, it } from 'vitest';

import * as organizationConstants from '../../../src/modules/organizations/organization.constants.js';
import {
  ORGANIZATION_PLAN,
  ORGANIZATION_STATUS,
} from '../../../src/modules/organizations/organization.constants.js';

describe('organization constants', () => {
  it('exports exactly the status and plan constants', () => {
    expect(Object.keys(organizationConstants).sort()).toEqual([
      'ORGANIZATION_PLAN',
      'ORGANIZATION_STATUS',
    ]);
  });

  it('defines only frozen active and suspended statuses', () => {
    expect(Object.isFrozen(ORGANIZATION_STATUS)).toBe(true);
    expect(ORGANIZATION_STATUS).toEqual({
      ACTIVE: 'active',
      SUSPENDED: 'suspended',
    });
  });

  it('defines only frozen free and pro plans', () => {
    expect(Object.isFrozen(ORGANIZATION_PLAN)).toBe(true);
    expect(ORGANIZATION_PLAN).toEqual({
      FREE: 'free',
      PRO: 'pro',
    });
  });

  it('uses lowercase stored values', () => {
    for (const value of [
      ...Object.values(ORGANIZATION_STATUS),
      ...Object.values(ORGANIZATION_PLAN),
    ]) {
      expect(value).toBe(value.toLowerCase());
    }
  });
});
