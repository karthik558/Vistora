import WorkspacePage from "../../../components/WorkspacePage";
import {serverUser} from "../../../lib/platform/server-session";
export default async function Page(){return <WorkspacePage user={await serverUser()}/>;}
