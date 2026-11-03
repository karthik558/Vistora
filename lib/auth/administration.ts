import {hasModuleAccess} from "./modules";

type AdministrationUser = { isOrganizationAdmin?: boolean; rights?: string[] } | null | undefined;

export function canOpenTeam(user: AdministrationUser): boolean {
  return !!user?.isOrganizationAdmin || !!user?.rights?.includes("manage_users") || !!user?.rights?.includes("view_users");
}

export function canOpenSettings(user: AdministrationUser): boolean {
  return user?.isOrganizationAdmin === true || !!user?.rights?.includes("view_settings");
}

export function canOpenWorkspace(user: AdministrationUser): boolean {
  return user?.isOrganizationAdmin === true;
}

export function canOpenReports(user: AdministrationUser): boolean {
  return user?.isOrganizationAdmin === true || !!user?.rights?.includes("export_reports");
}
export function canOpenAuditLog(user: AdministrationUser): boolean {
  return user?.isOrganizationAdmin === true || !!user?.rights?.includes("view_audit_log");
}

export function canOpenProperties(user: AdministrationUser): boolean {
  return hasModuleAccess(user,"hospitality") && (!!user?.isOrganizationAdmin || !!user?.rights?.includes("manage_properties") || !!user?.rights?.includes("view_properties"));
}

export function canOpenRoleMapping(user: AdministrationUser): boolean {
  return !!user?.isOrganizationAdmin || !!user?.rights?.includes("view_role_mapping") || !!user?.rights?.includes("manage_role_mapping");
}

export function isAdministrationPath(path: string): boolean {
  return /^\/dashboard\/(users|settings|properties|workspace|role-mapping|administration)(\/|$)/.test(path);
}
