import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InvoiceForm } from './invoice-form.jsx';

function renderForm(overrides = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn();
  render(
    <InvoiceForm
      submitLabel="Create Invoice"
      submittingLabel="Creating Invoice..."
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return onSubmit;
}

function fillValidCreate() {
  fireEvent.change(screen.getByLabelText('Invoice number'), {
    target: { value: ' INV-1001 ' },
  });
  fireEvent.change(screen.getByLabelText('Amount (USD)'), {
    target: { value: '1250.00' },
  });
  fireEvent.change(screen.getByLabelText('Issue date'), {
    target: { value: '2026-08-01' },
  });
  fireEvent.change(screen.getByLabelText('Due date'), {
    target: { value: '2026-08-31' },
  });
}

describe('InvoiceForm', () => {
  it('renders accessible create fields, native dates, and no deferred controls', () => {
    renderForm();
    expect(screen.getByLabelText('Invoice number')).toBeRequired();
    expect(screen.getByLabelText('Amount (USD)')).toBeRequired();
    expect(screen.getByLabelText('Issue date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Due date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText(/payment method|line item|tax|currency selector/i))
      .not.toBeInTheDocument();
  });

  it.each([
    ['Invoice number', '', 'Invoice number is required'],
    ['Invoice number', 'x'.repeat(51), 'must not exceed 50'],
    ['Amount (USD)', '', 'Amount is required'],
    ['Amount (USD)', 'abc', 'valid USD amount'],
    ['Amount (USD)', '1.001', 'at most two decimal'],
    ['Amount (USD)', '0', 'between $0.01 and $10,000,000.00'],
    ['Amount (USD)', '-1', 'at least $0.01'],
    ['Amount (USD)', '10000000.01', 'between $0.01 and $10,000,000.00'],
  ])('rejects invalid %s value %j', (label, value, message) => {
    const onSubmit = renderForm();
    fillValidCreate();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(screen.getByText(new RegExp(message.replaceAll('$', '\\$')))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires valid dates and rejects a due date before the issue date', () => {
    const onSubmit = renderForm();
    fillValidCreate();
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(screen.getByText('Due date is required.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(screen.getByText(/Due date must be on or after/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts equal and past dates, converts amount to cents, trims values, and omits create extras', () => {
    const onSubmit = renderForm();
    fillValidCreate();
    fireEvent.change(screen.getByLabelText('Issue date'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(onSubmit).toHaveBeenCalledWith({
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: '2020-01-01T00:00:00.000Z',
      dueDate: '2020-01-01T00:00:00.000Z',
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('currency');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('status');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('notes');
  });

  it('rejects notes above 2000 characters', () => {
    const onSubmit = renderForm();
    fillValidCreate();
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'x'.repeat(2001) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(screen.getByText(/must not exceed 2000/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['paid', 'void'])('submits the manual %s edit status and clears notes with null', (status) => {
    const onSubmit = renderForm({
      isEditing: true,
      submitLabel: 'Save changes',
      initialValues: {
        invoiceNumber: 'INV-1',
        amount: '1.00',
        issueDate: '2026-08-01',
        dueDate: '2026-08-01',
        notes: 'Clear me',
        status: 'draft',
      },
    });
    expect(screen.getByLabelText('Status')).toHaveValue('draft');
    expect(screen.getByText(/does not process a payment/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: status } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith({ notes: null, status });
  });

  it('submits valid changed edit fields and blocks an empty edit', () => {
    const initialValues = {
      invoiceNumber: 'INV-1',
      amount: '1.00',
      issueDate: '2026-08-01',
      dueDate: '2026-08-01',
      notes: '',
      status: 'draft',
    };
    const onSubmit = renderForm({
      isEditing: true,
      submitLabel: 'Save changes',
      initialValues,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Make at least one change');
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '1.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith({ amountCents: 150 });
  });

  it('preserves values after a safe API error and prevents duplicate submission', () => {
    const onSubmit = vi.fn(() => new Promise(() => {}));
    renderForm({ onSubmit, serverError: 'Safe server error' });
    fillValidCreate();
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Invoice number')).toHaveValue(' INV-1001 ');
    expect(screen.getByRole('alert')).toHaveTextContent('Safe server error');
  });
});
