import { ApiError } from '../../core/errors/api-error.js';
import { ORGANIZATION_STATUS } from '../organizations/organization.constants.js';
import { USER_ROLE } from '../users/user.constants.js';
import {
  findOrganizationById,
  findOrganizations,
  findOrganizationUsers,
  getOrganizationUserCounts,
  getPlatformCounts,
  updateOrganizationStatusById,
} from './super-admin.repository.js';

const resolveDependencies = (dependencies = {}) => ({
  findOrganizationById,
  findOrganizations,
  findOrganizationUsers,
  getOrganizationUserCounts,
  getPlatformCounts,
  updateOrganizationStatusById,
  ...dependencies,
});

const notFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'The organization was not found.',
  });

const normalizeCount = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;

const dateValue = (value) => (value instanceof Date ? value.toISOString() : (value ?? null));

const organizationDto = (organization) =>
  Object.freeze({
    id: String(organization._id),
    name: organization.name,
    slug: organization.slug,
    status: organization.status ?? ORGANIZATION_STATUS.ACTIVE,
    createdAt: dateValue(organization.createdAt),
    updatedAt: dateValue(organization.updatedAt),
  });

const userCountsDto = (counts) =>
  Object.freeze({
    total: normalizeCount(counts?.total),
    organizationAdmins: normalizeCount(counts?.roles?.[USER_ROLE.ORGANIZATION_ADMIN]),
    clients: normalizeCount(counts?.roles?.[USER_ROLE.CLIENT]),
  });

const userDto = (user) =>
  Object.freeze({
    id: String(user._id),
    organizationId: String(user.tenantId),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: dateValue(user.createdAt),
    updatedAt: dateValue(user.updatedAt),
  });

const paginationDto = ({ page, limit, total }) =>
  Object.freeze({
    page,
    limit,
    total: normalizeCount(total),
    totalPages: normalizeCount(total) === 0 ? 0 : Math.ceil(normalizeCount(total) / limit),
  });

export async function getSuperAdminOverview(_input, dependencies) {
  const counts = await resolveDependencies(dependencies).getPlatformCounts();
  return Object.freeze({
    organizations: Object.freeze({
      total: normalizeCount(counts?.organizations?.total),
      active: normalizeCount(counts?.organizations?.statuses?.[ORGANIZATION_STATUS.ACTIVE]),
      suspended: normalizeCount(counts?.organizations?.statuses?.[ORGANIZATION_STATUS.SUSPENDED]),
    }),
    users: userCountsDto(counts?.users),
  });
}

export async function listOrganizations(input, dependencies) {
  const result = await resolveDependencies(dependencies).findOrganizations(input);
  return Object.freeze({
    organizations: result.organizations.map(organizationDto),
    pagination: paginationDto({ ...input, total: result.total }),
  });
}

export async function getOrganizationDetails(input, dependencies) {
  const resolved = resolveDependencies(dependencies);
  const organization = await resolved.findOrganizationById(input);
  if (!organization) throw notFound();
  const counts = await resolved.getOrganizationUserCounts(input);
  return Object.freeze({
    ...organizationDto(organization),
    userCounts: userCountsDto(counts),
  });
}

export async function updateOrganizationStatus(input, dependencies) {
  const organization = await resolveDependencies(dependencies).updateOrganizationStatusById(input);
  if (!organization) throw notFound();
  return organizationDto(organization);
}

export async function listOrganizationUsers(input, dependencies) {
  const resolved = resolveDependencies(dependencies);
  if (!(await resolved.findOrganizationById({ organizationId: input.organizationId }))) {
    throw notFound();
  }
  const result = await resolved.findOrganizationUsers(input);
  return Object.freeze({
    users: result.users.filter((user) => user.role !== USER_ROLE.SUPER_ADMIN).map(userDto),
    pagination: paginationDto({ ...input, total: result.total }),
  });
}
