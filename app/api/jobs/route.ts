import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {runWorker} from "../../../lib/platform/worker";
import {withWorkspace,errorResponse} from "../../../lib/platform/http";
import {workspaceUser,PlatformError} from "../../../lib/platform/db";
export const runtime="nodejs";
export const maxDuration=60;
const manual=withWorkspace(async(_request:NextRequest)=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);
 return NextResponse.json({success:true,results:await runWorker(workspaceUser().organizationId)});
});
export async function POST(request:NextRequest) {
 const expected=process.env.WORKSPACE_CRON_SECRET,actual=request.headers.get("authorization")?.replace(/^Bearer /,"");
 if(expected&&actual&&Buffer.byteLength(expected)===Buffer.byteLength(actual)&&timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) {
  try{return NextResponse.json({success:true,results:await runWorker()});}catch(error){return errorResponse(error);}
 }
 return manual(request);
}
