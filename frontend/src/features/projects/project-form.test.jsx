import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectForm } from './project-form.jsx';

const clients = [{
  id: 'client-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  companyName: 'Analytical Engines',
}];

function renderForm(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn();
  render(
    <ProjectForm
      clients={clients}
      submitLabel="Create Project"
      submittingLabel="Creating Project..."
      onSubmit={onSubmit}
      isSubmitting={false}
      {...props}
    />,
  );
  return onSubmit;
}

function fillValid() {
  fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: ' Website redesign ' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' Public site ' } });
}

describe('ProjectForm', () => {
  it('renders accessible Client, name and description fields without status on create', () => {
    renderForm();
    expect(screen.getByLabelText('Client')).toHaveDisplayValue('Select a client');
    expect(screen.getByRole('option', { name: 'Analytical Engines — Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tenant/i)).not.toBeInTheDocument();
  });

  it('shows and prepopulates status while editing', () => {
    renderForm({
      isEditing: true,
      initialValues: {
        clientId: 'client-1',
        name: 'Website',
        description: 'Copy',
        status: 'completed',
      },
    });
    expect(screen.getByLabelText('Status')).toHaveValue('completed');
    expect(screen.getByLabelText('Project name')).toHaveValue('Website');
  });

  it('requires a Client and valid trimmed name', () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(screen.getByText('Select a client.')).toBeInTheDocument();
    expect(screen.getByText('Project name is required.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(screen.getByText('Project name must contain at least 2 characters.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects overlong name and description', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'x'.repeat(151) } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'x'.repeat(2001) } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(screen.getByText('Project name must not exceed 150 characters.')).toBeInTheDocument();
    expect(screen.getByText('Description must not exceed 2000 characters.')).toBeInTheDocument();
  });

  it('trims valid create values and omits status', () => {
    const onSubmit = renderForm();
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(onSubmit).toHaveBeenCalledWith({
      clientId: 'client-1',
      name: 'Website redesign',
      description: 'Public site',
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('uses null to clear description and submits archived status on edit', () => {
    const onSubmit = renderForm({
      isEditing: true,
      initialValues: {
        clientId: 'client-1',
        name: 'Website',
        description: 'Old',
        status: 'active',
      },
    });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(onSubmit).toHaveBeenCalledWith({
      clientId: 'client-1',
      name: 'Website',
      description: null,
      status: 'archived',
    });
  });

  it('preserves values on a safe server error and prevents duplicate submission', () => {
    renderForm({
      initialValues: { clientId: 'client-1', name: 'Preserved', description: 'Copy' },
      isSubmitting: true,
      serverError: 'Safe error',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Safe error');
    expect(screen.getByRole('button', { name: 'Creating Project...' })).toBeDisabled();
    expect(screen.getByLabelText('Project name')).toHaveValue('Preserved');
  });

  it('disables submission and explains Client loading errors', () => {
    renderForm({ clients: [], clientsError: 'Clients unavailable' });
    expect(screen.getByRole('alert')).toHaveTextContent('Clients unavailable');
    expect(screen.getByLabelText('Client')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeDisabled();
  });
});
