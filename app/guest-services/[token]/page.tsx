import GuestServicePortal from "../../../components/GuestServicePortal";
export const metadata = {
  title: "Guest services | Vistora",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GuestServicePortal token={token} />;
}
