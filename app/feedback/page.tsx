import FeedbackForm from "../../components/FeedbackForm";
export const dynamic = "force-dynamic";
export default async function GeneralFeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = params.token || params.t;
  if (typeof token === "string" && token) return <FeedbackForm publicToken={token} />;
  return <main className="guest-shell"><section className="guest-card"><h1>A feedback link is required</h1><p>Please use the link or QR code provided by your property, or ask reception for a current link.</p></section></main>;
}
