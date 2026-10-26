import {lookup} from "node:dns/promises";
import {BlockList,isIP} from "node:net";
import https from "node:https";
import {createHmac} from "node:crypto";
import {PlatformError} from "./db";
const blocked=new BlockList();
for(const [ip,prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.168.0.0",16],["198.18.0.0",15],["224.0.0.0",4],["240.0.0.0",4]] as const)blocked.addSubnet(ip,prefix,"ipv4");
blocked.addSubnet("::",128,"ipv6");blocked.addSubnet("::1",128,"ipv6");blocked.addSubnet("fc00::",7,"ipv6");blocked.addSubnet("fe80::",10,"ipv6");blocked.addSubnet("ff00::",8,"ipv6");blocked.addSubnet("2001:db8::",32,"ipv6");
export async function validateDestination(input:string) {
 const url=new URL(input);
 if(url.protocol!=="https:"||url.username||url.password||url.hash||(url.port&&url.port!=="443"))throw new PlatformError("Use a public HTTPS endpoint on port 443.");
 const hostname=url.hostname.replace(/^\[|\]$/g,"");
 const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});
 if(!addresses.length||addresses.some(a=>(a.family===6&&a.address.toLowerCase().includes("::ffff:"))||blocked.check(a.address,a.family===6?"ipv6":"ipv4")))throw new PlatformError("Endpoint must resolve to a public internet address.");
 return {url,address:addresses[0]};
}
export async function sendSigned(url:string,payload:unknown,secret:string,id:string) {
 const target=await validateDestination(url),body=JSON.stringify(payload),timestamp=Math.floor(Date.now()/1000).toString();
 const signature=createHmac("sha256",secret).update(timestamp+"."+body).digest("hex");
 return await new Promise<number>((resolve,reject)=>{
  const req=https.request(target.url,{method:"POST",family:target.address.family,headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),"X-Vistora-Timestamp":timestamp,"X-Vistora-Signature":"v1="+signature,"Idempotency-Key":id},lookup:((_host:any,options:any,callback:any)=>options.all?callback(null,[target.address]):callback(null,target.address.address,target.address.family)) as any},res=>{res.resume();resolve(res.statusCode||500);});
  req.setTimeout(10000,()=>req.destroy(new Error("Delivery timed out.")));req.on("error",reject);req.end(body);
 });
}
