/* Stencil's local, editable handwriting-to-OpenType pipeline. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/perfect-freehand.js'));
  else root.StencilFontCore = factory(root.PerfectFreehand);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (freehand) {
  'use strict';
  const VERSION = 1;
  const GRID = 1000;
  const BASELINE = 800;
  const BEARING = 50;
  const GROUPS = Object.freeze({
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ',
    lowercase: 'abcdefghijklmnopqrstuvwxyzåäö',
    digits: '0123456789',
    symbols: '.,!?:;-&()/\'"+@#%='
  });
  const GROUP_LIST = Object.freeze([
    {id:'uppercase',label:'Stora bokstäver',characters:GROUPS.uppercase},
    {id:'lowercase',label:'Små bokstäver',characters:GROUPS.lowercase},
    {id:'digits',label:'Siffror',characters:GROUPS.digits},
    {id:'symbols',label:'Tecken',characters:GROUPS.symbols}
  ]);
  const LIMITS = Object.freeze({glyphs:200,strokesPerGlyph:200,pointsPerStroke:10000,totalPoints:100000,minSize:1,maxSize:150,minSpacing:-40,maxSpacing:200});
  const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const fail = message => {throw new Error(message);};
  const round = n => Math.round(n * 1000) / 1000;
  const coordinate = n => String(round(n));

  function validCharacter(character) {
    if (typeof character !== 'string' || [...character].length !== 1) return false;
    const code = character.codePointAt(0);
    return code >= 33 && code <= 0xffff && !(code >= 0xd800 && code <= 0xdfff) && !/[\s\u007f-\u009f]/u.test(character);
  }

  function copyStroke(stroke, label, budget) {
    if (!object(stroke) || !Array.isArray(stroke.points)) fail(`${label}: streckets punkter saknas.`);
    if (stroke.points.length < 1 || stroke.points.length > LIMITS.pointsPerStroke) fail(`${label}: ett streck måste ha 1–${LIMITS.pointsPerStroke} punkter.`);
    if (!finite(stroke.size) || stroke.size < LIMITS.minSize || stroke.size > LIMITS.maxSize) fail(`${label}: pennstorleken måste vara mellan ${LIMITS.minSize} och ${LIMITS.maxSize}.`);
    if (typeof stroke.pressure !== 'boolean') fail(`${label}: uppgiften om penntryck är ogiltig.`);
    budget.count += stroke.points.length;
    if (budget.count > LIMITS.totalPoints) fail(`Projektet innehåller för många ritpunkter. Gränsen är ${LIMITS.totalPoints}.`);
    const points = stroke.points.map(point => {
      if (!Array.isArray(point) || point.length < 2 || point.length > 3 || !finite(point[0]) || !finite(point[1]) || point[0] < 0 || point[0] > GRID || point[1] < 0 || point[1] > GRID) fail(`${label}: en ritpunkt ligger utanför ritytan eller har ogiltiga mått.`);
      const pressure = point.length === 3 ? point[2] : 0.5;
      if (!finite(pressure) || pressure < 0 || pressure > 1) fail(`${label}: penntryck måste ligga mellan 0 och 1.`);
      return [point[0],point[1],pressure];
    });
    return {points,size:stroke.size,pressure:stroke.pressure};
  }

  function sanitizeProject(input) {
    if (!object(input) || input.version !== VERSION) fail('Projektfilen har ett okänt format. Välj en säkerhetskopia från Stencils bokstavsverkstad.');
    if (typeof input.name !== 'string') fail('Typsnittets namn saknas.');
    const name = input.name.trim().replace(/\s+/g,' ');
    if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(input.name)) fail('Ge typsnittet ett namn med 1–60 tecken.');
    const spacing = own(input,'spacing') ? input.spacing : 0;
    if (!finite(spacing) || spacing < LIMITS.minSpacing || spacing > LIMITS.maxSpacing) fail(`Bokstavsavståndet måste vara mellan ${LIMITS.minSpacing} och ${LIMITS.maxSpacing}.`);
    if (!object(input.glyphs)) fail('Projektfilens bokstäver saknas.');
    const entries = Object.entries(input.glyphs);
    if (entries.length > LIMITS.glyphs) fail(`Ett projekt kan innehålla högst ${LIMITS.glyphs} tecken.`);
    const glyphs = Object.create(null);
    const budget = {count:0};
    for (const [character,glyph] of entries) {
      if (!validCharacter(character)) fail('Projektfilen innehåller ett ogiltigt tecken.');
      if (!object(glyph) || !Array.isArray(glyph.strokes) || glyph.strokes.length > LIMITS.strokesPerGlyph) fail(`Tecknet ${character} får innehålla högst ${LIMITS.strokesPerGlyph} streck.`);
      glyphs[character] = {strokes:glyph.strokes.map(stroke => copyStroke(stroke,`Tecknet ${character}`,budget))};
    }
    return {version:VERSION,name,glyphs,spacing};
  }

  function validateProject(input) {
    try {sanitizeProject(input);return {valid:true,errors:[]};}
    catch (error) {return {valid:false,errors:[error.message || 'Projektfilen kunde inte läsas.']};}
  }

  // Clip filled polygons, not the centreline. The editor and exported glyphs
  // then share the same visible boundary and never escape the 1000-unit artboard.
  function clipPolygon(points) {
    let result = points;
    const edges = [
      {inside:p=>p[0]>=0,at:(a,b)=>[0,a[1]+(b[1]-a[1])*(0-a[0])/(b[0]-a[0])]},
      {inside:p=>p[0]<=GRID,at:(a,b)=>[GRID,a[1]+(b[1]-a[1])*(GRID-a[0])/(b[0]-a[0])]},
      {inside:p=>p[1]>=0,at:(a,b)=>[a[0]+(b[0]-a[0])*(0-a[1])/(b[1]-a[1]),0]},
      {inside:p=>p[1]<=GRID,at:(a,b)=>[a[0]+(b[0]-a[0])*(GRID-a[1])/(b[1]-a[1]),GRID]}
    ];
    for (const edge of edges) {
      const input = result;result=[];
      if (!input.length) break;
      let previous = input[input.length-1];
      for (const current of input) {
        const currentInside=edge.inside(current),previousInside=edge.inside(previous);
        if (currentInside !== previousInside) result.push(edge.at(previous,current));
        if (currentInside) result.push(current);
        previous=current;
      }
    }
    return result;
  }

  function strokeOutline(stroke) {
    if (!freehand || typeof freehand.getStroke !== 'function') fail('Ritverktyget kunde inte laddas. Ladda om sidan.');
    // The public helper also accepts an active, empty stroke during pointerdown.
    if (object(stroke) && Array.isArray(stroke.points) && !stroke.points.length) return [];
    const clean = copyStroke(stroke,'Strecket',{count:0});
    // Fast pointer moves can have only a handful of samples. Densify those
    // segments before building joins so constant-width corners do not taper.
    const points = [clean.points[0]];
    let length = 0;
    for (let i=1;i<clean.points.length;i++) length+=Math.hypot(clean.points[i][0]-clean.points[i-1][0],clean.points[i][1]-clean.points[i-1][1]);
    const step = Math.max(8,length/Math.max(1,20000-clean.points.length));
    for (let i=1;i<clean.points.length;i++) {
      const a=clean.points[i-1],b=clean.points[i];
      const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
      for(let j=1;j<=count;j++) {const t=j/count;points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}
    }
    const outline = freehand.getStroke(points,{
      size:clean.size,thinning:clean.pressure ? 0.65 : 0,
      smoothing:0.5,streamline:0,simulatePressure:false,last:true,
      start:{cap:true,taper:0},end:{cap:true,taper:0}
    });
    const clipped = clipPolygon(outline).map(point=>[Math.round(point[0]),Math.round(point[1])]);
    return clipped.filter((point,index)=>index===0 || point[0]!==clipped[index-1][0] || point[1]!==clipped[index-1][1]);
  }

  function outlineToPath(points) {
    if (!Array.isArray(points) || points.length < 3) return '';
    return `M${coordinate(points[0][0])} ${coordinate(points[0][1])} `+points.slice(1).map(point=>`L${coordinate(point[0])} ${coordinate(point[1])}`).join(' ')+' Z';
  }

  function glyphOutline(glyph) {
    const strokes = glyph && Array.isArray(glyph.strokes) ? glyph.strokes : [];
    const outlines = strokes.map(strokeOutline).filter(outline=>outline.length>=3);
    let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
    for (const outline of outlines) for (const [x,y] of outline) {x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y);}
    const bounds = outlines.length ? {x1,y1,x2,y2,width:x2-x1,height:y2-y1} : {x1:0,y1:0,x2:0,y2:0,width:0,height:0};
    return {outlines,bounds};
  }

  function drawnCharacters(project) {
    return Object.keys(project.glyphs || {}).filter(character=>project.glyphs[character]?.strokes?.some(stroke=>stroke.points?.length));
  }

  function missingCharacters(project,text) {
    const drawn = new Set(drawnCharacters(project));
    return [...new Set([...(text || '').normalize('NFC')].filter(character=>! /\s/u.test(character) && !drawn.has(character)))];
  }

  function missingGlyph(opentype) {
    const path = new opentype.Path();
    // A four-bar hollow box remains visible under nonzero winding.
    for (const [x,y,width,height] of [[50,0,45,700],[505,0,45,700],[95,0,410,45],[95,655,410,45]]) {
      path.moveTo(x,y);path.lineTo(x+width,y);path.lineTo(x+width,y+height);path.lineTo(x,y+height);path.close();
    }
    return new opentype.Glyph({name:'.notdef',advanceWidth:600,path});
  }

  function createFont(project,opentype) {
    const clean = sanitizeProject(project);
    if (!opentype || typeof opentype.Font !== 'function' || typeof opentype.Glyph !== 'function' || typeof opentype.Path !== 'function') fail('Typsnittsverktyget kunde inte laddas. Ladda om sidan.');
    const characters = drawnCharacters(clean).sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
    if (!characters.length) fail('Rita minst ett tecken innan du skapar typsnittet.');
    const glyphs = [missingGlyph(opentype),new opentype.Glyph({name:'space',unicode:32,advanceWidth:Math.max(200,350+clean.spacing),path:new opentype.Path()})];
    for (const character of characters) {
      const model = glyphOutline(clean.glyphs[character]);
      if (!model.outlines.length || !model.bounds.width || !model.bounds.height) continue;
      const path = new opentype.Path();
      for (const points of model.outlines) {
        path.moveTo(points[0][0]-model.bounds.x1+BEARING,BASELINE-points[0][1]);
        for (let i=1;i<points.length;i++) path.lineTo(points[i][0]-model.bounds.x1+BEARING,BASELINE-points[i][1]);
        path.close();
      }
      glyphs.push(new opentype.Glyph({
        name:'uni'+character.codePointAt(0).toString(16).toUpperCase().padStart(4,'0'),unicode:character.codePointAt(0),
        advanceWidth:Math.round(model.bounds.width+BEARING*2+clean.spacing),path
      }));
    }
    if (glyphs.length < 3) fail('Inga ritade tecken kunde omvandlas till ett typsnitt. Rita ett tydligare streck.');
    const font = new opentype.Font({familyName:clean.name,styleName:'Regular',unitsPerEm:GRID,ascender:BASELINE,descender:BASELINE-GRID,glyphs});
    // Keep PostScript identifiers ASCII while retaining the user's display name.
    const postscript = clean.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,48) || 'StencilHanddrawn';
    font.names.postScriptName = {en:postscript+'-Regular'};
    font.names.description = {en:'Hand-drawn in Stencil Letter Studio. User-created glyphs; no kerning or hinting.'};
    font.names.version = {en:'Version 1.000'};
    font.kerningPairs = {};
    return font;
  }

  function fontArrayBuffer(project,opentype) {
    const result = createFont(project,opentype).toArrayBuffer();
    if (!(result instanceof ArrayBuffer) || result.byteLength < 4) fail('Typsnittsfilen kunde inte skapas.');
    return result;
  }

  return Object.freeze({VERSION,GRID,BASELINE,BEARING,GROUPS,GROUP_LIST,LIMITS,validCharacter,validateProject,sanitizeProject,strokeOutline,outlineToPath,glyphOutline,drawnCharacters,missingCharacters,createFont,fontArrayBuffer});
});
