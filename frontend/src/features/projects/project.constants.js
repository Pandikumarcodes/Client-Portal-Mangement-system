export const PROJECT_STATUS = Object.freeze({
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

export const PROJECT_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: PROJECT_STATUS.ACTIVE, label: 'Active' }),
  Object.freeze({ value: PROJECT_STATUS.ON_HOLD, label: 'On hold' }),
  Object.freeze({ value: PROJECT_STATUS.COMPLETED, label: 'Completed' }),
  Object.freeze({ value: PROJECT_STATUS.ARCHIVED, label: 'Archived' }),
]);

export const PROJECT_STATUS_LABELS = Object.freeze(
  Object.fromEntries(PROJECT_STATUS_OPTIONS.map((option) => [option.value, option.label])),
);

export const PROJECT_PAGE_SIZE = 20;
export const CLIENT_OPTION_PAGE_SIZE = 50;
