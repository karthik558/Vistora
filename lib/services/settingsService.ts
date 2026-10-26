import { checked, workspaceDb, workspaceUser } from "../platform/db";
export interface ApplicationSettings {
  organizationName: string; projectName: string; brandTagline: string;
  slaCriticalMinutes: number; slaStandardMinutes: number; autoGuestFollowUp: boolean;
  alertEmail: string; defaultTimezone: string; dataRetentionDays: number;
}
export interface PropertySettingConfig {
  propertyId: string; propertyName: string; propertyCode: string; brand: string; isActive: boolean;
  totalRooms: number; location: string; contactEmail: string; contactPhone: string; welcomeMessage: string;
}
const defaults: ApplicationSettings = { organizationName:"",projectName:"Vistora",brandTagline:"Guest experience operations",slaCriticalMinutes:15,slaStandardMinutes:120,autoGuestFollowUp:true,alertEmail:"",defaultTimezone:"Asia/Kolkata",dataRetentionDays:365 };
export async function getApplicationSettings(): Promise<ApplicationSettings> {
  const db=workspaceDb(), org=workspaceUser().organizationId;
  const organization=checked(await db.from("organizations").select("name,timezone").eq("id",org).single());
  const rows=checked(await db.from("organization_settings").select("settings").eq("organization_id",org));
  return {...defaults,...(rows[0]?.settings || {}),organizationName:organization.name,defaultTimezone:organization.timezone};
}
export async function updateApplicationSettings(patch: Partial<ApplicationSettings>) {
  const next={...await getApplicationSettings(),...patch};
  checked(await workspaceDb().from("organizations").update({name:next.organizationName,timezone:next.defaultTimezone}).eq("id",workspaceUser().organizationId).select("id").single());
  checked(await workspaceDb().from("organization_settings").upsert({organization_id:workspaceUser().organizationId,settings:next,updated_at:new Date().toISOString()}).select().single());
  return next;
}
export async function getAllPropertySettings(): Promise<PropertySettingConfig[]> {
  const db=workspaceDb();
  const [properties,settings]=await Promise.all([db.from("properties").select("*"),db.from("property_settings").select("*")]);
  return checked(properties).map((p:any)=>({
    propertyId:p.id,propertyName:p.name,propertyCode:p.code,brand:p.brand,isActive:p.is_active,totalRooms:p.total_rooms,
    location:p.location,contactEmail:"",contactPhone:"",welcomeMessage:"Tell us about your stay.",
    ...(checked(settings).find((s:any)=>s.property_id===p.id)?.settings || {})
  }));
}
export async function getPropertySetting(propertyId:string) {
  return (await getAllPropertySettings()).find(p=>p.propertyId===propertyId)||null;
}
export async function updatePropertySetting(propertyId:string,patch:Partial<PropertySettingConfig>) {
  const existing=await getPropertySetting(propertyId);
  if(!existing) throw new Error("Property not found or access denied.");
  const next={...existing,...patch,propertyId};
  checked(await workspaceDb().from("property_settings").upsert({property_id:propertyId,organization_id:workspaceUser().organizationId,settings:next,updated_at:new Date().toISOString()}).select().single());
  return next;
}
