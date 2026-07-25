import { Link } from 'react-router';
import { DashboardSummaryCard } from './dashboard-summary-card.jsx';

export function DashboardSection({ id, title, total, counts, action }) {
  return (
    <section className="dashboard-section" aria-labelledby={id}>
      <div className="dashboard-section-header">
        <h2 id={id}>{title}</h2>
        {action && <Link to={action.to}>{action.label}</Link>}
      </div>
      <dl className="dashboard-summary-grid">
        <DashboardSummaryCard label="Total" count={total} />
        {counts.map(({ label, count }) => (
          <DashboardSummaryCard key={label} label={label} count={count} />
        ))}
      </dl>
    </section>
  );
}
