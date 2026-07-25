import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { getSuperAdminErrorMessage } from '../features/super-admin/get-super-admin-error-message.js';
import { listOrganizations } from '../features/super-admin/super-admin-api.js';
import { ORGANIZATION_STATUS } from '../features/super-admin/super-admin.constants.js';

export function SuperAdminOrganizationsPage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = sequence.current + 1;
    sequence.current = requestId;
    setLoading(true);
    setError('');
    listOrganizations({ page, limit: 20, status, signal: controller.signal }, accessToken)
      .then((result) => {
        if (sequence.current !== requestId) return;
        setOrganizations(result.organizations);
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.name === 'AbortError') return;
        if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
          clearSession();
          navigate('/login', { replace: true });
          return;
        }
        if (sequence.current === requestId) {
          setOrganizations([]);
          setError(getSuperAdminErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence.current === requestId) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, clearSession, navigate, page, retryKey, status]);

  return (
    <section className="client-page super-admin-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1>Organizations</h1>
          <p>View active and suspended Organizations.</p>
        </div>
      </div>
      <div className="list-toolbar">
        <label htmlFor="organization-status-filter">Status</label>
        <select
          id="organization-status-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value={ORGANIZATION_STATUS.ACTIVE}>Active</option>
          <option value={ORGANIZATION_STATUS.SUSPENDED}>Suspended</option>
        </select>
      </div>
      {loading && <div className="content-state" role="status">Loading Organizations...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
            Retry loading Organizations
          </button>
        </div>
      )}
      {!loading && !error && organizations.length === 0 && (
        <div className="content-state">
          {status ? 'No Organizations match this status.' : 'No Organizations are available.'}
        </div>
      )}
      {!loading && !error && organizations.length > 0 && (
        <>
          <div className="client-table-wrap">
            <table className="client-table">
              <thead><tr><th scope="col">Organization</th><th scope="col">Slug</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td data-label="Organization">{organization.name}</td>
                    <td data-label="Slug">{organization.slug}</td>
                    <td data-label="Status"><StatusText status={organization.status} /></td>
                    <td data-label="Created">{formatDate(organization.createdAt)}</td>
                    <td data-label="Action"><Link to={`/super-admin/organizations/${encodeURIComponent(organization.id)}`}>View details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            label="Organization list pagination"
            page={page}
            totalPages={pagination.totalPages}
            setPage={setPage}
          />
        </>
      )}
    </section>
  );
}

export function StatusText({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === ORGANIZATION_STATUS.SUSPENDED ? 'Suspended' : 'Active'}
    </span>
  );
}

export function Pagination({ label, page, totalPages, setPage }) {
  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span>Page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
      <button type="button" className="secondary-button" disabled={totalPages === 0 || page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
    </nav>
  );
}
