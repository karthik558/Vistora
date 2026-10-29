/* Staff PWA: no authenticated API responses, guest data, or tokens are cached. */
const CACHE="omniops-shell-v1";
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add("/operations-offline.html")));self.skipWaiting();});
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{if(event.request.mode==="navigate"&&new URL(event.request.url).pathname.startsWith("/dashboard/hospitality"))event.respondWith(fetch(event.request).catch(()=>caches.match("/operations-offline.html")));});
self.addEventListener("push",event=>{let data;try{data=event.data.json();}catch{return;}event.waitUntil(self.registration.showNotification(data.title||"New job received",{body:data.body||"Open operations to review.",tag:data.tag||"operations",icon:"/vistora_logo_blue.webp",badge:"/ops-icon.svg",vibrate:[200,100,200],data:{url:"/dashboard/hospitality?section=Service%20jobs"}}));});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{const target=windows.find(w=>new URL(w.url).origin===self.location.origin);if(target){target.navigate("/dashboard/hospitality?section=Service%20jobs");return target.focus();}return clients.openWindow("/dashboard/hospitality?section=Service%20jobs");}));});
