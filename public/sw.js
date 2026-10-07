// Levrotec Finance Tracker — minimal service worker.
// It exists only so phones treat the site as an installable app. It does NOT
// cache anything: every request goes to the network, so finance data and new
// versions of the app are always live.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
