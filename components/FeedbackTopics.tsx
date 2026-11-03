"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ScanText } from "lucide-react";
import { FeedbackTable } from "./Dashboard";
import type { FeedbackViewModel } from "../types/experience";
import { matchesTopic, summarizeTopics } from "../lib/feedback/insights";

export default function FeedbackTopics({ feedback }: { feedback: FeedbackViewModel[] }) {
  const [topic, setTopic] = useState("all");
  const topics = useMemo(() => summarizeTopics(feedback), [feedback]);
  const visible = feedback.filter(row => matchesTopic(row, topic));
  const topOpportunity = [...topics].filter(item => item.negative > 0).sort((a, b) => b.negative - a.negative)[0];
  return <div className="feedback-intelligence">
    <section className="fi-panel"><div className="fi-section-heading"><div><h2>Feedback topics</h2></div><span>Click a topic to explore its feedback <ArrowUpRight size={16} /></span></div>
      <div className="fi-topics">{topics.map(item => <button key={item.id} aria-pressed={topic === item.id} onClick={() => setTopic(topic === item.id ? "all" : item.id)}><span>{item.label}<ArrowUpRight size={16} /></span><strong>{item.count}<small> mentions</small></strong><div className="fi-topic-track" aria-hidden="true"><i style={{ width: `${item.count ? item.positive / item.count * 100 : 0}%` }} /><i style={{ width: `${item.count ? (item.count - item.positive - item.negative) / item.count * 100 : 0}%` }} /><i style={{ width: `${item.count ? item.negative / item.count * 100 : 0}%` }} /></div><small>{item.average === null ? "No matching comments yet" : `${item.average.toFixed(1)}/5 · ${item.positive} positive · ${item.negative} low-rated`}</small></button>)}</div>
      <p className="fi-method">Topics use keyword matching in guest comments; a comment may appear in several topics. Positive = 4–5 stars, neutral = 3, low-rated = 1–2. These are ratings, not inferred sentiment.</p>
      {topOpportunity && <div className="fi-opportunity"><ScanText size={20} /><p><strong>A closer look: {topOpportunity.label}</strong><br />{topOpportunity.negative} low-rated response{topOpportunity.negative === 1 ? "" : "s"} mention this topic. Read the comments to understand what needs attention.</p><button className="button button-outline" onClick={() => setTopic(topOpportunity.id)}>Explore topic</button></div>}
      <div className="fi-chips"><button aria-pressed={topic === "all"} onClick={() => setTopic("all")}>All topics</button><button aria-pressed={topic === "other"} onClick={() => setTopic("other")}>Other / no comment</button></div>
    </section>
    <p className="fi-results" aria-live="polite">{visible.length} matching responses{topic !== "all" ? ` · ${topics.find(item => item.id === topic)?.label || "Other / no comment"}` : ""}.</p>
    <FeedbackTable feedback={visible} title="Topic feedback" />
  </div>;
}
