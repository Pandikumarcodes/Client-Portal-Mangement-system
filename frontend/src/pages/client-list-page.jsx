import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { listClients } from '../features/clients/client-api.js';
import { CLIENT_STATUS } from '../features/clients/client.constants.js';
import { getClientErrorMessage } from '../features/clients/get-client-error-message.js';

const limit = 20;

export function ClientListPage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listClients(
        { page, limit, status: status || undefined },
        accessToken,
      );
      setClients(result.clients);
      setPagination(result.pagination);
    } catch (requestError) {
      if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
        clearSession();
        navigate('/login', { replace: true });
        return;
      }
      setError(getClientErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, clearSession, navigate, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };

  return (
    <section className="client-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Organization administration</p>
          <h1>Clients</h1>
          <p>Manage the client profiles owned by your organization.</p>
        </div>
        <Link className="primary-link" to="/admin/clients/new">Add client</Link>
      </div>

      <div className="list-toolbar">
        <label htmlFor="client-status">Status</label>
        <select id="client-status" value={status} onChange={changeStatus}>
          <option value="">All clients</option>
          <option value={CLIENT_STATUS.ACTIVE}>Active</option>
          <option value={CLIENT_STATUS.INACTIVE}>Inactive</option>
        </select>
      </div>

      {loading && <div className="content-state" role="status">Loading clients...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={load}>Retry loading clients</button>
        </div>
      )}
      {!loading && !error && clients.length === 0 && (
        <div className="content-state">
          <p>No clients have been added yet.</p>
        </div>
      )}
      {!loading && !error && clients.length > 0 && (
        <>
          <div className="client-table-wrap">
            <table className="client-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Email</th>
                  <th scope="col">Company</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td data-label="Client">{client.firstName} {client.lastName}</td>
                    <td data-label="Email">{client.email}</td>
                    <td data-label="Company">{client.companyName || 'Not provided'}</td>
                    <td data-label="Status"><StatusBadge status={client.status} /></td>
                    <td data-label="Created">{formatDate(client.createdAt)}</td>
                    <td data-label="Action">
                      <Link to={`/admin/clients/${encodeURIComponent(client.id)}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Client list pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span>Page {pagination.page || page}{pagination.totalPages ? ` of ${pagination.totalPages}` : ''}</span>
            <button
              type="button"
              className="secondary-button"
              disabled={pagination.totalPages === 0 || page >= pagination.totalPages}
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

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status === CLIENT_STATUS.ACTIVE ? 'Active' : 'Inactive'}</span>;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
