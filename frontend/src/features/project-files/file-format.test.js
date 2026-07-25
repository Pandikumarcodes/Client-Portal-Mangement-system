import { describe, expect, it } from 'vitest';
import {
  formatProjectFileSize,
  getProjectFileTypeLabel,
  sanitizeDownloadFilename,
} from './file-format.js';

describe('Project File formatting', () => {
  it('formats bytes, KiB, and MiB without invalid output', () => {
    expect(formatProjectFileSize(0)).toBe('0 bytes');
    expect(formatProjectFileSize(1)).toBe('1 byte');
    expect(formatProjectFileSize(1536)).toBe('1.5 KiB');
    expect(formatProjectFileSize(2 * 1024 * 1024)).toBe('2 MiB');
    expect(formatProjectFileSize(-1)).toBe('Size unavailable');
    expect(formatProjectFileSize(Number.NaN)).not.toContain('NaN');
  });

  it.each([
    ['application/pdf', 'PDF'],
    ['image/png', 'PNG image'],
    ['image/jpeg', 'JPEG image'],
    ['text/plain', 'Text file'],
    ['text/csv', 'CSV file'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word document'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel workbook'],
    ['application/octet-stream', 'File'],
  ])('maps %s safely', (mimeType, label) => {
    expect(getProjectFileTypeLabel(mimeType)).toBe(label);
  });

  it('sanitizes separators, traversal, controls, empty, and long names', () => {
    expect(sanitizeDownloadFilename('proposal.pdf')).toBe('proposal.pdf');
    expect(sanitizeDownloadFilename('../private\\proposal\u0000.pdf')).toBe('_private_proposal.pdf');
    expect(sanitizeDownloadFilename('', '')).toBe('download');
    expect(sanitizeDownloadFilename('a'.repeat(300))).toHaveLength(180);
    expect(sanitizeDownloadFilename('../../secret')).not.toContain('..');
  });
});
