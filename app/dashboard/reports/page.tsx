import WorkspacePage from "../../../components/WorkspacePage";
import {serverUser} from "../../../lib/platform/server-session";
export const dynamic="force-dynamic";
export default async function ReportsPage(){return <WorkspacePage user={await serverUser()} initialTab="Reports"/>;}
