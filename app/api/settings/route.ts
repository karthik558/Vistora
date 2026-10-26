import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email,number} from "../../../lib/platform/http";
import {getApplicationSettings,updateApplicationSettings,getPropertySetting,getAllPropertySettings,updatePropertySetting} from "../../../lib/services/settingsService";
import {assertProperty,PlatformError,workspaceUser} from "../../../lib/platform/db";
import {validateHospitality} from "../../../lib/hospitality/config";
export const GET=withWorkspace(async(request:NextRequest)=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);
 const propertyId=request.nextUrl.searchParams.get("propertyId");
 return NextResponse.json({success:true,appSettings:await getApplicationSettings(),...(propertyId?{propertySetting:await getPropertySetting(propertyId)}:{propertySettings:await getAllPropertySettings()})});
},"manage_settings");
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);
 const b=await request.json();
 if(b.type==="application"){
   const p=b.appSettings||{},patch:Record<string,unknown>={};
   for(const k of ["organizationName","projectName","brandTagline","defaultTimezone"])if(p[k]!==undefined)patch[k]=text(p[k],k,200);
   if(p.defaultTimezone)try{new Intl.DateTimeFormat("en",{timeZone:p.defaultTimezone});}catch{throw new PlatformError("Enter a valid IANA timezone.");}
   for(const k of ["slaCriticalMinutes","slaStandardMinutes"])if(p[k]!==undefined)patch[k]=number(p[k],k,1,10080);
   if(p.dataRetentionDays!==undefined)patch.dataRetentionDays=number(p.dataRetentionDays,"Retention",30,3650);
   if(p.alertEmail!==undefined)patch.alertEmail=p.alertEmail?email(p.alertEmail):"";
   if(p.autoGuestFollowUp!==undefined){if(typeof p.autoGuestFollowUp!=="boolean")throw new PlatformError("Invalid follow-up setting.");patch.autoGuestFollowUp=p.autoGuestFollowUp;}
   if(p.hospitality!==undefined)try{patch.hospitality=validateHospitality(p.hospitality);}catch(error){throw new PlatformError((error as Error).message);}
   if(p.logoUrl!==undefined){const url=text(p.logoUrl,"Logo URL",1000,false);if(url&&!/^https:\/\/[^\s]+$/.test(url))throw new PlatformError("Use an HTTPS logo URL.");patch.logoUrl=url;}
   if(p.guestWelcomeMessage!==undefined)patch.guestWelcomeMessage=text(p.guestWelcomeMessage,"Welcome message",160,false);
   return NextResponse.json({success:true,appSettings:await updateApplicationSettings(patch)});
 }
 if(b.type==="property"){
  await assertProperty(b.propertyId);const p=b.propertySetting||{},patch:Record<string,unknown>={};
  for(const k of ["propertyName","propertyCode","brand","location","contactPhone","welcomeMessage"])if(p[k]!==undefined)patch[k]=text(p[k],k,k==="welcomeMessage"?500:200,false);
  if(p.contactEmail!==undefined)patch.contactEmail=p.contactEmail?email(p.contactEmail):"";
  if(p.totalRooms!==undefined)patch.totalRooms=number(p.totalRooms,"Rooms",1,100000);
  if(p.isActive!==undefined)patch.isActive=p.isActive===true;
  return NextResponse.json({success:true,propertySetting:await updatePropertySetting(b.propertyId,patch)});
 }
 throw new PlatformError("Invalid settings type.");
},"manage_settings");
