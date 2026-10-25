import FeedbackForm from "../../../components/FeedbackForm";

export default async function PublicFeedbackPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  return <FeedbackForm publicToken={publicToken} />;
}