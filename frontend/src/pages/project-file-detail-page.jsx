import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { formatProjectFileSize, getProjectFileTypeLabel } from '../features/project-files/file-format.js';
import { getProjectFileErrorMessage } from '../features/project-files/get-project-file-error-message.js';
import { downloadProjectFile, getProjectFile } from '../features/project-files/project-file-api.js';
import { ProjectFileStatusBadge } from '../features/project-files/project-file-status-badge.jsx';
import { getProject } from '../features/projects/project-api.js';

export function ProjectFileDetailPage() {
  const { projectId, fileId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

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
      getProjectFile({ projectId, fileId, signal: controller.signal }, accessToken),
    ])
      .then(([loadedProject, loadedFile]) => {
        setProject(loadedProject);
        setFile(loadedFile);
      })
      .catch((requestError) => {
        if (
          requestError?.name !== 'AbortError'
          && !handleAuthenticationFailure(requestError)
        ) {
          setError(getProjectFileErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, fileId, handleAuthenticationFailure, projectId, retryKey]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadProjectFile({
        projectId,
        fileId,
        fallbackName: file.originalName,
      }, accessToken);
    } catch (requestError) {
      if (!handleAuthenticationFailure(requestError)) {
        setDownloadError(getProjectFileErrorMessage(requestError));
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageState title="File details" role="status">Loading file...</PageState>;
  if (error) {
    return (
      <section className="client-page project-page">
        <h1>File details</h1>
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
  if (!project || !file) return null;

  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  const filePath = `${projectPath}/files/${encodeURIComponent(fileId)}`;
  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Project file details</p>
          <h1 className="long-filename">{file.originalName}</h1>
          <p>Project: <Link to={projectPath}>{project.name}</Link></p>
        </div>
        <Link className="primary-link" to={`${filePath}/edit`}>Edit metadata</Link>
      </div>
      {downloadError && <div className="server-error" role="alert">{downloadError}</div>}
      <div className="content-card">
        <dl className="detail-grid">
          <Detail label="Type" value={getProjectFileTypeLabel(file.mimeType)} />
          <Detail label="Size" value={formatProjectFileSize(file.sizeBytes)} />
          <Detail label="Status" value={<ProjectFileStatusBadge status={file.status} />} />
          <Detail label="Uploaded" value={formatDate(file.createdAt)} />
          <Detail label="Updated" value={formatDate(file.updatedAt)} />
          <Detail wide label="Description" value={file.description || 'No description provided.'} />
        </dl>
        <div className="button-row file-detail-actions">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            aria-label={`Download ${file.originalName}`}
          >
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>
      <Link className="secondary-link back-link" to={projectPath}>Back to Project</Link>
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
