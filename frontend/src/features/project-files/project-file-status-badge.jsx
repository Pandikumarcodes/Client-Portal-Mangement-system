import { PROJECT_FILE_STATUS_LABELS } from './project-file.constants.js';

export function ProjectFileStatusBadge({ status }) {
  return (
    <span className={`status-badge status-project-file-${status}`}>
      {PROJECT_FILE_STATUS_LABELS[status] ?? 'Status unavailable'}
    </span>
  );
}
