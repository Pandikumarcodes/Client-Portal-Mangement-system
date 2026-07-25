import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { DashboardSection } from '../features/dashboard/dashboard-section.jsx';
import { getOrganizationDashboard } from '../features/dashboard/dashboard-api.js';
import { getDashboardErrorMessage } from '../features/dashboard/get-dashboard-error-message.js';
import { useAuth } from '../features/auth/use-auth.js';

export function OrganizationDashboardPage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);
  const loadingRef = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    loadingRef.current = true;
    setLoading(true);
    setError('');

    getOrganizationDashboard({ signal: controller.signal }, accessToken)
      .then((result) => {
        if (requestSequence.current === requestId) setDashboard(result);
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.name === 'AbortError') return;
        if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
          clearSession();
          navigate('/login', { replace: true });
          return;
        }
        if (requestSequence.current === requestId) {
          setDashboard(null);
          setError(getDashboardErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestSequence.current === requestId) {
          loadingRef.current = false;
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [accessToken, clearSession, navigate, retryKey]);

  return (
    <section className="client-page organization-dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Organization administration</p>
          <h1>Dashboard</h1>
          <p>A current overview of your clients, projects, milestones, files, and invoices.</p>
        </div>
      </div>

      {loading && !dashboard && (
        <div className="content-state" role="status">Loading dashboard...</div>
      )}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (loadingRef.current) return;
              loadingRef.current = true;
              setRetryKey((current) => current + 1);
            }}
          >
            Retry loading dashboard
          </button>
        </div>
      )}
      {!loading && !error && dashboard && (
        <div className="dashboard-sections">
          <DashboardSection
            id="dashboard-clients"
            title="Clients"
            total={dashboard.clients.total}
            counts={[
              { label: 'Active', count: dashboard.clients.active },
              { label: 'Inactive', count: dashboard.clients.inactive },
            ]}
            action={{ label: 'View clients', to: '/admin/clients' }}
          />
          <DashboardSection
            id="dashboard-projects"
            title="Projects"
            total={dashboard.projects.total}
            counts={[
              { label: 'Active', count: dashboard.projects.active },
              { label: 'On hold', count: dashboard.projects.onHold },
              { label: 'Completed', count: dashboard.projects.completed },
              { label: 'Archived', count: dashboard.projects.archived },
            ]}
            action={{ label: 'View projects', to: '/projects' }}
          />
          <DashboardSection
            id="dashboard-milestones"
            title="Milestones"
            total={dashboard.milestones.total}
            counts={[
              { label: 'Pending', count: dashboard.milestones.pending },
              { label: 'In progress', count: dashboard.milestones.inProgress },
              { label: 'Completed', count: dashboard.milestones.completed },
            ]}
            action={{ label: 'View projects', to: '/projects' }}
          />
          <DashboardSection
            id="dashboard-files"
            title="Files"
            total={dashboard.files.total}
            counts={[
              { label: 'Active', count: dashboard.files.active },
              { label: 'Archived', count: dashboard.files.archived },
            ]}
            action={{ label: 'View projects', to: '/projects' }}
          />
          <DashboardSection
            id="dashboard-invoices"
            title="Invoices"
            total={dashboard.invoices.total}
            counts={[
              { label: 'Draft', count: dashboard.invoices.draft },
              { label: 'Sent', count: dashboard.invoices.sent },
              { label: 'Paid', count: dashboard.invoices.paid },
              { label: 'Void', count: dashboard.invoices.void },
            ]}
            action={{ label: 'View projects', to: '/projects' }}
          />
        </div>
      )}
    </section>
  );
}
