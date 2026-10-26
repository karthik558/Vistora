import OnboardingForm from "../../../components/OnboardingForm";
export default async function Page({params}:{params:Promise<{token:string}>}){return <OnboardingForm invitation={(await params).token}/>;}
