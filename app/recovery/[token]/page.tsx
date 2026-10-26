import RecoveryForm from "../../../components/RecoveryForm";
export default async function Page({params}:{params:Promise<{token:string}>}){return <RecoveryForm token={(await params).token}/>;}
