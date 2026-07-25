import { PROJECT_STATUS_LABELS } from './project.constants.js';

export function ProjectStatusBadge({ status }) {
  return (
    <span className={`status-badge status-project-${status}`}>
      {getProjectStatusLabel(status)}
    </span>
  );
}

function getProjectStatusLabel(status) {
  return PROJECT_STATUS_LABELS[status] ?? 'Status unavailable';
}
