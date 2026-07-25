import {
  createProjectInvoice,
  getProjectInvoice,
  listProjectInvoices,
  updateProjectInvoice,
} from './invoice.service.js';

const resolveDependencies = (dependencies = {}) => ({
  createProjectInvoice,
  listProjectInvoices,
  getProjectInvoice,
  updateProjectInvoice,
  ...dependencies,
});

export function createInvoiceController(dependencies) {
  const service = resolveDependencies(dependencies);
  const create = async (request, response) => {
    const body = request.validated.body;
    const invoice = await service.createProjectInvoice({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      invoiceNumber: body.invoiceNumber,
      amountCents: body.amountCents,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      notes: body.notes,
    });
    return response.status(201).json({ success: true, data: { invoice } });
  };
  const list = async (request, response) => {
    const result = await service.listProjectInvoices({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      page: request.validated.query.page,
      limit: request.validated.query.limit,
      status: request.validated.query.status,
    });
    return response.status(200).json({
      success: true,
      data: {
        invoices: result.invoices,
        pagination: result.pagination,
      },
    });
  };
  const getById = async (request, response) => {
    const invoice = await service.getProjectInvoice({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      invoiceId: request.validated.params.invoiceId,
    });
    return response.status(200).json({ success: true, data: { invoice } });
  };
  const update = async (request, response) => {
    const invoice = await service.updateProjectInvoice({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      invoiceId: request.validated.params.invoiceId,
      updates: request.validated.body,
    });
    return response.status(200).json({ success: true, data: { invoice } });
  };

  return Object.freeze({ create, list, getById, update });
}
