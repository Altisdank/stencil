(function () {
  'use strict';
  const PAGE = {width:210,height:297,margin:10};
  const PT = 72 / 25.4;
  const f = n => Number(n.toFixed(6)).toString();
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  function normalizePath(path, height, x, y) {
    const box = pathBounds(path.commands);
    if (!path.commands.length || !Number.isFinite(box.y2 - box.y1) || box.y2 <= box.y1) return {commands:[],width:0,height:0};
    const scale = height / (box.y2-box.y1);
    const commands = path.commands.map(command => {
      const out = {type:command.type};
      for (const key of ['x','x1','x2']) if (Number.isFinite(command[key])) out[key] = x + (command[key]-box.x1)*scale;
      for (const key of ['y','y1','y2']) if (Number.isFinite(command[key])) out[key] = y + (command[key]-box.y1)*scale;
      return out;
    });
    return {commands,width:(box.x2-box.x1)*scale,height};
  }
  function pathData(commands) {
    return commands.map(c => c.type === 'Z' ? 'Z' : c.type === 'M' || c.type === 'L' ? `${c.type}${f(c.x)} ${f(c.y)}` : c.type === 'Q' ? `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}` : `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`).join(' ');
  }
  function pdfPath(commands) {
    let current = {x:0,y:0}; let start = current;
    const out = [];
    for (const c of commands) {
      if (c.type === 'M') {out.push(`${f(c.x)} ${f(c.y)} m`); start = {x:c.x,y:c.y};}
      if (c.type === 'L') out.push(`${f(c.x)} ${f(c.y)} l`);
      if (c.type === 'C') out.push(`${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)} c`);
      if (c.type === 'Q') {
        const c1 = {x:current.x + (c.x1-current.x)*2/3,y:current.y + (c.y1-current.y)*2/3};
        const c2 = {x:c.x + (c.x1-c.x)*2/3,y:c.y + (c.y1-c.y)*2/3};
        out.push(`${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(c.x)} ${f(c.y)} c`);
      }
      if (c.type === 'Z') {out.push('h'); current = start;} else current = {x:c.x,y:c.y};
    }
    return out.join('\n');
  }
  function createPDF(design) {
    let content = `q\n${f(PT)} 0 0 ${f(-PT)} 0 ${f(PAGE.height*PT)} cm\n0 g\n0 G\n1 J\n1 j\n`;
    if (design.mirror) content += '-1 0 0 1 210 0 cm\n';
    const gray=1-clamp(design.darkness??1,0,1);content+=`${f(gray)} g\n${f(gray)} G\n`;
    for(const layer of design.layers||[{commands:design.commands}])if(layer.commands.length)content+=`${pdfPath(layer.commands)}\nf\n`;
    for (const stroke of design.strokes) {
      if (stroke.points.length < 2) continue;
      content += `${f(stroke.width)} w\n${f(stroke.points[0].x)} ${f(stroke.points[0].y)} m\n`;
      content += stroke.points.slice(1).map(p => `${f(p.x)} ${f(p.y)} l`).join('\n')+'\nS\n';
    }
    content += 'Q\n';
    if (design.calibration) content += `q\n${f(PT)} 0 0 ${f(-PT)} 0 ${f(PAGE.height*PT)} cm\n0 G\n0.2 w\n150.1 237.1 49.8 49.8 re\nS\nQ\n`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(210*PT)} ${f(297*PT)}] /Resources << >> /Contents 4 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}endstream`,
      '<< /Title (Stencil A4 - actual size) /Creator (Stencil) >>'
    ];
    let pdf = '%PDF-1.4\n%Stencil vector document\n';
    const offsets = [0];
    objects.forEach((object,index) => {offsets.push(pdf.length); pdf += `${index+1} 0 obj\n${object}\nendobj\n`;});
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    pdf += offsets.slice(1).map(offset => String(offset).padStart(10,'0')+' 00000 n \n').join('');
    pdf += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(pdf);
  }
  function createSVG(design) {
    const mirror = design.mirror ? ' transform="translate(210 0) scale(-1 1)"' : '';
    const gray=Math.round((1-clamp(design.darkness??1,0,1))*255),ink=`rgb(${gray},${gray},${gray})`;
    let markup = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><g${mirror} fill="${ink}">`;
    for(const layer of design.layers||[{commands:design.commands}])if(layer.commands.length)markup+=`<path d="${pathData(layer.commands)}"/>`;
    markup += design.strokes.map(stroke => `<polyline points="${stroke.points.map(p => `${f(p.x)},${f(p.y)}`).join(' ')}" fill="none" stroke="${ink}" stroke-width="${f(stroke.width)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    markup += '</g>';
    if (design.calibration) markup += '<rect x="150.1" y="237.1" width="49.8" height="49.8" fill="none" stroke="#000" stroke-width="0.2"/>';
    return markup+'</svg>';
  }
  // Evaluate extrema of the curves themselves, not their control-point hull.
  function pathBounds(commands) {
    const bounds = {x1:Infinity,y1:Infinity,x2:-Infinity,y2:-Infinity};
    let current={x:0,y:0},start=current;
    const add=(x,y)=>{bounds.x1=Math.min(bounds.x1,x);bounds.y1=Math.min(bounds.y1,y);bounds.x2=Math.max(bounds.x2,x);bounds.y2=Math.max(bounds.y2,y);};
    const cubic=(a,b,c,d,t)=>{const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;};
    const roots=(a,b,c,d)=>{const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a;if(Math.abs(A)<1e-12)return Math.abs(B)<1e-12?[]:[-C/B];const delta=B*B-4*A*C;return delta<0?[]:[(-B+Math.sqrt(delta))/(2*A),(-B-Math.sqrt(delta))/(2*A)];};
    for(const c of commands){
      if(c.type==='M'){current={x:c.x,y:c.y};start=current;add(c.x,c.y);continue;}
      if(c.type==='Z'){current=start;continue;}
      if(c.type==='Q'){
        for(const axis of ['x','y']){const a=current[axis],b=c[axis+'1'],d=c[axis],den=a-2*b+d,t=den?((a-b)/den):-1;if(t>0&&t<1){const u=1-t;add(u*u*current.x+2*u*t*c.x1+t*t*c.x,u*u*current.y+2*u*t*c.y1+t*t*c.y);}}
      }
      if(c.type==='C'){
        for(const axis of ['x','y'])for(const t of roots(current[axis],c[axis+'1'],c[axis+'2'],c[axis]))if(t>0&&t<1)add(cubic(current.x,c.x1,c.x2,c.x,t),cubic(current.y,c.y1,c.y2,c.y,t));
      }
      add(c.x,c.y);current={x:c.x,y:c.y};
    }
    return Number.isFinite(bounds.x1)?bounds:{x1:0,y1:0,x2:0,y2:0};
  }
  function mapPath(commands,transform){return commands.map(c=>{const out={type:c.type};for(const suffix of ['', '1', '2'])if(Number.isFinite(c['x'+suffix])&&Number.isFinite(c['y'+suffix])){const p=transform(c['x'+suffix],c['y'+suffix]);out['x'+suffix]=p.x;out['y'+suffix]=p.y;}return out;});}
  function mirroredPosition(x,width){return PAGE.width-x-width;}
  function transformPath(path,width,height,angle,x,y){
    const source=pathBounds(path.commands);const sw=source.x2-source.x1,sh=source.y2-source.y1;
    if(!path.commands.length||sw<=0||sh<=0)return {commands:[],width:0,height:0};
    const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
    const rotated=mapPath(path.commands,(px,py)=>{const a=(px-source.x1)*width/sw,b=(py-source.y1)*height/sh;return {x:a*cos-b*sin,y:a*sin+b*cos};});
    const box=pathBounds(rotated);
    return {commands:mapPath(rotated,(px,py)=>({x:px-box.x1+x,y:py-box.y1+y})),width:box.x2-box.x1,height:box.y2-box.y1};
  }
  const IMPORT_LIMIT=16*1024*1024;
  function fontEntries(bytes,filename,unzip){
    if(bytes.byteLength>IMPORT_LIMIT)throw Error('Filen är för stor. Välj en fil på högst 16 MB.');
    if(/\.(ttf|otf)$/i.test(filename))return [{name:filename,bytes}];
    if(!/\.zip$/i.test(filename))throw Error('Välj en TTF-, OTF- eller ZIP-fil.');
    if(!unzip)throw Error('ZIP-stödet kunde inte laddas. Prova en uppackad TTF- eller OTF-fil.');
    let count=0,total=0;
    const files=unzip(bytes,{filter(file){
      if(!/\.(ttf|otf)$/i.test(file.name)||/(^|\/)__MACOSX\//.test(file.name)||/(^|\/)\._/.test(file.name))return false;
      if(++count>20||file.originalSize>IMPORT_LIMIT||(total+=file.originalSize)>32*1024*1024)throw Error('ZIP-filen innehåller för många eller för stora typsnitt. Välj ett enskilt TTF- eller OTF-typsnitt.');
      return true;
    }});
    const entries=Object.entries(files).map(([name,data])=>({name:name.split(/[\\/]/).pop(),bytes:data}));
    if(!entries.length)throw Error('ZIP-filen innehåller inga TTF- eller OTF-typsnitt.');
    if(entries.some(entry=>entry.bytes.byteLength>IMPORT_LIMIT)||entries.reduce((sum,entry)=>sum+entry.bytes.byteLength,0)>32*1024*1024)throw Error('Typsnitten i ZIP-filen är för stora.');
    return entries;
  }
  const core={PAGE,PT,normalizePath,pathBounds,mapPath,transformPath,mirroredPosition,fontEntries,pathData,pdfPath,createPDF,createSVG};
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(typeof document==='undefined')return;
  window.StencilWorkshopCore=core;
  const root=document.getElementById('verkstad');if(!root)return;
  const catalog=window.StencilFonts||[];
  const initialFont=catalog.find(font=>font.id==='cormorant-garamond')||catalog[0];
  root.classList.add('stencil-workshop');root.setAttribute('aria-labelledby','workshop-title');
  root.innerHTML=`<div class="section-top"><span class="eyebrow">02 — STENCILVERKSTADEN</span><span class="eyebrow">FRÅN SKÄRM TILL HUD</span></div>
    <div class="workshop-heading"><h2 id="workshop-title">Din form.<br><em>Rätt mått.</em></h2><p>A4. Millimeter. Ditt uttryck.<br>Skapa originalet som ska bli din stencil.</p></div>
    <div class="workshop-layout"><div class="workshop-controls">
      <div class="workshop-mode" role="group" aria-label="Verktyg"><button type="button" id="ws-text-mode" aria-pressed="true">01 / Text & flytta</button><button type="button" id="ws-draw-mode" aria-pressed="false">02 / Rita</button></div>
      <div class="ws-control-block ws-text-settings"><label for="ws-text">DIN TEXT</label><input id="ws-text" type="text" value="Stay true." maxlength="100" autocomplete="off"><label for="ws-font">TYPSNITT</label><select id="ws-font" aria-describedby="ws-weight-note"></select><p class="ws-hint" id="ws-weight-note">Typsnittets originalvikt används i både provet och utskriften.</p><button type="button" id="ws-import" class="ws-import-button">Importera typsnitt <span aria-hidden="true">↗</span></button><input id="ws-import-file" type="file" accept=".ttf,.otf,.zip" hidden><p class="ws-hint">TTF, OTF eller ZIP · högst 16 MB. Filen stannar i din webbläsare under besöket. Kontrollera typsnittets licens innan användning.</p><p id="ws-import-status" class="ws-hint" role="status" aria-live="polite"></p></div>
      <div class="ws-control-block ws-size-settings"><div class="ws-dimensions"><label for="ws-width">SYNLIG BREDD (mm)<input id="ws-width" type="text" inputmode="decimal" value="" aria-describedby="ws-height-help"></label><label for="ws-height">SYNLIG HÖJD (mm)<input id="ws-height" type="text" inputmode="decimal" value="18" aria-describedby="ws-height-help"></label></div><label class="ws-check"><input id="ws-lock" type="checkbox" checked> Lås proportionerna</label><p class="ws-hint" id="ws-height-help">Den synliga textens mått före rotation, inklusive prickar och accenter. 2,1 mm här = 2,1 mm i originalfilen.</p><label class="ws-rotation" for="ws-rotation">ROTATION (grader)<input id="ws-rotation" type="text" inputmode="decimal" value="0"></label><div class="ws-position"><label>FRÅN VÄNSTER (mm)<input id="ws-x" type="text" inputmode="decimal" value="25"></label><label>FRÅN OVANKANT (mm)<input id="ws-y" type="text" inputmode="decimal" value="45"></label></div><p class="ws-hint">Positionen gäller ytterkanten efter rotation och spegling. Dra texten på arket eller använd måtten ovan.</p><button class="ws-inline-button" id="ws-center" type="button">Centrera texten ↔</button></div>
      <div class="ws-control-block ws-pen-settings" id="ws-pen-settings" hidden><div class="ws-dimension-title"><label for="ws-pen-width">PENNANS LINJEBREDD</label><span>mm</span></div><input id="ws-pen-width" type="text" inputmode="decimal" value="0,6"><p class="ws-hint">Rita med penna, finger eller mus. Linjebredden är konstant för exakta mått. Svep utanför pappret för att bläddra.</p><div class="ws-drawing-actions"><button type="button" id="ws-undo" disabled>Ångra streck</button><button type="button" id="ws-clear" disabled>Rensa teckning</button></div></div>
      <div class="ws-control-block ws-options"><label><input id="ws-mirror" type="checkbox"> Spegelvänd motivet</label><label><input id="ws-calibration" type="checkbox"> Lägg till kontrollruta, 50 × 50 mm</label><p class="ws-hint">Kontrollrutan skrivs ut. Mät mellan dess ytterkanter.</p></div>
      <p id="ws-message" class="ws-message" role="status" aria-live="polite">Laddar typsnittet…</p><div class="ws-export"><button type="button" id="ws-pdf" class="solid-button" disabled>Hämta A4-PDF <span aria-hidden="true">↓</span></button><div><button type="button" id="ws-svg" disabled>Hämta SVG ↗</button><button type="button" id="ws-print" disabled>Skriv ut ↗</button></div></div>
      <details class="ws-print-help"><summary>Så behåller du rätt storlek <span aria-hidden="true">+</span></summary><p>Välj A4 och <strong>100 % / faktisk storlek</strong> i utskriftsdialogen. Stäng av ”anpassa till sida” samt sidhuvud och sidfot. Använd helst PDF-filen och kontrollera först måtten med kontrollrutan på vanligt papper.</p><p>Förhandsvisningen anpassas till din skärm och är inte fysiskt skalenlig. Skrivaren och dess inställningar avgör det slutliga måttet på papper. Använd papper som din skrivare stöder.</p></details>
    </div><div class="workshop-preview"><div class="ws-preview-meta"><span>A4 / 210 × 297 mm</span><span id="ws-mode-label">TEXT & FLYTTA</span></div><div class="ws-zoom-row"><label for="ws-zoom">SKÄRMZOOM</label><select id="ws-zoom"><option value="fit">Anpassa till fönstret</option><option value="1">100 %</option><option value="1.5">150 %</option><option value="2">200 %</option></select></div><div class="ws-paper-viewport"><div class="ws-paper-frame"><svg id="ws-sheet" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm" role="img" aria-label="Förhandsvisning av A4-stencil"><defs><pattern id="ws-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d8dbd5" stroke-width="0.13"/></pattern></defs><rect width="210" height="297" fill="white"/><rect x="10" y="10" width="190" height="277" fill="url(#ws-grid)"/><rect x="10" y="10" width="190" height="277" fill="none" stroke="#c1c7ba" stroke-width="0.25" stroke-dasharray="1.3 1.3"/><g id="ws-art"><path id="ws-text-path" fill="#10120f"/><g id="ws-strokes"/></g><rect id="ws-selection" fill="transparent" stroke="#667353" stroke-width="0.25" stroke-dasharray="1 1" tabindex="0" role="button" aria-label="Flytta texten med piltangenter, en millimeter per steg. Håll Skift för tio millimeter." hidden/><rect id="ws-control-square" x="150.1" y="237.1" width="49.8" height="49.8" fill="none" stroke="#000" stroke-width="0.2" hidden/></svg></div></div><div class="ws-paper-caption"><p id="ws-measure">Textens mått: —</p><span>10 mm säkerhetsmarginal</span></div><p class="ws-preview-note">Rutnät, markeringsram och marginal följer inte med i filen. Dra texten för att placera den. En markerad text kan flyttas med piltangenterna.</p></div></div>`;
  const q=selector=>root.querySelector(selector),ns='http://www.w3.org/2000/svg';
  const state={font:null,fontId:initialFont?.id,text:'Stay true.',height:18,width:0,x:25,y:45,angle:0,commands:[],footprintWidth:0,footprintHeight:0,sizeAxis:'height',valid:false,loading:true,mode:'text',penWidth:.6,mirror:false,calibration:false,strokes:[],activeStroke:null,pointerId:null,drag:null,fontRequest:0,importCount:0};
  const fontCache=new Map(),imported=new Map();
  const builtInGroup=document.createElement('optgroup');builtInGroup.label='Typsnitt i Stencil';q('#ws-font').append(builtInGroup);
  const importedGroup=document.createElement('optgroup');importedGroup.label='Dina egna och importerade typsnitt';
  function optionFor(font,group){const option=document.createElement('option');option.value=font.id;option.textContent=font.name;group.append(option);}
  catalog.forEach(font=>optionFor(font,builtInGroup));if(initialFont)q('#ws-font').value=initialFont.id;
  // Keep the select as the shared value for catalogue links and font imports.
  // A custom list is needed because native select menus ignore font styling on many devices.
  const nativeFont=q('#ws-font');nativeFont.hidden=true;
  nativeFont.insertAdjacentHTML('afterend',`<div class="ws-font-picker"><button type="button" id="ws-font-toggle" aria-haspopup="listbox" aria-expanded="false" aria-controls="ws-font-list" aria-labelledby="ws-font-label ws-font-current"><span id="ws-font-current"></span><span aria-hidden="true">⌄</span></button><div class="ws-font-popup" hidden><label for="ws-font-search">Sök typsnitt</label><input id="ws-font-search" type="search" placeholder="Sök på namn…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ws-font-list"><div id="ws-font-list" role="listbox" aria-label="Typsnitt"></div><p id="ws-font-empty" role="status" hidden>Inga typsnitt matchar sökningen.</p></div></div>`);
  q('label[for="ws-font"]').id='ws-font-label';q('#ws-font-label').htmlFor='ws-font-toggle';
  const picker=q('.ws-font-picker'),fontToggle=q('#ws-font-toggle'),fontPopup=q('.ws-font-popup'),fontSearch=q('#ws-font-search'),fontList=q('#ws-font-list');
  const previewFaces=new Map();let visibleFonts=[],activeFont=-1;
  function allFonts(){return [...catalog,...imported.values()];}
  async function previewFont(font,element){
    const family=`StencilPreview-${font.id}`;
    element.style.fontFamily=`"${family}", serif`;
    if(!previewFaces.has(font.id)){
      const source=font.previewBytes||`url("assets/fonts/${encodeURIComponent(font.id)}.ttf")`;
      const face=new FontFace(family,source);
      previewFaces.set(font.id,face.load().then(loaded=>{document.fonts.add(loaded);return true;}).catch(()=>false));
    }
    if(!await previewFaces.get(font.id)){element.style.fontFamily='';element.title='Typsnittets förhandsvisning kunde inte laddas.';}
  }
  const fontObserver=window.IntersectionObserver?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const font=allFonts().find(item=>item.id===entry.target.dataset.fontId);if(font)previewFont(font,entry.target);fontObserver.unobserve(entry.target);}},{root:fontList,rootMargin:'100px'}):null;
  function activateFont(index,scroll=true){
    activeFont=index;
    [...fontList.children].forEach((row,i)=>row.classList.toggle('is-active',i===index));
    const row=fontList.children[index];
    if(row){fontSearch.setAttribute('aria-activedescendant',row.id);if(scroll)row.scrollIntoView({block:'nearest'});}else fontSearch.removeAttribute('aria-activedescendant');
  }
  function renderFontList(){
    fontObserver?.disconnect();fontList.replaceChildren();
    const query=fontSearch.value.trim().toLocaleLowerCase('sv');
    visibleFonts=allFonts().filter(font=>font.name.toLocaleLowerCase('sv').includes(query));
    visibleFonts.forEach((font,index)=>{
      const row=document.createElement('div');row.id=`ws-font-option-${index}`;row.dataset.fontId=font.id;row.setAttribute('role','option');row.setAttribute('aria-selected',String(font.id===nativeFont.value));
      const name=document.createElement('span');name.className='ws-font-name';name.textContent=font.name;name.dataset.fontId=font.id;
      const check=document.createElement('span');check.className='ws-font-check';check.setAttribute('aria-hidden','true');check.textContent=font.id===nativeFont.value?'✓':'';
      row.append(name,check);row.addEventListener('click',()=>chooseFont(font.id));fontList.append(row);
      if(fontObserver)fontObserver.observe(name);else previewFont(font,name);
    });
    q('#ws-font-empty').hidden=visibleFonts.length>0;
    activateFont(Math.max(0,visibleFonts.findIndex(font=>font.id===nativeFont.value)),false);
  }
  function syncFontPicker(){const font=allFonts().find(item=>item.id===nativeFont.value);if(font){q('#ws-font-current').textContent=font.name;previewFont(font,q('#ws-font-current'));}}
  function closeFontPicker(focus=false){fontPopup.hidden=true;fontToggle.setAttribute('aria-expanded','false');fontSearch.setAttribute('aria-expanded','false');if(focus)fontToggle.focus();}
  function openFontPicker(){fontPopup.hidden=false;fontToggle.setAttribute('aria-expanded','true');fontSearch.setAttribute('aria-expanded','true');fontSearch.value='';renderFontList();fontSearch.focus();activateFont(activeFont);}
  function chooseFont(id){nativeFont.value=id;closeFontPicker(true);nativeFont.dispatchEvent(new Event('change',{bubbles:true}));}
  fontToggle.addEventListener('click',()=>fontPopup.hidden?openFontPicker():closeFontPicker());
  fontToggle.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();openFontPicker();}});
  fontSearch.addEventListener('input',renderFontList);
  fontSearch.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();activateFont(clamp(activeFont+(event.key==='ArrowDown'?1:-1),0,visibleFonts.length-1));}
    if(event.key==='Enter'){event.preventDefault();if(visibleFonts[activeFont])chooseFont(visibleFonts[activeFont].id);}
  });
  picker.addEventListener('keydown',event=>{if(event.key==='Escape'&&!fontPopup.hidden){event.preventDefault();event.stopPropagation();closeFontPicker(true);}});
  picker.addEventListener('focusout',event=>{if(!picker.contains(event.relatedTarget))closeFontPicker();});
  // Keep focus on the search field while selecting an option with mouse or touch.
  fontList.addEventListener('pointerdown',event=>event.preventDefault());
  document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target))closeFontPicker();});
  syncFontPicker();
  const svg=q('#ws-sheet');
  function resizePreview(){const viewport=q('.ws-paper-viewport'),frame=q('.ws-paper-frame'),availableHeight=matchMedia('(max-width:760px)').matches?Math.min(320,Math.max(260,window.innerHeight-245)):Math.max(260,window.innerHeight-245),fitWidth=Math.min(viewport.clientWidth,availableHeight*210/297),zoom=q('#ws-zoom').value;frame.style.width=`${zoom==='fit'?fitWidth:(210*96/25.4)*Number(zoom)}px`;viewport.style.height=`${fitWidth*297/210}px`;}
  q('#ws-zoom').addEventListener('change',resizePreview);if(window.ResizeObserver)new ResizeObserver(resizePreview).observe(q('.ws-paper-viewport'));window.addEventListener('resize',resizePreview);requestAnimationFrame(resizePreview);
  function mm(value){const number=Number(String(value).trim().replace(',','.'));return String(value).trim()&&Number.isFinite(number)?number:NaN;}
  const show=n=>Number(n.toFixed(3)).toString().replace('.',',');
  const automaticValues=new Map();
  function fieldValue(id){const input=q(id),saved=automaticValues.get(id);return saved&&saved.text===input.value?saved.value:mm(input.value);}
  function setField(id,value){const text=show(value);q(id).value=text;automaticValues.set(id,{text,value});}
  function error(message){state.valid=false;q('#ws-message').textContent=message;q('#ws-message').classList.add('is-error');q('#ws-selection').setAttribute('hidden','');q('#ws-letter-handles')?.replaceChildren();updateActions();}
  function updateActions(){const any=state.commands.length||state.strokes.length||state.calibration;['#ws-pdf','#ws-svg','#ws-print'].forEach(id=>q(id).disabled=state.loading||!state.valid||!any);q('#ws-undo').disabled=q('#ws-clear').disabled=state.strokes.length===0;}
  function geometry(commitPosition=false,preserveLetterAnchor=false){
    q('#ws-message').classList.remove('is-error');state.text=q('#ws-text').value;
    let width=fieldValue('#ws-width'),height=fieldValue('#ws-height');
    let requestedX=fieldValue('#ws-x'),requestedY=fieldValue('#ws-y');
    const pen=mm(q('#ws-pen-width').value),angle=mm(q('#ws-rotation').value),locked=q('#ws-lock').checked;
    if(![height,requestedX,requestedY,pen,angle].every(Number.isFinite)||(!locked&&!Number.isFinite(width))||(locked&&state.sizeAxis==='width'&&!Number.isFinite(width)))return error('Ange giltiga mått, till exempel 2,1.');
    if(height<.1||height>1000||(!locked||state.sizeAxis==='width')&&(width<.1||width>1000))return error('Textens bredd och höjd måste vara mellan 0,1 och 1000 mm.');
    if(pen<.1||pen>10)return error('Pennans linjebredd måste vara mellan 0,1 och 10 mm.');
    if(angle<-360||angle>360)return error('Ange en rotation mellan −360 och 360 grader.');
    state.penWidth=pen;state.angle=angle;if(state.loading||!state.font)return;
    const missing=[...new Set([...state.text].filter(character=>!/\s/.test(character)&&!state.font.charToGlyphIndex(character)))];if(missing.length)return error(`Typsnittet saknar följande tecken: ${missing.join(' ')}. Välj ett annat typsnitt eller ändra texten.`);
    let raw,model;
    try{
      const lettering=window.StencilLettering;
      raw=lettering?.enabled?window.StencilLetterCore.base(state.font,state.text):state.font.getPath(state.text,0,0,1000,{kerning:true});
      const box=pathBounds(raw.commands),ratio=(box.x2-box.x1)/(box.y2-box.y1);
      if(raw.commands.length&&Number.isFinite(ratio)&&ratio>0){if(locked){if(state.sizeAxis==='width')height=width/ratio;else width=height*ratio;}else if(!Number.isFinite(width))width=height*ratio;}else width=Number.isFinite(width)?width:0;
      model=lettering?.enabled?lettering.layout(raw,width,height,angle):transformPath(raw,width,height,angle,0,0);
    }catch(problem){return error(problem.message||'Texten kunde inte skapas i det här typsnittet. Välj ett annat.');}
    if(raw.commands.length){if(locked&&state.sizeAxis==='height')setField('#ws-width',width);if(locked&&state.sizeAxis==='width')setField('#ws-height',height);}
    if(preserveLetterAnchor&&state.letterOrigin&&Number.isFinite(model.originX)){
      const dx=model.originX-state.letterOrigin.x,dy=model.originY-state.letterOrigin.y;
      requestedX+=state.mirror?-dx-model.width+state.footprintWidth:dx;requestedY+=dy;
      setField('#ws-x',requestedX);setField('#ws-y',requestedY);
    }
    state.letterOrigin=Number.isFinite(model.originX)?{x:model.originX,y:model.originY}:null;
    state.width=width;state.height=height;state.footprintWidth=model.width;state.footprintHeight=model.height;
    if(model.width>190+1e-8||model.height>277+1e-8){state.commands=[];q('#ws-text-path').removeAttribute('d');q('#ws-measure').textContent=`Efter rotation: ${show(model.width)} × ${show(model.height)} mm`;return error('Texten ryms inte inom utskriftsytan efter rotation. Minska måtten eller ändra vinkeln. Ingen automatisk skalning görs.');}
    const boundedX=clamp(requestedX,10,200-model.width),boundedY=clamp(requestedY,10,287-model.height);
    if(!commitPosition&&(Math.abs(boundedX-requestedX)>1e-7||Math.abs(boundedY-requestedY)>1e-7))return error('Positionen ligger utanför säkerhetsmarginalen. Avsluta inmatningen för att placera texten innanför pappret.');
    state.x=boundedX;state.y=boundedY;const moved=Math.abs(state.x-requestedX)>1e-7||Math.abs(state.y-requestedY)>1e-7;
    if(state.x!==requestedX)setField('#ws-x',state.x);if(state.y!==requestedY)setField('#ws-y',state.y);
    const underlyingX=state.mirror?mirroredPosition(state.x,model.width):state.x;
    state.commands=mapPath(model.commands,(x,y)=>({x:x+underlyingX,y:y+state.y}));
    state.layers=model.layers?.map(layer=>({...layer,commands:mapPath(layer.commands,(x,y)=>({x:x+underlyingX,y:y+state.y}))}));
    q('#ws-text-path').setAttribute('d',pathData(state.commands));q('#ws-art').setAttribute('transform',state.mirror?'translate(210 0) scale(-1 1)':'');q('#ws-control-square').toggleAttribute('hidden',!state.calibration);
    const selection=q('#ws-selection');selection.setAttribute('x',f(state.x));selection.setAttribute('y',f(state.y));selection.setAttribute('width',f(model.width));selection.setAttribute('height',f(model.height));selection.toggleAttribute('hidden',!state.commands.length||state.mode!=='text');
    q('#ws-measure').textContent=state.commands.length?`Yta efter rotation: ${model.width.toFixed(2).replace('.',',')} × ${model.height.toFixed(2).replace('.',',')} mm`:'Ingen text på arket';
    state.valid=true;q('#ws-message').textContent=moved?'Texten flyttades innanför papprets 10 mm säkerhetsmarginal.':state.commands.length||state.strokes.length||state.calibration?'Redo för A4. Originalets mått ändras inte vid export.':'Skriv en text eller välj Rita och skapa ditt motiv.';updateActions();
    window.StencilLettering?.render(state,model);
  }
  async function loadFont(id){
    syncFontPicker();
    q('#ws-letter-paths')?.replaceChildren();q('#ws-letter-handles')?.replaceChildren();
    const request=++state.fontRequest;state.loading=true;state.valid=false;state.fontId=id;state.commands=[];q('#ws-text-path').removeAttribute('d');q('#ws-selection').setAttribute('hidden','');q('#ws-message').classList.remove('is-error');q('#ws-message').textContent='Laddar typsnittets konturer…';updateActions();
    try{if(!window.opentype)throw Error('Parser unavailable');if(!fontCache.has(id)){const response=await fetch(`assets/fonts/${encodeURIComponent(id)}.ttf`);if(!response.ok)throw Error('Font unavailable');fontCache.set(id,window.opentype.parse(await response.arrayBuffer()));}if(request!==state.fontRequest)return;state.font=fontCache.get(id);state.loading=false;geometry(true);}catch{if(request!==state.fontRequest)return;state.loading=false;state.font=null;error('Typsnittet kunde inte laddas. Välj ett annat typsnitt och försök igen.');}
  }
  q('#ws-import').addEventListener('click',()=>q('#ws-import-file').click());
  q('#ws-import-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;const status=q('#ws-import-status'),button=q('#ws-import');button.disabled=true;status.textContent='Läser typsnittet lokalt…';
    try{
      if(file.size>IMPORT_LIMIT)throw Error('Filen är för stor. Välj en fil på högst 16 MB.');
      if(!window.opentype)throw Error('Typsnittsläsaren kunde inte laddas. Ladda om sidan och försök igen.');
      let entries;try{entries=fontEntries(new Uint8Array(await file.arrayBuffer()),file.name,window.fflate?.unzipSync);}catch(problem){if(problem instanceof Error&&/[åäö]|ZIP|TTF|OTF/.test(problem.message))throw problem;throw Error('ZIP-filen kunde inte öppnas. Prova att packa upp filen och välj dess TTF- eller OTF-fil.');}
      const added=[],failed=[];
      for(const entry of entries){try{const data=entry.bytes;const parsed=window.opentype.parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));if(!parsed.numGlyphs)throw Error('Empty font');const name=parsed.names.fullName?.en||parsed.names.fontFamily?.en||entry.name.replace(/\.(ttf|otf)$/i,'');const id=`imported-${++state.importCount}`;fontCache.set(id,parsed);const font={id,name:String(name).slice(0,100),previewBytes:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};imported.set(id,font);added.push(font);}catch{failed.push(entry.name);}}
      if(!added.length)throw Error('Inget läsbart typsnitt hittades. Filen kan vara skadad eller använda ett format som inte stöds. Prova en annan TTF- eller OTF-fil.');
      if(!importedGroup.isConnected)q('#ws-font').append(importedGroup);added.forEach(font=>optionFor(font,importedGroup));q('#ws-font').value=added[0].id;await loadFont(added[0].id);
      status.textContent=`${added.length} ${added.length===1?'typsnitt importerat':'typsnitt importerade'} för det här besöket.${failed.length?` ${failed.length} filer kunde inte läsas.`:''}`;
    }catch(problem){status.textContent=problem.message||'Typsnittet kunde inte importeras.';}finally{button.disabled=false;event.target.value='';}
  });
  function setMode(mode){state.mode=mode;q('#ws-text-mode').setAttribute('aria-pressed',String(mode==='text'));q('#ws-draw-mode').setAttribute('aria-pressed',String(mode==='draw'));q('#ws-pen-settings').hidden=mode!=='draw';svg.classList.toggle('is-drawing',mode==='draw');q('#ws-mode-label').textContent=mode==='draw'?'RITA PÅ PAPPRET':'TEXT & FLYTTA';q('#ws-selection').toggleAttribute('hidden',mode!=='text'||!state.valid||!state.commands.length);}
  ['#ws-text','#ws-width','#ws-height','#ws-x','#ws-y','#ws-pen-width','#ws-rotation'].forEach(id=>{q(id).addEventListener('input',()=>{automaticValues.delete(id);if(id==='#ws-width'||id==='#ws-height')state.sizeAxis=id.slice(4);geometry(false);});q(id).addEventListener('change',()=>geometry(true));});
  q('#ws-lock').addEventListener('change',()=>geometry(true));q('#ws-font').addEventListener('change',event=>loadFont(event.target.value));q('#ws-text-mode').addEventListener('click',()=>setMode('text'));q('#ws-draw-mode').addEventListener('click',()=>setMode('draw'));
  q('#ws-center').addEventListener('click',()=>{if(state.valid){setField('#ws-x',(210-state.footprintWidth)/2);geometry(true);}});
  q('#ws-mirror').addEventListener('change',event=>{if(state.valid&&event.target.checked!==state.mirror)setField('#ws-x',mirroredPosition(state.x,state.footprintWidth));state.mirror=event.target.checked;geometry(true);});q('#ws-calibration').addEventListener('change',event=>{state.calibration=event.target.checked;geometry(true);});
  function renderStrokes(){const group=q('#ws-strokes');group.replaceChildren();const gray=Math.round((1-(window.StencilLettering?.darkness??1))*255);for(const stroke of state.strokes){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',stroke.points.map(point=>`${f(point.x)},${f(point.y)}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',`rgb(${gray},${gray},${gray})`);line.setAttribute('stroke-width',f(stroke.width));line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');group.append(line);}updateActions();}
  function paperPoint(event){const matrix=svg.getScreenCTM();if(!matrix)return null;return new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());}
  function point(event){const p=paperPoint(event);if(!p)return null;const radius=state.penWidth/2;return {x:clamp(state.mirror?210-p.x:p.x,10+radius,200-radius),y:clamp(p.y,10+radius,287-radius)};}
  svg.addEventListener('pointerdown',event=>{
    if(state.pointerId!==null||!state.valid||event.button>0)return;
    if(state.mode==='text'){
      if(event.target.id!=='ws-selection')return;const p=paperPoint(event);if(!p)return;event.preventDefault();state.pointerId=event.pointerId;state.drag={start:p,x:state.x,y:state.y};svg.setPointerCapture(event.pointerId);q('#ws-selection').focus({preventScroll:true});svg.classList.add('is-dragging');return;
    }
    event.preventDefault();const start=point(event);if(!start)return;state.pointerId=event.pointerId;svg.setPointerCapture(event.pointerId);state.activeStroke={width:state.penWidth,points:[start,{x:start.x+.0001,y:start.y}]};state.strokes.push(state.activeStroke);renderStrokes();
  });
  svg.addEventListener('pointermove',event=>{
    if(event.pointerId!==state.pointerId)return;event.preventDefault();
    if(state.drag){const p=paperPoint(event);if(p){setField('#ws-x',state.drag.x+p.x-state.drag.start.x);setField('#ws-y',state.drag.y+p.y-state.drag.start.y);geometry(true);}return;}
    if(!state.activeStroke)return;const coalesced=event.getCoalescedEvents?event.getCoalescedEvents():[];for(const sample of(coalesced.length?coalesced:[event])){const p=point(sample);if(p){const last=state.activeStroke.points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)>.08)state.activeStroke.points.push(p);}}renderStrokes();
  });
  function endPointer(event){if(event.pointerId!==state.pointerId)return;state.activeStroke=null;state.pointerId=null;state.drag=null;svg.classList.remove('is-dragging');if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);geometry(true);}
  svg.addEventListener('pointerup',endPointer);svg.addEventListener('pointercancel',endPointer);svg.addEventListener('lostpointercapture',endPointer);
  q('#ws-selection').addEventListener('keydown',event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},delta=directions[event.key];if(!delta||!state.valid||state.mode!=='text')return;event.preventDefault();const step=event.shiftKey?10:1;setField('#ws-x',state.x+delta[0]*step);setField('#ws-y',state.y+delta[1]*step);geometry(true);});
  q('#ws-undo').addEventListener('click',()=>{state.strokes.pop();renderStrokes();geometry(true);});q('#ws-clear').addEventListener('click',()=>{state.strokes=[];renderStrokes();geometry(true);});
  function design(){return {commands:state.commands,layers:state.layers,strokes:state.strokes,mirror:state.mirror,calibration:state.calibration,darkness:window.StencilLettering?.darkness??1};}
  function download(bytes,type,filename){const url=URL.createObjectURL(new Blob([bytes],{type})),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  q('#ws-pdf').addEventListener('click',()=>{if(!state.valid||state.loading)return;download(createPDF(design()),'application/pdf','stencil-a4-100-procent.pdf');q('#ws-message').textContent='A4-PDF skapad. Välj faktisk storlek / 100 % när du skriver ut.';});q('#ws-svg').addEventListener('click',()=>{if(state.valid&&!state.loading)download(createSVG(design()),'image/svg+xml','stencil-a4.svg');});
  let printSheet;function removePrintSheet(){printSheet?.remove();printSheet=null;document.body.classList.remove('stencil-printing');}
  q('#ws-print').addEventListener('click',()=>{if(!state.valid||state.loading)return;removePrintSheet();printSheet=document.createElement('div');printSheet.id='stencil-print-sheet';printSheet.innerHTML=createSVG(design());document.body.append(printSheet);document.body.classList.add('stencil-printing');window.print();});window.addEventListener('afterprint',removePrintSheet);
  window.StencilWorkshop={refresh(){geometry(true,true);},selectFont(id,text){if(!catalog.some(font=>font.id===id)&&!imported.has(id))return;if(typeof text==='string')q('#ws-text').value=text.slice(0,100);q('#ws-font').value=id;loadFont(id);setMode('text');root.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},getDesign(){return structuredClone(design());}};
  async function receiveCreatedFont(){
    const key='stencil-font-handoff-v1';let raw;
    try{raw=sessionStorage.getItem(key);}catch{return false;}
    if(!raw)return false;
    try{
      if(raw.length>16*1024*1024)throw Error('Typsnittsprojektet är för stort för att öppnas här.');
      const payload=JSON.parse(raw),maker=window.StencilFontCore;
      if(!maker||!window.opentype)throw Error('Bokstavsverkstaden kunde inte laddas. Försök igen från ditt typsnittsprojekt.');
      const project=maker.sanitizeProject(payload.project);
      const bytes=await maker.fontArrayBuffer(project,window.opentype);
      const parsed=window.opentype.parse(bytes);
      if(!parsed.numGlyphs)throw Error('Typsnittet saknar läsbara tecken.');
      const id=`created-${++state.importCount}`,font={id,name:`${project.name} · eget typsnitt`,previewBytes:bytes};
      fontCache.set(id,parsed);imported.set(id,font);
      if(!importedGroup.isConnected)q('#ws-font').append(importedGroup);
      optionFor(font,importedGroup);q('#ws-font').value=id;
      const sample=typeof payload.sample==='string'?payload.sample.normalize('NFC').slice(0,100):'';
      q('#ws-text').value=sample.trim()?sample:Object.keys(project.glyphs).filter(character=>parsed.charToGlyphIndex(character)).join('').slice(0,100);
      await loadFont(id);setMode('text');
      if(state.font!==parsed)throw Error('Ditt typsnitt kunde inte öppnas. Försök igen från bokstavsverkstaden.');
      try{sessionStorage.removeItem(key);}catch{}
      q('#ws-import-status').textContent=`Ditt typsnitt ”${project.name}” är öppnat. Ange måtten och exportera som A4-stencil. Dina ritade bokstäver finns kvar i bokstavsverkstaden.`;
      return true;
    }catch(problem){
      q('#ws-import-status').textContent=problem instanceof Error&&/[åäö]/i.test(problem.message)?problem.message:'Ditt typsnittsprojekt kunde inte öppnas. Gå tillbaka till bokstavsverkstaden och försök igen. Ditt sparade utkast är kvar.';
      return false;
    }
  }
  async function startWorkshop(){if(await receiveCreatedFont())return;if(initialFont)loadFont(initialFont.id);else error('Typsnittsbiblioteket saknas. Ladda om sidan.');}
  startWorkshop();
})();
