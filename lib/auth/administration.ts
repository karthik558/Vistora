import {hasModuleAccess} from "./modules";

type AdministrationUser = { isOrganizationAdmin?: boolean; rights?: string[] } | null | undefined;

export function canOpenTeam(user: AdministrationUser): boolean {
  return !!user?.isOrganizationAdmin || !!user?.rights?.includes("manage_users");
}

export function canOpenSettings(user: AdministrationUser): boolean {
  return user?.isOrganizationAdmin === true;
}

export function canOpenWorkspace(user: AdministrationUser): boolean {
  return user?.isOrganizationAdmin === true;
}

export function canOpenProperties(user: AdministrationUser): boolean {
  return hasModuleAccess(user,"hospitality") && (!!user?.isOrganizationAdmin || !!user?.rights?.includes("manage_properties"));
}

export function isAdministrationPath(path: string): boolean {
  return /^\/dashboard\/(users|settings|properties|workspace|role-mapping)(\/|$)/.test(path);
}
