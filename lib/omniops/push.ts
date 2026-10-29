import webpush from "web-push";
import { checked, serviceDb } from "../platform/db";
export async function deliverOperationsPush(organizationId?: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY,
    subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject)
    return { configured: false, sent: 0 };
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const db = serviceDb();
  const response = await db.rpc("claim_ops_push", {
    p_org: organizationId || null,
    p_limit: 20,
  });
  if (response.error && ["42883", "PGRST202"].includes(response.error.code))
    return { configured: true, sent: 0, pendingMigration: true };
  const notices = checked(response) as any[];
  let sent = 0;
  // Four concurrent sends keep a batch within the worker's time budget. Database leases
  // recover crashes and suppress competing workers; failed deliveries back off per notice.
  for (let start = 0; start < notices.length; start += 4) {
    await Promise.all(
      notices.slice(start, start + 4).map(async (notice) => {
        const scope = () =>
          db
            .from("ops_push_deliveries")
            .update({ delivered_at: new Date().toISOString() })
            .eq("subscription_id", notice.subscription_id)
            .eq("job_id", notice.job_id)
            .eq("routing_cycle", notice.routing_cycle)
            .eq("escalation_level", notice.escalation_level);
        try {
          await webpush.sendNotification(
            notice.subscription,
            JSON.stringify({
              title:
                notice.priority === "critical"
                  ? "Critical job received"
                  : "New job received",
              body: "Open your operations queue to review and acknowledge.",
              tag: `job:${notice.job_id}`,
            }),
            { TTL: 300, timeout: 2000 },
          );
          checked(await scope().select("job_id"));
          sent++;
        } catch (error) {
          const code = (error as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            checked(
              await db
                .from("ops_push_subscriptions")
                .delete()
                .eq("id", notice.subscription_id)
                .select("id"),
            );
          } else {
            checked(
              await db
                .from("ops_push_deliveries")
                .update({
                  retry_after: new Date(
                    Date.now() +
                      Math.min(3600, 30 * 2 ** notice.attempts) * 1000,
                  ).toISOString(),
                })
                .eq("subscription_id", notice.subscription_id)
                .eq("job_id", notice.job_id)
                .eq("routing_cycle", notice.routing_cycle)
                .eq("escalation_level", notice.escalation_level)
                .select("job_id"),
            );
          }
        }
      }),
    );
  }
  return { configured: true, sent };
}
