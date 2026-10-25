export interface GuestInvitation {
  id: string;
  token: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  propertyId: string;
  propertyName?: string;
  roomNumber: string;
  channel: "direct_link" | "email" | "sms" | "whatsapp";
  status: "pending" | "completed" | "expired";
  createdAt: string;
  completedAt?: string | null;
  feedbackRating?: number | null;
  feedbackId?: string | null;
  notes?: string | null;
}

// In-memory seeded store with realistic hospitality guest invitations
let invitationsStore: GuestInvitation[] = [
  {
    id: "inv-101",
    token: "inv_9f82d1c3",
    guestName: "Lady Caroline Montagu",
    guestEmail: "caroline.montagu@mayfair.co.uk",
    guestPhone: "+44 7700 900142",
    propertyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    propertyName: "Vistora Riverside Bangkok",
    roomNumber: "Suite 408",
    channel: "direct_link",
    status: "completed",
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    completedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    feedbackRating: 5,
    feedbackId: "seed-fb-1",
    notes: "VIP Gold arrival invitation sent via Concierge link.",
  },
  {
    id: "inv-102",
    token: "inv_7a39e8d4",
    guestName: "Dr. Aris Thorne",
    guestEmail: "athorne@geneva-med.org",
    guestPhone: "+41 22 798 1234",
    propertyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    propertyName: "Vistora Riverside Bangkok",
    roomNumber: "Room 312",
    channel: "email",
    status: "pending",
    createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    completedAt: null,
    notes: "Post-breakfast checkout invitation dispatched via email.",
  },
  {
    id: "inv-103",
    token: "inv_4b12c6f1",
    guestName: "Kenjiro Takahashi",
    guestEmail: "kenjiro@tokyo-arch.jp",
    guestPhone: "+81 90 1234 5678",
    propertyId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    propertyName: "Vistora Siam Bangkok",
    roomNumber: "Penthouse 12",
    channel: "sms",
    status: "completed",
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    completedAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    feedbackRating: 5,
    feedbackId: "seed-fb-2",
    notes: "SMS invitation with tracked hash value.",
  },
  {
    id: "inv-104",
    token: "inv_8d55a9e2",
    guestName: "Sophia Dubois",
    guestEmail: "sophia.dubois@parislux.fr",
    guestPhone: "+33 6 12 34 56 78",
    propertyId: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
    propertyName: "Vistora Chiang Mai Resort",
    roomNumber: "Villa 04",
    channel: "whatsapp",
    status: "pending",
    createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    completedAt: null,
    notes: "Sent via WhatsApp concierge upon spa checkout.",
  },
];

export function listInvitations(propertyId?: string): GuestInvitation[] {
  if (propertyId && propertyId !== "all") {
    return invitationsStore.filter((inv) => inv.propertyId === propertyId);
  }
  return [...invitationsStore];
}

export function createInvitation(payload: {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  propertyId: string;
  propertyName?: string;
  roomNumber: string;
  channel?: "direct_link" | "email" | "sms" | "whatsapp";
  notes?: string;
}): GuestInvitation {
  const token = `inv_${Math.random().toString(36).substring(2, 8)}${Date.now().toString(36).slice(-4)}`;
  const newInvite: GuestInvitation = {
    id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    token,
    guestName: payload.guestName.trim(),
    guestEmail: payload.guestEmail?.trim() || null,
    guestPhone: payload.guestPhone?.trim() || null,
    propertyId: payload.propertyId,
    propertyName: payload.propertyName || "Vistora Partner Property",
    roomNumber: payload.roomNumber.trim(),
    channel: payload.channel || "direct_link",
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
    notes: payload.notes || null,
  };

  invitationsStore.unshift(newInvite);
  return newInvite;
}

export function getInvitationByToken(token: string): GuestInvitation | null {
  return invitationsStore.find((inv) => inv.token.toLowerCase() === token.toLowerCase()) || null;
}

export function markInvitationCompleted(token: string, rating: number, feedbackId?: string): boolean {
  const invite = invitationsStore.find((inv) => inv.token.toLowerCase() === token.toLowerCase());
  if (invite) {
    invite.status = "completed";
    invite.completedAt = new Date().toISOString();
    invite.feedbackRating = rating;
    if (feedbackId) invite.feedbackId = feedbackId;
    return true;
  }
  return false;
}

export function deleteInvitation(id: string): boolean {
  const initialLen = invitationsStore.length;
  invitationsStore = invitationsStore.filter((inv) => inv.id !== id);
  return invitationsStore.length < initialLen;
}
