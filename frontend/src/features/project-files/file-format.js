import { PROJECT_FILE_TYPE_LABELS } from './project-file.constants.js';

export function formatProjectFileSize(value) {
  if (!Number.isFinite(value) || value < 0) return 'Size unavailable';
  if (value < 1024) return `${value} ${value === 1 ? 'byte' : 'bytes'}`;
  if (value < 1024 * 1024) return `${formatUnit(value / 1024)} KiB`;
  return `${formatUnit(value / (1024 * 1024))} MiB`;
}

function formatUnit(value) {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

export function getProjectFileTypeLabel(mimeType) {
  return PROJECT_FILE_TYPE_LABELS[mimeType] ?? 'File';
}

export function sanitizeDownloadFilename(value, fallback = 'download') {
  const cleaned = typeof value === 'string'
    ? [...value]
      .filter((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint >= 32 && codePoint !== 127;
      })
      .join('')
      .replaceAll('/', '_')
      .replaceAll('\\', '_')
      .replaceAll('..', '_')
      .replace(/_+/g, '_')
      .trim()
    : '';
  const withoutTraversal = cleaned.replace(/^\.+/, '').slice(0, 180);
  if (withoutTraversal) return withoutTraversal;
  const safeFallback = typeof fallback === 'string' && fallback !== value
    ? sanitizeDownloadFilename(fallback, 'download')
    : 'download';
  return safeFallback || 'download';
}
