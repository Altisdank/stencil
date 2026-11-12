/* Catalogue-only entry point for the landing page; no library UI dependency. */
(function () {
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
})();
