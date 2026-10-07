// Carte Marine : fonctionnement hors ligne (appli + cartes téléchargées)
const SHELL = 'cm-shell-v48', LIB = 'cm-lib-v1', TILES = 'cm-tiles';
const LIBS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/shpjs@4.0.4/dist/shp.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;600&family=Barlow:wght@400;500;600&display=swap'
];
const TILE_RX = /(tile\.openstreetmap\.org|tiles\.openseamap\.org|depth\.openseamap\.org\/geoserver|server\.arcgisonline\.com|services\.data\.shom\.fr\/INSPIRE\/wmts|data\.geopf\.fr\/wmts|wms\.gebco\.net|ows\.emodnet-bathymetry\.eu\/wms|gis\.charttools\.noaa\.gov|wms\.geo\.admin\.ch)/;
const LIB_RX = /(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const s = await caches.open(SHELL);
    await Promise.all(['./', './index.html', './tide-engine.js', './marees-europe.json', './marees-amerique.json', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'].map(u => s.add(u).catch(() => {})));
    const l = await caches.open(LIB);
    await Promise.all(LIBS.map(u => fetch(u, { mode:'no-cors' }).then(r => l.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('cm-shell') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Clé de cache stable : pour les requêtes WMS, on trie les paramètres et on arrondit la zone (bbox).
function canon(url){
  const u = new URL(url), m = new Map();
  let wms = false;
  u.searchParams.forEach((v, k) => { const lk = k.toLowerCase(); if (lk === 'bbox'){ wms = true; v = v.split(',').map(n => Math.round(parseFloat(n))).join(','); } m.set(lk, v); });
  if (!wms) return url;
  return u.origin + u.pathname + '?' + [...m.keys()].sort().map(k => k + '=' + m.get(k)).join('&');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (TILE_RX.test(url) && !/getfeatureinfo/i.test(url)){ e.respondWith(tile(req)); return; }
  if (LIB_RX.test(url)){ e.respondWith(cacheFirst(req, LIB)); return; }
  if (new URL(url).origin === self.location.origin){ e.respondWith(networkFirst(req)); return; }
});

// Images de carte : on essaie d'abord une requête « CORS » (réponse lisible : on ne garde que les bonnes images,
// et elle prend peu de place) ; si le serveur ne l'autorise pas, requête classique.
const noCors = new Set();
async function tile(req){
  const key = canon(req.url), c = await caches.open(TILES);
  const hit = await c.match(key);
  if (hit) return hit;
  const host = new URL(req.url).host;
  if (!noCors.has(host)){
    try{
      const r = await fetch(req.url, { mode:'cors', credentials:'omit' });
      if (r.ok) c.put(key, r.clone()).catch(() => {});
      return r;
    }catch(err){ if (self.navigator.onLine !== false) noCors.add(host); }
  }
  try{
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') c.put(key, r.clone()).catch(() => {});
    return r;
  }catch(err){ return new Response('', { status:504, statusText:'hors ligne' }); }
}
async function cacheFirst(req, name){
  const c = await caches.open(name), hit = await c.match(req.url);
  if (hit) return hit;
  try{ const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req.url, r.clone()).catch(() => {}); return r; }
  catch(err){ return new Response('', { status:504 }); }
}
// Fichiers de l'appli : réseau d'abord, mais pas plus de 4 s d'attente si le réseau est très faible (en mer).
async function networkFirst(req){
  const c = await caches.open(SHELL);
  const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()).catch(() => {}); return r; });
  const hit = await c.match(req, { ignoreSearch:true });
  if (hit){
    const r = await Promise.race([net.catch(() => null), new Promise(res => setTimeout(() => res(null), 4000))]);
    return r && r.ok ? r : hit;
  }
  try{ return await net; }
  catch(err){
    if (req.mode === 'navigate') return (await c.match('./index.html')) || (await c.match('./')) || new Response('Hors ligne', { status:503 });
    return new Response('', { status:504, statusText:'hors ligne' });
  }
}
