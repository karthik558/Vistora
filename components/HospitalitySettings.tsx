"use client";
import {HospitalityConfig,MODULES,moneyToMinor} from "../lib/hospitality/config";
import WorkspaceSelect from "./WorkspaceSelect";
import Link from "next/link";
export default function HospitalitySettings({value,onChange}:{value:HospitalityConfig;onChange:(next:HospitalityConfig)=>void}){
 const amount=(key:"monthlyBudgetMinor"|"perExpenseLimitMinor"|"approvalThresholdMinor",label:string)=><label>{label}<input inputMode="decimal" pattern="[0-9]{1,10}([.][0-9]{1,2})?" required defaultValue={value[key]/100} onChange={e=>{try{onChange({...value,[key]:moneyToMinor(e.target.value)});}catch{}}}/></label>;
 return <section className="hospitality-settings">
 <h3>Hotel operations &amp; appearance</h3><p>Configure the admin modules, section accents, room-readiness rules and cost controls.</p>
 <div className="hotel-settings-links"><Link href="/dashboard/hospitality">Hotel operations</Link><Link href="/dashboard/properties">Manage properties</Link><Link href="/dashboard/workspace">Team, integrations &amp; automation</Link></div>
 <h4>Section colors</h4><div className="hotel-color-grid">{MODULES.map(module=><label key={module}>{module.charAt(0).toUpperCase()+module.slice(1)}<div><input aria-label={module+" color picker"} type="color" value={/^#[0-9a-f]{6}$/i.test(value.colors[module])?value.colors[module]:"#000000"} onChange={e=>onChange({...value,colors:{...value.colors,[module]:e.target.value}})}/><input aria-label={module+" hex color"} value={value.colors[module]} maxLength={7} onChange={e=>onChange({...value,colors:{...value.colors,[module]:e.target.value}})} pattern="#[0-9a-fA-F]{6}" required/></div></label>)}</div>
 <h4>Enabled modules</h4><div className="hotel-module-switches">{(Object.keys(value.modules) as Array<keyof typeof value.modules>).map(module=><label key={module}><input type="checkbox" checked={value.modules[module]} onChange={e=>onChange({...value,modules:{...value.modules,[module]:e.target.checked}})}/>{module.charAt(0).toUpperCase()+module.slice(1)}</label>)}</div>
 <h4>Operational rules</h4><div className="hotel-settings-fields"><label>Default job response · minutes<input type="number" min={1} max={10080} value={value.taskResponseMinutes} onChange={e=>onChange({...value,taskResponseMinutes:Number(e.target.value)})} required/></label><label>Cost currency<WorkspaceSelect label="Cost currency" value={value.currency} onChange={currency=>onChange({...value,currency})} options={["INR","USD","EUR","GBP","AED","THB"].map(currency=>({value:currency,label:currency}))}/></label></div>
 <label>Outgoing call rate · minor currency units per started minute<input type="number" min={0} max={100000} value={value.callRateMinor} onChange={e=>onChange({...value,callRateMinor:Number(e.target.value)})} required/><small>Zero records calls without adding a charge. Rates apply to new call records only.</small></label>
 <label className="hotel-check-label"><input type="checkbox" checked={value.requireInspection} onChange={e=>onChange({...value,requireInspection:e.target.checked})}/>Require a passing room inspection before check-in</label>
 <label className="hotel-check-label"><input type="checkbox" checked={value.alertsEnabled} onChange={e=>onChange({...value,alertsEnabled:e.target.checked})}/>Queue overdue service alerts through the configured delivery provider</label>
 <label>Inspection checklist · one check per line<textarea rows={5} value={value.inspectionChecklist.join("\n")} onChange={e=>onChange({...value,inspectionChecklist:e.target.value.split("\n")})} maxLength={4800}/></label>
 <h4>Strict cost controls</h4><p>Zero monthly or per-expense limit blocks new costs. Pending approvals reserve budget. These limits record operational spending; they do not make payments.</p>
 <div className="hotel-settings-fields">{amount("monthlyBudgetMinor","Monthly company budget")}{amount("perExpenseLimitMinor","Maximum per expense")}{amount("approvalThresholdMinor","Auto-approval threshold")}</div>
 </section>;
}
