import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { formatInvoiceDate } from '../features/invoices/invoice-date.js';
import { formatCentsAsUsd } from '../features/invoices/invoice-format.js';
import { getInvoiceErrorMessage } from '../features/invoices/get-invoice-error-message.js';
import { getInvoice } from '../features/invoices/invoice-api.js';
import { InvoiceStatusBadge } from '../features/invoices/invoice-status-badge.jsx';
import { getProject } from '../features/projects/project-api.js';

export function InvoiceDetailPage() {
  const { projectId, invoiceId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const handleAuthenticationFailure = useCallback((requestError) => {
    if (requestError?.code !== 'AUTHENTICATION_REQUIRED') return false;
    clearSession();
    navigate('/login', { replace: true });
    return true;
  }, [clearSession, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      getProject(projectId, accessToken, controller.signal),
      getInvoice({ projectId, invoiceId, signal: controller.signal }, accessToken),
    ])
      .then(([loadedProject, loadedInvoice]) => {
        setProject(loadedProject);
        setInvoice(loadedInvoice);
      })
      .catch((requestError) => {
        if (
          requestError?.name !== 'AbortError'
          && !handleAuthenticationFailure(requestError)
        ) {
          setError(getInvoiceErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, invoiceId, projectId, retryKey]);

  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  if (loading) return <PageState title="Invoice details">Loading invoice...</PageState>;
  if (error) {
    return (
      <section className="client-page project-page">
        <h1>Invoice details</h1>
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to={projectPath}>Back to Project</Link>
      </section>
    );
  }
  if (!project || !invoice) return null;

  const invoicePath = `${projectPath}/invoices/${encodeURIComponent(invoiceId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Invoice details</p>
          <h1 className="long-invoice-number">{invoice.invoiceNumber}</h1>
          <p>Project: <Link to={projectPath}>{project.name}</Link></p>
        </div>
        <Link className="primary-link" to={`${invoicePath}/edit`}>Edit Invoice</Link>
      </div>
      <div className="content-card">
        <dl className="detail-grid">
          <Detail label="Amount" value={`${formatCentsAsUsd(invoice.amountCents)} USD`} />
          <Detail label="Status" value={<InvoiceStatusBadge status={invoice.status} />} />
          <Detail label="Issue date" value={formatInvoiceDate(invoice.issueDate)} />
          <Detail label="Due date" value={formatInvoiceDate(invoice.dueDate)} />
          <Detail label="Created" value={formatDate(invoice.createdAt)} />
          <Detail label="Updated" value={formatDate(invoice.updatedAt)} />
          <Detail wide label="Notes" value={invoice.notes || 'No notes provided.'} />
        </dl>
      </div>
      <Link className="secondary-link back-link" to={projectPath}>Back to Project</Link>
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

function Detail({ label, value, wide = false }) {
  return <div className={wide ? 'detail-wide' : undefined}><dt>{label}</dt><dd>{value}</dd></div>;
}
