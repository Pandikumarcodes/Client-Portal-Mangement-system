import { Client } from '../clients/client.model.js';
import { CLIENT_STATUS } from '../clients/client.constants.js';
import { Invoice } from '../invoices/invoice.model.js';
import { INVOICE_STATUS } from '../invoices/invoice.constants.js';
import { ProjectFile } from '../project-files/project-file.model.js';
import { PROJECT_FILE_STATUS } from '../project-files/project-file.constants.js';
import { Project } from '../projects/project.model.js';
import { PROJECT_STATUS } from '../projects/project.constants.js';

const requireTenantId = (tenantId) => {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new TypeError('A trusted tenant context is required.');
  }
};

const countByStatus = async (Model, tenantId, statuses) => {
  const [total, ...statusCounts] = await Promise.all([
    Model.countDocuments({ tenantId }),
    ...statuses.map((status) => Model.countDocuments({ tenantId, status })),
  ]);

  return {
    total,
    statuses: Object.fromEntries(statuses.map((status, index) => [status, statusCounts[index]])),
  };
};

export async function getOrganizationDashboardCounts({ tenantId }) {
  requireTenantId(tenantId);

  const [clients, projects, files, invoices] = await Promise.all([
    countByStatus(Client, tenantId, Object.values(CLIENT_STATUS)),
    countByStatus(Project, tenantId, Object.values(PROJECT_STATUS)),
    countByStatus(ProjectFile, tenantId, Object.values(PROJECT_FILE_STATUS)),
    countByStatus(Invoice, tenantId, Object.values(INVOICE_STATUS)),
  ]);

  return { clients, projects, milestones: { total: 0, statuses: {} }, files, invoices };
}
