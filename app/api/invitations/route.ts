import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email} from "../../../lib/platform/http";
import {PlatformError} from "../../../lib/platform/db";
import {listInvitations,createInvitation,deleteInvitation} from "../../../lib/services/invitationsService";
import {logAuditEvent} from "../../../lib/services/auditLogService";
export const GET=withWorkspace(async(request:NextRequest)=>NextResponse.json({success:true,invitations:await listInvitations(request.nextUrl.searchParams.get("propertyId")||undefined)}),"manage_questionnaire");
export const POST=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json(),channel=b.channel||"direct_link";
 if(!["direct_link","email","sms","whatsapp"].includes(channel))throw new PlatformError("Invalid delivery channel.");
 if(channel==="email"&&!b.guestEmail)throw new PlatformError("Enter the guest email for email delivery.");
 if(["sms","whatsapp"].includes(channel)&&!b.guestPhone)throw new PlatformError("Enter the guest phone number for this channel.");
 const invitation=await createInvitation({guestName:text(b.guestName,"Guest name",100),guestEmail:b.guestEmail?email(b.guestEmail):undefined,guestPhone:text(b.guestPhone,"Phone",30,false),propertyId:text(b.propertyId,"Property",50),roomNumber:text(b.roomNumber,"Room",50),channel,notes:text(b.notes,"Notes",1000,false)});
 await logAuditEvent({actorName:"",actorEmail:"",actorRole:"",action:"Guest invitation created",resource:invitation.id});
 return NextResponse.json({success:true,invitation,message:channel==="direct_link"?"Invitation link created.":"Invitation saved and delivery queued."},{status:201});
},"manage_questionnaire");
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 await deleteInvitation(text(request.nextUrl.searchParams.get("id"),"Invitation ID",50));return NextResponse.json({success:true});
},"manage_questionnaire");
