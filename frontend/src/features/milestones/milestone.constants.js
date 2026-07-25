export const MILESTONE_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

export const MILESTONE_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: MILESTONE_STATUS.PENDING, label: 'Pending' }),
  Object.freeze({ value: MILESTONE_STATUS.IN_PROGRESS, label: 'In progress' }),
  Object.freeze({ value: MILESTONE_STATUS.COMPLETED, label: 'Completed' }),
]);

export const MILESTONE_STATUS_LABELS = Object.freeze(
  Object.fromEntries(MILESTONE_STATUS_OPTIONS.map(({ value, label }) => [value, label])),
);

export const MILESTONE_PAGE_SIZE = 20;
