import { apiRequest } from '../../core/api/api-client.js';

export async function registerAccount(input) {
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      organizationName: input.organizationName,
      organizationSlug: input.organizationSlug,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password,
    },
  });
  return result.data;
}

export async function loginAccount(input) {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: input.email, password: input.password },
  });
  return result.data;
}
