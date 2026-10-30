import { checked, PlatformError, serviceDb, workspaceDb, workspaceUser, assertProperty } from "../platform/db";
import { newToken, hashToken, encryptSecret, decryptSecret } from "../platform/secrets";

export interface GuestInvitation {
  id: string;
  token: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  propertyId: string;
  propertyName?: string;
  propertyCode?: string;
  roomNumber: string;
  channel: "direct_link" | "email" | "sms" | "whatsapp";
  status: "pending" | "completed" | "expired";
  createdAt: string;
  completedAt?: string | null;
  feedbackRating?: number | null;
  feedbackId?: string | null;
  notes?: string | null;
}

function map(r: any, token = ""): GuestInvitation {
  return {
    id: r.id,
    token,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
    propertyId: r.property_id,
    propertyName: r.properties?.name,
    propertyCode: r.properties?.code,
    roomNumber: r.room_number,
    channel: r.channel,
    status: r.status === "pending" && Date.parse(r.expires_at) < Date.now() ? "expired" : r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    feedbackRating: r.feedback_rating,
    feedbackId: r.feedback_id,
    notes: r.notes,
  };
}

export async function listInvitations(propertyId?: string) {
  let q = workspaceDb().from("guest_invitations").select("*,properties(name,code)").order("created_at", { ascending: false });
  if (propertyId && propertyId !== "all") q = q.eq("property_id", propertyId);
  return checked(await q).map((r: any) => {
    let token = "";
    if (r.token_encrypted) {
      try {
        token = decryptSecret(r.token_encrypted);
      } catch (e) {
        console.warn("[invitationsService] Could not decrypt token for row:", r.id);
      }
    }
    return map(r, token);
  });
}

export async function createInvitation(payload: {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  propertyId: string;
  propertyName?: string;
  roomNumber: string;
  channel?: "direct_link" | "email" | "sms" | "whatsapp";
  notes?: string;
}) {
  await assertProperty(payload.propertyId);
  const token = newToken(), org = workspaceUser().organizationId;
  const tokenHash = hashToken(token);
  const tokenEncrypted = encryptSecret(token);

  let row: any = null;

  // Try RPC first
  try {
    const rpcRes = await serviceDb().rpc("create_guest_invitation", {
      p_invitation: {
        organization_id: org,
        property_id: payload.propertyId,
        token_encrypted: tokenEncrypted,
        guest_name: payload.guestName,
        guest_email: payload.guestEmail || null,
        guest_phone: payload.guestPhone || null,
        room_number: payload.roomNumber,
        channel: payload.channel || "direct_link",
        notes: payload.notes || null,
      },
      p_token: token,
    });
    if (!rpcRes.error && rpcRes.data) {
      row = rpcRes.data;
    }
  } catch (e) {
    console.warn("[invitationsService] RPC create_guest_invitation failed, falling back to direct insert:", e);
  }

  // Fallback to direct insertion if RPC errored or is missing
  if (!row) {
    const insertRes = await serviceDb()
      .from("guest_invitations")
      .insert({
        organization_id: org,
        property_id: payload.propertyId,
        token_hash: tokenHash,
        token_encrypted: tokenEncrypted,
        guest_name: payload.guestName,
        guest_email: payload.guestEmail || null,
        guest_phone: payload.guestPhone || null,
        room_number: payload.roomNumber,
        channel: payload.channel || "direct_link",
        notes: payload.notes || null,
      })
      .select("*,properties(name,code)")
      .single();

    row = checked(insertRes);

    if (payload.channel && payload.channel !== "direct_link") {
      try {
        await serviceDb().from("notification_outbox").insert({
          organization_id: org,
          kind: "invitation",
          dedup_key: "invitation:" + row.id,
          payload: {
            recipient: payload.channel === "email" ? payload.guestEmail : payload.guestPhone,
            channel: payload.channel,
            token,
            propertyId: payload.propertyId,
          },
        });
      } catch (e) {
        console.warn("[invitationsService] notification_outbox insert skipped:", e);
      }
    }
  }

  return map(row, token);
}

export async function getInvitationByToken(token: string) {
  const { data, error } = await serviceDb()
    .from("guest_invitations")
    .select("*,properties(name,code)")
    .eq("token_hash", hashToken(token))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) checked({ data, error });
  return data ? map(data, token) : null;
}

export async function getInvitationById(id: string): Promise<GuestInvitation | null> {
  const { data, error } = await workspaceDb()
    .from("guest_invitations")
    .select("*,properties(name,code)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  let token = "";
  if (data.token_encrypted) {
    try {
      token = decryptSecret(data.token_encrypted);
    } catch {}
  }
  return map(data, token);
}

export async function markInvitationCompleted(_token: string, _rating: number, _feedbackId?: string) {
  return true;
}

export async function deleteInvitation(id: string) {
  checked(await workspaceDb().from("guest_invitations").delete().eq("id", id).select("id").single());
  return true;
}
