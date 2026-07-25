import { Invoice } from './invoice.model.js';

export async function createInvoice({
  tenantId,
  projectId,
  invoiceNumber,
  amountCents,
  issueDate,
  dueDate,
  notes,
}) {
  return Invoice.create({
    tenantId,
    projectId,
    invoiceNumber,
    amountCents,
    issueDate,
    dueDate,
    notes,
  });
}

export async function findInvoices({ tenantId, projectId, page, limit, status }) {
  const filter = { tenantId, projectId };
  if (status) filter.status = status;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, total };
}

export async function findInvoiceById({ tenantId, projectId, invoiceId }) {
  return Invoice.findOne({ _id: invoiceId, tenantId, projectId }).lean();
}

export async function updateInvoiceById({ tenantId, projectId, invoiceId, updates }) {
  const setUpdates = {};
  const updateOperation = {};

  for (const field of ['invoiceNumber', 'amountCents', 'issueDate', 'dueDate', 'status']) {
    if (Object.hasOwn(updates, field)) setUpdates[field] = updates[field];
  }
  if (Object.hasOwn(updates, 'notes')) {
    if (updates.notes === undefined) {
      updateOperation.$unset = { notes: 1 };
    } else {
      setUpdates.notes = updates.notes;
    }
  }
  if (Object.keys(setUpdates).length > 0) {
    updateOperation.$set = setUpdates;
  }

  return Invoice.findOneAndUpdate({ _id: invoiceId, tenantId, projectId }, updateOperation, {
    new: true,
    runValidators: true,
  }).lean();
}
