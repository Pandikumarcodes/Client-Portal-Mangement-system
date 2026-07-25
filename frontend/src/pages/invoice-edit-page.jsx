import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { toDateInputValue } from '../features/invoices/invoice-date.js';
import { formatCentsForInput } from '../features/invoices/invoice-format.js';
import { getInvoiceErrorMessage } from '../features/invoices/get-invoice-error-message.js';
import { getInvoice, updateInvoice } from '../features/invoices/invoice-api.js';
import { InvoiceForm } from '../features/invoices/invoice-form.jsx';
import { getProject } from '../features/projects/project-api.js';

export function InvoiceEditPage() {
  const { projectId, invoiceId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [invoice, setInvoice] = useState(null);
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
    Promise.all([
      getProject(projectId, accessToken, controller.signal),
      getInvoice({ projectId, invoiceId, signal: controller.signal }, accessToken),
    ])
      .then(([loadedProject, loadedInvoice]) => {
        setProject(loadedProject);
        setInvoice(loadedInvoice);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setLoadError(getInvoiceErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, invoiceId, projectId, retryKey]);

  const initialValues = useMemo(() => invoice ? {
    invoiceNumber: invoice.invoiceNumber,
    amount: formatCentsForInput(invoice.amountCents),
    issueDate: toDateInputValue(invoice.issueDate),
    dueDate: toDateInputValue(invoice.dueDate),
    notes: invoice.notes ?? '',
    status: invoice.status,
  } : undefined, [invoice]);

  const handleSubmit = async (updates) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      await updateInvoice({ projectId, invoiceId, updates }, accessToken);
      navigate(
        `/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}`,
        { replace: true },
      );
    } catch (error) {
      if (!handleAuthenticationFailure(error)) setServerError(getInvoiceErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  if (loading) return <PageState title="Edit Invoice">Loading invoice...</PageState>;
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Edit Invoice</h1>
        <div className="content-state error-state" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to={projectPath}>Back to Project</Link>
      </section>
    );
  }
  if (!project || !invoice) return null;

  const detailPath = `${projectPath}/invoices/${encodeURIComponent(invoiceId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project invoice</p>
          <h1>Edit Invoice</h1>
          <p>For <Link to={projectPath}>{project.name}</Link></p>
        </div>
      </div>
      <div className="content-card form-card">
        <InvoiceForm
          initialValues={initialValues}
          isEditing
          submitLabel="Save changes"
          submittingLabel="Saving changes..."
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
        <Link className="secondary-link" to={detailPath}>Cancel</Link>
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
