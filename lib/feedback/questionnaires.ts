import { checked, PlatformError } from "../platform/db";
import type { AnswerQuestion } from "../feedbackAnswers";

export interface GuestQuestionnaire {
 id: string; property_id: string; organization_id: string; name: string; title: string;
 introduction: string; accent_color: string; is_default: boolean;
}
export async function guestQuestionnaire(db: any, propertyId: string, organizationId: string): Promise<GuestQuestionnaire | null> {
 const result = await db.from("feedback_questionnaires").select("id,property_id,organization_id,name,title,introduction,accent_color,is_default").eq("property_id",propertyId).eq("organization_id",organizationId).eq("is_default",true).maybeSingle();
 if (result.error && ["PGRST205","42P01"].includes(result.error.code)) return null;
 if (result.error) throw new PlatformError("Could not load this property's questionnaire.",503);
 return result.data;
}
export async function publicQuestions(db: any, property: {id:string;organization_id:string}, questionnaire: GuestQuestionnaire | null) {
 const base = () => db.from("feedback_questions").select("id,question_text,question_type,options,translations,is_required,display_order,department").eq("organization_id",property.organization_id).eq("is_active",true).order("display_order");
 const legacy = () => base().or("property_id.is.null,property_id.eq."+property.id);
 const result = await (questionnaire ? base().eq("questionnaire_id",questionnaire.id).eq("property_id",property.id) : legacy().is("questionnaire_id",null));
 // Preserve old invitation/stay/pf links while the additive migration is rolled out.
 if (!questionnaire && result.error && ["PGRST204","42703"].includes(result.error.code)) return checked<(AnswerQuestion & {department?:string|null})[]>(await legacy());
 return checked<(AnswerQuestion & {department?:string|null})[]>(result);
}
