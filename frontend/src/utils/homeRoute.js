/**
 * First route available to the user, based on role and organization services.
 * @param {Object|null} user
 * @param {Object} services - normalized services
 * @returns {string}
 */
export const getHomeRoute = (user, services) => {
  if (!user) return '/login';
  if (user.role === 'superadmin') return '/superadmin';
  if (services?.sanctions) return '/dashboard';
  return '/settings';
};

export default getHomeRoute;
