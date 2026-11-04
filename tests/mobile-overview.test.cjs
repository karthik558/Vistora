const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const h = React.createElement;
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText,file);
const root = path.resolve(__dirname, '..');
const config = require('../lib/hospitality/config.ts');
const emptyComponent = { __esModule: true, default: () => null };
function load(file, mocks) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText, {exports, URLSearchParams, require(name) {
  if (Object.hasOwn(mocks,name)) return mocks[name];
  if (name.startsWith('./')) return emptyComponent;
  return name.startsWith('../') ? require(path.resolve(root,path.dirname(file),name)) : require(name);
 }});
 return exports;
}
const link = {__esModule:true,default:({children,prefetch,...props})=>h('a',props,children)};
const image = {__esModule:true,default:({priority,...props})=>h('img',props)};
const summary = {property:'p1',properties:[],active:12,resolved:30,escalated:2,feedback:8,mine:4,overdue:1,cleaning:6,inHouse:20,alerts:[{id:'j1',title:'Repair air conditioner',department:'Engineering',escalation_level:1,due_at:'2020-01-01T00:00:00Z'}]};

test('Mobile home keeps tiles during loading, scopes queue links, renders alerts and omits footer shortcuts', () => {
 const { ServiceOverviewContent } = load('components/MobileOperationsHome.tsx', {
  'next/link': link, './WorkspaceSelect': {__esModule:true,default:()=>h('button',null,'Property')},
 });
 const props = {property:'p1',setProperty:()=>{},loading:false,error:'',refresh:()=>{},canViewFeedback:true};
 const markup = renderToStaticMarkup(h(ServiceOverviewContent,{...props,data:summary}));
 assert.equal((markup.match(/class="mobile-overview-tile tone-/g)||[]).length,8);
 assert.match(markup,/jobs=mine/); assert.match(markup,/jobs=overdue/);
 assert.match(markup,/Repair air conditioner/); assert.match(markup,/Escalation level 1/);
 assert.doesNotMatch(markup,/Full hotel operations|All modules|HOTEL OPERATIONS|Your service overview/);
 const restricted = renderToStaticMarkup(h(ServiceOverviewContent,{...props,data:{...summary,feedback:null},canViewFeedback:false}));
 assert.doesNotMatch(restricted,/href="\/dashboard\/feedback"/);
 const loading = renderToStaticMarkup(h(ServiceOverviewContent,{...props,data:null,loading:true}));
 assert.equal((loading.match(/class="mobile-overview-tile tone-/g)||[]).length,8);
 assert.match(loading,/Checking for alerts/);
 const empty = renderToStaticMarkup(h(ServiceOverviewContent,{...props,data:{...summary,alerts:[]}}));
 assert.match(empty,/caught up/);
});

function shellMarkup(pathname, mobile) {
 let stateIndex = 0;
 const { AppShell } = load('components/Dashboard.tsx', {
  react: {...React,useState: initial => React.useState(stateIndex++ === 3 ? mobile : initial)},
  'next/link':link, 'next/image':image,
  'next/navigation':{useRouter:()=>({}),usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams('property=p1')},
  './FeedbackShellContext':{FeedbackShellContext:React.createContext(null)},
  './AppearanceProvider':{useAppearance:()=>({config:config.DEFAULT_HOSPITALITY,dark:false})},
  '../lib/platform/notificationsStore':{useComplaintBadge:()=>({badgeCount:0,clearBadge:()=>{}})},
 });
 return renderToStaticMarkup(h(AppShell,{user:{fullName:'Staff',email:'staff@example.com',isOrganizationAdmin:true},module:'operations',active:'Overview'},h('p',null,'Page content')));
}
test('Overview stays on the mobile home from the home screen and other mobile operations pages', () => {
 for (const [pathname,mobile] of [['/dashboard/hospitality/mobile',true],['/dashboard/hospitality/mobile',false],['/dashboard/hospitality',true]]) {
  const markup = shellMarkup(pathname,mobile);
  const bottom = markup.match(/<nav class="mobile-bottom-navbar"[\s\S]*?<\/nav>/)[0];
  assert.match(bottom,/href="\/dashboard\/hospitality\/mobile\?property=p1"/);
  if (pathname.endsWith('/mobile')) {
   assert.match(bottom,/class="mobile-nav-tab active"/);
   assert.doesNotMatch(markup, /class="breadcrumbs"/);
  }
 }
 const desktop = shellMarkup('/dashboard/hospitality',false).match(/<nav class="mobile-bottom-navbar"[\s\S]*?<\/nav>/)[0];
 assert.match(desktop,/href="\/dashboard\/hospitality\?property=p1"/);
});
