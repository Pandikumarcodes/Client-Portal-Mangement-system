import { useEffect, useRef, useState } from 'react';
import { dateInputToIso, isValidDateInput } from './milestone-date.js';
import {
  MILESTONE_STATUS,
  MILESTONE_STATUS_OPTIONS,
} from './milestone.constants.js';

const emptyValues = {
  title: '',
  description: '',
  dueDate: '',
  status: MILESTONE_STATUS.PENDING,
};

function validate(values, isEditing) {
  const errors = {};
  const title = values.title.trim();
  const description = values.description.trim();
  if (!title) errors.title = 'Milestone title is required.';
  else if (title.length < 2) errors.title = 'Milestone title must contain at least 2 characters.';
  else if (title.length > 150) errors.title = 'Milestone title must not exceed 150 characters.';
  if (description.length > 2000) {
    errors.description = 'Description must not exceed 2000 characters.';
  }
  if (values.dueDate && !isValidDateInput(values.dueDate)) {
    errors.dueDate = 'Enter a valid due date.';
  }
  if (
    isEditing
    && !MILESTONE_STATUS_OPTIONS.some(({ value }) => value === values.status)
  ) {
    errors.status = 'Select a valid milestone status.';
  }
  return errors;
}

export function MilestoneForm({
  initialValues,
  isEditing = false,
  onSubmit,
  isSubmitting = false,
  serverError = '',
  submitLabel,
  submittingLabel,
}) {
  const [values, setValues] = useState({ ...emptyValues, ...initialValues });
  const [errors, setErrors] = useState({});
  const submittingRef = useRef(false);

  useEffect(() => {
    setValues({ ...emptyValues, ...initialValues });
    setErrors({});
  }, [initialValues]);

  useEffect(() => {
    if (!isSubmitting) submittingRef.current = false;
  }, [isSubmitting]);

  const changeField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting || submittingRef.current) return;
    const nextErrors = validate(values, isEditing);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const title = values.title.trim();
    const description = values.description.trim();
    const dueDate = values.dueDate ? dateInputToIso(values.dueDate) : null;
    let submission;
    if (isEditing) {
      submission = {};
      const initial = { ...emptyValues, ...initialValues };
      if (title !== initial.title?.trim()) submission.title = title;
      if (description !== initial.description?.trim()) {
        submission.description = description || null;
      }
      if (values.dueDate !== initial.dueDate) submission.dueDate = dueDate;
      if (values.status !== initial.status) submission.status = values.status;
      if (Object.keys(submission).length === 0) {
        setErrors({ form: 'Make at least one change before saving.' });
        return;
      }
    } else {
      submission = { title };
      if (description) submission.description = description;
      if (dueDate) submission.dueDate = dueDate;
    }

    submittingRef.current = true;
    Promise.resolve(onSubmit(submission)).finally(() => {
      submittingRef.current = false;
    });
  };

  const formError = serverError || errors.form;
  return (
    <form className="client-form milestone-form" onSubmit={handleSubmit} noValidate>
      {formError && <div className="server-error" role="alert">{formError}</div>}
      <div className="form-field">
        <label htmlFor="milestone-title">Title</label>
        <input
          id="milestone-title"
          name="title"
          type="text"
          maxLength={151}
          required
          value={values.title}
          onChange={(event) => changeField('title', event.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'milestone-title-error' : undefined}
        />
        {errors.title && (
          <p id="milestone-title-error" className="field-error">{errors.title}</p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="milestone-description">Description</label>
        <textarea
          id="milestone-description"
          name="description"
          rows="6"
          maxLength={2001}
          value={values.description}
          onChange={(event) => changeField('description', event.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'milestone-description-error' : undefined}
        />
        {errors.description && (
          <p id="milestone-description-error" className="field-error">{errors.description}</p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="milestone-due-date">Due date</label>
        <input
          id="milestone-due-date"
          name="dueDate"
          type="date"
          value={values.dueDate}
          onChange={(event) => changeField('dueDate', event.target.value)}
          aria-invalid={Boolean(errors.dueDate)}
          aria-describedby={errors.dueDate ? 'milestone-due-date-error' : undefined}
        />
        {errors.dueDate && (
          <p id="milestone-due-date-error" className="field-error">{errors.dueDate}</p>
        )}
      </div>
      {isEditing && (
        <div className="form-field">
          <label htmlFor="milestone-status">Status</label>
          <select
            id="milestone-status"
            name="status"
            value={values.status}
            onChange={(event) => changeField('status', event.target.value)}
            aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? 'milestone-status-error' : undefined}
          >
            {MILESTONE_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {errors.status && (
            <p id="milestone-status-error" className="field-error">{errors.status}</p>
          )}
        </div>
      )}
      <button className="form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
