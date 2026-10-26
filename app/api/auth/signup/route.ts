import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {errorResponse,email,text} from "../../../../lib/platform/http";
import {PlatformError} from "../../../../lib/platform/db";
export async function POST(request:NextRequest){
 try{
  const b=await request.json();
  if(typeof b.password!=="string"||b.password.length<10)throw new PlatformError("Use a password of at least 10 characters.");
  const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
  const {error}=await auth.auth.signUp({email:email(b.email),password:b.password,options:{data:{full_name:text(b.fullName,"Full name",100)}}});
  if(error)throw new PlatformError(error.message);
  return NextResponse.json({success:true,message:"Check your email to confirm your account, then sign in here to continue."});
 }catch(error){return errorResponse(error);}
}
