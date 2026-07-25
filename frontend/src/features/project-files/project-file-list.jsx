import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate } from '../../core/format-date.js';
import { useAuth } from '../auth/use-auth.js';
import { formatProjectFileSize, getProjectFileTypeLabel } from './file-format.js';
import { getProjectFileErrorMessage } from './get-project-file-error-message.js';
import { downloadProjectFile, listProjectFiles } from './project-file-api.js';
import {
  PROJECT_FILE_PAGE_SIZE,
  PROJECT_FILE_STATUS_OPTIONS,
} from './project-file.constants.js';
import { ProjectFileStatusBadge } from './project-file-status-badge.jsx';

export function ProjectFileList({ projectId }) {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [files, setFiles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const handleAuthenticationFailure = useCallback((requestError) => {
    if (requestError?.code !== 'AUTHENTICATION_REQUIRED') return false;
    clearSession();
    navigate('/login', { replace: true });
    return true;
  }, [clearSession, navigate]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError('The project was not found.');
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFiles([]);
    listProjectFiles({
      projectId,
      page,
      limit: PROJECT_FILE_PAGE_SIZE,
      status: status || undefined,
      signal: controller.signal,
    }, accessToken)
      .then((result) => {
        setFiles(result.files);
        setPagination(result.pagination);
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
  }, [accessToken, handleAuthenticationFailure, page, projectId, retryKey, status]);

  const handleDownload = async (file) => {
    if (downloadingId) return;
    setDownloadingId(file.id);
    setDownloadError('');
    try {
      await downloadProjectFile({
        projectId,
        fileId: file.id,
        fallbackName: file.originalName,
      }, accessToken);
    } catch (requestError) {
      if (!handleAuthenticationFailure(requestError)) {
        setDownloadError(getProjectFileErrorMessage(requestError));
      }
    } finally {
      setDownloadingId('');
    }
  };

  const addPath = `/projects/${encodeURIComponent(projectId)}/files/new`;
  return (
    <section className="project-file-section" aria-labelledby="project-files-heading">
      <div className="milestone-section-header">
        <div>
          <h2 id="project-files-heading">Files</h2>
          <p>Share approved deliverables securely within this project.</p>
        </div>
        <Link className="primary-link" to={addPath}>Upload File</Link>
      </div>
      <div className="list-toolbar milestone-toolbar">
        <div>
          <label htmlFor="project-file-status-filter">Status</label>
          <select
            id="project-file-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {PROJECT_FILE_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      {downloadError && <div className="server-error" role="alert">{downloadError}</div>}
      {loading && <div className="content-state" role="status">Loading files...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
            Retry loading files
          </button>
        </div>
      )}
      {!loading && !error && files.length === 0 && (
        <div className="content-state">
          {status ? (
            <>
              <p>No files match the selected status.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setStatus('');
                  setPage(1);
                }}
              >
                Clear status filter
              </button>
            </>
          ) : (
            <>
              <p>This project has no files yet.</p>
              <Link className="primary-link" to={addPath}>Upload File</Link>
            </>
          )}
        </div>
      )}
      {!loading && !error && files.length > 0 && (
        <>
          <div className="client-table-wrap">
            <table className="client-table project-file-table">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">Type and size</th>
                  <th scope="col">Status</th>
                  <th scope="col">Description</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td data-label="File" className="project-file-name" title={file.originalName}>
                      {file.originalName}
                    </td>
                    <td data-label="Type and size">
                      {getProjectFileTypeLabel(file.mimeType)}
                      <span className="file-size"> · {formatProjectFileSize(file.sizeBytes)}</span>
                    </td>
                    <td data-label="Status"><ProjectFileStatusBadge status={file.status} /></td>
                    <td data-label="Description" className="description-cell">
                      {file.description || 'No description provided.'}
                    </td>
                    <td data-label="Uploaded">{formatDate(file.createdAt)}</td>
                    <td data-label="Actions">
                      <div className="file-actions">
                        <Link to={
                          `/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}`
                        }>
                          View details
                        </Link>
                        <button
                          type="button"
                          className="text-button"
                          disabled={Boolean(downloadingId)}
                          onClick={() => handleDownload(file)}
                          aria-label={`Download ${file.originalName}`}
                        >
                          {downloadingId === file.id ? 'Downloading...' : 'Download'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Project file list pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {pagination.page || page}
              {pagination.totalPages > 0 ? ` of ${pagination.totalPages}` : ''}
              {Number.isFinite(pagination.total) ? ` · ${pagination.total} total` : ''}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={pagination.totalPages <= 0 || page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
