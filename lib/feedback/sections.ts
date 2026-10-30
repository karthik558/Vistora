export const feedbackSectionRights: Record<string, string> = {
  overview: "view_feedback", feedback: "view_feedback", analytics: "view_feedback",
  directory: "view_feedback", complaints: "manage_complaints", forms: "manage_questionnaire",
  questionnaire: "manage_questionnaire", "qr-codes": "manage_questionnaire",
  invitations: "manage_questionnaire", reports: "export_reports", "audit-log": "view_audit_log",
};

export function feedbackSection(href: string): string | null {
  const match = /^\/dashboard\/([^/?#]+)(?:\?.*)?$/.exec(href);
  return match && Object.hasOwn(feedbackSectionRights, match[1]) ? match[1] : null;
}