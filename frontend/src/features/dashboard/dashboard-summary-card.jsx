export function DashboardSummaryCard({ label, count }) {
  const safeCount = Number.isInteger(count) && count >= 0 ? count : 0;

  return (
    <div className="dashboard-summary-card">
      <dt>{label}</dt>
      <dd>{safeCount.toLocaleString()}</dd>
    </div>
  );
}
