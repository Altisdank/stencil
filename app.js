'use strict';
const fonts = [
  {id:'bodoni-moda',name:'Bodoni Moda',category:'Serif',designer:'Owen Earl',sample:'Kontraster.',weight:400,variable:true,range:'400–900',tags:'elegant editorial tidlös mode'},
  {id:'space-grotesk',name:'Space Grotesk',category:'Sans serif',designer:'Florian Karsten',sample:'Nya perspektiv.',weight:300,variable:true,range:'300–700',tags:'geometrisk modern ren'},
  {id:'syne',name:'Syne',category:'Display',designer:'Bonjour Monde, Lucas Descroix & George Triantafyllakos',sample:'EGENSINNE.',weight:400,variable:true,range:'400–800',tags:'expressiv bred experimentell'},
  {id:'cormorant-garamond',name:'Cormorant Garamond',category:'Serif',designer:'Christian Thalmann',sample:'En annan känsla.',weight:300,variable:true,range:'300–700',tags:'elegant editorial klassisk tidlös'},
  {id:'archivo-black',name:'Archivo Black',category:'Display',designer:'Omnibus-Type',sample:'TA PLATS.',weight:400,variable:false,range:'Regular',tags:'fet stark rubrik'},
  {id:'dm-sans',name:'DM Sans',category:'Sans serif',designer:'Colophon Foundry',sample:'Bara det viktiga.',weight:400,variable:true,range:'100–1000',tags:'ren modern enkel läsbar'},
  {id:'caveat',name:'Caveat',category:'Handskrivet',designer:'Impallari Type',sample:'Lite mer människa.',weight:400,variable:true,range:'400–700',tags:'penna handstil personlig'},
  {id:'space-mono',name:'Space Mono',category:'Monospace',designer:'Colophon Foundry',sample:'Hello, världen.',weight:400,variable:false,range:'Regular',tags:'kod teknisk retro'}
  ,...(window.EXTRA_FONTS || [])
];
const featuredOrder = ['great-vibes','unifraktur-maguntia','cormorant-garamond','pirata-one','allura','caveat','bodoni-moda','kaushan-script'];
fonts.sort((a,b) => (featuredOrder.indexOf(a.id) < 0 ? 99 : featuredOrder.indexOf(a.id)) - (featuredOrder.indexOf(b.id) < 0 ? 99 : featuredOrder.indexOf(b.id)));
window.StencilFonts = fonts;
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const state = {category:'all',query:'',savedOnly:false,sort:'curated',text:'',dark:false,limit:8};
let storageAvailable = true;
let saved = new Set();
try { const value = JSON.parse(localStorage.getItem('stencil-favorites') || localStorage.getItem('dafont-favorites') || '[]'); if(Array.isArray(value)) saved = new Set(value.filter(id => fonts.some(font => font.id === id))); } catch { storageAvailable = false; }
const bookmark = '<svg viewBox="0 0 18 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 2h12v19l-6-4-6 4V2Z"/></svg>';
function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 3000); }
function updateSaved() { $$('.saved-count').forEach(el => el.textContent = saved.size); $$('[data-saved]').forEach(el => el.setAttribute('aria-pressed',String(state.savedOnly))); }
function toggleFavorite(id) {
  const adding = !saved.has(id);
  adding ? saved.add(id) : saved.delete(id);
  try { localStorage.setItem('stencil-favorites', JSON.stringify([...saved])); } catch { storageAvailable = false; }
  notify(adding ? (storageAvailable ? 'Sparat i din samling.' : 'Sparat för den här sessionen. Webbläsaren tillåter inte lokal lagring.') : 'Borttaget från dina sparade.');
  render();
}
function getFilteredFonts() {
  const query = state.query.toLocaleLowerCase('sv').trim();
  const found = fonts.filter(font => (state.category === 'all' || font.category === state.category) && (!state.savedOnly || saved.has(font.id)) && (!query || `${font.name} ${font.category} ${font.designer} ${font.tags}`.toLocaleLowerCase('sv').includes(query)));
  if(state.sort !== 'curated') found.sort((a,b) => a.name.localeCompare(b.name,'sv') * (state.sort === 'az' ? 1 : -1));
  return found;
}
function render() {
  const found = getFilteredFonts();
  const activeElement = document.activeElement;
  const focusId = activeElement?.dataset.favorite;
  const grid = $('#font-grid'); grid.replaceChildren();
  for(const font of found.slice(0,state.limit)) {
    const card = document.createElement('article'); card.className = 'font-card'; card.setAttribute('aria-label',font.name);
    card.innerHTML = `<div class="font-card-head"><div><button class="font-name" data-font="${font.id}" aria-label="Prova ${font.name} och se detaljer">${font.name} <span aria-hidden="true">↗</span></button><span class="font-category">${font.category.toUpperCase()}${font.variable ? ' / VARIABLE' : ' / REGULAR'}</span></div><button class="favorite" data-favorite="${font.id}" aria-label="${saved.has(font.id) ? 'Ta bort' : 'Spara'} ${font.name}${saved.has(font.id) ? ' från sparade' : ''}" aria-pressed="${saved.has(font.id)}">${bookmark}</button></div><div class="specimen"></div><div class="font-card-foot"><span><i class="license-dot"></i>Fri för kommersiellt bruk</span><a class="download-link" href="assets/fonts/${font.id}.zip" download="${font.id}.zip" aria-label="Ladda ned ${font.name} med licens">Ladda ned <span aria-hidden="true">↓</span></a></div>`;
    const specimen = $('.specimen',card); specimen.style.fontFamily = `"${font.name}", ${font.category === 'Serif' ? 'serif' : 'sans-serif'}`; specimen.style.fontWeight = font.weight; specimen.textContent = state.text || font.sample;
    grid.append(card);
    const stencilButton = document.createElement('button');
    stencilButton.className = 'stencil-font-button';
    stencilButton.dataset.stencilFont = font.id;
    stencilButton.textContent = 'Till stencil ↗';
    stencilButton.setAttribute('aria-label',`Använd ${font.name} i A4-verkstaden`);
    $('.font-card-foot',card).prepend(stencilButton);
  }
  $('#results-count').textContent = `${found.length} ${found.length === 1 ? 'typsnitt' : 'typsnitt'} ${state.savedOnly ? 'bland dina sparade' : 'i urvalet'}`;
  $('#empty-state').hidden = found.length > 0;
  const emptySaved = state.savedOnly && saved.size === 0;
  $('#empty-state h3').textContent = emptySaved ? 'Din samling börjar här.' : 'Ingen form hittad. Än.';
  $('#empty-state p').textContent = emptySaved ? 'Spara typsnitt med bokmärket så hittar du dem enkelt igen.' : 'Prova ett annat sökord eller välj en annan stil.';
  $('#clear-filters').hidden = !state.savedOnly && state.category === 'all' && !state.query;
  $('#load-more').hidden = state.limit >= found.length;
  $('#shown-count').textContent = found.length ? `Visar ${Math.min(state.limit,found.length)} av ${found.length} typsnitt` : '';
  $('[data-category="all"] span').textContent = String(fonts.length).padStart(2,'0');
  $$('[data-category]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.category === state.category)));
  updateSaved();
  if(focusId) ($(`[data-favorite="${focusId}"]`) || $('[data-favorite]') || $('#empty-reset')).focus({preventScroll:true});
}
function resetFilters() { state.category = 'all'; state.query = ''; state.savedOnly = false; state.limit = 8; $('#search').value = ''; render(); }
function goToLibrary() { $('#bibliotek').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); }
$('#search').addEventListener('input',event => { state.query = event.target.value; state.limit = 8; render(); });
$('#preview').addEventListener('input',event => { state.text = event.target.value; render(); });
$('#size').addEventListener('input',event => { document.documentElement.style.setProperty('--sample-size',`${event.target.value}px`); $('#size-output').textContent = `${event.target.value} px`; });
$('#sort').addEventListener('change',event => { state.sort = event.target.value; render(); });
$('#contrast').addEventListener('click',event => { state.dark = !state.dark; $('#font-grid').classList.toggle('dark',state.dark); event.currentTarget.setAttribute('aria-pressed',String(state.dark)); event.currentTarget.setAttribute('aria-label',state.dark ? 'Visa ljusa typsnittsprover' : 'Visa mörka typsnittsprover'); });
$$('[data-category]').forEach(button => button.addEventListener('click',() => { state.category = button.dataset.category; state.limit = 8; render(); }));
$('#load-more').addEventListener('click',() => { const start = state.limit; state.limit += 8; render(); $$('.font-name')[start]?.focus(); });
$$('[data-collection]').forEach(button => button.addEventListener('click',() => { resetFilters(); state.category = button.dataset.collection; render(); goToLibrary(); }));
$$('[data-saved]').forEach(button => button.addEventListener('click',() => { resetFilters(); state.savedOnly = true; render(); if($('#menu-dialog').open) $('#menu-dialog').close(); goToLibrary(); }));
$$('[data-reset]').forEach(link => link.addEventListener('click',resetFilters));
$('#clear-filters').addEventListener('click',resetFilters);
$('#empty-reset').addEventListener('click',resetFilters);
document.addEventListener('click',event => {
  const stencil = event.target.closest('[data-stencil-font]');
  if(stencil) {
    const fromDetail = Boolean(stencil.closest('#font-dialog'));
    const previewText = fromDetail ? $('#detail-input').value : state.text;
    if($('#font-dialog').open) $('#font-dialog').close();
    window.StencilWorkshop?.selectFont(stencil.dataset.stencilFont, previewText || undefined);
  }
  const favorite = event.target.closest('[data-favorite]'); if(favorite) toggleFavorite(favorite.dataset.favorite);
  const detail = event.target.closest('[data-font]'); if(detail) openFont(detail.dataset.font);
});
document.addEventListener('keydown',event => { if(event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); $('#search').focus(); } });
function openFont(id) {
  const font = fonts.find(item => item.id === id); if(!font) return;
  const content = $('#detail-content');
  content.innerHTML = `<p class="eyebrow">${font.category.toUpperCase()} / ${font.variable ? 'VARIABELT TYPSNITT' : 'REGULAR'}</p><h2 id="detail-title">${font.name}</h2><p class="detail-designer">Av ${font.designer}</p><label class="detail-preview">PROVA DIN TEXT<input id="detail-input" maxlength="100" placeholder="Skriv något eget…"></label><div class="detail-sample"></div><p class="detail-alphabet">ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ<br>abcdefghijklmnopqrstuvwxyzåäö<br>0123456789 &amp;!?@#</p><dl class="detail-meta"><div><dt>VIKTER I FILEN</dt><dd>${font.range}</dd></div><div><dt>FORMAT</dt><dd>TrueType / TTF</dd></div><div><dt>LICENS</dt><dd>SIL OFL 1.1</dd></div></dl><div class="detail-actions"><a class="solid-button" href="assets/fonts/${font.id}.zip" download="${font.id}.zip">Ladda ned typsnitt <span aria-hidden="true">↓</span></a><a class="text-link" href="assets/fonts/${font.id}-OFL.txt" target="_blank" rel="noopener">Läs hela licensen ↗</a></div><p class="detail-note">Fri för personlig och kommersiell användning. ZIP-filen innehåller typsnittet och dess licens. Behåll licensfilen om du delar typsnittet vidare.</p>`;
  const sample = $('.detail-sample'); sample.textContent = state.text || font.sample; sample.style.fontFamily = `"${font.name}",sans-serif`; sample.style.fontWeight = font.weight;
  $('.detail-alphabet').style.fontFamily = `"${font.name}",sans-serif`;
  $('#detail-input').value = state.text;
  $('#detail-input').addEventListener('input',event => { sample.textContent = event.target.value || font.sample; });
  $('#font-dialog').showModal();
  const stencilButton = document.createElement('button');
  stencilButton.className = 'solid-button';
  stencilButton.dataset.stencilFont = font.id;
  stencilButton.textContent = 'Använd i stencil ↗';
  $('.detail-actions').prepend(stencilButton);
}
$('.menu-button').addEventListener('click',() => $('#menu-dialog').showModal());
$$('dialog').forEach(dialog => { $('.dialog-close',dialog).addEventListener('click',() => dialog.close()); dialog.addEventListener('click',event => { if(event.target === dialog) { const rect = dialog.getBoundingClientRect(); if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }); });
$$('#menu-dialog a').forEach(link => link.addEventListener('click',() => $('#menu-dialog').close()));
render();
const scene = $('.machine-scene');
if(scene) {
  function positionInk() { const width = scene.clientWidth, height = scene.clientHeight; const scale = Math.max(width / 1536, height / 1024); const imageWidth = 1536 * scale, imageHeight = 1024 * scale; scene.style.setProperty('--ink-x',`${(width-imageWidth)*.65 + imageWidth*.712}px`); scene.style.setProperty('--ink-y',`${(height-imageHeight)*.5 + imageHeight*.845}px`); }
  new ResizeObserver(positionInk).observe(scene);
  positionInk();
  const motionButton = $('.motion-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  function updateMotion() { scene.classList.toggle('ink-paused',paused); motionButton.setAttribute('aria-pressed',String(paused)); motionButton.textContent = paused ? '▷ Spela bläcket' : 'Ⅱ Pausa bläcket'; }
  motionButton.addEventListener('click',()=>{paused=!paused;updateMotion();});
  reducedMotion.addEventListener('change',event=>{paused=event.matches;updateMotion();});
  updateMotion();
}
