(function () {
  'use strict';
  const status = document.getElementById('landingStatus');
  const icons = () => window.lucide?.createIcons();
  const legacyHashes = new Set(['#bibliotek', '#hemskarm', '#licenser', '#samlingar']);
  function routeLegacyLink() {
    if (!legacyHashes.has(location.hash)) return;
    const destination = new URL('app.html', location.href);
    destination.hash = location.hash;
    location.replace(destination.href);
  }
  routeLegacyLink();
  window.addEventListener('hashchange', routeLegacyLink);
  icons();

  const menuButton = document.getElementById('landingMenuButton');
  const mobileNav = document.getElementById('landingMobileNav');
  function closeMenu(restoreFocus = false) {
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Öppna menyn');
    if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => {
    const opening = mobileNav.hidden;
    mobileNav.hidden = !opening;
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? 'Stäng menyn' : 'Öppna menyn');
  });
  mobileNav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileNav.hidden) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!mobileNav.hidden && !event.target.closest('.landing-header')) closeMenu();
  });
  window.matchMedia('(min-width: 1101px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  const video = document.getElementById('heroVideo');
  const playButton = document.getElementById('togglePlayBtn');
  const muteButton = document.getElementById('toggleAudioBtn');
  const restartButton = document.getElementById('restartVideoBtn');
  const audioStatus = document.getElementById('videoAudioStatus');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncVideoControls() {
    const playing = !video.paused && !video.ended;
    playButton.setAttribute('aria-label', playing ? 'Pausa filmen' : 'Spela filmen');
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}" class="w-4 h-4" aria-hidden="true"></i>`;
    const audible = !video.muted && video.volume > 0;
    muteButton.setAttribute('aria-label', audible ? 'Stäng av ljudet' : 'Slå på ljudet');
    muteButton.setAttribute('aria-pressed', String(audible));
    muteButton.innerHTML = `<i data-lucide="${audible ? 'volume-2' : 'volume-x'}" class="w-4 h-4 text-[#d4ff32]" aria-hidden="true"></i>`;
    audioStatus.textContent = audible ? 'Ljudet är på' : 'Ljudet är av';
    icons();
  }
  async function playVideo(userInitiated = false) {
    try { await video.play(); }
    catch {
      if (userInitiated) status.textContent = 'Filmen kunde inte spelas. Försök igen när den har laddats.';
      syncVideoControls();
    }
  }
  playButton.addEventListener('click', () => video.paused ? playVideo(true) : video.pause());
  muteButton.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
  });
  restartButton.addEventListener('click', () => {
    video.currentTime = 0;
    playVideo(true);
  });
  ['play', 'pause', 'ended', 'volumechange'].forEach(event => video.addEventListener(event, syncVideoControls));
  video.addEventListener('error', () => {
    status.textContent = 'Filmen kunde inte laddas. Verkstaden kan fortfarande användas.';
    syncVideoControls();
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) video.pause();
  });
  syncVideoControls();
  if (!reducedMotion.matches) playVideo();

  document.querySelectorAll('[data-example-font]').forEach(button => {
    button.addEventListener('click', () => {
      if (!window.StencilWorkshop) {
        status.textContent = 'Verkstaden laddas fortfarande. Försök igen om en stund.';
        return;
      }
      window.StencilWorkshop.selectFont(button.dataset.exampleFont, button.dataset.exampleText);
      const input = document.getElementById('ws-text');
      input?.focus({preventScroll:true});
    });
  });
  // Set a landing-specific sample without scrolling away from the introductory film.
  const initialText = document.getElementById('ws-text');
  const initialFont = document.getElementById('ws-font');
  let pendingFontHandoff = false;
  try { pendingFontHandoff = Boolean(sessionStorage.getItem('stencil-font-handoff-v1')); }
  catch { /* The workshop also skips handoff when session storage is unavailable. */ }
  const builtInFont = window.StencilFonts?.some(font => font.id === initialFont?.value);
  if (initialText?.value === 'Stay true.' && builtInFont && !pendingFontHandoff) {
    initialText.value = 'La Mara';
    initialText.dispatchEvent(new Event('input', {bubbles:true}));
  }
})();
