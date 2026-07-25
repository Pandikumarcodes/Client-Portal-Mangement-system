const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateInput(value) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function toDateInputValue(value) {
  if (typeof value !== 'string' || !value) return '';
  const dateOnly = value.slice(0, 10);
  return isValidDateInput(dateOnly) ? dateOnly : '';
}

export function dateInputToIso(value) {
  if (!isValidDateInput(value)) return '';
  return `${value}T00:00:00.000Z`;
}
