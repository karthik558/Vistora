import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ArrowUpRight, MessageSquareText, ScanText, HeartHandshake, QrCode, ClipboardCheck, ShieldCheck, Check, Star } from "lucide-react";
import FeedbackPreview from "../components/FeedbackPreview";

export const dynamic = "force-dynamic";

const capabilities = [
  { icon: MessageSquareText, title: "One place for every voice", description: "Bring guest responses into a searchable inbox. Filter by property, date and rating to get straight to what matters." },
  { icon: ScanText, title: "Find the recurring themes", description: "Explore cleanliness, comfort, service and more. See the actual comments behind each topic and rating." },
  { icon: HeartHandshake, title: "Make every follow-up count", description: "Prioritize overdue feedback, contact requests and unacknowledged responses in a focused follow-up queue." },
  { icon: QrCode, title: "Feedback, without the friction", description: "Collect responses with property QR codes, guest invitations and shareable feedback forms." },
  { icon: ClipboardCheck, title: "Surveys that fit your stay", description: "Build your questionnaire around the guest experience, with ratings and the questions your team needs answered." },
  { icon: ShieldCheck, title: "Clear ownership. Real progress.", description: "Assign concerns, track response deadlines and keep resolution notes so your team can close the loop." },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("vistora-user")?.value;
  let isLoggedIn = false;
  if (userCookie) {
    try { isLoggedIn = !!JSON.parse(decodeURIComponent(userCookie))?.email; } catch { /* Display hint only; workspace routes verify the session. */ }
  }
  const destination = isLoggedIn ? "/dashboard" : "/login";
  return <main className="vistora-public">
    <a className="vp-skip" href="#main-content">Skip to content</a>
    <header className="vp-header"><Link href="/" aria-label="Vistora home"><Image src="/vistora_wordmark_white.webp" alt="Vistora" width={135} height={34} priority /></Link><nav aria-label="Main navigation"><a href="#experience">The experience</a><a href="#features">Features</a><a href="#questions">FAQs</a></nav><Link prefetch={true} href={destination} className="vp-login">{isLoggedIn ? "Your workspace" : "Sign in"}<ArrowUpRight size={16} /></Link></header>
    <section className="vp-hero" id="main-content">
      <div className="vp-hero-art" aria-hidden="true" />
      <div className="vp-hero-copy"><p className="vp-kicker"><span /> THE GUEST EXPERIENCE, REIMAGINED</p><h1>Great stays begin<br />with <em>being heard.</em></h1><p className="vp-lead">Turn guest feedback into thoughtful action.<br />Listen closely. Understand what matters.<br />Give every guest a reason to return.</p><div className="vp-hero-actions"><Link prefetch={true} href={destination} className="vp-button">{isLoggedIn ? "Open your workspace" : "Explore your workspace"}<span><ArrowRight size={18} /></span></Link><a href="#experience" className="vp-text-link">See how it works <ArrowUpRight size={17} /></a></div></div>
      <div className="vp-floating-card"><span className="vp-float-label"><MessageSquareText size={15} /> EVERY VOICE MATTERS</span><div className="vp-stars" aria-label="Five stars">{[1,2,3,4,5].map(n => <Star key={n} size={17} fill="currentColor" />)}</div><p>A moment of feedback.<br />A better experience tomorrow.</p><div><span className="vp-avatar">V</span><span>Listen. Learn. Follow through.<small>The Vistora approach</small></span><Check size={18} /></div></div>
      <div className="vp-hero-foot"><span>MORE THAN A FEEDBACK FORM</span><span>Guest voices <i /> Meaningful insights <i /> Thoughtful recovery</span><a href="#experience" aria-label="Discover the experience">↓</a></div>
    </section>
    <section className="vp-promise"><span>Made for the moments<br /><strong>that make a stay.</strong></span><div><MessageSquareText />Listen with intention</div><div><ScanText />Understand the details</div><div><HeartHandshake />Respond with care</div></section>
    <section id="experience" className="vp-section"><div className="vp-section-title"><p className="vp-kicker">THE FULL FEEDBACK JOURNEY</p><h2>Don’t just collect feedback.<br /><em>Do something good with it.</em></h2><p>From the first response to the final resolution,<br />bring your team closer to your guests.</p></div><FeedbackPreview /></section>
    <section id="features" className="vp-features vp-section"><div className="vp-feature-heading"><div><p className="vp-kicker">PURPOSEFUL BY DESIGN</p><h2>Everything you need<br />to turn listening into loyalty.</h2></div><p>A focused workspace for the people<br />behind exceptional guest experiences.</p></div><div className="vp-feature-grid">{capabilities.map(({icon: Icon, title, description}, index) => <article key={title}><div><Icon size={25} strokeWidth={1.5} /><span>0{index + 1}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="vp-trust"><div><h2>Good hospitality<br />is built on trust.</h2><p>Your team needs a clear picture, and your guests deserve to be heard. Vistora keeps feedback connected to the people who can act on it.</p></div><ul><li><Check /><span><strong>Access with purpose</strong>Workspace permissions and property access keep teams focused on the feedback they’re responsible for.</span></li><li><Check /><span><strong>Insights you can inspect</strong>Read the original comments behind topic counts. Understand how ratings are grouped.</span></li><li><Check /><span><strong>A clear path to resolution</strong>Keep acknowledgements, ownership and case history together, from concern to closure.</span></li></ul></section>
    <section id="questions" className="vp-section vp-faq"><div><p className="vp-kicker">A FEW HELPFUL ANSWERS</p><h2>A little clarity<br />before you begin.</h2></div><div>{[
      ["How do guests share their feedback?", "Guests can use your property’s feedback link or QR code, or follow an invitation. They can share ratings, answer your questionnaire and request a follow-up."],
      ["What happens when a guest needs attention?", "Your team can open the feedback record, acknowledge it, assign ownership and track a resolution. The follow-up queue helps surface overdue cases and guests who requested contact."],
      ["How are feedback topics identified?", "The Analytics page matches words in guest comments to topics such as cleanliness, room comfort and breakfast. Ratings provide the positive, neutral and low-rated breakdown. This is transparent keyword matching, not AI sentiment analysis."],
      ["Can I work across multiple properties?", "Yes. Authorized teams can filter feedback by property and date. Access follows the property assignments and permissions in your workspace."],
    ].map(([q,a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
    <section className="vp-cta"><p className="vp-kicker">BETTER EXPERIENCES START HERE</p><h2>Your guests have something to say.<br /><em>Make it matter.</em></h2><Link href={destination} prefetch={true} className="vp-button">{isLoggedIn ? "Open your workspace" : "Explore your workspace"}<span><ArrowRight size={18} /></span></Link></section>
    <footer className="vp-footer"><Link href="/" aria-label="Vistora home"><Image src="/vistora_wordmark_white.webp" alt="Vistora" width={120} height={30} /></Link><p>Every voice. A better stay.</p><span>© 2026 Vistora</span><a href="#main-content">Back to top ↑</a></footer>
  </main>;
}
