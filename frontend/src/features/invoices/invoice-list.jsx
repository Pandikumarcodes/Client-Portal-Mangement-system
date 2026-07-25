import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate } from '../../core/format-date.js';
import { useAuth } from '../auth/use-auth.js';
import { formatInvoiceDate } from './invoice-date.js';
import { formatCentsAsUsd } from './invoice-format.js';
import { getInvoiceErrorMessage } from './get-invoice-error-message.js';
import { listInvoices } from './invoice-api.js';
import {
  INVOICE_PAGE_SIZE,
  INVOICE_STATUS_OPTIONS,
} from './invoice.constants.js';
import { InvoiceStatusBadge } from './invoice-status-badge.jsx';

export function InvoiceList({ projectId }) {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const handleError = useCallback((requestError) => {
    if (requestError?.name === 'AbortError') return;
    if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
      clearSession();
      navigate('/login', { replace: true });
      return;
    }
    setError(getInvoiceErrorMessage(requestError));
  }, [clearSession, navigate]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError('The project was not found.');
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setInvoices([]);
    listInvoices({
      projectId,
      page,
      limit: INVOICE_PAGE_SIZE,
      status: status || undefined,
      signal: controller.signal,
    }, accessToken)
      .then((result) => {
        setInvoices(result.invoices);
        setPagination(result.pagination);
      })
      .catch(handleError)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleError, page, projectId, retryKey, status]);

  const createPath = `/projects/${encodeURIComponent(projectId)}/invoices/new`;
  return (
    <section className="invoice-section" aria-labelledby="project-invoices-heading">
      <div className="resource-section-header">
        <div>
          <h2 id="project-invoices-heading">Invoices</h2>
          <p>Manage basic USD invoice records for this project.</p>
        </div>
        <Link className="primary-link" to={createPath}>Create Invoice</Link>
      </div>
      <div className="list-toolbar resource-toolbar">
        <div>
          <label htmlFor="invoice-status-filter">Status</label>
          <select
            id="invoice-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {INVOICE_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="content-state" role="status">Loading invoices...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
            Retry loading invoices
          </button>
        </div>
      )}
      {!loading && !error && invoices.length === 0 && (
        <div className="content-state">
          {status ? (
            <>
              <p>No invoices match the selected status.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setStatus('');
                  setPage(1);
                }}
              >
                Clear status filter
              </button>
            </>
          ) : (
            <>
              <p>This project has no invoice records yet.</p>
              <Link className="primary-link" to={createPath}>Create Invoice</Link>
            </>
          )}
        </div>
      )}
      {!loading && !error && invoices.length > 0 && (
        <>
          <div className="client-table-wrap">
            <table className="client-table invoice-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Issue date</th>
                  <th scope="col">Due date</th>
                  <th scope="col">Notes</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Invoice" className="invoice-number-cell">
                      {invoice.invoiceNumber}
                    </td>
                    <td data-label="Amount">{formatCentsAsUsd(invoice.amountCents)}</td>
                    <td data-label="Status"><InvoiceStatusBadge status={invoice.status} /></td>
                    <td data-label="Issue date">{formatInvoiceDate(invoice.issueDate)}</td>
                    <td data-label="Due date">{formatInvoiceDate(invoice.dueDate)}</td>
                    <td data-label="Notes" className="description-cell">
                      {invoice.notes || 'No notes provided.'}
                    </td>
                    <td data-label="Created">{formatDate(invoice.createdAt)}</td>
                    <td data-label="Action">
                      <Link to={
                        `/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoice.id)}`
                      }>
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Invoice list pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {pagination.page || page}
              {pagination.totalPages > 0 ? ` of ${pagination.totalPages}` : ''}
              {Number.isFinite(pagination.total) ? ` · ${pagination.total} total` : ''}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={pagination.totalPages <= 0 || page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
