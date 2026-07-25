import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getAuthErrorMessage } from "../features/auth/get-auth-error-message.js";
import { getRoleHome } from "../features/auth/get-role-home.js";
import { useAuth } from "../features/auth/use-auth.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const initialValues = {
  organizationName: "",
  organizationSlug: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

function validate(values) {
  const errors = {};
  if (values.organizationName.trim().length < 2)
    errors.organizationName =
      "Organization name must contain at least 2 characters.";
  else if (values.organizationName.trim().length > 120)
    errors.organizationName =
      "Organization name must not exceed 120 characters.";
  const slug = values.organizationSlug.trim().toLowerCase();
  if (slug.length < 2)
    errors.organizationSlug = "Organization URL is required.";
  else if (slug.length > 80 || !slugPattern.test(slug))
    errors.organizationSlug = "Enter a valid organization URL.";
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  else if (values.firstName.trim().length > 80)
    errors.firstName = "First name must not exceed 80 characters.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  else if (values.lastName.trim().length > 80)
    errors.lastName = "Last name must not exceed 80 characters.";
  const email = values.email.trim();
  if (!email) errors.email = "Email is required.";
  else if (email.length > 254 || !emailPattern.test(email))
    errors.email = "Enter a valid email address.";
  if (values.password.length < 8)
    errors.password = "Password must contain at least 8 characters.";
  else if (values.password.length > 128)
    errors.password = "Password must not exceed 128 characters.";
  else if (
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/\d/.test(values.password)
  )
    errors.password =
      "Password must include lowercase, uppercase, and numeric characters.";
  return errors;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef(null);
  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setServerError("");
    const localErrors = validate(values);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }
    setSubmitting(true);
    try {
      const session = await register({
        organizationName: values.organizationName.trim(),
        organizationSlug: values.organizationSlug.trim().toLowerCase(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      navigate(getRoleHome(session.user?.role), { replace: true });
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
      requestAnimationFrame(() => errorRef.current?.focus());
      if (error?.code === "VALIDATION_ERROR" && Array.isArray(error.details))
        setErrors(detailsToFields(error.details));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="auth-layout">
      <article className="auth-card registration-card">
        <span className="eyebrow">Client Management Portal</span>
        <h1>Create your workspace</h1>
        <p>Register an Organization Admin account to get started.</p>
        {serverError && (
          <div
            ref={errorRef}
            className="server-error"
            role="alert"
            tabIndex="-1"
          >
            {serverError}
          </div>
        )}
        <form onSubmit={submit} noValidate>
          <Field
            label="Organization name"
            name="organizationName"
            autoComplete="organization"
            value={values.organizationName}
            error={errors.organizationName}
            onChange={(value) => update("organizationName", value)}
          />
          <Field
            label="Organization URL"
            name="organizationSlug"
            autoComplete="off"
            value={values.organizationSlug}
            error={errors.organizationSlug}
            onChange={(value) => update("organizationSlug", value)}
          />
          <div className="form-grid">
            <Field
              label="First name"
              name="firstName"
              autoComplete="given-name"
              value={values.firstName}
              error={errors.firstName}
              onChange={(value) => update("firstName", value)}
            />
            <Field
              label="Last name"
              name="lastName"
              autoComplete="family-name"
              value={values.lastName}
              error={errors.lastName}
              onChange={(value) => update("lastName", value)}
            />
          </div>
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            error={errors.email}
            onChange={(value) => update("email", value)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            error={errors.password}
            onChange={(value) => update("password", value)}
          />
          <button className="form-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <nav className="auth-links" aria-label="Authentication">
          <span>Already registered?</span>
          <Link to="/login">Sign in</Link>
        </nav>
      </article>
    </section>
  );
}
function Field({
  label,
  name,
  type = "text",
  autoComplete,
  value,
  error,
  onChange,
}) {
  const errorId = `${name}-error`;
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
function detailsToFields(details) {
  const fields = [
    "organizationName",
    "organizationSlug",
    "firstName",
    "lastName",
    "email",
    "password",
  ];
  return Object.fromEntries(
    details
      .slice(0, 20)
      .filter((detail) => fields.includes(detail.field?.replace(/^body\./, "")))
      .map((detail) => [detail.field.replace(/^body\./, ""), detail.message]),
  );
}
