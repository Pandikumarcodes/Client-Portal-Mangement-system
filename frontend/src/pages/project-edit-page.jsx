import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { listClients } from '../features/clients/client-api.js';
import { CLIENT_OPTION_PAGE_SIZE } from '../features/projects/project.constants.js';
import { getProjectErrorMessage } from '../features/projects/get-project-error-message.js';
import { getProject, updateProject } from '../features/projects/project-api.js';
import { ProjectForm } from '../features/projects/project-form.jsx';

export function ProjectEditPage() {
  const { projectId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

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
      listClients(
        { page: 1, limit: CLIENT_OPTION_PAGE_SIZE, signal: controller.signal },
        accessToken,
      ),
    ])
      .then(([loadedProject, clientResult]) => {
        setProject(loadedProject);
        setClients(clientResult.clients);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setLoadError(getProjectErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, projectId, retryKey]);

  const initialValues = useMemo(() => project ? {
    clientId: project.clientId,
    name: project.name,
    description: project.description ?? '',
    status: project.status,
  } : undefined, [project]);

  const handleSubmit = async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      const updated = await updateProject(projectId, values, accessToken);
      navigate(`/projects/${encodeURIComponent(updated.id)}`, { replace: true });
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setServerError(getProjectErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="client-page project-page">
        <h1>Edit Project</h1>
        <div className="content-state" role="status">Loading project...</div>
      </section>
    );
  }
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Edit Project</h1>
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
          <p className="eyebrow">Projects</p>
          <h1>Edit Project</h1>
          <p>Update the project details or change its status.</p>
        </div>
      </div>
      <div className="content-card form-card">
        <ProjectForm
          clients={clients}
          initialValues={initialValues}
          isEditing
          submitLabel="Save changes"
          submittingLabel="Saving changes..."
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
          submitDisabled={clients.length === 0}
        />
        <Link
          className="secondary-link"
          to={`/projects/${encodeURIComponent(projectId)}`}
        >
          Cancel
        </Link>
      </div>
    </section>
  );
}
