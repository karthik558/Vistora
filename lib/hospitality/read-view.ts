import {NextRequest,NextResponse} from "next/server";
import {checked,PlatformError,workspaceDb,workspaceUser} from "../platform/db";

// A module grant gives staff a property-scoped read view. Financials and writes stay admin-only.
export async function hotelReadView(request:NextRequest){
 const db=workspaceDb(),user=workspaceUser();
 const access=await db.rpc("workspace_module",{module:"hospitality"});
 if(access.error?.code==="PGRST202"||access.error?.code==="42883")throw new PlatformError("Module access setup is pending. Apply section 25 in supabase/schema.sql.",503);
 if(!checked(access))throw new PlatformError("Hotel operations module access required.",403);
 if(request.nextUrl.searchParams.has("stayLink"))throw new PlatformError("Feedback link access requires a company administrator.",403);
 const property=request.nextUrl.searchParams.get("property")||"all",view=request.nextUrl.searchParams.get("jobs")||"active";
 if(!["active","closed"].includes(view))throw new PlatformError("Choose a valid job view.");
 const scoped=(query:any)=>property==="all"?query:query.eq("property_id",property);
 if(property!=="all")checked(await db.from("properties").select("id").eq("id",property).single());
 const [properties,rooms,stays,jobs,inspections,counts]=await Promise.all([
  db.from("properties").select("id,name,is_active").order("name"),
  scoped(db.from("hotel_rooms").select("*").order("room_number").limit(200)),
  scoped(db.from("stays").select("id,property_id,guest_id,room_id,room_number,guest_count,check_in_date,check_out_date,status,guests(full_name)").not("room_id","is",null).order("created_at",{ascending:false}).limit(100)),
  scoped(db.from("service_jobs").select("*,assignee:profiles!assigned_to(full_name)").in("status",view==="active"?["open","in_progress"]:["completed","cancelled"]).order("due_at",{ascending:view==="active"}).limit(100)),
  scoped(db.from("room_inspections").select("*").order("created_at",{ascending:false}).limit(100)),
  Promise.all([
   scoped(db.from("hotel_rooms").select("id",{count:"exact",head:true})),
   scoped(db.from("stays").select("id",{count:"exact",head:true}).eq("status","active")),
   scoped(db.from("hotel_rooms").select("id",{count:"exact",head:true}).in("status",["dirty","out_of_service"])),
   scoped(db.from("service_jobs").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]))
  ])
 ]);
 counts.forEach(result=>{checked({data:true,error:result.error});if(result.count===null)throw new PlatformError("Could not load hotel counts.",503);});
 const visibleStays=checked(stays) as any[],guestIds=[...new Set(visibleStays.map((stay:any)=>stay.guest_id))];
 const guests=user.rights.includes("view_guest_pii")&&guestIds.length?checked(await db.from("guests").select("id,full_name,email,phone,vip_tier,preferences,created_at").in("id",guestIds).order("created_at",{ascending:false}).limit(100)):[];
 const search=(request.nextUrl.searchParams.get("search")||"").trim().toLowerCase().slice(0,100);
 return NextResponse.json({success:true,canManage:false,properties:checked(properties),rooms:checked(rooms),stays:visibleStays,jobs:checked(jobs),inspections:checked(inspections),guests:guests.filter(guest=>!search||guest.full_name.toLowerCase().includes(search)),costs:[],activity:[],budget:null,team:[],feedback:[],metrics:{guests:null,pendingCosts:null,...Object.fromEntries(["rooms","inHouse","roomsNeedService","openJobs"].map((key,i)=>[key,counts[i].count]))}},{headers:{"Cache-Control":"private, no-store"}});
}
