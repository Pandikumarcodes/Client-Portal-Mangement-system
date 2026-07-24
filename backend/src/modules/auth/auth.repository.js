import mongoose from 'mongoose';

import { Organization } from '../organizations/organization.model.js';
import { USER_ROLE, USER_STATUS } from '../users/user.constants.js';
import { User } from '../users/user.model.js';

const toSafeUser = (user) => ({
  _id: user._id,
  tenantId: user.tenantId,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  status: user.status,
});

export async function createOrganizationAdminAccount(input) {
  const session = await mongoose.startSession();
  let organization;
  let user;

  try {
    await session.withTransaction(async () => {
      [organization] = await Organization.create([input.organization], { session });
      [user] = await User.create(
        [
          {
            ...input.user,
            role: USER_ROLE.ORGANIZATION_ADMIN,
            status: USER_STATUS.ACTIVE,
            tenantId: organization._id,
          },
        ],
        { session },
      );
    });

    return { organization, user: toSafeUser(user) };
  } finally {
    await session.endSession();
  }
}

export async function findUserForAuthentication(email) {
  return User.findOne({ email }).select('+passwordHash');
}

export async function findUserByIdForAuthentication(userId) {
  return User.findById(userId);
}

export async function findOrganizationById(tenantId) {
  return Organization.findById(tenantId);
}
