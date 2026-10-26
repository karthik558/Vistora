import {NextRequest,NextResponse} from "next/server";
import {checked,serviceDb,sessionDb,PlatformError} from "../../../lib/platform/db";
import {errorResponse,text} from "../../../lib/platform/http";
import {hashToken} from "../../../lib/platform/secrets";
export async function POST(request:NextRequest) {
 try {
  const b=await request.json(),token=request.cookies.get("sb-access-token")?.value||request.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!token)throw new PlatformError("Sign in first.",401);
  const {data,error}=await sessionDb(token).auth.getUser(token);if(error||!data.user)throw new PlatformError("Sign in first.",401);
  let organizationId:string;
  if(b.invitation) organizationId=checked(await serviceDb().rpc("accept_team_invitation",{p_user:data.user.id,p_hash:hashToken(text(b.invitation,"Invitation",100))}));
  else {
   const slug=text(b.slug,"Workspace address",60).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new PlatformError("Use lowercase letters, numbers and hyphens for the workspace address.");
   organizationId=checked(await serviceDb().rpc("create_company",{p_user:data.user.id,p_name:text(b.name,"Company name",100),p_slug:slug}));
  }
  return NextResponse.json({success:true,organizationId});
 }catch(error){return errorResponse(error);}
}
