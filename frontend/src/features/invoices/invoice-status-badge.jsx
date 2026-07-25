import { INVOICE_STATUS_LABELS } from './invoice.constants.js';

export function InvoiceStatusBadge({ status }) {
  return (
    <span className={`status-badge status-invoice-${status}`}>
      {INVOICE_STATUS_LABELS[status] ?? 'Status unavailable'}
    </span>
  );
}
