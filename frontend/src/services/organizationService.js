import api from './api';

/**
 * SuperAdmin organization management API
 */

/**
 * List organizations with services and user counts
 * @param {{ search?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ data: Object[], meta: { page, limit, total, totalPages } }>}
 */
export const listOrganizations = ({ search, page, limit } = {}) => {
  const params = {};
  if (search) params.search = search;
  if (page) params.page = page;
  if (limit) params.limit = limit;

  return api.get('/auth/organizations', { params }).then((response) => response.data);
};

/**
 * Get organization details
 * @param {string} id
 */
export const getOrganization = (id) => {
  return api.get(`/auth/organizations/${encodeURIComponent(id)}`).then((response) => response.data);
};

/**
 * Replace organization service package
 * @param {string} id
 * @param {{ sanctions: boolean, identityMode: string }} services
 */
export const updateOrganizationServices = (id, services) => {
  return api
    .put(`/auth/organizations/${encodeURIComponent(id)}/services`, {
      sanctions: services.sanctions,
      identityMode: services.identityMode,
    })
    .then((response) => response.data);
};
