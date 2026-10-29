export type AnswerQuestion = {id:string;question_text:string;question_type:string;is_required:boolean;options?:string[]|null};
export function multiChoices(value:string):string[] {
 if(!value)return [];
 try {const parsed=JSON.parse(value);return Array.isArray(parsed)&&parsed.every(v=>typeof v==="string")?parsed:[];}catch{return [];}
}
export function toggleMultiChoice(value:string,option:string):string {
 const current=multiChoices(value),next=current.includes(option)?current.filter(v=>v!==option):[...current,option];
 return next.length?JSON.stringify(next):"";
}
export function validateAnswers(questions:AnswerQuestion[],input:unknown,recommendation:unknown) {
 if(input!==undefined&&!Array.isArray(input))throw new Error("Answers must be a list.");
 if(Array.isArray(input)&&input.length>80)throw new Error("Too many answers.");
 const seen=new Set<string>();
 const answers=(Array.isArray(input)?input:[]).map((answer:any)=>{
  const q=questions.find(q=>q.id===answer?.questionId);
  if(!q)throw new Error("This questionnaire changed. Reload the form and try again.");
  if(seen.has(q.id))throw new Error("Submit each question only once.");
  seen.add(q.id);
  if(typeof answer.answerValue!=="string"||answer.answerValue.length>2000)throw new Error("Enter a valid answer of at most 2000 characters.");
  let value=answer.answerValue.trim();
  if(value){
   if(q.question_type==="multi_choice"){
    const values=multiChoices(value);
    if(!values.length||new Set(values).size!==values.length||values.some(v=>!q.options?.includes(v)))throw new Error("Choose valid options for "+q.question_text);
    value=JSON.stringify(values);
   }else if(["choice","dropdown","emoji","touchpoint","yes_no"].includes(q.question_type)){
    const options=q.question_type==="yes_no"&&!q.options?.length?["Yes","No"]:q.options;
    if(!options?.includes(value))throw new Error("Choose a valid option for "+q.question_text);
   }else if(q.question_type==="rating"&&!/^[1-5]\/5$/.test(value))throw new Error("Choose a rating from 1 to 5.");
   else if(["nps","csat"].includes(q.question_type)&&(!/^\d+$/.test(value)||Number(value)<(q.question_type==="nps"?0:1)||Number(value)>10))throw new Error("Choose a valid recommendation or satisfaction score.");
  }
  return {questionId:q.id,questionText:q.question_text,answerValue:value};
 });
 if(questions.some(q=>q.is_required&&!answers.some(a=>a.questionId===q.id&&a.answerValue)))throw new Error("Please answer the required questions.");
 const nps=answers.filter(a=>questions.some(q=>q.id===a.questionId&&q.question_type==="nps")&&a.answerValue).map(a=>Number(a.answerValue));
 if(new Set(nps).size>1)throw new Error("Recommendation answers must agree.");
 if(recommendation!==undefined&&recommendation!==null&&(!Number.isInteger(recommendation)||Number(recommendation)<0||Number(recommendation)>10))throw new Error("Choose a recommendation score from 0 to 10.");
 if(nps.length&&recommendation!==undefined&&recommendation!==null&&recommendation!==nps[0])throw new Error("Recommendation score must match your questionnaire answer.");
 return {answers,recommendationScore:nps[0]??(recommendation==null?null:Number(recommendation))};
}
