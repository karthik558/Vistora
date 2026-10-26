export type WorkspaceModule="feedback"|"hospitality";
export const MODULE_ACCESS_MARKER="module_access:configured";
export const FEEDBACK_RIGHTS=["view_feedback","manage_complaints","reassign_property","manage_questionnaire","export_reports","view_audit_log"];
type Member={isOrganizationAdmin?:boolean;rights?:string[]};
export function hasModuleAccess(user:Member|null|undefined,module:WorkspaceModule):boolean{
 if(user?.isOrganizationAdmin)return true;
 const rights=user?.rights||[];
 if(rights.includes("module:"+module))return true;
 if(rights.includes(MODULE_ACCESS_MARKER)||module==="hospitality")return false;
 return rights.some(right=>FEEDBACK_RIGHTS.includes(right));
}
export function withModuleAssignments(rights:string[]):string[]{
 if(rights.includes(MODULE_ACCESS_MARKER))return [...new Set(rights)];
 return [...new Set([...rights,MODULE_ACCESS_MARKER,...(hasModuleAccess({rights},"feedback")?["module:feedback"]:[])])];
}
export function effectiveModuleRights(rights:string[],admin:boolean):string[]{
 return hasModuleAccess({rights,isOrganizationAdmin:admin},"feedback")?rights:rights.filter(right=>!FEEDBACK_RIGHTS.includes(right));
}
