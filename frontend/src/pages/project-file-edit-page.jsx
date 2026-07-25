import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { getProjectFileErrorMessage } from '../features/project-files/get-project-file-error-message.js';
import { getProjectFile, updateProjectFile } from '../features/project-files/project-file-api.js';
import {
  PROJECT_FILE_DESCRIPTION_MAX_LENGTH,
  PROJECT_FILE_STATUS_OPTIONS,
} from '../features/project-files/project-file.constants.js';
import { getProject } from '../features/projects/project-api.js';

export function ProjectFileEditPage() {
  const { projectId, fileId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({});
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
      getProjectFile({ projectId, fileId, signal: controller.signal }, accessToken),
    ])
      .then(([loadedProject, loadedFile]) => {
        setProject(loadedProject);
        setFile(loadedFile);
        setDescription(loadedFile.description ?? '');
        setStatus(loadedFile.status);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !handleAuthenticationFailure(error)) {
          setLoadError(getProjectFileErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, fileId, handleAuthenticationFailure, projectId, retryKey]);

  const detailPath = useMemo(
    () => `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
    [fileId, projectId],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = {};
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > PROJECT_FILE_DESCRIPTION_MAX_LENGTH) {
      nextErrors.description = 'Description must not exceed 500 characters.';
    }
    if (!PROJECT_FILE_STATUS_OPTIONS.some((option) => option.value === status)) {
      nextErrors.status = 'Select a valid file status.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setIsSubmitting(true);
    setServerError('');
    try {
      await updateProjectFile({
        projectId,
        fileId,
        updates: { description: trimmedDescription || null, status },
      }, accessToken);
      navigate(detailPath, { replace: true });
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setServerError(getProjectFileErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <PageState title="Edit file metadata" role="status">Loading file...</PageState>;
  if (loadError) {
    return (
      <section className="client-page project-page">
        <h1>Edit file metadata</h1>
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
  if (!project || !file) return null;

  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project file</p>
          <h1>Edit file metadata</h1>
          <p>For <Link to={`/projects/${encodeURIComponent(projectId)}`}>{project.name}</Link></p>
        </div>
      </div>
      <div className="content-card form-card">
        <p className="read-only-file"><strong>File:</strong> <span>{file.originalName}</span></p>
        <form className="client-form project-file-form" onSubmit={handleSubmit} noValidate>
          {serverError && <div className="server-error" role="alert">{serverError}</div>}
          <div className="form-field">
            <label htmlFor="project-file-description">Description</label>
            <textarea
              id="project-file-description"
              name="description"
              rows="5"
              maxLength={PROJECT_FILE_DESCRIPTION_MAX_LENGTH + 1}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setErrors((current) => ({ ...current, description: undefined }));
              }}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'project-file-description-error' : undefined}
            />
            {errors.description && (
              <p id="project-file-description-error" className="field-error">
                {errors.description}
              </p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="project-file-status">Status</label>
            <select
              id="project-file-status"
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setErrors((current) => ({ ...current, status: undefined }));
              }}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? 'project-file-status-error' : undefined}
            >
              {PROJECT_FILE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.status && (
              <p id="project-file-status-error" className="field-error">{errors.status}</p>
            )}
            <p className="field-help">
              Archiving changes metadata only. The stored file remains downloadable.
            </p>
          </div>
          <button className="form-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving changes...' : 'Save changes'}
          </button>
        </form>
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
