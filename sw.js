/* ApiCampo — service worker
   Objetivo: que la app abra y funcione aunque no haya internet,
   incluso si el teléfono estuvo apagado o sin señal desde la instalación. */

var CACHE_NAME = "apicampo-cache-v7";

var APP_SHELL = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

/* Librerías externas (QR) y fuentes: se guardan en cuanto se piden la primera vez,
   así ya quedan disponibles sin conexión desde la segunda apertura. */
var EXTERNOS = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL).catch(function(){ /* si algo falla no bloquea la instalación */ });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(nombres){
      return Promise.all(nombres.map(function(n){
        if(n !== CACHE_NAME) return caches.delete(n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Estrategia para la página principal (navegación, index.html): red primero,
   así siempre se ve la versión más reciente en cuanto hay internet, y solo se
   usa la copia guardada si no hay conexión. Para todo lo demás (íconos,
   manifest, fuentes, librerías): copia guardada primero, y lo que llega de
   red se guarda para la próxima vez. */
self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;

  if(req.mode === "navigate"){
    event.respondWith(
      fetch(req).then(function(res){
        var copia = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copia); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(cached){
          if(cached) return cached;
          return caches.match(self.registration.scope).then(function(r){
            return r || new Response(
              "<h1>Sin conexión</h1><p>Abre ApiCampo una vez con internet para que quede disponible sin conexión.</p>",
              {headers:{"Content-Type":"text/html; charset=utf-8"}}
            );
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req, {ignoreVary:true, ignoreSearch:false}).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        var esExterno = EXTERNOS.some(function(u){ return req.url.indexOf(u.split("?")[0].split("&")[0]) === 0 || req.url === u; });
        var mismoOrigen = req.url.indexOf(self.location.origin) === 0;
        if(res && (res.ok || res.type === "opaque") && (mismoOrigen || esExterno || req.url.indexOf("fonts.g") !== -1 || req.url.indexOf("cdnjs.cloudflare.com") !== -1)){
          var copia = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copia); });
        }
        return res;
      }).catch(function(){});
    })
  );
});
