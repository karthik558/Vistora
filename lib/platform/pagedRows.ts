// Advance by the actual returned count, including deployments with a lower API row cap.
export async function pagedRows<T>(query:any):Promise<T[]> {
 const rows:T[]=[];
 for(let offset=0;;){
  const {data,error}=await query.range(offset,offset+499);
  if(error)throw new Error(error.message||"Unable to load records.");
  if(!data?.length)return rows;
  rows.push(...data);offset+=data.length;
 }
}
