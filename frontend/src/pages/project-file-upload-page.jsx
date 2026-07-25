import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { getProjectFileErrorMessage } from '../features/project-files/get-project-file-error-message.js';
import { uploadProjectFile } from '../features/project-files/project-file-api.js';
import { ProjectFileUploadForm } from '../features/project-files/project-file-upload-form.jsx';
import { getProject } from '../features/projects/project-api.js';

export function ProjectFileUploadPage() {
  const { projectId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverErrorCode, setServerErrorCode] = useState('');

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
          setLoadError(getProjectFileErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleAuthenticationFailure, projectId, retryKey]);

  const handleSubmit = async ({ file, description }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    setServerErrorCode('');
    try {
      const uploaded = await uploadProjectFile({ projectId, file, description }, accessToken);
      navigate(
        `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(uploaded.id)}`,
        { replace: true },
      );
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setServerErrorCode(error?.code ?? '');
        setServerError(getProjectFileErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <PageState title="Upload File" role="status">Loading project...</PageState>;
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Upload File</h1>
        <div className="content-state error-state" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>
        </div>
        <Link className="secondary-link" to="/projects">Back to Projects</Link>
      </section>
    );
  }
  if (!project) return null;

  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project file</p>
          <h1>Upload File</h1>
          <p>For <Link to={projectPath}>{project.name}</Link></p>
        </div>
      </div>
      <div className="content-card form-card">
        <ProjectFileUploadForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
          serverErrorCode={serverErrorCode}
        />
        <Link className="secondary-link" to={projectPath}>Cancel</Link>
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
