(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const core = window.StencilFontCore;
  const STORAGE = 'stencil-font-project-v1';
  const HANDOFF = 'stencil-font-handoff-v1';
  const NS = 'http://www.w3.org/2000/svg';
  const fresh = () => ({version:1,name:'Min handstil',glyphs:{},spacing:0});
  const errorBox = $('#maker-error');
  function showError(message) {errorBox.textContent=message;errorBox.hidden=false;}
  function clearError() {errorBox.hidden=true;errorBox.textContent='';}
  if (!core || !window.opentype) {showError('Bokstavsverkstaden kunde inte laddas. Ladda om sidan och försök igen.');return;}
  let project=fresh(), selected='A', group='uppercase', active=null, revision=0, previewRequest=0;
  let previewFace=null, cachedBuffer=null, cachedRevision=-1, renderTimer=null, frame=null, preserveStored=false;
  const history=new Map();
  const drawing=$('#drawing');
  const groups=core.GROUPS;
  const allCharacters=Object.values(groups).join('');
  const drawnButton=document.createElement('button');drawnButton.id='preview-drawn';drawnButton.className='text-button';drawnButton.textContent='Prova bara ritade tecken';drawnButton.hidden=true;$('#missing-characters').after(drawnButton);
  try {
    const saved=localStorage.getItem(STORAGE);
    if(saved){project=core.sanitizeProject(JSON.parse(saved));$('#save-status').textContent='Ditt lokalt sparade utkast har öppnats.';}
  } catch {preserveStored=true;showError('Det sparade utkastet kunde inte öppnas. Det har inte skrivits över. Öppna en projektfil eller börja på ett nytt typsnitt.');}
  if(matchMedia('(max-width:640px)').matches)$('#alphabet-details').open=false;
  function drawnCharacters(){return Object.keys(project.glyphs).filter(char=>project.glyphs[char].strokes.length);}
  function currentStrokes(){return project.glyphs[selected]?.strokes||[];}
  function getHistory(){if(!history.has(selected))history.set(selected,{undo:[],redo:[]});return history.get(selected);}
  function remember(){const h=getHistory();h.undo.push(currentStrokes().slice());if(h.undo.length>30)h.undo.shift();h.redo=[];}
  function save(){
    if(preserveStored){$('#save-status').textContent='Spara en projektfil för att behålla det nya arbetet.';return;}
    try {localStorage.setItem(STORAGE,JSON.stringify(project));$('#save-status').textContent='Sparat lokalt här · ingen uppladdning.';}
    catch {$('#save-status').textContent='Utkastet kunde inte sparas här. Spara en projektfil innan du lämnar sidan.';}
  }
  function changed(){revision++;cachedBuffer=null;save();renderPalette();updateButtons();schedulePreview();}
  function syncInputs(){
    $('#font-name').value=project.name;$('#letter-spacing').value=project.spacing;$('#spacing-value').textContent=String(project.spacing);
  }
  function renderPalette(){
    const grid=$('#glyph-grid');grid.replaceChildren();
    for(const char of [...groups[group]]){
      const b=document.createElement('button');b.type='button';b.className='glyph-button';b.textContent=char;b.dataset.character=char;
      b.setAttribute('aria-pressed',String(char===selected));const done=Boolean(project.glyphs[char]?.strokes.length);b.classList.toggle('drawn',done);b.setAttribute('aria-label',`Rita ${char}${done?' – ritat':''}`);grid.append(b);
    }
    $('#glyph-count').textContent=`${drawnCharacters().length} ritade`;
    document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===group)));
  }
  function renderStrokes(){
    const layer=$('#glyph-strokes');layer.replaceChildren();
    try {for(const stroke of currentStrokes()){const path=document.createElementNS(NS,'path');path.setAttribute('d',core.outlineToPath(core.strokeOutline(stroke)));layer.append(path);}}
    catch(problem){showError(problem.message||'Bokstaven kunde inte visas.');}
    $('#live-stroke').removeAttribute('d');
    $('#current-character').textContent=selected;$('#ghost-character').textContent=selected;$('#ghost-character').hidden=!$('#show-guide').checked;
    // SVG does not consistently honor the HTML hidden property, so set display explicitly.
    $('#ghost-character').style.display=$('#show-guide').checked?'':'none';
    $('#ghost-character').style.fontSize=/[ÅÄÖ]/.test(selected)?'820px':'950px';
    drawing.setAttribute('aria-label',`Rityta för tecknet ${selected}. Rita med penna, finger eller mus.`);
    updateButtons();
  }
  function missingCharacters(){return core.missingCharacters(project,$('#test-text').value);}
  function updateButtons(){
    const h=getHistory(), count=drawnCharacters().length;
    $('#undo').disabled=!h.undo.length||Boolean(active);$('#redo').disabled=!h.redo.length||Boolean(active);$('#clear-character').disabled=!currentStrokes().length||Boolean(active);
    $('#export-font').disabled=!count||Boolean(active);$('#use-in-stencil').disabled=!count||Boolean(active)||Boolean(missingCharacters().length)||!$('#test-text').value.trim();
  }
  function stopActive(){
    if(!active)return;const id=active.id;active=null;if(frame){cancelAnimationFrame(frame);frame=null;}$('#live-stroke').removeAttribute('d');
    if(drawing.hasPointerCapture(id))drawing.releasePointerCapture(id);updateButtons();
  }
  function selectCharacter(char){
    if(!allCharacters.includes(char))return;stopActive();selected=char;
    group=Object.keys(groups).find(key=>groups[key].includes(char))||group;renderPalette();renderStrokes();
    $('#drawing-status').textContent=currentStrokes().length?`Fortsätt på ${char}, eller ångra och rita om.`:`Rita ${char} på arket. Lyft pennan för att spara strecket.`;
  }
  $('#glyph-grid').addEventListener('click',event=>{const b=event.target.closest('[data-character]');if(b)selectCharacter(b.dataset.character);});
  document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{group=button.dataset.group;selectCharacter([...groups[group]][0]);}));
  function stepCharacter(direction){const chars=[...groups[group]],index=chars.indexOf(selected);selectCharacter(chars[(index+direction+chars.length)%chars.length]);}
  $('#next-character').addEventListener('click',()=>stepCharacter(1));$('#previous-character').addEventListener('click',()=>stepCharacter(-1));
  $('#pen-size').addEventListener('input',()=>$('#pen-size-value').textContent=$('#pen-size').value);
  $('#show-guide').addEventListener('change',()=>{$('#ghost-character').style.display=$('#show-guide').checked?'':'none';});
  $('#pen-only').addEventListener('change',()=>{stopActive();$('#drawing-status').textContent=$('#pen-only').checked?'Endast penna är aktivt. Finger och mus ritar inte.':'Rita med penna, finger eller mus.';});
  function sample(event,final=false){
    const box=drawing.getBoundingClientRect();if(!box.width||!box.height)return null;
    const x=Math.max(4,Math.min(996,(event.clientX-box.left)*1000/box.width));
    const y=Math.max(4,Math.min(996,(event.clientY-box.top)*1000/box.height));
    const previous=active?.stroke.points.at(-1)?.[2]||.5;
    let pressure=final?previous:event.pointerType==='pen'&&event.pressure>0?event.pressure:.5;
    return [x,y,Math.max(.05,Math.min(1,pressure))];
  }
  function paintLive(){frame=null;if(active)$('#live-stroke').setAttribute('d',core.outlineToPath(core.strokeOutline(active.stroke)));}
  function addSamples(event,final=false){
    if(!active)return;let events=[];try{events=event.getCoalescedEvents?.()||[];}catch{}
    if(!events.length||final)events=[event];
    for(const ev of events){const p=sample(ev,final);if(!p)continue;const points=active.stroke.points,last=points.at(-1);if(points.length>=10000)break;
      if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>1||Math.abs(p[2]-last[2])>.08)points.push(p);
    }
    if(!frame)frame=requestAnimationFrame(paintLive);
  }
  drawing.addEventListener('pointerdown',event=>{
    if(active||event.button>0)return;
    if($('#pen-only').checked&&event.pointerType!=='pen'){$('#drawing-status').textContent='Endast penna är aktivt. Avmarkera det för att rita med finger eller mus.';return;}
    if(currentStrokes().length>=200){showError('Det här tecknet har 200 streck. Rensa eller ångra några streck innan du fortsätter.');return;}
    event.preventDefault();clearError();active={id:event.pointerId,character:selected,stroke:{points:[],size:Number($('#pen-size').value),pressure:$('#pen-pressure').checked&&event.pointerType==='pen'}};
    drawing.setPointerCapture(event.pointerId);addSamples(event);updateButtons();
  });
  drawing.addEventListener('pointermove',event=>{if(event.pointerId!==active?.id)return;event.preventDefault();addSamples(event);});
  drawing.addEventListener('pointerup',event=>{
    if(event.pointerId!==active?.id)return;event.preventDefault();addSamples(event,true);const stroke=active.stroke;
    stopActive();if(!stroke.points.length)return;
    const candidate={...project,glyphs:{...project.glyphs,[selected]:{strokes:[...currentStrokes(),stroke]}}};
    const check=core.validateProject(candidate);if(!check.valid){showError(check.errors.join(' '));return;}
    remember();project.glyphs[selected]={strokes:[...currentStrokes(),stroke]};renderStrokes();changed();
    $('#drawing-status').textContent=`${selected} har ${currentStrokes().length} ${currentStrokes().length===1?'streck':'streck'}. Fortsätt rita eller välj nästa tecken.`;
  });
  function cancelPointer(event){if(event.pointerId!==active?.id)return;stopActive();$('#drawing-status').textContent='Det senaste strecket avbröts. Lyft pennan och prova igen.';}
  drawing.addEventListener('pointercancel',cancelPointer);drawing.addEventListener('lostpointercapture',cancelPointer);
  window.addEventListener('blur',stopActive);window.addEventListener('pagehide',()=>{stopActive();save();});
  function replaceStrokes(strokes){if(strokes.length)project.glyphs[selected]={strokes};else delete project.glyphs[selected];renderStrokes();changed();}
  function undo(){if(active)return;const h=getHistory();if(!h.undo.length)return;h.redo.push(currentStrokes().slice());replaceStrokes(h.undo.pop());$('#drawing-status').textContent='Senaste ändringen ångrad.';}
  function redo(){if(active)return;const h=getHistory();if(!h.redo.length)return;h.undo.push(currentStrokes().slice());replaceStrokes(h.redo.pop());$('#drawing-status').textContent='Ändringen är återställd.';}
  $('#undo').addEventListener('click',undo);$('#redo').addEventListener('click',redo);
  $('#clear-character').addEventListener('click',()=>{if(!currentStrokes().length)return;remember();replaceStrokes([]);$('#drawing-status').textContent=`${selected} är rensat. Ångra tar tillbaka ritningen.`;});
  drawing.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}});
  $('#font-name').addEventListener('input',()=>{project.name=$('#font-name').value.trim()||'Min handstil';changed();});
  $('#letter-spacing').addEventListener('input',()=>{project.spacing=Number($('#letter-spacing').value);$('#spacing-value').textContent=String(project.spacing);changed();});
  function getBuffer(){if(cachedRevision!==revision||!cachedBuffer){cachedBuffer=core.fontArrayBuffer(project,window.opentype);cachedRevision=revision;}return cachedBuffer;}
  function schedulePreview(){previewRequest++;clearTimeout(renderTimer);renderTimer=setTimeout(updatePreview,160);}
  async function updatePreview(){
    const request=++previewRequest,count=drawnCharacters().length,preview=$('#font-preview'),missing=missingCharacters();updateButtons();
    $('#missing-characters').textContent=missing.length?`Inte ritade ännu: ${missing.join(' ')}. De visas som tomma rutor i typsnittet.`:'';
    drawnButton.hidden=!count||!missing.length;
    if(!count){preview.replaceChildren();const note=document.createElement('span');note.className='preview-placeholder';note.textContent='Här tar din handstil form.';preview.append(note);$('#preview-ready').textContent='Rita ditt första tecken för att börja.';return;}
    try{
      const buffer=getBuffer(),face=new FontFace(`StencilHand${request}`,buffer);await face.load();if(request!==previewRequest)return;
      document.fonts.add(face);if(previewFace)document.fonts.delete(previewFace);previewFace=face;
      preview.style.fontFamily=`"StencilHand${request}"`;preview.textContent=$('#test-text').value.normalize('NFC');
      $('#preview-ready').textContent=`${count} ${count===1?"eget tecken":"egna tecken"} · riktig typsnittsförhandsvisning`;
    }catch(problem){if(request!==previewRequest)return;$('#preview-ready').textContent='Förhandsvisningen kunde inte skapas.';showError(problem.message||'Typsnittet kunde inte skapas. Spara projektfilen och prova att rita om tecknet.');}
  }
  $('#test-text').addEventListener('input',schedulePreview);
  drawnButton.addEventListener('click',()=>{$('#test-text').value=drawnCharacters().join('').slice(0,100);schedulePreview();});
  function filename(){return(project.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'min-handstil');}
  function download(data,type,name){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  $('#backup').addEventListener('click',()=>{stopActive();download(JSON.stringify(project,null,2),'application/json',`${filename()}.stencil.json`);$('#save-status').textContent='Projektfil skapad. Behåll den för att fortsätta på en annan enhet.';});
  $('#export-font').addEventListener('click',()=>{try{clearError();download(getBuffer(),'font/otf',`${filename()}.otf`);$('#preview-ready').textContent='OTF-filen är skapad. Du kan importera den i Stencil eller installera den på en dator.';}catch(problem){showError(problem.message||'Typsnittet kunde inte exporteras.');}});
  $('#use-in-stencil').addEventListener('click',()=>{
    if(missingCharacters().length||!$('#test-text').value.trim())return;
    try{core.sanitizeProject(project);sessionStorage.setItem(HANDOFF,JSON.stringify({project,sample:$('#test-text').value.normalize('NFC')}));save();window.location.href='app.html#verkstad';}
    catch{showError('Webbläsaren kunde inte överföra typsnittet. Hämta OTF-filen och importera den i A4-verkstaden i stället.');}
  });
  function confirmReplace(message){
    stopActive();const dialog=$('#confirm-dialog');$('#confirm-copy').textContent=message;dialog.returnValue='';dialog.showModal();
    return new Promise(resolve=>{const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='accept');};dialog.addEventListener('close',close);});
  }
  $('#confirm-cancel').addEventListener('click',()=>$('#confirm-dialog').close('cancel'));$('#confirm-accept').addEventListener('click',()=>$('#confirm-dialog').close('accept'));
  function setProject(next){stopActive();project=next;history.clear();preserveStored=false;selected='A';group='uppercase';const first=drawnCharacters()[0];if(first&&allCharacters.includes(first)){selected=first;group=Object.keys(groups).find(key=>groups[key].includes(first));}$('#test-text').value=first||'A';syncInputs();clearError();renderStrokes();changed();}
  $('#new-project').addEventListener('click',async()=>{if((drawnCharacters().length||preserveStored)&&!await confirmReplace('Det nuvarande utkastet ersätts. Spara en projektfil först om du vill kunna fortsätta med det senare.'))return;setProject(fresh());$('#drawing-status').textContent='Ett nytt alfabet. Börja med A, eller välj ett annat tecken.';});
  $('#open-project').addEventListener('click',()=>$('#project-file').click());
  $('#project-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>16*1024*1024)throw Error('Projektfilen är för stor. Välj en fil på högst 16 MB.');
      let parsed;try{parsed=JSON.parse(await file.text());}catch{throw Error('Filen är inte en läsbar Stencil-projektfil. Välj en sparad .stencil.json-fil.');}
      const next=core.sanitizeProject(parsed);
      if((drawnCharacters().length||preserveStored)&&!await confirmReplace('Det öppnade projektet ersätter ditt nuvarande utkast. Spara först en projektfil om du vill behålla båda.'))return;
      setProject(next);$('#drawing-status').textContent='Projektet är öppnat. Dina tecken går att fortsätta redigera.';
    }catch(problem){showError(problem.message||'Projektet kunde inte öppnas. Ditt nuvarande utkast finns kvar.');}finally{event.target.value='';}
  });
  syncInputs();renderPalette();renderStrokes();schedulePreview();
})();
