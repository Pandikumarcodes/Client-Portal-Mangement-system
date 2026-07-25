import { useEffect, useState } from 'react';

const emptyValues = { firstName: '', lastName: '', email: '', companyName: '' };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values) {
  const errors = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const email = values.email.trim();
  const companyName = values.companyName.trim();

  if (!firstName) errors.firstName = 'First name is required.';
  else if (firstName.length > 80) errors.firstName = 'First name must not exceed 80 characters.';
  if (!lastName) errors.lastName = 'Last name is required.';
  else if (lastName.length > 80) errors.lastName = 'Last name must not exceed 80 characters.';
  if (!email || email.length > 254 || !emailPattern.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (companyName.length > 120) {
    errors.companyName = 'Company name must not exceed 120 characters.';
  }
  return errors;
}

export function ClientForm({
  initialValues,
  submitLabel,
  submittingLabel,
  onSubmit,
  isSubmitting,
  serverError,
}) {
  const [values, setValues] = useState({ ...emptyValues, ...initialValues });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setValues({ ...emptyValues, ...initialValues });
    setErrors({});
  }, [initialValues]);

  const changeField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const companyName = values.companyName.trim();
    onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      companyName: companyName || undefined,
    });
  };

  return (
    <form className="client-form" onSubmit={handleSubmit} noValidate>
      {serverError && <div className="server-error" role="alert">{serverError}</div>}
      <div className="form-grid">
        <ClientField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          value={values.firstName}
          error={errors.firstName}
          onChange={changeField}
        />
        <ClientField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          value={values.lastName}
          error={errors.lastName}
          onChange={changeField}
        />
      </div>
      <ClientField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={changeField}
      />
      <ClientField
        label="Company name"
        name="companyName"
        autoComplete="organization"
        value={values.companyName}
        error={errors.companyName}
        onChange={changeField}
      />
      <button className="form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}

function ClientField({ label, name, type = 'text', autoComplete, value, error, onChange }) {
  const errorId = `${name}-error`;
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value ?? ''}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
