import { hasModuleAccess } from "../auth/modules";
export function canManageServiceJobs(
  user: { isOrganizationAdmin?: boolean; rights?: string[] } | null | undefined,
) {
  return (
    !!user?.isOrganizationAdmin ||
    (hasModuleAccess(user, "hospitality") &&
      !!user?.rights?.includes("manage_service_jobs"))
  );
}
export function canOperateDepartment(
  user: { isOrganizationAdmin?: boolean; rights?: string[] } | null | undefined,
  department: string,
) {
  if (user?.isOrganizationAdmin) return true;
  if (!canManageServiceJobs(user)) return false;
  const scopes = (user?.rights || []).filter((right) =>
    right.startsWith("dept_scope:"),
  );
  return (
    !scopes.length ||
    scopes.includes("dept_scope:*") ||
    scopes.includes("dept_scope:All Departments") ||
    scopes.includes("dept_scope:" + department)
  );
}
