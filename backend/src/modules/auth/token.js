import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { USER_ROLE } from '../users/user.constants.js';

const ACCESS_TOKEN_LIFETIME = '15m';
const REFRESH_TOKEN_LIFETIME = '7d';
const TOKEN_ISSUER = 'client-management-portal-api';
const TOKEN_AUDIENCE = 'client-management-portal';
const TOKEN_ALGORITHM = 'HS256';
const TOKEN_INPUT_ERROR_MESSAGE = 'Token must be a non-empty string.';
const IDENTITY_INPUT_ERROR_MESSAGE = 'Token identity must be an object.';
const USER_ID_ERROR_MESSAGE = 'Token identity userId must be a non-empty string.';
const ROLE_ERROR_MESSAGE = 'Token identity role is invalid.';
const TENANT_ID_ERROR_MESSAGE = 'Token identity tenantId is required.';
const SUPER_ADMIN_TENANT_ERROR_MESSAGE = 'Super Admin tokens cannot include tenantId.';

const validRoles = new Set(Object.values(USER_ROLE));

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const validateIdentity = (identity) => {
  if (!isRecord(identity)) {
    throw new TypeError(IDENTITY_INPUT_ERROR_MESSAGE);
  }

  const { userId, role, tenantId } = identity;

  if (typeof userId !== 'string' || userId.length === 0) {
    throw new TypeError(USER_ID_ERROR_MESSAGE);
  }

  if (!validRoles.has(role)) {
    throw new TypeError(ROLE_ERROR_MESSAGE);
  }

  if (role === USER_ROLE.SUPER_ADMIN) {
    if (tenantId !== undefined) {
      throw new TypeError(SUPER_ADMIN_TENANT_ERROR_MESSAGE);
    }
  } else if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new TypeError(TENANT_ID_ERROR_MESSAGE);
  }

  return { userId, role, tenantId };
};

const createPayload = (identity, tokenType) => {
  const { userId, role, tenantId } = validateIdentity(identity);
  const payload = {
    sub: userId,
    role,
    tokenType,
  };

  if (tenantId !== undefined) {
    payload.tenantId = tenantId;
  }

  if (tokenType === 'refresh') {
    payload.jti = randomUUID();
  }

  return payload;
};

const signToken = (identity, tokenType) => {
  const isAccessToken = tokenType === 'access';

  return jwt.sign(
    createPayload(identity, tokenType),
    isAccessToken ? env.jwtAccessSecret : env.jwtRefreshSecret,
    {
      algorithm: TOKEN_ALGORITHM,
      expiresIn: isAccessToken ? ACCESS_TOKEN_LIFETIME : REFRESH_TOKEN_LIFETIME,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
};

const verifyToken = (token, tokenType, secret) => {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError(TOKEN_INPUT_ERROR_MESSAGE);
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: [TOKEN_ALGORITHM],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });

    if (!isRecord(payload) || payload.tokenType !== tokenType) {
      return null;
    }

    const identity = validateIdentity({
      userId: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
    });
    const normalized = {
      userId: identity.userId,
      role: identity.role,
      tokenType,
    };

    if (identity.tenantId !== undefined) {
      normalized.tenantId = identity.tenantId;
    }

    if (tokenType === 'refresh') {
      if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
        return null;
      }
      normalized.jti = payload.jti;
    }

    return Object.freeze(normalized);
  } catch {
    return null;
  }
};

export function createAccessToken(identity) {
  return signToken(identity, 'access');
}

export function createRefreshToken(identity) {
  return signToken(identity, 'refresh');
}

export function verifyAccessToken(token) {
  return verifyToken(token, 'access', env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return verifyToken(token, 'refresh', env.jwtRefreshSecret);
}
