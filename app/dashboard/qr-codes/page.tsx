import { serverUser } from "../../../lib/platform/server-session";
import OperationsPage from "../../../components/OperationsPage";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
import { WorkspaceUser } from "../../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function QrCodesPage() {
  const initialUser = await serverUser();

  const isGlobal = !initialUser || initialUser.role === "admin";
  const allowedPropertyIds = isGlobal
    ? null
    : initialUser?.propertyIds || (initialUser?.propertyId ? [initialUser.propertyId] : []);
  const defaultProperty = !isGlobal && allowedPropertyIds && allowedPropertyIds.length === 1
    ? allowedPropertyIds[0]
    : "all";

  const data = await getDashboardData(defaultProperty, allowedPropertyIds);
  return <OperationsPage section="qr-codes" data={data} initialUser={initialUser} />;
}
