(function(){
  'use strict';
  const root=document.getElementById('verkstad'),workshop=window.StencilWorkshop,core=window.StencilWorkshopCore;
  if(!root||!workshop||!window.StencilLetterCore)return;
  const q=s=>root.querySelector(s),ns='http://www.w3.org/2000/svg';
  const data={enabled:false,edits:[],tracking:0,darkness:1,selected:0,characters:[]},undo=[],redo=[];
  let lastState=null,drag=null;
  q('.ws-size-settings').insertAdjacentHTML('afterend',`<div class="ws-control-block ws-letter-settings"><label class="ws-check"><input id="ws-letter-enable" type="checkbox"> Finjustera bokstav för bokstav</label><p class="ws-hint">Välj en bokstav nedan eller på arket. Flytta, vrid, spegla och forma varje tecken fritt.</p><div id="ws-letter-tools" hidden><div id="ws-letter-chips" role="group" aria-label="Välj bokstav"></div><p class="ws-hint" id="ws-letter-selected" aria-live="polite"></p><div class="ws-letter-fields"><label>Flytta höger/vänster (mm)<input data-letter="x" value="0" inputmode="decimal"></label><label>Flytta ner/upp (mm)<input data-letter="y" value="0" inputmode="decimal"></label><label>Rotation (°)<input data-letter="angle" value="0" inputmode="decimal"></label><label>Extra avstånd efter (mm)<input data-letter="gap" value="0" inputmode="decimal"></label><label class="ws-letter-wide">Tjocklek – konturförskjutning (mm)<input data-letter="thickness" value="0" inputmode="decimal"></label></div><p class="ws-hint">Negativt värde gör tunnare, positivt gör tjockare. Konturen flyttas på båda sidor: +0,10 mm gör ett rakt streck cirka 0,20 mm bredare. Små hål och tunna detaljer kan försvinna.</p><div class="ws-letter-actions"><button type="button" data-flip="flipX" aria-pressed="false">Spegla ↔</button><button type="button" data-flip="flipY" aria-pressed="false">Vänd ↕</button><button type="button" id="ws-letter-reset">Återställ bokstaven</button></div><label class="ws-tracking-label">Extra avstånd mellan alla (mm)<input id="ws-letter-tracking" value="0" inputmode="decimal"></label><p class="ws-hint">Avstånden läggs till typsnittets ursprungliga mellanrum. Negativa värden drar ihop bokstäverna. Finjustering delar upp sammanbundna tecken; grundmåtten ovan gäller före dina bokstavsändringar.</p><div class="ws-letter-actions"><button type="button" id="ws-letter-undo" disabled>Ångra ändring</button><button type="button" id="ws-letter-redo" disabled>Gör om</button><button type="button" id="ws-letters-reset">Återställ alla</button></div></div><p id="ws-letter-feedback" class="ws-hint" role="status"></p></div><div class="ws-control-block ws-density-settings"><label for="ws-density">SVÄRTA I UTSKRIFTSFILEN <output id="ws-density-value">100 %</output></label><input id="ws-density" type="range" min="20" max="100" step="5" value="100"><p class="ws-hint">100 % = svart. Lägre värde ger grått i PDF och SVG. Termoskrivarens värme/densitet styrs i skrivarens app eller drivrutin, inte här. Vissa skrivare gör grått till raster eller rent svart. Prova på ditt stencilpapper.</p><button type="button" id="ws-density-test" class="ws-inline-button">Hämta provark med fem svärtor</button></div>`);
  const sheet=q('#ws-sheet'),paths=document.createElementNS(ns,'g'),handles=document.createElementNS(ns,'g');paths.id='ws-letter-paths';handles.id='ws-letter-handles';q('#ws-art').prepend(paths);q('#ws-selection').after(handles);
  const snapshot=()=>JSON.stringify({enabled:data.enabled,edits:data.edits,tracking:data.tracking,darkness:data.darkness});
  function remember(){undo.push(snapshot());if(undo.length>100)undo.shift();redo.length=0;}
  function historyButtons(){q('#ws-letter-undo').disabled=!undo.length;q('#ws-letter-redo').disabled=!redo.length;}
  function refresh(){workshop.refresh();historyButtons();}
  function reconcile(text){
    const chars=Array.from(text.normalize('NFC'));if(chars.join('')===data.characters.join(''))return;
    let start=0,end=0;while(start<chars.length&&chars[start]===data.characters[start])start++;
    while(end<chars.length-start&&end<data.characters.length-start&&chars.at(-1-end)===data.characters.at(-1-end))end++;
    const edits=chars.map(()=>({}));for(let i=0;i<start;i++)edits[i]=data.edits[i]||{};for(let i=0;i<end;i++)edits[chars.length-1-i]=data.edits[data.characters.length-1-i]||{};
    data.characters=chars;data.edits=edits;data.selected=Math.max(0,Math.min(data.selected,chars.length-1));undo.length=redo.length=0;renderChips();historyButtons();
  }
  function renderChips(){
    const group=q('#ws-letter-chips');group.replaceChildren();data.characters.forEach((char,index)=>{const b=document.createElement('button');b.type='button';b.textContent=/\s/.test(char)?'␣':char;b.setAttribute('aria-label',`${/\s/.test(char)?'Mellanslag':char}, tecken ${index+1}`);b.setAttribute('aria-pressed',String(index===data.selected));b.style.fontFamily=`"StencilPreview-${q('#ws-font').value}", serif`;b.addEventListener('click',()=>{data.selected=index;renderChips();refresh();});group.append(b);});syncFields();
  }
  function syncFields(){
    const edit=data.edits[data.selected]||{},char=data.characters[data.selected];
    q('#ws-letter-selected').textContent=char===undefined?'Skriv en text för att välja bokstav.':`Tecken ${data.selected+1}: ${/\s/.test(char)?'mellanslag':char}`;
    root.querySelectorAll('[data-letter]').forEach(input=>{if(document.activeElement!==input)input.value=String(edit[input.dataset.letter]||0).replace('.',',');input.disabled=char===undefined;});
    root.querySelectorAll('[data-flip]').forEach(button=>{button.setAttribute('aria-pressed',String(!!edit[button.dataset.flip]));button.disabled=char===undefined;});
    q('#ws-letter-reset').disabled=char===undefined;q('#ws-letter-enable').checked=data.enabled;q('#ws-letter-tools').hidden=!data.enabled;
    if(document.activeElement!==q('#ws-letter-tracking'))q('#ws-letter-tracking').value=String(data.tracking).replace('.',',');
    q('#ws-density').value=data.darkness*100;q('#ws-density-value').textContent=`${Math.round(data.darkness*100)} %`;
  }
  q('#ws-letter-enable').addEventListener('change',event=>{remember();data.enabled=event.target.checked;reconcile(q('#ws-text').value);renderChips();refresh();});
  const limits={x:150,y:150,angle:360,gap:50,thickness:2,tracking:30};
  function numericInput(input,key){
    input.addEventListener('input',()=>{
      const value=input.value.trim(),n=Number(value.replace(',','.'));
      const valid=value!==''&&Number.isFinite(n)&&Math.abs(n)<=limits[key];input.setAttribute('aria-invalid',String(!valid));
      if(!valid){q('#ws-letter-feedback').textContent=`Ange ett tal mellan −${limits[key]} och ${limits[key]}.`;q('#ws-pdf').disabled=q('#ws-svg').disabled=q('#ws-print').disabled=true;return;}
      remember();if(key==='tracking')data.tracking=n;else data.edits[data.selected]={...data.edits[data.selected],[key]:n};q('#ws-letter-feedback').textContent='';refresh();
    });
    input.addEventListener('blur',()=>{if(input.getAttribute('aria-invalid')==='true'){input.setAttribute('aria-invalid','false');input.value=String(key==='tracking'?data.tracking:data.edits[data.selected]?.[key]||0);q('#ws-letter-feedback').textContent='Det ogiltiga värdet återställdes.';refresh();}});
  }
  root.querySelectorAll('[data-letter]').forEach(input=>numericInput(input,input.dataset.letter));numericInput(q('#ws-letter-tracking'),'tracking');
  root.querySelectorAll('[data-flip]').forEach(button=>button.addEventListener('click',()=>{remember();const key=button.dataset.flip;data.edits[data.selected]={...data.edits[data.selected],[key]:!data.edits[data.selected]?.[key]};syncFields();refresh();}));
  q('#ws-letter-reset').addEventListener('click',()=>{remember();data.edits[data.selected]={};syncFields();refresh();});
  q('#ws-letters-reset').addEventListener('click',()=>{remember();data.edits=[];data.tracking=0;syncFields();refresh();});
  for(const [id,from,to] of [['#ws-letter-undo',undo,redo],['#ws-letter-redo',redo,undo]])q(id).addEventListener('click',()=>{if(!from.length)return;to.push(snapshot());Object.assign(data,JSON.parse(from.pop()));syncFields();renderChips();refresh();});
  q('#ws-density').addEventListener('input',event=>{data.darkness=Number(event.target.value)/100;syncFields();refresh();});
  function render(state,model){
    lastState=state;reconcile(state.text);paths.replaceChildren();handles.replaceChildren();
    q('#ws-letter-chips').querySelectorAll('button').forEach(button=>button.style.fontFamily=`"StencilPreview-${state.fontId}", serif`);
    const gray=Math.round((1-data.darkness)*255),ink=`rgb(${gray},${gray},${gray})`;
    q('#ws-text-path').setAttribute('fill',ink);q('#ws-strokes').querySelectorAll('polyline').forEach(line=>line.setAttribute('stroke',ink));
    if(data.enabled&&state.layers){
      q('#ws-text-path').removeAttribute('d');q('#ws-selection').setAttribute('hidden','');
      for(const layer of state.layers){
        if(!layer.commands.length)continue;
        const p=document.createElementNS(ns,'path');p.setAttribute('d',core.pathData(layer.commands));p.setAttribute('fill',ink);paths.append(p);
        if(state.mode!=='text')continue;
        const b=core.pathBounds(layer.commands),rect=document.createElementNS(ns,'rect');
        rect.dataset.letterIndex=layer.index;rect.setAttribute('x',state.mirror?210-b.x2:b.x1);rect.setAttribute('y',b.y1);rect.setAttribute('width',b.x2-b.x1);rect.setAttribute('height',b.y2-b.y1);rect.setAttribute('class',layer.index===data.selected?'is-selected':'');rect.setAttribute('tabindex',layer.index===data.selected?'0':'-1');rect.setAttribute('role','button');rect.setAttribute('aria-label',`Flytta ${layer.character}, tecken ${layer.index+1}. Piltangenter: 0,1 mm, Skift: 1 mm.`);handles.append(rect);
      }
    }
    if(model.warnings?.length){q('#ws-letter-feedback').textContent='En bokstav har blivit helt för tunn och försvunnit. Öka tjockleken innan export.';q('#ws-pdf').disabled=q('#ws-svg').disabled=q('#ws-print').disabled=true;}
    else if(!root.querySelector('[data-letter][aria-invalid="true"]'))q('#ws-letter-feedback').textContent='';
    if(root.querySelector('.ws-letter-settings [aria-invalid="true"]'))q('#ws-pdf').disabled=q('#ws-svg').disabled=q('#ws-print').disabled=true;
    syncFields();historyButtons();
  }
  const point=event=>new DOMPoint(event.clientX,event.clientY).matrixTransform(sheet.getScreenCTM().inverse());
  function moveDelta(dx,dy){const a=-lastState.angle*Math.PI/180;dx*=lastState.mirror?-1:1;return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};}
  handles.addEventListener('pointerdown',event=>{
    const index=event.target.dataset.letterIndex;if(index===undefined||event.button>0||drag)return;
    event.preventDefault();event.stopPropagation();data.selected=Number(index);remember();drag={pointer:event.pointerId,start:point(event),edit:{...data.edits[data.selected]}};sheet.setPointerCapture(event.pointerId);renderChips();refresh();
  });
  sheet.addEventListener('pointermove',event=>{if(!drag||drag.pointer!==event.pointerId)return;event.preventDefault();const p=point(event),d=moveDelta(p.x-drag.start.x,p.y-drag.start.y);data.edits[data.selected]={...drag.edit,x:Math.round(((drag.edit.x||0)+d.x)*100)/100,y:Math.round(((drag.edit.y||0)+d.y)*100)/100};refresh();});
  const end=event=>{if(drag?.pointer!==event.pointerId)return;drag=null;if(sheet.hasPointerCapture(event.pointerId))sheet.releasePointerCapture(event.pointerId);syncFields();};
  sheet.addEventListener('pointerup',end);sheet.addEventListener('pointercancel',end);sheet.addEventListener('lostpointercapture',end);
  handles.addEventListener('keydown',event=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;event.preventDefault();remember();const step=event.shiftKey?1:.1,d=moveDelta(delta[0]*step,delta[1]*step),e=data.edits[data.selected]||{};data.edits[data.selected]={...e,x:Math.round(((e.x||0)+d.x)*100)/100,y:Math.round(((e.y||0)+d.y)*100)/100};refresh();handles.querySelector('.is-selected')?.focus();});
  q('#ws-text-mode').addEventListener('click',refresh);q('#ws-draw-mode').addEventListener('click',refresh);
  q('#ws-density-test').addEventListener('click',()=>{
    const paths=[],levels=[.2,.4,.6,.8,1];
    let markup='<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="white"/><text x="20" y="22" font-family="sans-serif" font-size="6">Stencil – provark för svärta</text><text x="20" y="32" font-family="sans-serif" font-size="3.5">Skriv ut i 100 %. Välj resultatet som passar ditt papper och din skrivare.</text>';
    levels.forEach((level,i)=>{const y=50+i*40,g=Math.round((1-level)*255);markup+=`<g fill="rgb(${g},${g},${g})" stroke="rgb(${g},${g},${g})"><text x="20" y="${y+5}" font-family="sans-serif" font-size="6" stroke="none">${level*100} %</text><rect x="50" y="${y-3}" width="18" height="12" stroke="none"/>`;[.1,.2,.4,.8].forEach((w,j)=>markup+=`<path d="M ${80+j*25} ${y-3} v 12" fill="none" stroke-width="${w}"/>`);markup+='</g>';});
    markup+='<text x="20" y="265" font-family="sans-serif" font-size="3.5">Linjer från vänster: 0,1 / 0,2 / 0,4 / 0,8 mm. Värmen ställs på skrivaren.</text><path d="M 20 280 h 50" stroke="black" stroke-width=".2"/><text x="20" y="289" font-family="sans-serif" font-size="3.5">Kontrollinje: 50 mm</text></svg>';
    const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'})),link=document.createElement('a');link.href=url;link.download='stencil-provark-svarta.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  });
  window.StencilLettering={get enabled(){return data.enabled;},get darkness(){return data.darkness;},layout(raw,w,h,a){reconcile(q('#ws-text').value);return window.StencilLetterCore.layout(raw,w,h,a,data.edits,data.tracking);},render};
  reconcile(q('#ws-text').value);refresh();
})();
