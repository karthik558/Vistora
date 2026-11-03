import { PlatformError } from "../platform/db";
import { text, number } from "../platform/http";
const types = ["choice","multi_choice","rating","yes_no","text","long_text","nps","csat","emoji","touchpoint","dropdown"];
export function questionFields(body: any, partial: boolean) {
 const fields: Record<string, unknown> = {};
 if (!partial || body.questionText !== undefined) fields.question_text = text(body.questionText,"Question",300);
 if (!partial || body.questionType !== undefined) {
  const type=body.questionType ?? "choice";
  if (!types.includes(type)) throw new PlatformError("Invalid question type.");
  fields.question_type = type;
 }
 if (!partial || body.options !== undefined) {
  const options=body.options===undefined?[]:body.options;
  if (!Array.isArray(options) || options.length > 30) throw new PlatformError("Choose at most 30 options.");
  fields.options=options.map((option:unknown)=>text(option,"Option",100));
 }
 for (const [input,column] of [["isRequired","is_required"],["isActive","is_active"]]) if(body[input]!==undefined){if(typeof body[input]!=="boolean")throw new PlatformError("Invalid question setting.");fields[column]=body[input];}
 if(!partial){fields.is_required=body.isRequired===true;fields.is_active=true;}
 if(body.department!==undefined){
  if(body.department!==null&&!["Front Desk","Housekeeping","Food & Beverage","Concierge","Facilities & Room","Spa & Wellness","Valet & Transfers"].includes(body.department))throw new PlatformError("Choose a valid department.");
  fields.department=body.department;
 }
 if(body.displayOrder!==undefined)fields.display_order=number(body.displayOrder,"Question order",0,1000);
 if(body.translations!==undefined){
  if(!body.translations||typeof body.translations!=="object"||Array.isArray(body.translations)||Object.keys(body.translations).length>20)throw new PlatformError("Invalid translations.");
  const translations:Record<string,unknown>={};
  for(const [language,value] of Object.entries(body.translations)){
   if(!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language)||!value||typeof value!=="object"||Array.isArray(value))throw new PlatformError("Invalid translation.");
   const entry=value as any;
   const translation:Record<string,unknown>={};
   if(entry.questionText)translation.questionText=text(entry.questionText,"Translation",300);
   if(entry.options!==undefined){
    if(!Array.isArray(entry.options)||entry.options.length>30)throw new PlatformError("Invalid translated options.");
    translation.options=entry.options.map((option:unknown)=>text(option,"Translated option",100));
   }
   translations[language]=translation;
  }
  fields.translations=translations;
 }
 return fields;
}
