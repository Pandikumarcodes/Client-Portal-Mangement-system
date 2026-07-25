import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate } from '../core/format-date.js';
import { useAuth } from '../features/auth/use-auth.js';
import { listClients } from '../features/clients/client-api.js';
import {
  CLIENT_OPTION_PAGE_SIZE,
  PROJECT_PAGE_SIZE,
  PROJECT_STATUS_OPTIONS,
} from '../features/projects/project.constants.js';
import { createClientLabelMap } from '../features/projects/project-client-utils.js';
import { getProjectErrorMessage } from '../features/projects/get-project-error-message.js';
import { listProjects } from '../features/projects/project-api.js';
import { ProjectStatusBadge } from '../features/projects/project-status-badge.jsx';

export function ProjectListPage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState('');
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const handleError = useCallback((requestError, setMessage) => {
    if (requestError?.name === 'AbortError') return;
    if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
      clearSession();
      navigate('/login', { replace: true });
      return;
    }
    setMessage(getProjectErrorMessage(requestError));
  }, [clearSession, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    setClientsLoading(true);
    setClientsError('');
    listClients(
      { page: 1, limit: CLIENT_OPTION_PAGE_SIZE, signal: controller.signal },
      accessToken,
    )
      .then((result) => setClients(result.clients))
      .catch((requestError) => handleError(requestError, setClientsError))
      .finally(() => {
        if (!controller.signal.aborted) setClientsLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleError]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProjects([]);
    listProjects({
      page,
      limit: PROJECT_PAGE_SIZE,
      status: status || undefined,
      clientId: clientId || undefined,
      signal: controller.signal,
    }, accessToken)
      .then((result) => {
        setProjects(result.projects);
        setPagination(result.pagination);
      })
      .catch((requestError) => handleError(requestError, setError))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, clientId, handleError, page, retryKey, status]);

  const clientLabels = useMemo(() => createClientLabelMap(clients), [clients]);
  const filtersActive = Boolean(status || clientId);
  const resetFilters = () => {
    setStatus('');
    setClientId('');
    setPage(1);
  };

  return (
    <section className="client-page project-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Organization administration</p>
          <h1>Projects</h1>
          <p>Manage client projects and their current status.</p>
        </div>
        <Link className="primary-link" to="/projects/new">Create Project</Link>
      </div>

      <div className="list-toolbar project-toolbar">
        <div>
          <label htmlFor="project-status-filter">Status</label>
          <select
            id="project-status-filter"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          >
            <option value="">All statuses</option>
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="project-client-filter">Client</label>
          <select
            id="project-client-filter"
            value={clientId}
            disabled={clientsLoading || Boolean(clientsError)}
            onChange={(event) => { setClientId(event.target.value); setPage(1); }}
          >
            <option value="">{clientsLoading ? 'Loading clients...' : 'All clients'}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {clientLabels.get(client.id)}
              </option>
            ))}
          </select>
        </div>
        {clientsError && <p className="toolbar-error" role="alert">{clientsError}</p>}
      </div>

      {loading && <div className="content-state" role="status">Loading projects...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
            Retry loading projects
          </button>
        </div>
      )}
      {!loading && !error && projects.length === 0 && (
        <div className="content-state">
          {filtersActive ? (
            <>
              <p>No projects match the selected filters.</p>
              <button type="button" className="secondary-button" onClick={resetFilters}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p>No projects have been created yet.</p>
              <Link className="primary-link" to="/projects/new">Create Project</Link>
            </>
          )}
        </div>
      )}
      {!loading && !error && projects.length > 0 && (
        <>
          <div className="client-table-wrap">
            <table className="client-table project-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col">Description</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td data-label="Project">{project.name}</td>
                    <td data-label="Client">{clientLabels.get(project.clientId) ?? 'Client unavailable'}</td>
                    <td data-label="Status"><ProjectStatusBadge status={project.status} /></td>
                    <td data-label="Description" className="description-cell">
                      {project.description || 'No description provided.'}
                    </td>
                    <td data-label="Created">{formatDate(project.createdAt)}</td>
                    <td data-label="Action">
                      <Link to={`/projects/${encodeURIComponent(project.id)}`}>View details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Project list pagination">
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
