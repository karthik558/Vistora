import type {FeedbackViewModel} from "../../types/experience";
// Pending cases are excluded until their deadline passes; ratings do not measure SLA performance.
export function responseCompliance(rows:Pick<FeedbackViewModel,"rating"|"status"|"deadline"|"firstResponseAt">[],now=Date.now()){
 let evaluated=0,onTime=0;const openDeadlines:number[]=[];
 for(const row of rows){
  const deadline=Date.parse(row.deadline||"");
  if(row.rating>3||!Number.isFinite(deadline))continue;
  if(row.status!=="resolved")openDeadlines.push(deadline);
  const responded=Date.parse(row.firstResponseAt||"");
  if(Number.isFinite(responded)&&responded<=now){evaluated++;if(responded<=deadline)onTime++;}
  else if(deadline<=now){evaluated++;}
 }
 return {rate:evaluated?Math.round(onTime/evaluated*100):null,evaluated,nextDeadline:openDeadlines.length?new Date(Math.min(...openDeadlines)).toISOString():null};
}
