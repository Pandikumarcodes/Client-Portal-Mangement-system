import { describe, expect, it } from 'vitest';

import { PROJECT_STATUS } from '../../../src/modules/projects/project.constants.js';

describe('Project status constants', () => {
  it('is frozen and contains exactly the lowercase Project statuses', () => {
    expect(Object.isFrozen(PROJECT_STATUS)).toBe(true);
    expect(PROJECT_STATUS).toEqual({
      ACTIVE: 'active',
      ON_HOLD: 'on_hold',
      COMPLETED: 'completed',
      ARCHIVED: 'archived',
    });
    expect(Object.values(PROJECT_STATUS).every((value) => value === value.toLowerCase())).toBe(
      true,
    );
  });
});
