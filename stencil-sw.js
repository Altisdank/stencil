// Leave requests and sign-in redirects to the network. Only handle lost connections.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Stencil</title><h1>Stencil behöver internet</h1><p>Kontrollera anslutningen och försök igen.</p><a href="">Försök igen</a></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )));
});
