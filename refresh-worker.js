// Network-first within this tournament only. No offline copies of event pages.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode!=='navigate'&&!['script','style','manifest'].includes(request.destination))return;
 url.searchParams.set('_network',Date.now().toString());
 event.respondWith(fetch(new Request(url.href,{method:'GET',headers:request.headers,credentials:request.credentials,redirect:'follow',cache:'no-store'})));
});
