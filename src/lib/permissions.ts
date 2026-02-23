export const hasRole = (
  userRoles: string[],
  allowedRoles: string[]
) => {
  if (!userRoles || userRoles.length === 0) return false;

  // Admin override
  if (userRoles.includes("admin")) return true;

  return allowedRoles.some((role) =>
    userRoles.includes(role)
  );
};