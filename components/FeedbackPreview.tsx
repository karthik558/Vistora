"use client";

import { useState } from "react";
import { ArrowUpRight, Check, MessageSquareText } from "lucide-react";

const previews = [
  { label: "Listen", title: "A better stay starts with listening.", detail: "Invite honest feedback with guest surveys, shareable links and property QR codes.", guest: "The welcome was wonderful. Breakfast could use more vegetarian options.", tag: "New guest feedback", action: "Feedback received", score: "4 / 5", metric: "Guest rating" },
  { label: "Understand", title: "See the story behind the score.", detail: "Find recurring topics, explore ratings and read the comments behind every insight.", guest: "Food & breakfast appears in 8 comments. Three guests gave a low rating.", tag: "Topic insight", action: "Explore the feedback", score: "8", metric: "Topic mentions" },
  { label: "Follow up", title: "Close the loop with care.", detail: "Find contact requests, acknowledge concerns and track each case through to resolution.", guest: "Your feedback is with our team. Thank you for helping us make your next stay better.", tag: "Service recovery", action: "Acknowledged by the team", score: "1", metric: "Conversation to follow up" },
];

export default function FeedbackPreview() {
  const [active, setActive] = useState(0);
  const preview = previews[active];
  return <div className="vp-product">
    <div className="vp-switcher" aria-label="Explore the feedback workflow">{previews.map((item, index) => <button key={item.label} aria-pressed={index === active} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.label}</button>)}</div>
    <div className="vp-preview-body" aria-live="polite"><div className="vp-preview-copy"><p className="vp-kicker">FROM SIGNAL TO SERVICE</p><h3>{preview.title}</h3><p>{preview.detail}</p><span className="vp-demo-label">Illustrative product preview · sample data</span></div>
      <div className="vp-preview-card"><div className="vp-card-top"><span><MessageSquareText size={17} /> {preview.tag}</span><ArrowUpRight size={18} /></div><blockquote>“{preview.guest}”</blockquote><div className="vp-preview-bottom"><span><Check size={15} />{preview.action}</span><div><strong>{preview.score}</strong><small>{preview.metric}</small></div></div></div>
    </div>
  </div>;
}
