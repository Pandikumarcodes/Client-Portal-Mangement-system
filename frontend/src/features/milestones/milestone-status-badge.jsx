import { MILESTONE_STATUS_LABELS } from './milestone.constants.js';

export function MilestoneStatusBadge({ status }) {
  return (
    <span className={`status-badge status-milestone-${status}`}>
      {MILESTONE_STATUS_LABELS[status] ?? 'Status unavailable'}
    </span>
  );
}
