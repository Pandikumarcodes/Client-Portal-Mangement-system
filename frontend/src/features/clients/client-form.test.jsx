import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClientForm } from './client-form.jsx';

const renderForm = (props = {}) => {
  const onSubmit = props.onSubmit ?? vi.fn();
  render(
    <ClientForm
      submitLabel="Save client"
      submittingLabel="Saving client..."
      onSubmit={onSubmit}
      isSubmitting={false}
      {...props}
    />,
  );
  return onSubmit;
};

describe('ClientForm', () => {
  it('renders the four visible, accessible fields without identity fields', () => {
    renderForm();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    expect(screen.queryByLabelText(/tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/user id/i)).not.toBeInTheDocument();
  });

  it('shows required and invalid-email errors', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save client' }));
    expect(screen.getByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('normalizes values and accepts an optional company', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' Ada ' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: ' Lovelace ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' ADA@Example.COM ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save client' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      companyName: undefined,
    }));
  });

  it('rejects an overlong company and clears its field error on edit', () => {
    renderForm({
      initialValues: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        companyName: 'x'.repeat(121),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save client' }));
    expect(screen.getByText('Company name must not exceed 120 characters.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Valid' } });
    expect(screen.queryByText('Company name must not exceed 120 characters.')).not.toBeInTheDocument();
  });

  it('disables only the submit button and shows a server alert', () => {
    renderForm({ isSubmitting: true, serverError: 'Safe server error' });
    expect(screen.getByRole('button', { name: 'Saving client...' })).toBeDisabled();
    expect(screen.getByLabelText('First name')).not.toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Safe server error');
  });
});
