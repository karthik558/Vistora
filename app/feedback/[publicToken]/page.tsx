import FeedbackForm from "../../../components/FeedbackForm";

export default function PublicFeedbackPage({
  params,
}: {
  params: { publicToken: string };
}) {
  return <FeedbackForm publicToken={params.publicToken} />;
}