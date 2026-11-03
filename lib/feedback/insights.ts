import type { FeedbackViewModel } from "../../types/experience";

// Transparent keyword grouping, not inferred sentiment or an AI classification.
export const feedbackTopics = [
  { id: "cleanliness", label: "Cleanliness", pattern: /\b(clean\w*|dirty|dust\w*|hygiene|linen|towels?)\b/i },
  { id: "service", label: "Service & welcome", pattern: /\b(staff|service|friendly|helpful|reception|check[ -]?in|welcome)\b/i },
  { id: "comfort", label: "Room comfort", pattern: /\b(room|beds?|pillow\w*|noise|noisy|quiet|sleep|air[ -]?condition\w*)\b/i },
  { id: "dining", label: "Food & breakfast", pattern: /\b(food|breakfast|restaurant|dining|meal\w*|coffee|vegetarian)\b/i },
  { id: "connectivity", label: "Wi-Fi & connectivity", pattern: /\b(wi[ -]?fi|internet|connection|connectivity)\b/i },
  { id: "value", label: "Value for money", pattern: /\b(price|value|expensive|cost|affordable|worth)\b/i },
] as const;

export function matchesTopic(row: FeedbackViewModel, topic: string): boolean {
  if (topic === "all") return true;
  const text = row.comment || "";
  if (topic === "other") return !feedbackTopics.some(item => item.pattern.test(text));
  return feedbackTopics.find(item => item.id === topic)?.pattern.test(text) ?? false;
}

export type FollowUpView = "all" | "overdue" | "contact" | "unacknowledged" | "unassigned";
export function needsFollowUp(row: FeedbackViewModel, view: FollowUpView, now: number): boolean {
  if (row.status === "resolved") return false;
  const overdue = !!row.deadline && Date.parse(row.deadline) < now;
  if (view === "overdue") return overdue;
  if (view === "contact") return row.wantsContact;
  if (view === "unacknowledged") return !row.firstResponseAt;
  if (view === "unassigned") return !row.assignedTo?.trim();
  return overdue || row.wantsContact || !row.firstResponseAt || row.rating <= 2 || row.status === "escalated";
}

export function summarizeTopics(rows: FeedbackViewModel[]) {
  return feedbackTopics.map(topic => {
    const matching = rows.filter(row => matchesTopic(row, topic.id));
    return { id: topic.id, label: topic.label, count: matching.length,
      positive: matching.filter(row => row.rating >= 4).length,
      negative: matching.filter(row => row.rating <= 2).length,
      average: matching.length ? matching.reduce((sum, row) => sum + row.rating, 0) / matching.length : null };
  }).sort((a, b) => b.count - a.count);
}

export function prioritizeFollowUps(rows: FeedbackViewModel[], now: number) {
  const rank = (row: FeedbackViewModel) => needsFollowUp(row, "overdue", now) ? 0 : row.status === "escalated" ? 1 : row.wantsContact ? 2 : 3;
  return [...rows].sort((a, b) => rank(a) - rank(b) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}
