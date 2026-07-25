import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate } from '../../core/format-date.js';
import { useAuth } from '../auth/use-auth.js';
import { getMilestoneErrorMessage } from './get-milestone-error-message.js';
import { listMilestones } from './milestone-api.js';
import {
  MILESTONE_PAGE_SIZE,
  MILESTONE_STATUS_OPTIONS,
} from './milestone.constants.js';
import { MilestoneStatusBadge } from './milestone-status-badge.jsx';

export function MilestoneList({ projectId }) {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const handleError = useCallback((requestError) => {
    if (requestError?.name === 'AbortError') return;
    if (requestError?.code === 'AUTHENTICATION_REQUIRED') {
      clearSession();
      navigate('/login', { replace: true });
      return;
    }
    setError(getMilestoneErrorMessage(requestError));
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
    setMilestones([]);
    listMilestones({
      projectId,
      page,
      limit: MILESTONE_PAGE_SIZE,
      status: status || undefined,
      signal: controller.signal,
    }, accessToken)
      .then((result) => {
        setMilestones(result.milestones);
        setPagination(result.pagination);
      })
      .catch(handleError)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, handleError, page, projectId, retryKey, status]);

  const addPath = `/projects/${encodeURIComponent(projectId)}/milestones/new`;
  return (
    <section className="milestone-section" aria-labelledby="project-milestones-heading">
      <div className="milestone-section-header">
        <div>
          <h2 id="project-milestones-heading">Milestones</h2>
          <p>Track the key outcomes for this project.</p>
        </div>
        <Link className="primary-link" to={addPath}>Add Milestone</Link>
      </div>

      <div className="list-toolbar milestone-toolbar">
        <div>
          <label htmlFor="milestone-status-filter">Status</label>
          <select
            id="milestone-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {MILESTONE_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="content-state" role="status">Loading milestones...</div>}
      {!loading && error && (
        <div className="content-state error-state" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
            Retry loading milestones
          </button>
        </div>
      )}
      {!loading && !error && milestones.length === 0 && (
        <div className="content-state">
          {status ? (
            <>
              <p>No milestones match the selected status.</p>
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
              <p>This project has no milestones yet.</p>
              <Link className="primary-link" to={addPath}>Add Milestone</Link>
            </>
          )}
        </div>
      )}
      {!loading && !error && milestones.length > 0 && (
        <>
          <div className="client-table-wrap">
            <table className="client-table milestone-table">
              <thead>
                <tr>
                  <th scope="col">Milestone</th>
                  <th scope="col">Status</th>
                  <th scope="col">Due date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Created</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone) => (
                  <tr key={milestone.id}>
                    <td data-label="Milestone" className="milestone-title-cell">{milestone.title}</td>
                    <td data-label="Status">
                      <MilestoneStatusBadge status={milestone.status} />
                    </td>
                    <td data-label="Due date">
                      {milestone.dueDate ? formatDate(milestone.dueDate) : 'No due date'}
                    </td>
                    <td data-label="Description" className="description-cell">
                      {milestone.description || 'No description provided.'}
                    </td>
                    <td data-label="Created">{formatDate(milestone.createdAt)}</td>
                    <td data-label="Action">
                      <Link to={
                        `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestone.id)}`
                      }>
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination" aria-label="Milestone list pagination">
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
