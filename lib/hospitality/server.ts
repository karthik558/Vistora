import {cache} from "react";
import {serviceDb} from "../platform/db";
import {hospitalityConfig,DEFAULT_HOSPITALITY} from "./config";
// Only public appearance/module preferences cross into the client layout.
export const companyAppearance=cache(async(organizationId:string)=>{
 const {data,error}=await serviceDb().from("organization_settings").select("settings").eq("organization_id",organizationId).maybeSingle();
 if(error)throw new Error(error.message);
 const config=hospitalityConfig(data?.settings?.hospitality);
 return {...DEFAULT_HOSPITALITY,colors:config.colors,modules:config.modules};
});
