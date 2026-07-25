import { describe, expect, it } from 'vitest';

import { CLIENT_STATUS } from '../../../src/modules/clients/client.constants.js';

describe('Client status constants', () => {
  it('is frozen and contains only lowercase active/inactive values', () => {
    expect(Object.isFrozen(CLIENT_STATUS)).toBe(true);
    expect(CLIENT_STATUS).toEqual({ ACTIVE: 'active', INACTIVE: 'inactive' });
    expect(Object.values(CLIENT_STATUS).every((value) => value === value.toLowerCase())).toBe(true);
  });
});
