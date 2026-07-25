import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { listClients } from '../features/clients/client-api.js';
import { CLIENT_OPTION_PAGE_SIZE } from '../features/projects/project.constants.js';
import { createClientLabelMap } from '../features/projects/project-client-utils.js';
import { getProjectErrorMessage } from '../features/projects/get-project-error-message.js';
import { getProject } from '../features/projects/project-api.js';
import { ProjectStatusBadge } from '../features/projects/project-status-badge.jsx';
import { MilestoneList } from '../features/milestones/milestone-list.jsx';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [clientLabel, setClientLabel] = useState('Client unavailable');
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
      listClients(
        { page: 1, limit: CLIENT_OPTION_PAGE_SIZE, signal: controller.signal },
        accessToken,
      ),
    ])
      .then(([loadedProject, clientResult]) => {
        setProject(loadedProject);
        setClientLabel(
          createClientLabelMap(clientResult.clients).get(loadedProject.clientId)
            ?? 'Client unavailable',
        );
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError' && !handleAuthenticationFailure(requestError)) {
          setError(getProjectErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, projectId, retryKey]);

  if (loading) {
    return <ProjectState title="Project details" role="status">Loading project...</ProjectState>;
  }
  if (error) {
    return (
      <section className="client-page project-page">
        <h1>Project details</h1>
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to="/projects">Back to Projects</Link>
      </section>
    );
  }
  if (!project) return null;

  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project details</p>
          <h1>{project.name}</h1>
          <p>View this project and its current status.</p>
        </div>
        <Link className="primary-link" to={`/projects/${encodeURIComponent(project.id)}/edit`}>
          Edit Project
        </Link>
      </div>
      <div className="content-card">
        <dl className="detail-grid">
          <Detail label="Client" value={clientLabel} />
          <Detail label="Status" value={<ProjectStatusBadge status={project.status} />} />
          <Detail label="Created" value={formatDate(project.createdAt)} />
          <Detail label="Updated" value={formatDate(project.updatedAt)} />
          <Detail wide label="Description" value={project.description || 'No description provided.'} />
        </dl>
      </div>
      <MilestoneList projectId={project.id} />
      <Link className="secondary-link back-link" to="/projects">Back to Projects</Link>
    </section>
  );
}

function ProjectState({ title, role, children }) {
  return (
    <section className="client-page project-page">
      <h1>{title}</h1>
      <div className="content-state" role={role}>{children}</div>
    </section>
  );
}

function Detail({ label, value, wide = false }) {
  return <div className={wide ? 'detail-wide' : undefined}><dt>{label}</dt><dd>{value}</dd></div>;
}
