import { describe, expect, it } from 'vitest';
import {
  MILESTONE_STATUS,
  MILESTONE_STATUS_LABELS,
  MILESTONE_STATUS_OPTIONS,
} from './milestone.constants.js';

describe('Milestone status constants', () => {
  it('contains exactly the three immutable backend statuses', () => {
    expect(Object.isFrozen(MILESTONE_STATUS)).toBe(true);
    expect(MILESTONE_STATUS).toEqual({
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
    });
    expect(Object.values(MILESTONE_STATUS)).toHaveLength(3);
  });

  it('provides immutable readable labels without extra statuses', () => {
    expect(Object.isFrozen(MILESTONE_STATUS_OPTIONS)).toBe(true);
    expect(MILESTONE_STATUS_LABELS).toEqual({
      pending: 'Pending',
      in_progress: 'In progress',
      completed: 'Completed',
    });
    expect(Object.keys(MILESTONE_STATUS_LABELS)).toHaveLength(3);
  });
});
