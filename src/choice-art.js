import { applyEffect } from './pixels.js';
import { makeCanvas } from './engine.js';
import { playfulIcon } from './playful-icons.js';

let choiceArtSequence=0;
// Vector teaching pictures remain sharp at every display scale.
export function choiceArt(select, option) {
  const view=document.createElement('span');view.className='choice-picture';view.setAttribute('aria-hidden','true');
  const key=select.id,value=option.value;
  if(['paint-source','paper-grain'].includes(key)&&!['color','custom','none'].includes(value)) {
    const image=document.createElement('img');image.src=(window.LUOYE_ASSETS||[]).find(a=>a.id===value)?.thumbnail||'assets/'+value+'.png';image.alt='';view.append(image);return view;
  }
  if(key==='effect-kind'){
    const canvas=makeCanvas(96,64),ctx=canvas.getContext('2d');ctx.fillStyle='#aad7dc';ctx.fillRect(0,0,96,64);ctx.fillStyle='#f7cd74';ctx.beginPath();ctx.arc(76,15,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#91b89b';ctx.fillRect(0,45,96,19);ctx.fillStyle='#f4c2a4';ctx.fillRect(28,29,34,29);ctx.fillStyle='#b9624a';ctx.beginPath();ctx.moveTo(21,30);ctx.lineTo(45,10);ctx.lineTo(70,30);ctx.fill();ctx.fillStyle='#714d3b';ctx.fillRect(40,40,11,18);ctx.fillStyle='#fff4d5';ctx.fillRect(31,35,6,7);ctx.fillRect(54,35,6,7);
    const pixels=ctx.getImageData(0,0,96,64);pixels.data.set(applyEffect(pixels.data,96,64,value,{brightness:30,contrast:15,hue:70,saturation:20,amount:45,radius:4,red:140,green:85,blue:110,levels:3,dx:[4,0,-4],dy:[0,0,0],seed:123,color:'#b9624a',background:'#f9d88e',tolerance:30}));ctx.putImageData(pixels,0,0);canvas.setAttribute('aria-hidden','true');view.append(canvas);return view;
  }
  if(key==='text-font'){view.textContent='画';view.style.fontFamily=value;view.classList.add('font-sample');return view;}
  const shape={line:'M8 52 56 12',rect:'M10 14h46v36H10z',roundrect:'M19 12h28q10 0 10 10v22q0 10-10 10H19q-10 0-10-10V22q0-10 10-10z',triangle:'M32 8 59 55H5z',ellipse:'M8 32a24 18 0 1 0 48 0 24 18 0 1 0-48 0',star:'m32 6 8 17 20 3-14 13 3 20-17-9-17 9 3-20L4 26l20-3z',pentagon:'M32 6 59 26 49 57H15L5 26z',hexagon:'M17 9h30l15 23-15 23H17L2 32z',bezier:'M6 52C12-20 52 84 58 12',free:'M9 48C-1 20 24 5 40 15S69 44 47 55 12 61 9 48',polygon:'M9 12 40 20 57 7 49 52 15 56z'};
  let drawing='';
  if(['geometry','selection-shape','stroke-mode'].includes(key)) {
    drawing='<rect x="3" y="3" width="58" height="58" rx="12" fill="#fff9e9" stroke="#ead2a4" stroke-width="2"/>';
    if(key==='selection-shape')drawing+='<path d="M22 28 20 15 30 22 42 16 43 28" fill="#efb864"/><ellipse cx="33" cy="36" rx="16" ry="14" fill="#efb864" stroke="none"/><circle cx="27" cy="32" r="2" fill="#714c3c"/><circle cx="39" cy="32" r="2" fill="#714c3c"/><path d="m30 39 3 3 3-3" stroke="#714c3c" stroke-width="2"/>';
    drawing+=`<path d="${shape[value]||shape.rect}" fill="${key==='selection-shape'||['line','bezier','free'].includes(value)?'none':'#f6c785'}" stroke="${key==='selection-shape'?'#a35d40':'#cc8552'}" stroke-width="3" stroke-linejoin="round" ${key==='selection-shape'?'stroke-dasharray="4 4"':''}/>`;
    if(key!=='selection-shape')drawing+='<g transform="translate(43 36) rotate(32)"><path d="M0 0h9v19l-4.5 8L0 19Z" fill="#f2a796" stroke="#83513f" stroke-width="2"/><path d="M0 19h9L4.5 27Z" fill="#ffe9b9"/><path d="M2 6h5" stroke="#fff3da" stroke-width="3"/></g>';
  }
  if(key==='selection-mode'){
    const fills={replace:['#fff5df','#f3ba76'],union:['#f3ba76','#f3ba76'],subtract:['#f3ba76','#fff5df'],intersect:['#fff5df','#fff5df']}[value];
    drawing=`<rect x="4" y="10" width="36" height="39" rx="12" fill="${fills[0]}" stroke-dasharray="4 3"/><rect x="25" y="21" width="35" height="38" rx="12" fill="${fills[1]}" stroke-dasharray="4 3"/>`;
    if(value==='intersect')drawing+='<path d="M25 21h3q12 0 12 12v16H25Z" fill="#f3ba76" stroke="none"/>';
    drawing+='<circle cx="30" cy="33" r="2" fill="#87573e" stroke="none"/><circle cx="36" cy="33" r="2" fill="#87573e" stroke="none"/><path d="M30 40q3 3 6 0" stroke-width="2"/>';
  }
  if(key==='eraser-mode') drawing=`<rect x="5" y="7" width="54" height="50" rx="10" fill="#b8d9c8"/>${value==='rect'?'<rect x="14" y="20" width="35" height="26" rx="2" fill="#fffaf0" stroke="#8d6c55" stroke-dasharray="4 3"/>':`<path d="M15 44 44 19" stroke="#fffaf0" stroke-width="${value==='soft'?22:13}" stroke-linecap="round" opacity="${value==='soft'?.55:1}"/>`}<path d="m30 35 15-17 12 10-15 17Z" fill="#f1a396" stroke="#875944" stroke-width="2"/><path d="m30 35 6-7 12 10-6 7Z" fill="#ffe7bf"/>`;
  if(key==='fill-mode') {
    const gradient=value.includes('gradient'),base=value==='all'||value==='gradient',gradientId='choice-fill-'+(++choiceArtSequence);
    drawing='<defs><linearGradient id="'+gradientId+'"><stop stop-color="#f2b560"/><stop offset="1" stop-color="#e69aab"/></linearGradient></defs><rect x="4" y="5" width="56" height="54" rx="9" fill="#fff7e5" stroke="#d9bb8d" stroke-width="2"/>';
    drawing+=`<path d="${value==='ellipse'?'M7 48a24 10 0 1 0 48 0 24 10 0 1 0-48 0':base?'M7 9H57V56H7Z':value==='rect'?'M9 39H54V56H9Z':'M8 54V39L21 28 34 39V54Z'}" fill="${gradient?'url(#'+gradientId+')':'#eeb46b'}" stroke="#a76e4d" stroke-width="2"/>`;
    drawing+='<g transform="translate(28 4) rotate(14 12 17)"><path d="M1 12Q1-5 24 12" stroke="#886348" fill="none" stroke-width="3"/><path d="M0 12h25l-3 25H4Z" fill="#f3b994" stroke="#88583e" stroke-width="2"/><ellipse cx="12" cy="12" rx="13" ry="5" fill="#fff4d8" stroke="#88583e" stroke-width="2"/><ellipse cx="12" cy="12" rx="9" ry="2" fill="#eaa343"/><circle cx="9" cy="23" r="1.5" fill="#79523d"/><circle cx="17" cy="23" r="1.5" fill="#79523d"/><path d="M10 28q3 4 6 0" stroke="#79523d" stroke-width="2" fill="none"/><path d="M-1 14q-10 11-8 19" stroke="#eaa343" stroke-width="5" fill="none"/></g>';
    if(gradient)drawing+='<path d="M8 57h43m-5-4 5 4-5 4" stroke="#97624a" stroke-width="2"/>';
  }
  if(key==='warp-kind')drawing=value==='push'?'<path d="M12 8v48M26 8C6 22 51 34 26 56M40 8v48M54 8v48" fill="none" stroke="#84b5a1" stroke-width="4"/><path d="M13 32h32m-8-9 9 9-9 9" stroke="#aa6347" fill="none" stroke-width="4"/>':'<circle cx="32" cy="32" r="22" fill="#b6daca"/><circle cx="32" cy="32" r="12" fill="#f7d69b"/><path d="m15 15-7-7m0 10V8h10m31 41 7 7m-10 0h10V46" stroke="#92563c" fill="none" stroke-width="4"/>';
  if(key==='board-filter-kind')drawing={ripple:'<ellipse cx="32" cy="32" rx="26" ry="20"/><ellipse cx="32" cy="32" rx="17" ry="12"/><ellipse cx="32" cy="32" rx="7" ry="5"/>',twist:'<path d="M32 31c-18-20-36 16-11 24 37 12 52-41 20-48C16 0 6 13 7 24"/>',waterfall:'<path d="M12 6c-10 18 20 25 0 49M26 6c-10 18 20 25 0 49M40 6c-10 18 20 25 0 49M54 6c-10 18 20 25 0 49"/>','point-light':'<circle cx="32" cy="32" r="10" fill="#f5c570"/><path d="M32 3v10m0 38v10M3 32h10m38 0h10M12 12l7 7m26 26 7 7M12 52l7-7m26-26 7-7"/>','direction-light':'<path d="m9 12 43 5-30 34Z" fill="#ffe5a1"/><path d="m9 12 35 26m-13-1 13 1-4-13"/>'}[value]||'';
  if(drawing){view.innerHTML='<svg viewBox="0 0 64 64" fill="none" stroke="#8d654c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</svg>';return view;}
  const icon=key.includes('fractal')?'fractal':key.includes('filter')||key==='effect-kind'?'board-filter':key==='brush'?value:key.includes('music')?'music':key.includes('eraser')?'eraser':key.includes('fill')?'fill':key.includes('warp')?'warp':key==='preset'||key==='export-format'?'paper':key.startsWith('text')?'text':'palette';view.innerHTML=playfulIcon(icon);return view;
}
