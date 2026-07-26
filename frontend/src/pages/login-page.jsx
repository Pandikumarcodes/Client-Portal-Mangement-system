import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getAuthErrorMessage } from "../features/auth/get-auth-error-message.js";
import { getRoleHome } from "../features/auth/get-role-home.js";
import { useAuth } from "../features/auth/use-auth.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initialValues = { email: "", password: "" };

function validate(values) {
  const errors = {};
  if (!values.email.trim()) errors.email = "Email is required.";
  else if (
    values.email.trim().length > 254 ||
    !emailPattern.test(values.email.trim())
  )
    errors.email = "Enter a valid email address.";
  if (!values.password) errors.password = "Password is required.";
  else if (values.password.length > 128)
    errors.password = "Password must not exceed 128 characters.";
  return errors;
}

export function LoginPage() {
  const { login, bootstrapError } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef(null);
  const submittingRef = useRef(false);

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setServerError("");
    const localErrors = validate(values);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const session = await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      navigate(getRoleHome(session.user?.role), { replace: true });
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
      requestAnimationFrame(() => errorRef.current?.focus());
      if (error?.code === "VALIDATION_ERROR" && Array.isArray(error.details))
        setErrors(detailsToFields(error.details, ["email", "password"]));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  return (
    <section className="auth-layout">
      <article className="auth-card">
        <span className="eyebrow">Client Management Portal</span>
        <h1>Welcome back</h1>
        <p>Sign in to continue to your workspace.</p>
        {(serverError || bootstrapError) && (
          <div
            ref={errorRef}
            className="server-error"
            role="alert"
            tabIndex="-1"
          >
            {serverError || bootstrapError}
          </div>
        )}
        <form onSubmit={submit} noValidate>
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
            autoComplete="current-password"
            value={values.password}
            error={errors.password}
            onChange={(value) => update("password", value)}
          />
          <button className="form-submit" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <nav className="auth-links" aria-label="Authentication">
          <span>New here?</span>
          <Link to="/register">Create an organization</Link>
        </nav>
      </article>
    </section>
  );
}

function Field({ label, name, type, autoComplete, value, error, onChange }) {
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
function detailsToFields(details, fields) {
  return Object.fromEntries(
    details
      .slice(0, 20)
      .filter((detail) => fields.includes(detail.field?.replace(/^body\./, "")))
      .map((detail) => [detail.field.replace(/^body\./, ""), detail.message]),
  );
}
