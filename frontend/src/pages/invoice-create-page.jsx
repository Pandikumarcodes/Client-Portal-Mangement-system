import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { createInvoice } from '../features/invoices/invoice-api.js';
import { InvoiceForm } from '../features/invoices/invoice-form.jsx';
import { getInvoiceErrorMessage } from '../features/invoices/get-invoice-error-message.js';
import { getProject } from '../features/projects/project-api.js';

export function InvoiceCreatePage() {
  const { projectId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleAuthenticationFailure = useCallback((error) => {
    if (error?.code !== 'AUTHENTICATION_REQUIRED') return false;
    clearSession();
    navigate('/login', { replace: true });
    return true;
  }, [clearSession, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getProject(projectId, accessToken, controller.signal)
      .then(setProject)
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setLoadError(getInvoiceErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, projectId, retryKey]);

  const handleSubmit = async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      const invoice = await createInvoice({ projectId, ...values }, accessToken);
      navigate(
        `/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoice.id)}`,
        { replace: true },
      );
    } catch (error) {
      if (!handleAuthenticationFailure(error)) setServerError(getInvoiceErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <PageState title="Create Invoice">Loading project...</PageState>;
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Create Invoice</h1>
        <div className="content-state error-state" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to="/projects">Back to Projects</Link>
      </section>
    );
  }
  if (!project) return null;
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project invoice</p>
          <h1>Create Invoice</h1>
          <p>For <Link to={projectPath}>{project.name}</Link></p>
        </div>
      </div>
      <div className="content-card form-card">
        <InvoiceForm
          submitLabel="Create Invoice"
          submittingLabel="Creating Invoice..."
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
        <Link className="secondary-link" to={projectPath}>Cancel</Link>
      </div>
    </section>
  );
}

function PageState({ title, children }) {
  return (
    <section className="client-page project-page">
      <h1>{title}</h1>
      <div className="content-state" role="status">{children}</div>
    </section>
  );
}
