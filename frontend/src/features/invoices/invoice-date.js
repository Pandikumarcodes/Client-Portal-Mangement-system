import {
  dateInputToIso,
  isValidDateInput,
  toDateInputValue,
} from '../milestones/milestone-date.js';

export { dateInputToIso, isValidDateInput, toDateInputValue };

export function formatInvoiceDate(value) {
  const dateOnly = toDateInputValue(value);
  if (!dateOnly) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

export function isDueDateOnOrAfterIssueDate(issueDate, dueDate) {
  return isValidDateInput(issueDate)
    && isValidDateInput(dueDate)
    && dueDate >= issueDate;
}
