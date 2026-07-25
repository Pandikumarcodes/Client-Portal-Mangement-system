import { useEffect, useState } from 'react';
import { PROJECT_STATUS_OPTIONS } from './project.constants.js';
import { getClientLabel } from './project-client-utils.js';

const emptyValues = { clientId: '', name: '', description: '', status: 'active' };

function validate(values, isEditing) {
  const errors = {};
  const name = values.name.trim();
  const description = values.description.trim();
  if (!values.clientId) errors.clientId = 'Select a client.';
  if (!name) errors.name = 'Project name is required.';
  else if (name.length < 2) errors.name = 'Project name must contain at least 2 characters.';
  else if (name.length > 150) errors.name = 'Project name must not exceed 150 characters.';
  if (description.length > 2000) {
    errors.description = 'Description must not exceed 2000 characters.';
  }
  if (isEditing && !PROJECT_STATUS_OPTIONS.some((option) => option.value === values.status)) {
    errors.status = 'Select a valid project status.';
  }
  return errors;
}

export function ProjectForm({
  clients,
  clientsLoading = false,
  clientsError = '',
  initialValues,
  isEditing = false,
  onSubmit,
  isSubmitting,
  serverError,
  submitLabel,
  submittingLabel,
  submitDisabled = false,
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
    if (isSubmitting || submitDisabled) return;
    const nextErrors = validate(values, isEditing);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const description = values.description.trim();
    const submission = {
      clientId: values.clientId,
      name: values.name.trim(),
      description: isEditing ? (description || null) : (description || undefined),
    };
    if (isEditing) submission.status = values.status;
    onSubmit(submission);
  };

  return (
    <form className="client-form project-form" onSubmit={handleSubmit} noValidate>
      {serverError && <div className="server-error" role="alert">{serverError}</div>}
      <div className="form-field">
        <label htmlFor="project-client">Client</label>
        <select
          id="project-client"
          name="clientId"
          required
          value={values.clientId}
          disabled={clientsLoading || Boolean(clientsError)}
          onChange={(event) => changeField('clientId', event.target.value)}
          aria-invalid={Boolean(errors.clientId)}
          aria-describedby={errors.clientId ? 'project-client-error' : undefined}
        >
          <option value="">{clientsLoading ? 'Loading clients...' : 'Select a client'}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{getClientLabel(client)}</option>
          ))}
        </select>
        {errors.clientId && <p id="project-client-error" className="field-error">{errors.clientId}</p>}
        {clientsError && <p className="field-error" role="alert">{clientsError}</p>}
      </div>
      <ProjectField
        label="Project name"
        name="project-name"
        value={values.name}
        error={errors.name}
        maxLength={150}
        onChange={(value) => changeField('name', value)}
      />
      <div className="form-field">
        <label htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          name="description"
          rows="6"
          maxLength={2001}
          value={values.description}
          onChange={(event) => changeField('description', event.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'project-description-error' : undefined}
        />
        {errors.description && <p id="project-description-error" className="field-error">{errors.description}</p>}
      </div>
      {isEditing && (
        <div className="form-field">
          <label htmlFor="project-status">Status</label>
          <select
            id="project-status"
            name="status"
            value={values.status}
            onChange={(event) => changeField('status', event.target.value)}
            aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? 'project-status-error' : undefined}
          >
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.status && <p id="project-status-error" className="field-error">{errors.status}</p>}
        </div>
      )}
      <button
        className="form-submit"
        type="submit"
        disabled={isSubmitting || submitDisabled || clientsLoading || Boolean(clientsError)}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}

function ProjectField({ label, name, value, error, maxLength, onChange }) {
  const errorId = `${name}-error`;
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name="name"
        type="text"
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
