const V='orc-v3';
const F=['./','index.html','styles.css','app.js','extra.js','precos.js','logos.js','manifest.json','vendor/jspdf.umd.min.js','vendor/jspdf.plugin.autotable.min.js','assets/logo.png','assets/apple-touch-icon.png','assets/logo-branca.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(ch=>ch.put(e.request,c));return r}).catch(()=>caches.match(e.request))));
