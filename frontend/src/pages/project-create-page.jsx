import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { listClients } from '../features/clients/client-api.js';
import { CLIENT_OPTION_PAGE_SIZE } from '../features/projects/project.constants.js';
import { createProject } from '../features/projects/project-api.js';
import { ProjectForm } from '../features/projects/project-form.jsx';
import { getProjectErrorMessage } from '../features/projects/get-project-error-message.js';

export function ProjectCreatePage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState('');
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
    setClientsLoading(true);
    listClients(
      { page: 1, limit: CLIENT_OPTION_PAGE_SIZE, signal: controller.signal },
      accessToken,
    )
      .then((result) => setClients(result.clients))
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setClientsError(getProjectErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setClientsLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure]);

  const handleSubmit = async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      const project = await createProject(values, accessToken);
      navigate(`/projects/${encodeURIComponent(project.id)}`, { replace: true });
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setServerError(getProjectErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const noClients = !clientsLoading && !clientsError && clients.length === 0;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h1>Create Project</h1>
          <p>Start a project for an existing client.</p>
        </div>
      </div>
      {noClients && (
        <div className="content-state">
          <p>A client must exist before you can create a project.</p>
          <Link className="primary-link" to="/admin/clients/new">Create Client</Link>
        </div>
      )}
      {!noClients && (
        <div className="content-card form-card">
          <ProjectForm
            clients={clients}
            clientsLoading={clientsLoading}
            clientsError={clientsError}
            submitLabel="Create Project"
            submittingLabel="Creating Project..."
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            serverError={serverError}
          />
          <Link className="secondary-link" to="/projects">Cancel</Link>
        </div>
      )}
    </section>
  );
}
