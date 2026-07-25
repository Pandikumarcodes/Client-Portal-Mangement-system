import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { getSuperAdminErrorMessage } from '../features/super-admin/get-super-admin-error-message.js';
import {
  getOrganization,
  listOrganizationUsers,
  updateOrganizationStatus,
} from '../features/super-admin/super-admin-api.js';
import {
  ORGANIZATION_STATUS,
  ORGANIZATION_USER_ROLE,
  USER_STATUS,
} from '../features/super-admin/super-admin.constants.js';
import { Pagination, StatusText } from './super-admin-organizations-page.jsx';

export function SuperAdminOrganizationDetailPage() {
  const { organizationId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getOrganization(organizationId, accessToken, controller.signal)
      .then(setOrganization)
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.name === 'AbortError') return;
        if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
          clearSession();
          navigate('/login', { replace: true });
          return;
        }
        setError(getSuperAdminErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, clearSession, navigate, organizationId, retryKey]);

  const changeStatus = async () => {
    if (!organization || updating) return;
    const nextStatus =
      organization.status === ORGANIZATION_STATUS.ACTIVE
        ? ORGANIZATION_STATUS.SUSPENDED
        : ORGANIZATION_STATUS.ACTIVE;
    setUpdating(true);
    setStatusMessage('');
    try {
      const updated = await updateOrganizationStatus(
        organizationId,
        nextStatus,
        accessToken,
      );
      setOrganization((current) => ({ ...current, ...updated }));
      setStatusMessage(
        nextStatus === ORGANIZATION_STATUS.SUSPENDED
          ? 'The Organization was suspended. Its data was retained.'
          : 'The Organization was activated.',
      );
    } catch (requestError) {
      if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
        clearSession();
        navigate('/login', { replace: true });
      } else {
        setStatusMessage(getSuperAdminErrorMessage(requestError));
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <PageState role="status">Loading Organization details...</PageState>;
  if (error) {
    return (
      <PageState role="alert">
        <p>{error}</p>
        {error !== 'The organization was not found.' && (
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button>
        )}
        <Link className="secondary-link" to="/super-admin/organizations">Back to Organizations</Link>
      </PageState>
    );
  }
  if (!organization) return null;

  return (
    <section className="client-page super-admin-page">
      <div className="page-header"><div><p className="eyebrow">Organization details</p><h1>{organization.name}</h1><p>Safe platform metadata and tenant-user visibility.</p></div></div>
      <section className="content-card" aria-labelledby="organization-metadata-heading">
        <h2 id="organization-metadata-heading">Basic details</h2>
        <dl className="detail-grid">
          <Detail label="Slug" value={organization.slug} />
          <Detail label="Status" value={<StatusText status={organization.status} />} />
          <Detail label="Created" value={formatDate(organization.createdAt)} />
          <Detail label="Updated" value={formatDate(organization.updatedAt)} />
        </dl>
      </section>
      <section className="content-card" aria-labelledby="organization-user-counts-heading">
        <h2 id="organization-user-counts-heading">User counts</h2>
        <dl className="summary-counts">
          <Detail label="Total" value={organization.userCounts.total} />
          <Detail label="Organization Admins" value={organization.userCounts.organizationAdmins} />
          <Detail label="Clients" value={organization.userCounts.clients} />
        </dl>
      </section>
      <section className="content-card status-control" aria-labelledby="organization-access-heading">
        <h2 id="organization-access-heading">Organization access</h2>
        <p>Suspension blocks normal Organization login and refresh access. It does not delete Organization or tenant data. Existing stateless access tokens may remain valid until their short expiry.</p>
        <p>Current status: <strong>{organization.status === ORGANIZATION_STATUS.SUSPENDED ? 'Suspended' : 'Active'}</strong></p>
        <button type="button" disabled={updating} onClick={changeStatus}>
          {updating ? 'Updating status...' : organization.status === ORGANIZATION_STATUS.ACTIVE ? 'Suspend Organization' : 'Activate Organization'}
        </button>
        {statusMessage && <p className="status-message" role="status">{statusMessage}</p>}
      </section>
      <OrganizationUsers organizationId={organizationId} />
      <Link className="secondary-link back-link" to="/super-admin/organizations">Back to Organizations</Link>
    </section>
  );
}

function OrganizationUsers({ organizationId }) {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ totalPages: 0 });
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
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
    listOrganizationUsers({
      organizationId,
      page,
      limit: 20,
      role,
      status,
      signal: controller.signal,
    }, accessToken)
      .then((result) => {
        if (sequence.current !== requestId) return;
        setUsers(result.users.filter((user) => user.role !== 'super_admin'));
        setPagination(result.pagination);
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.name === 'AbortError') return;
        if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
          clearSession();
          navigate('/login', { replace: true });
          return;
        }
        if (sequence.current === requestId) setError(getSuperAdminErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence.current === requestId) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, clearSession, navigate, organizationId, page, retryKey, role, status]);

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <section aria-labelledby="organization-users-heading">
      <h2 id="organization-users-heading">Organization users</h2>
      <div className="list-toolbar filter-group">
        <div><label htmlFor="organization-user-role">Role</label><select id="organization-user-role" value={role} onChange={changeFilter(setRole)}><option value="">All roles</option><option value={ORGANIZATION_USER_ROLE.ORGANIZATION_ADMIN}>Organization Admin</option><option value={ORGANIZATION_USER_ROLE.CLIENT}>Client</option></select></div>
        <div><label htmlFor="organization-user-status">Status</label><select id="organization-user-status" value={status} onChange={changeFilter(setStatus)}><option value="">All statuses</option><option value={USER_STATUS.ACTIVE}>Active</option><option value={USER_STATUS.INVITED}>Invited</option><option value={USER_STATUS.SUSPENDED}>Suspended</option></select></div>
      </div>
      {loading && <div className="content-state" role="status">Loading Organization users...</div>}
      {!loading && error && <div className="content-state error-state" role="alert"><p>{error}</p><button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry loading users</button></div>}
      {!loading && !error && users.length === 0 && <div className="content-state">No Organization users match these filters.</div>}
      {!loading && !error && users.length > 0 && (
        <><div className="client-table-wrap"><table className="client-table"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td data-label="Name">{user.firstName} {user.lastName}</td><td data-label="Email">{user.email}</td><td data-label="Role">{user.role === ORGANIZATION_USER_ROLE.ORGANIZATION_ADMIN ? 'Organization Admin' : 'Client'}</td><td data-label="Status">{user.status}</td><td data-label="Created">{formatDate(user.createdAt)}</td></tr>)}</tbody></table></div><Pagination label="Organization user list pagination" page={page} totalPages={pagination.totalPages} setPage={setPage} /></>
      )}
    </section>
  );
}

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function PageState({ role, children }) {
  return <section className="client-page super-admin-page"><h1>Organization details</h1><div className="content-state error-state" role={role}>{children}</div></section>;
}
