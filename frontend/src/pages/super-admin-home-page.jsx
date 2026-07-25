import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { getSuperAdminErrorMessage } from '../features/super-admin/get-super-admin-error-message.js';
import { getSuperAdminOverview } from '../features/super-admin/super-admin-api.js';

export function SuperAdminHomePage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(() => setRetryKey((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getSuperAdminOverview({ signal: controller.signal }, accessToken)
      .then(setOverview)
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.name === 'AbortError') return;
        if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
          clearSession();
          navigate('/login', { replace: true });
          return;
        }
        setOverview(null);
        setError(getSuperAdminErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, clearSession, navigate, retryKey]);

  return (
    <section className="client-page super-admin-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1>Platform Overview</h1>
          <p>Basic Organization and tenant-user counts across the platform.</p>
        </div>
        <Link className="primary-link" to="/super-admin/organizations">
          View Organizations
        </Link>
      </div>
      {loading && <div className="content-state" role="status">Loading platform overview...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={load}>Retry loading overview</button>
        </div>
      )}
      {!loading && !error && overview && (
        <div className="platform-summary-grid">
          <SummarySection
            title="Organizations"
            items={[
              ['Total', overview.organizations.total],
              ['Active', overview.organizations.active],
              ['Suspended', overview.organizations.suspended],
            ]}
          />
          <SummarySection
            title="Tenant users"
            items={[
              ['Total', overview.users.total],
              ['Organization Admins', overview.users.organizationAdmins],
              ['Clients', overview.users.clients],
            ]}
          />
        </div>
      )}
    </section>
  );
}

function SummarySection({ title, items }) {
  return (
    <section className="content-card" aria-labelledby={`summary-${title.replaceAll(' ', '-')}`}>
      <h2 id={`summary-${title.replaceAll(' ', '-')}`}>{title}</h2>
      <dl className="summary-counts">
        {items.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
