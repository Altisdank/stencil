const installButton = document.querySelector('#install-app');
let installPrompt;

if (installButton) {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    try {
      await prompt?.prompt();
    } catch {
      // The browser menu instructions remain available.
    }
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./stencil-sw.js').catch(error => {
    console.warn('Stencil kunde inte registrera webbappens service worker.', error);
  });
}
