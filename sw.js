const CACHE_SHELL = 'zrp-shell-v1';
const CACHE_API = 'zrp-api-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_SHELL && k !== CACHE_API).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Datos del repo privado: red primero (frescos), si no hay red usa el ultimo cache
  // y marca la respuesta para que la app avise "sin conexion".
  if(url.hostname === 'api.github.com'){
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_API).then(cache => cache.put(req, clone));
        return res;
      }).catch(async () => {
        const cached = await caches.match(req);
        if(!cached){
          return new Response(JSON.stringify({message: 'Sin conexión y sin caché para este dato'}), {
            status: 503,
            headers: {'Content-Type': 'application/json'}
          });
        }
        const headers = new Headers(cached.headers);
        headers.set('X-From-Cache', 'true');
        const body = await cached.blob();
        return new Response(body, {status: cached.status, statusText: cached.statusText, headers});
      })
    );
    return;
  }

  if(url.origin !== self.location.origin) return;

  // El HTML del cascaron: red primero (para agarrar deploys nuevos apenas hay conexion),
  // cache si no hay red — asi la app abre igual sin señal.
  if(req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')){
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_SHELL).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // CSS/JS/imagenes: llevan ?v= en la URL, asi que cache-first es seguro (URL nueva = contenido nuevo).
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const clone = res.clone();
      caches.open(CACHE_SHELL).then(cache => cache.put(req, clone));
      return res;
    }))
  );
});
