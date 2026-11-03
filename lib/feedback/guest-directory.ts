import { hasModuleAccess } from "../auth/modules";

export interface InHouseGuest {
  id: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  feedbackCount: number;
}
export function canTakeStayFeedback(user: { isOrganizationAdmin?: boolean; rights?: string[] } | null | undefined) {
  return !!user && (user.isOrganizationAdmin === true || (hasModuleAccess(user, "feedback") && user.rights?.includes("view_feedback") === true && user.rights?.includes("view_guest_pii") === true));
}
