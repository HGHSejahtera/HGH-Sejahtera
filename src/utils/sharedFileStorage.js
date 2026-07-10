/**
 * Utility to retrieve and clear a file shared via PWA Web Share Target API
 * Stored in IndexedDB 'HGHSharedFilesDB' under store 'files', key 'latest_awb'
 */
export function getAndClearSharedFile() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('HGHSharedFilesDB', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files');
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        const getReq = store.get('latest_awb');
        
        getReq.onsuccess = () => {
          const file = getReq.result;
          if (file) {
            store.delete('latest_awb');
          }
          resolve(file || null);
        };
        
        getReq.onerror = () => resolve(null);
      };

      request.onerror = () => resolve(null);
    } catch (err) {
      console.error('Error retrieving shared file from IndexedDB:', err);
      resolve(null);
    }
  });
}
