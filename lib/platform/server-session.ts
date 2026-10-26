import {cookies} from "next/headers";
import {NextRequest} from "next/server";
import {getAuthenticatedUser,publicUser} from "../auth/serverAuth";
import {cache} from "react";
export const serverUser=cache(async function serverUser() {
 const jar=await cookies();
 const user=await getAuthenticatedUser(new NextRequest("http://localhost/dashboard",{headers:{cookie:jar.toString()}}));
 return user?publicUser(user):null;
});
