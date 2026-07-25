import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MilestoneForm } from './milestone-form.jsx';

function renderForm(overrides = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn();
  render(
    <MilestoneForm
      submitLabel="Create Milestone"
      submittingLabel="Creating Milestone..."
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return onSubmit;
}

describe('MilestoneForm', () => {
  it('renders accessible create fields and hides status', () => {
    renderForm();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Due date')).toHaveAttribute('type', 'date');
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });

  it.each([
    ['', 'required'],
    ['A', 'at least 2'],
    ['x'.repeat(151), 'must not exceed 150'],
  ])('rejects invalid title %j', (title, message) => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Milestone' }));
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects an overlong description', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Approval' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'x'.repeat(2001) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Milestone' }));
    expect(screen.getByText(/must not exceed 2000/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed create values, allows a past date, and omits blank optionals', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Approval  ' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2020-01-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Milestone' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Approval',
      dueDate: '2020-01-02T00:00:00.000Z',
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('status');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('description');
  });

  it('shows edit status and submits completion plus optional clearing as null', () => {
    const onSubmit = renderForm({
      isEditing: true,
      submitLabel: 'Save changes',
      initialValues: {
        title: 'Approval',
        description: 'Copy',
        dueDate: '2026-08-15',
        status: 'pending',
      },
    });
    expect(screen.getByLabelText('Status')).toHaveValue('pending');
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).toHaveBeenCalledWith({
      description: null,
      dueDate: null,
      status: 'completed',
    });
  });

  it('prevents an empty edit update', () => {
    const onSubmit = renderForm({
      isEditing: true,
      submitLabel: 'Save changes',
      initialValues: { title: 'Approval', status: 'pending' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Make at least one change');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('preserves values after a safe API error and prevents duplicate submission', () => {
    const onSubmit = vi.fn(() => new Promise(() => {}));
    renderForm({
      onSubmit,
      initialValues: { title: 'Preserved' },
      serverError: 'Safe error',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Safe error');
    fireEvent.click(screen.getByRole('button', { name: 'Create Milestone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Milestone' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Title')).toHaveValue('Preserved');
  });
});
