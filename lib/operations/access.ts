import {hasModuleAccess} from "../auth/modules";
export function canManageServiceJobs(user:{isOrganizationAdmin?:boolean;rights?:string[]}|null|undefined){return !!user?.isOrganizationAdmin||(hasModuleAccess(user,"hospitality")&&!!user?.rights?.includes("manage_service_jobs"));}
