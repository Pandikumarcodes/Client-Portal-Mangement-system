import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { getMilestoneErrorMessage } from '../features/milestones/get-milestone-error-message.js';
import { getMilestone, updateMilestone } from '../features/milestones/milestone-api.js';
import { toDateInputValue } from '../features/milestones/milestone-date.js';
import { MilestoneForm } from '../features/milestones/milestone-form.jsx';
import { getProject } from '../features/projects/project-api.js';

export function MilestoneEditPage() {
  const { projectId, milestoneId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [milestone, setMilestone] = useState(null);
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
    Promise.all([
      getProject(projectId, accessToken, controller.signal),
      getMilestone({ projectId, milestoneId, signal: controller.signal }, accessToken),
    ])
      .then(([loadedProject, loadedMilestone]) => {
        setProject(loadedProject);
        setMilestone(loadedMilestone);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setLoadError(getMilestoneErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, milestoneId, projectId, retryKey]);

  const initialValues = useMemo(() => milestone ? {
    title: milestone.title,
    description: milestone.description ?? '',
    dueDate: toDateInputValue(milestone.dueDate),
    status: milestone.status,
  } : undefined, [milestone]);

  const handleSubmit = async (updates) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      await updateMilestone({ projectId, milestoneId, updates }, accessToken);
      navigate(
        `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
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
    return <PageState title="Edit Milestone" role="status">Loading milestone...</PageState>;
  }
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Edit Milestone</h1>
        <div className="content-state error-state" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to={`/projects/${encodeURIComponent(projectId)}`}>
          Back to Project
        </Link>
      </section>
    );
  }
  if (!project || !milestone) return null;

  const detailPath = `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project milestone</p>
          <h1>Edit Milestone</h1>
          <p>For <Link to={`/projects/${encodeURIComponent(projectId)}`}>{project.name}</Link></p>
        </div>
      </div>
      <div className="content-card form-card">
        <MilestoneForm
          initialValues={initialValues}
          isEditing
          submitLabel="Save changes"
          submittingLabel="Saving changes..."
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
        <Link className="secondary-link" to={detailPath}>Cancel</Link>
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
