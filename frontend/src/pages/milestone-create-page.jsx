import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { createMilestone } from '../features/milestones/milestone-api.js';
import { getMilestoneErrorMessage } from '../features/milestones/get-milestone-error-message.js';
import { MilestoneForm } from '../features/milestones/milestone-form.jsx';
import { getProject } from '../features/projects/project-api.js';

export function MilestoneCreatePage() {
  const { projectId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
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
    getProject(projectId, accessToken, controller.signal)
      .then(setProject)
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setLoadError(getMilestoneErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, projectId, retryKey]);

  const handleSubmit = async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      const milestone = await createMilestone({ projectId, ...values }, accessToken);
      navigate(
        `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestone.id)}`,
        { replace: true },
      );
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setServerError(getMilestoneErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <PageState title="Create Milestone" role="status">Loading project...</PageState>;
  }
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Create Milestone</h1>
        <div className="content-state error-state" role="alert">
          <p>{loadError}</p>
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
          <p className="eyebrow">Project milestone</p>
          <h1>Create Milestone</h1>
          <p>For <Link to={`/projects/${encodeURIComponent(projectId)}`}>{project.name}</Link></p>
        </div>
      </div>
      <div className="content-card form-card">
        <MilestoneForm
          submitLabel="Create Milestone"
          submittingLabel="Creating Milestone..."
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
        <Link className="secondary-link" to={`/projects/${encodeURIComponent(projectId)}`}>
          Cancel
        </Link>
      </div>
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
