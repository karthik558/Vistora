export const MODULES = ["feedback","guests","property","operations","compliance","administration"] as const;
export type ModuleName = typeof MODULES[number];
export interface HospitalityConfig {
 colors:Record<ModuleName,string>;
 modules:{guests:boolean;property:boolean;operations:boolean;compliance:boolean};
 currency:string;
 monthlyBudgetMinor:number;
 perExpenseLimitMinor:number;
 approvalThresholdMinor:number;
 taskResponseMinutes:number;
 callRateMinor:number;
 requireInspection:boolean;
 alertsEnabled:boolean;
 inspectionChecklist:string[];
}
export const DEFAULT_HOSPITALITY:HospitalityConfig={
 colors:{feedback:"#3e6b51",guests:"#294f7c",property:"#243d6a",operations:"#4c617e",compliance:"#78634d",administration:"#5f6672"},
 modules:{guests:true,property:true,operations:true,compliance:true},
 currency:"INR",monthlyBudgetMinor:0,perExpenseLimitMinor:0,approvalThresholdMinor:0,
 taskResponseMinutes:120,callRateMinor:0,requireInspection:true,alertsEnabled:false,
 inspectionChecklist:["Room cleaned and linen replaced","Bathroom and amenities checked","Safety equipment checked","Maintenance issues cleared"]
};
export function hospitalityConfig(value:any):HospitalityConfig {
 return {...DEFAULT_HOSPITALITY,...value,colors:{...DEFAULT_HOSPITALITY.colors,...value?.colors},modules:{...DEFAULT_HOSPITALITY.modules,...value?.modules},inspectionChecklist:Array.isArray(value?.inspectionChecklist)?value.inspectionChecklist:DEFAULT_HOSPITALITY.inspectionChecklist};
}
export function validateHospitality(value:any):HospitalityConfig {
 const config=hospitalityConfig(value);
 for(const module of MODULES)if(!/^#[0-9a-f]{6}$/i.test(config.colors[module]))throw new Error("Use a six-digit hex color for "+module+".");
 for(const enabled of Object.values(config.modules))if(typeof enabled!=="boolean")throw new Error("Module switches must be enabled or disabled.");
 if(!["INR","USD","EUR","GBP","AED","THB"].includes(config.currency))throw new Error("Choose a supported currency.");
 for(const field of ["monthlyBudgetMinor","perExpenseLimitMinor","approvalThresholdMinor"] as const)if(!Number.isSafeInteger(config[field])||config[field]<0||config[field]>1e12)throw new Error("Budget limits must be non-negative amounts below 10 billion.");
 if(!Number.isInteger(config.callRateMinor)||config.callRateMinor<0||config.callRateMinor>100000)throw new Error("Call rate must be 0–100,000 minor currency units per minute.");
 if(!Number.isInteger(config.taskResponseMinutes)||config.taskResponseMinutes<1||config.taskResponseMinutes>10080)throw new Error("Response target must be 1–10,080 minutes.");
 if(typeof config.requireInspection!=="boolean")throw new Error("Invalid inspection requirement.");
 if(typeof config.alertsEnabled!=="boolean")throw new Error("Invalid overdue alert setting.");
 if(!Array.isArray(config.inspectionChecklist)||config.inspectionChecklist.length<1||config.inspectionChecklist.length>30||config.inspectionChecklist.some(x=>typeof x!=="string"||!x.trim()||x.length>160)||new Set(config.inspectionChecklist.map(x=>x.trim())).size!==config.inspectionChecklist.length)throw new Error("Use 1–30 unique inspection checks, at most 160 characters each.");
 config.inspectionChecklist=config.inspectionChecklist.map(x=>x.trim());
 return config;
}
export function moneyToMinor(value:unknown):number {
 const input=String(value??"").trim();
 if(!/^\d{1,10}(\.\d{1,2})?$/.test(input))throw new Error("Enter a non-negative amount with at most two decimal places.");
 const [whole,fraction=""]=input.split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}
export function money(minor:number,currency:string) {
 return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(minor/100);
}
export function moduleForPath(path:string):ModuleName {
 if(path.includes("/directory"))return "guests";
 if(path.includes("/properties"))return "property";
 if(path.includes("/audit-log"))return "compliance";
 if(path.includes("/hospitality")||path.includes("/reports"))return "operations";
 if(/\/(settings|users|workspace)/.test(path))return "administration";
 return "feedback";
}
export function workspaceForPath(path:string,selected:string|null=null):"feedback"|"operations" {
 return /^\/dashboard\/(hospitality|properties)(\/|$)/.test(path)||selected==="operations"?"operations":"feedback";
}
export function sidebarTokens(hex:string,dark:boolean):Record<string,string>{
 return {"--workspace-sidebar":mix(hex,dark?"#10151d":"#111923",.65),"--workspace-sidebar-marker":mix(hex,"#ffffff",.55)};
}
function mix(a:string,b:string,weight:number){
 const color=(x:string)=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
 const first=color(a),second=color(b);
 return "#"+first.map((x,i)=>Math.round(x*(1-weight)+second[i]*weight).toString(16).padStart(2,"0")).join("");
}
export function contrastRatio(a:string,b:string){
 const luminance=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
 const first=luminance(a),second=luminance(b);return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);
}
function legible(hex:string,dark:boolean,target:number,backgrounds=[dark?"#1c1f24":"#ffffff"]){
 const toward=dark?"#ffffff":"#000000";
 for(let weight=0;weight<=1;weight+=.05){const next=mix(hex,toward,weight);if(backgrounds.every(background=>contrastRatio(next,background)>=target))return next;}
 return toward;
}
export function accentTokens(hex:string,dark:boolean):Record<string,string> {
 const accent=legible(dark?mix(hex,"#ffffff",.35):hex,dark,3);
 const soft=mix(dark?"#1c1f24":"#ffffff",hex,dark?.24:.10),text=legible(accent,dark,4.5,[dark?"#1c1f24":"#ffffff",dark?"#262a31":"#eef2ec",soft]);
 return {"--module-accent":text,"--sage":accent,"--sage-deep":text,"--sage-hover":text,"--sage-soft":soft};
}
// Both variants are present during SSR; CSS chooses the document theme without a light-mode flash.
export function themedAccentTokens(hex:string):Record<string,string>{
 return Object.fromEntries((["light","dark"] as const).flatMap(theme=>Object.entries(accentTokens(hex,theme==="dark")).map(([key,value])=>["--palette-"+theme+"-"+key.slice(2),value])));
}
