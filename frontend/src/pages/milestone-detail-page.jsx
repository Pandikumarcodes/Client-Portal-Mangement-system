import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { getMilestoneErrorMessage } from '../features/milestones/get-milestone-error-message.js';
import { getMilestone } from '../features/milestones/milestone-api.js';
import { MilestoneStatusBadge } from '../features/milestones/milestone-status-badge.jsx';
import { getProject } from '../features/projects/project-api.js';

export function MilestoneDetailPage() {
  const { projectId, milestoneId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [milestone, setMilestone] = useState(null);
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
      getMilestone({ projectId, milestoneId, signal: controller.signal }, accessToken),
    ])
      .then(([loadedProject, loadedMilestone]) => {
        setProject(loadedProject);
        setMilestone(loadedMilestone);
      })
      .catch((requestError) => {
        if (
          requestError?.name !== 'AbortError'
          && !handleAuthenticationFailure(requestError)
        ) {
          setError(getMilestoneErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, milestoneId, projectId, retryKey]);

  if (loading) {
    return <PageState title="Milestone details" role="status">Loading milestone...</PageState>;
  }
  if (error) {
    return (
      <section className="client-page project-page">
        <h1>Milestone details</h1>
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to={`/projects/${encodeURIComponent(projectId)}`}>
          Back to Project
        </Link>
      </section>
    );
  }
  if (!project || !milestone) return null;

  const milestonePath = `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Milestone details</p>
          <h1>{milestone.title}</h1>
          <p>
            Project: <Link to={`/projects/${encodeURIComponent(projectId)}`}>{project.name}</Link>
          </p>
        </div>
        <Link className="primary-link" to={`${milestonePath}/edit`}>Edit Milestone</Link>
      </div>
      <div className="content-card">
        <dl className="detail-grid">
          <Detail label="Status" value={<MilestoneStatusBadge status={milestone.status} />} />
          <Detail label="Due date" value={
            milestone.dueDate ? formatDate(milestone.dueDate) : 'No due date'
          } />
          <Detail label="Created" value={formatDate(milestone.createdAt)} />
          <Detail label="Updated" value={formatDate(milestone.updatedAt)} />
          <Detail
            wide
            label="Description"
            value={milestone.description || 'No description provided.'}
          />
        </dl>
      </div>
      <Link className="secondary-link back-link" to={`/projects/${encodeURIComponent(projectId)}`}>
        Back to Project
      </Link>
    </section>
  );
}

function PageState({ title, role, children }) {
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
