import { precacheAndRoute } from 'workbox-precaching';

// Precache static assets injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

// Helper to save shared file to IndexedDB
function saveSharedFileToIndexedDB(file) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HGHSharedFilesDB', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files');
      }
    };
    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      store.put(file, 'latest_awb');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Intercept Web Share Target API POST requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('awb_file');
        if (file) {
          await saveSharedFileToIndexedDB(file);
        }
      } catch (err) {
        console.error('Error handling share target in SW:', err);
      }
      return Response.redirect('/Agent/Upload?shared=true', 303);
    })());
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
