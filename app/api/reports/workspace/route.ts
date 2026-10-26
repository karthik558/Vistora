import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,number} from "../../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,assertProperty,PlatformError} from "../../../../lib/platform/db";
import {managementReport,reportRows} from "../../../../lib/platform/reports";

// Report access stays independent from workspace administration.
export const GET=withWorkspace(async(request:NextRequest)=>{
 const db=workspaceDb(),user=workspaceUser();
 const days=Math.min(366,Math.max(1,Number(request.nextUrl.searchParams.get("days"))||30));
 const property=request.nextUrl.searchParams.get("property");
 if(property&&property!=="all")await assertProperty(property);
 const properties=checked(await db.from("properties").select("id,name").order("name"));
 const organization=checked(await db.from("organizations").select("name").single());
 const views=checked(await db.from("saved_views").select("*").order("created_at",{ascending:false}));
 const report=managementReport(await reportRows(db,user.organizationId,days,property),days);
 return NextResponse.json({success:true,properties,organization,views,report,isAdmin:false},{headers:{"Cache-Control":"no-store"}});
},"export_reports");

export const POST=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json(),f=b.filters||{},user=workspaceUser();
 if(b.action!=="save_view")throw new PlatformError("Only saved report views can be changed here.",403);
 if(f.property&&f.property!=="all")await assertProperty(f.property);
 const result=checked(await workspaceDb().from("saved_views").insert({
  organization_id:user.organizationId,user_id:user.id,name:text(b.name,"View name",80),
  filters:{property:f.property||"all",days:number(Number(f.days)||30,"Days",1,366),queue:"all"}
 }).select().single());
 return NextResponse.json({success:true,result});
},"export_reports");

export const DELETE=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json();
 if(b.kind!=="view")throw new PlatformError("Only saved report views can be changed here.",403);
 checked(await workspaceDb().from("saved_views").delete().eq("id",b.id).eq("user_id",workspaceUser().id).select("id").single());
 return NextResponse.json({success:true});
},"export_reports");
