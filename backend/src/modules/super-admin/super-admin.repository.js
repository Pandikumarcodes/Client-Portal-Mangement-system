import { Organization } from '../organizations/organization.model.js';
import { ORGANIZATION_STATUS } from '../organizations/organization.constants.js';
import { User } from '../users/user.model.js';
import { USER_ROLE } from '../users/user.constants.js';

const organizationFields = '_id name slug status createdAt updatedAt';
const userFields = '_id tenantId firstName lastName email role status createdAt updatedAt';

const organizationStatusFilter = (status) => {
  if (status === ORGANIZATION_STATUS.ACTIVE) {
    return { status: { $ne: ORGANIZATION_STATUS.SUSPENDED } };
  }
  return status ? { status } : {};
};

export async function getPlatformCounts() {
  const [
    organizationTotal,
    activeOrganizations,
    suspendedOrganizations,
    organizationAdmins,
    clients,
  ] = await Promise.all([
    Organization.countDocuments({}),
    Organization.countDocuments({ status: { $ne: ORGANIZATION_STATUS.SUSPENDED } }),
    Organization.countDocuments({ status: ORGANIZATION_STATUS.SUSPENDED }),
    User.countDocuments({ role: USER_ROLE.ORGANIZATION_ADMIN }),
    User.countDocuments({ role: USER_ROLE.CLIENT }),
  ]);

  return {
    organizations: {
      total: organizationTotal,
      statuses: {
        [ORGANIZATION_STATUS.ACTIVE]: activeOrganizations,
        [ORGANIZATION_STATUS.SUSPENDED]: suspendedOrganizations,
      },
    },
    users: {
      total: organizationAdmins + clients,
      roles: {
        [USER_ROLE.ORGANIZATION_ADMIN]: organizationAdmins,
        [USER_ROLE.CLIENT]: clients,
      },
    },
  };
}

export async function findOrganizations({ page, limit, status }) {
  const filter = organizationStatusFilter(status);
  const [organizations, total] = await Promise.all([
    Organization.find(filter)
      .select(organizationFields)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Organization.countDocuments(filter),
  ]);
  return { organizations, total };
}

export async function findOrganizationById({ organizationId }) {
  return Organization.findOne({ _id: organizationId }).select(organizationFields).lean();
}

export async function updateOrganizationStatusById({ organizationId, status }) {
  return Organization.findOneAndUpdate(
    { _id: organizationId },
    { status },
    { new: true, runValidators: true },
  )
    .select(organizationFields)
    .lean();
}

export async function getOrganizationUserCounts({ organizationId }) {
  const [organizationAdmins, clients] = await Promise.all([
    User.countDocuments({ tenantId: organizationId, role: USER_ROLE.ORGANIZATION_ADMIN }),
    User.countDocuments({ tenantId: organizationId, role: USER_ROLE.CLIENT }),
  ]);
  return {
    total: organizationAdmins + clients,
    roles: {
      [USER_ROLE.ORGANIZATION_ADMIN]: organizationAdmins,
      [USER_ROLE.CLIENT]: clients,
    },
  };
}

export async function findOrganizationUsers({ organizationId, page, limit, role, status }) {
  const filter = {
    tenantId: organizationId,
    role: role ?? { $ne: USER_ROLE.SUPER_ADMIN },
  };
  if (status) filter.status = status;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(userFields)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { users, total };
}
