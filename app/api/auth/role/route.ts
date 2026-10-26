import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({success:false,error:"Role switching is disabled. Workspace administrators manage roles through Team & users."},{status:403});
}
