import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PROJECT_FILE_MIME_TYPES } from './project-file.constants.js';
import { ProjectFileUploadForm } from './project-file-upload-form.jsx';

function renderForm(properties = {}) {
  const onSubmit = vi.fn();
  render(<ProjectFileUploadForm onSubmit={onSubmit} isSubmitting={false} {...properties} />);
  return onSubmit;
}

describe('ProjectFileUploadForm', () => {
  it('renders accessible single-file controls without a preview', () => {
    renderForm();
    const input = screen.getByLabelText('File');
    expect(input).not.toHaveAttribute('multiple');
    for (const mimeType of PROJECT_FILE_MIME_TYPES) {
      expect(input).toHaveAttribute('accept', expect.stringContaining(mimeType));
    }
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
  });

  it('requires one non-empty supported file no larger than 10 MiB', () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select a file');
    expect(onSubmit).not.toHaveBeenCalled();

    const input = screen.getByLabelText('File');
    fireEvent.change(input, {
      target: { files: [new File([], 'empty.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    expect(screen.getByRole('alert')).toHaveTextContent('non-empty');

    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', {
          type: 'application/pdf',
        })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    expect(screen.getByRole('alert')).toHaveTextContent('10 MiB');

    fireEvent.change(input, {
      target: { files: [new File(['html'], 'page.html', { type: 'text/html' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    expect(screen.getByRole('alert')).toHaveTextContent('supported');
  });

  it.each(PROJECT_FILE_MIME_TYPES)('accepts %s and trims the description', (mimeType) => {
    const onSubmit = renderForm();
    const selected = new File(['content'], 'approved.file', { type: mimeType });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [selected] } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: ' Delivery notes ' },
    });
    expect(screen.getByText(/Selected:/)).toHaveTextContent('approved.file');
    expect(screen.getByText(/Selected:/)).toHaveTextContent('7 bytes');
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    expect(onSubmit).toHaveBeenCalledWith({
      file: selected,
      description: 'Delivery notes',
    });
  });

  it('rejects descriptions over 500 characters', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [new File(['pdf'], 'proposal.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'a'.repeat(501) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    expect(screen.getByText('Description must not exceed 500 characters.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables duplicate submission', () => {
    const onSubmit = renderForm({ isSubmitting: true });
    const button = screen.getByRole('button', { name: 'Uploading...' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('associates safe backend upload errors with the file input', () => {
    renderForm({
      serverError: 'The file must not exceed 10 MiB.',
      serverErrorCode: 'PROJECT_FILE_TOO_LARGE',
    });
    expect(screen.getByLabelText('File')).toHaveAccessibleDescription(
      'The file must not exceed 10 MiB.',
    );
  });
});
