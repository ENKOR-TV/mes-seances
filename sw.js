// Garde l'appli dans le téléphone pour qu'elle marche sans réseau.
// Après chaque modification des fichiers, augmenter VERSION.
const VERSION = 'mes-seances-v1';
const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/outils.js',
  './js/stockage.js',
  './js/programme-defaut.js',
  './js/seance.js',
  './js/regles.js',
  './js/signal.js',
  './js/graphique.js',
  './js/vues-seance.js',
  './js/vues-programme.js',
  './js/vues-historique.js',
  './js/vues-reglages.js',
  './icones/icone.svg',
  './icones/icone-180.png',
  './icones/icone-192.png',
  './icones/icone-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html'))),
  );
});
