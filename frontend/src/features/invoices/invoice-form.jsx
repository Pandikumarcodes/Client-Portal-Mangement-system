import { useEffect, useRef, useState } from 'react';
import {
  dateInputToIso,
  isDueDateOnOrAfterIssueDate,
  isValidDateInput,
} from './invoice-date.js';
import { parseUsdAmountToCents } from './invoice-format.js';
import {
  INVOICE_LIMITS,
  INVOICE_STATUS,
  INVOICE_STATUS_OPTIONS,
} from './invoice.constants.js';

const emptyValues = {
  invoiceNumber: '',
  amount: '',
  issueDate: '',
  dueDate: '',
  notes: '',
  status: INVOICE_STATUS.DRAFT,
};

function validateAmount(value) {
  const amount = value.trim();
  if (!amount) return 'Amount is required.';
  if (/^-/.test(amount)) return 'Amount must be at least $0.01.';
  if (/[eE]/.test(amount)) return 'Enter a standard USD amount without scientific notation.';
  if (/[$,]/.test(amount)) return 'Enter the amount without currency symbols or commas.';
  if (/^\d+\.\d{3,}$/.test(amount)) return 'Amount may have at most two decimal places.';
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return 'Enter a valid USD amount.';
  if (parseUsdAmountToCents(amount) === null) {
    return 'Amount must be between $0.01 and $10,000,000.00.';
  }
  return '';
}

function validate(values, isEditing) {
  const errors = {};
  const invoiceNumber = values.invoiceNumber.trim();
  const notes = values.notes.trim();
  if (!invoiceNumber) errors.invoiceNumber = 'Invoice number is required.';
  else if (invoiceNumber.length > INVOICE_LIMITS.MAX_INVOICE_NUMBER_LENGTH) {
    errors.invoiceNumber = 'Invoice number must not exceed 50 characters.';
  }
  const amountError = validateAmount(values.amount);
  if (amountError) errors.amount = amountError;
  if (!values.issueDate) errors.issueDate = 'Issue date is required.';
  else if (!isValidDateInput(values.issueDate)) errors.issueDate = 'Enter a valid issue date.';
  if (!values.dueDate) errors.dueDate = 'Due date is required.';
  else if (!isValidDateInput(values.dueDate)) errors.dueDate = 'Enter a valid due date.';
  else if (
    isValidDateInput(values.issueDate)
    && !isDueDateOnOrAfterIssueDate(values.issueDate, values.dueDate)
  ) {
    errors.dueDate = 'Due date must be on or after the issue date.';
  }
  if (notes.length > INVOICE_LIMITS.MAX_NOTES_LENGTH) {
    errors.notes = 'Notes must not exceed 2000 characters.';
  }
  if (
    isEditing
    && !INVOICE_STATUS_OPTIONS.some(({ value }) => value === values.status)
  ) {
    errors.status = 'Select a valid invoice status.';
  }
  return errors;
}

export function InvoiceForm({
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
    const normalized = {
      invoiceNumber: values.invoiceNumber.trim(),
      amountCents: parseUsdAmountToCents(values.amount),
      issueDate: dateInputToIso(values.issueDate),
      dueDate: dateInputToIso(values.dueDate),
      notes: values.notes.trim(),
      status: values.status,
    };
    let submission;
    if (isEditing) {
      const initial = { ...emptyValues, ...initialValues };
      submission = {};
      if (normalized.invoiceNumber !== initial.invoiceNumber?.trim()) {
        submission.invoiceNumber = normalized.invoiceNumber;
      }
      if (normalized.amountCents !== parseUsdAmountToCents(initial.amount ?? '')) {
        submission.amountCents = normalized.amountCents;
      }
      if (values.issueDate !== initial.issueDate) submission.issueDate = normalized.issueDate;
      if (values.dueDate !== initial.dueDate) submission.dueDate = normalized.dueDate;
      if (normalized.notes !== initial.notes?.trim()) submission.notes = normalized.notes || null;
      if (values.status !== initial.status) submission.status = values.status;
      if (Object.keys(submission).length === 0) {
        setErrors({ form: 'Make at least one change before saving.' });
        return;
      }
    } else {
      submission = {
        invoiceNumber: normalized.invoiceNumber,
        amountCents: normalized.amountCents,
        issueDate: normalized.issueDate,
        dueDate: normalized.dueDate,
      };
      if (normalized.notes) submission.notes = normalized.notes;
    }
    submittingRef.current = true;
    Promise.resolve(onSubmit(submission)).finally(() => {
      submittingRef.current = false;
    });
  };

  const field = (name, id, label, control) => (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {control}
      {errors[name] && (
        <p id={`invoice-${name}-error`} className="field-error">{errors[name]}</p>
      )}
    </div>
  );
  const describedBy = (name, helpId) => [
    errors[name] ? `invoice-${name}-error` : '',
    helpId ?? '',
  ].filter(Boolean).join(' ') || undefined;

  return (
    <form className="client-form invoice-form" onSubmit={handleSubmit} noValidate>
      {(serverError || errors.form) && (
        <div className="server-error" role="alert">{serverError || errors.form}</div>
      )}
      {field('invoiceNumber', 'invoice-number', 'Invoice number', (
        <input
          id="invoice-number"
          name="invoiceNumber"
          type="text"
          maxLength={51}
          required
          value={values.invoiceNumber}
          onChange={(event) => changeField('invoiceNumber', event.target.value)}
          aria-invalid={Boolean(errors.invoiceNumber)}
          aria-describedby={describedBy('invoiceNumber')}
        />
      ))}
      {field('amount', 'invoice-amount', 'Amount (USD)', (
        <input
          id="invoice-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          value={values.amount}
          onChange={(event) => changeField('amount', event.target.value)}
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={describedBy('amount', 'invoice-amount-help')}
        />
      ))}
      <p id="invoice-amount-help" className="field-help">Enter up to two decimal places.</p>
      <div className="form-grid">
        {field('issueDate', 'invoice-issueDate', 'Issue date', (
          <input
            id="invoice-issueDate"
            name="issueDate"
            type="date"
            required
            value={values.issueDate}
            onChange={(event) => changeField('issueDate', event.target.value)}
            aria-invalid={Boolean(errors.issueDate)}
            aria-describedby={describedBy('issueDate')}
          />
        ))}
        {field('dueDate', 'invoice-dueDate', 'Due date', (
          <input
            id="invoice-dueDate"
            name="dueDate"
            type="date"
            required
            value={values.dueDate}
            onChange={(event) => changeField('dueDate', event.target.value)}
            aria-invalid={Boolean(errors.dueDate)}
            aria-describedby={describedBy('dueDate')}
          />
        ))}
      </div>
      {field('notes', 'invoice-notes', 'Notes', (
        <textarea
          id="invoice-notes"
          name="notes"
          rows="6"
          maxLength={2001}
          value={values.notes}
          onChange={(event) => changeField('notes', event.target.value)}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={describedBy('notes')}
        />
      ))}
      {isEditing && (
        <>
          {field('status', 'invoice-status', 'Status', (
            <select
              id="invoice-status"
              name="status"
              value={values.status}
              onChange={(event) => changeField('status', event.target.value)}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={describedBy('status', 'invoice-status-help')}
            >
              {INVOICE_STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          ))}
          <p id="invoice-status-help" className="field-help">
            Status is managed manually. Paid records a status only; it does not process a payment.
          </p>
        </>
      )}
      <button className="form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
