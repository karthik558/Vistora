import { guestQuestionnaire } from "./questionnaires";
import { checked, PlatformError, serviceDb } from "../platform/db";
import { decryptSecret, encryptSecret, hashToken, signToken } from "../platform/secrets";
import { text } from "../platform/http";
import type { GuestStayDetails } from "../../types/experience";

interface PropertyLink { purpose: "guest-feedback-v1"; propertyId: string; room: string; department: string; demo: boolean }
export function createPropertyFeedbackToken(input: Omit<PropertyLink, "purpose">) {
  return "pf." + encryptSecret(JSON.stringify({ ...input, purpose: "guest-feedback-v1" }));
}

export async function createShortFeedbackLink(db: any, property: { id: string; organization_id: string; code?: string }, input: { room: string; department: string; demo: boolean }) {
 const code = (property.code || "property").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0,16) || "property";
 const location = input.room.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16);
 const signature = signToken(JSON.stringify(["guest-feedback-link-v2",property.organization_id,property.id,code,input.room,input.department,input.demo]));
 const token = [code,location,signature].filter(Boolean).join("-");
 const result = await db.from("guest_feedback_links").upsert({ organization_id: property.organization_id, property_id: property.id, token_hash: hashToken(token), ...input }, { onConflict: "token_hash", ignoreDuplicates: true });
 if (result.error && ["PGRST205","42P01"].includes(result.error.code)) throw new PlatformError("Apply the questionnaires and short links migration before generating links.",503);
 checked({data:true,error:result.error});
 const saved = checked<{is_active:boolean}>(await db.from("guest_feedback_links").select("is_active").eq("token_hash",hashToken(token)).single());
 if (!saved.is_active) throw new PlatformError("This feedback link has been disabled.",410);
 return token;
}

// A public caller must prove possession of a property, invitation or stay link.
// Neither a property ID nor a display/session cookie is a guest authorization grant.
export async function resolvePublicFeedbackLink(value: unknown) {
  if (typeof value !== "string" || !value || value === "verified" || value.length > 2048)
    throw new PlatformError("A valid property feedback link is required. Ask reception for a current link.", 403);
  const token = value;
  let propertyId: string, organizationId: string | undefined;
  let invitation: any = null, stay: any = null, propertyLink: PropertyLink | null = null;
  if (token.startsWith("pf.")) {
    try {
      propertyLink = JSON.parse(decryptSecret(token.slice(3)));
      if (!propertyLink || propertyLink.purpose !== "guest-feedback-v1" || typeof propertyLink.demo !== "boolean") throw new Error();
      propertyId = text(propertyLink.propertyId, "Property", 50);
      text(propertyLink.room, "Room", 50, false);
      text(propertyLink.department, "Department", 50, false);
    } catch { throw new PlatformError("This feedback link is invalid. Ask reception for a new link.", 404); }
  } else {
    // Existing invitation tokens are random hex; stay tokens may also be UUIDs.
    if (!/^(?:[a-z0-9-]{1,33}-[A-Za-z0-9_-]{22}|[a-z0-9-]{1,16}-[A-Za-z0-9_-]{24})$/.test(token) && !/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new PlatformError("Feedback link not found.", 404);
  }
  const db = serviceDb();
  if (!propertyLink && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(token) && /^(?:[a-z0-9-]{1,33}-[A-Za-z0-9_-]{22}|[a-z0-9-]{1,16}-[A-Za-z0-9_-]{24})$/.test(token)) {
    const result = await db.from("guest_feedback_links").select("organization_id,property_id,room,department,demo").eq("token_hash",hashToken(token)).eq("is_active",true).maybeSingle();
    if (result.error) checked(result);
    if (!result.data) throw new PlatformError("Feedback link not found.",404);
    organizationId = result.data.organization_id;
    propertyId = result.data.property_id;
    propertyLink = { purpose:"guest-feedback-v1", propertyId:propertyId!, room:result.data.room, department:result.data.department, demo:result.data.demo };
  }
  if (!propertyLink) {
    const result = await db.from("guest_invitations").select("id,organization_id,property_id,status,expires_at,guest_name,room_number,guest_email,guest_phone").eq("token_hash", hashToken(token)).maybeSingle();
    if (result.error) checked(result);
    invitation = result.data;
    if (invitation) {
      if (invitation.status !== "pending" || !(Date.parse(invitation.expires_at) > Date.now())) throw new PlatformError("This invitation has expired or was already used.", 410);
      propertyId = invitation.property_id; organizationId = invitation.organization_id;
    } else {
      const result = await db.from("stays").select("id,organization_id,property_id,room_number,check_in_date,check_out_date,guests(full_name)").eq("public_token", token).eq("status", "active").maybeSingle();
      if (result.error) checked(result);
      stay = result.data;
      if (!stay) throw new PlatformError("Feedback link not found.", 404);
      propertyId = stay.property_id; organizationId = stay.organization_id;
    }
  }
  const property = checked(await db.from("properties").select("id,name,code,organization_id,is_active").eq("id", propertyId!).eq("is_active", true).maybeSingle());
  if (organizationId && organizationId !== property.organization_id) throw new PlatformError("Feedback link not found.", 404);
  const guest = Array.isArray(stay?.guests) ? stay.guests[0] : stay?.guests;
  const questionnaire = await guestQuestionnaire(db, property.id, property.organization_id);
  const details: GuestStayDetails = {
    questionnaireTitle: questionnaire?.title, introduction: questionnaire?.introduction, accentColor: questionnaire?.accent_color,
    token, propertyId: property.id, propertyName: property.name, propertyCode: property.code,
    guestName: invitation?.guest_name || guest?.full_name || "",
    roomNumber: invitation?.room_number || stay?.room_number || propertyLink?.room || "",
    checkInDate: stay?.check_in_date || "", checkOutDate: stay?.check_out_date || "",
    isStayLink: !!(invitation || stay), demo: propertyLink?.demo || false,
    department: propertyLink?.department || "",
  };
  return { db, property, invitation, stay, details, questionnaire };
}
