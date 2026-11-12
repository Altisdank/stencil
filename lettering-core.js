(function(global){
  'use strict';
  const core=typeof module==='object'?require('./workshop.js'):global.StencilWorkshopCore;
  const clip=typeof module==='object'?require('./vendor/clipper.js'):global.ClipperLib;
  const SCALE=100000,TOLERANCE=.002;
  const map=core.mapPath;
  function polygons(commands){
    const paths=[];let points=[],current={x:0,y:0};
    const push=p=>points.push({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)});
    const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    function flatten(curve,depth=0){
      const a=curve[0],b=curve.at(-1),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      const distance=p=>length?Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/length:Math.hypot(p.x-a.x,p.y-a.y);
      // Control-polygon excess also catches collinear curves that double back.
      const excess=curve.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-curve[i].x,p.y-curve[i].y),0)-length;
      if(depth>=18||(curve.slice(1,-1).every(p=>distance(p)<=TOLERANCE)&&excess<=TOLERANCE)){push(b);return;}
      let row=curve;const left=[a],right=[b];
      while(row.length>1){row=row.slice(1).map((p,i)=>mid(row[i],p));left.push(row[0]);right.unshift(row.at(-1));}
      flatten(left,depth+1);flatten(right,depth+1);
    }
    const finish=()=>{if(points.length>=3)paths.push(points);points=[];};
    for(const c of commands){
      if(c.type==='M'){finish();current={x:c.x,y:c.y};push(current);}
      if(c.type==='L'){current={x:c.x,y:c.y};push(current);}
      if(c.type==='Q'||c.type==='C'){const end={x:c.x,y:c.y};flatten(c.type==='Q'?[current,{x:c.x1,y:c.y1},end]:[current,{x:c.x1,y:c.y1},{x:c.x2,y:c.y2},end]);current=end;}
      if(c.type==='Z')finish();
    }
    finish();return paths;
  }
  function offset(commands,amount){
    if(!amount||!commands.length)return commands;
    if(!clip)throw Error('Tjockleksverktyget kunde inte laddas. Ladda om sidan.');
    const union=new clip.Clipper(),clean=[];
    union.AddPaths(polygons(commands),clip.PolyType.ptSubject,true);
    union.Execute(clip.ClipType.ctUnion,clean,clip.PolyFillType.pftNonZero,clip.PolyFillType.pftNonZero);
    const offsetter=new clip.ClipperOffset(2,TOLERANCE*SCALE),solution=[];
    offsetter.AddPaths(clean,clip.JoinType.jtRound,clip.EndType.etClosedPolygon);offsetter.Execute(solution,amount*SCALE);
    return solution.flatMap(path=>[...path.map((p,i)=>({type:i?'L':'M',x:p.X/SCALE,y:p.Y/SCALE})),{type:'Z'}]);
  }
  function base(font,text){
    const chars=Array.from(text.normalize('NFC'));let x=0,previous=null;
    const layers=chars.map((character,index)=>{
      const glyph=font.charToGlyph(character);
      if(previous)x+=font.getKerningValue(previous,glyph)*1000/font.unitsPerEm;
      const commands=glyph.getPath(x,0,1000).commands;
      x+=(glyph.advanceWidth||0)*1000/font.unitsPerEm;previous=glyph;
      return {index,character,commands};
    });
    return {layers,commands:layers.flatMap(layer=>layer.commands)};
  }
  function layout(baseModel,width,height,angle,edits,tracking=0){
    const box=core.pathBounds(baseModel.commands),sw=box.x2-box.x1,sh=box.y2-box.y1;
    if(sw<=0||sh<=0)return {commands:[],layers:[],width:0,height:0};
    let advance=0;const a=angle*Math.PI/180;const warnings=[];
    let layers=baseModel.layers.map(layer=>{
      const e=edits[layer.index]||{},dx=Number(e.x)||0,dy=Number(e.y)||0,turn=(Number(e.angle)||0)*Math.PI/180;
      let commands=map(layer.commands,(x,y)=>({x:(x-box.x1)*width/sw+advance,y:(y-box.y1)*height/sh}));
      const b=core.pathBounds(commands),cx=(b.x1+b.x2)/2,cy=(b.y1+b.y2)/2;
      commands=offset(commands,Number(e.thickness)||0);
      if(layer.commands.length&&!commands.length)warnings.push(layer.index);
      commands=map(commands,(x,y)=>{const px=(x-cx)*(e.flipX?-1:1),py=(y-cy)*(e.flipY?-1:1);return {x:cx+dx+px*Math.cos(turn)-py*Math.sin(turn),y:cy+dy+px*Math.sin(turn)+py*Math.cos(turn)};});
      commands=map(commands,(x,y)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}));
      advance+=tracking+(Number(e.gap)||0);
      return {...layer,commands};
    });
    const bounds=core.pathBounds(layers.flatMap(layer=>layer.commands));
    layers=layers.map(layer=>({...layer,commands:map(layer.commands,(x,y)=>({x:x-bounds.x1,y:y-bounds.y1}))}));
    return {layers,commands:layers.flatMap(layer=>layer.commands),width:bounds.x2-bounds.x1,height:bounds.y2-bounds.y1,originX:bounds.x1,originY:bounds.y1,warnings};
  }
  const api={base,layout,offset,polygons};
  if(typeof module==='object')module.exports=api;else global.StencilLetterCore=api;
})(typeof window==='undefined'?globalThis:window);
