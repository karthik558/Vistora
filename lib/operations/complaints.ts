export const OPERATIONS_DEPARTMENTS=["IT","Engineering","Housekeeping","Front Desk","Food & Beverage","Concierge","Spa & Wellness","Valet & Transfers"] as const;
export const COMPLAINT_ISSUES=[
 {id:"wifi",label:"Wi-Fi not working",department:"IT"},
 {id:"television",label:"TV / telephone issue",department:"IT"},
 {id:"lighting",label:"Room light not working",department:"Engineering"},
 {id:"air_conditioning",label:"Air conditioning",department:"Engineering"},
 {id:"plumbing",label:"Water / plumbing",department:"Engineering"},
 {id:"cleanliness",label:"Room cleaning / linen",department:"Housekeeping"},
 {id:"noise",label:"Noise disturbance",department:"Front Desk"},
 {id:"food_service",label:"Food or room service",department:"Food & Beverage"},
 {id:"other",label:"Other issue",department:"Front Desk"}
] as const;
export const escalationLabel=(level:number)=>["Junior","Senior","GM"][level]||"Junior";
