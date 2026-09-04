import { applyEffect } from './pixels.js';
import { makeCanvas } from './engine.js';
import { playfulIcon } from './playful-icons.js';

// Vector teaching pictures remain sharp at every display scale.
export function choiceArt(select, option) {
  const view=document.createElement('span');view.className='choice-picture';view.setAttribute('aria-hidden','true');
  const key=select.id,value=option.value;
  if(['paint-source','paper-grain'].includes(key)&&!['color','custom','none'].includes(value)) {
    const image=document.createElement('img');image.src='assets/'+value+'.png';image.alt='';view.append(image);return view;
  }
  if(key==='effect-kind'){
    const canvas=makeCanvas(96,64),ctx=canvas.getContext('2d');ctx.fillStyle='#aad7dc';ctx.fillRect(0,0,96,64);ctx.fillStyle='#f7cd74';ctx.beginPath();ctx.arc(76,15,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#91b89b';ctx.fillRect(0,45,96,19);ctx.fillStyle='#f4c2a4';ctx.fillRect(28,29,34,29);ctx.fillStyle='#b9624a';ctx.beginPath();ctx.moveTo(21,30);ctx.lineTo(45,10);ctx.lineTo(70,30);ctx.fill();ctx.fillStyle='#714d3b';ctx.fillRect(40,40,11,18);ctx.fillStyle='#fff4d5';ctx.fillRect(31,35,6,7);ctx.fillRect(54,35,6,7);
    const pixels=ctx.getImageData(0,0,96,64);pixels.data.set(applyEffect(pixels.data,96,64,value,{brightness:30,contrast:15,hue:70,saturation:20,amount:45,radius:4,red:140,green:85,blue:110,levels:3,dx:[4,0,-4],dy:[0,0,0],seed:123,color:'#b9624a',background:'#f9d88e',tolerance:30}));ctx.putImageData(pixels,0,0);canvas.setAttribute('aria-hidden','true');view.append(canvas);return view;
  }
  if(key==='text-font'){view.textContent='画';view.style.fontFamily=value;view.classList.add('font-sample');return view;}
  const shape={line:'M8 52 56 12',rect:'M10 14h46v36H10z',roundrect:'M19 12h28q10 0 10 10v22q0 10-10 10H19q-10 0-10-10V22q0-10 10-10z',triangle:'M32 8 59 55H5z',ellipse:'M8 32a24 18 0 1 0 48 0 24 18 0 1 0-48 0',star:'m32 6 8 17 20 3-14 13 3 20-17-9-17 9 3-20L4 26l20-3z',pentagon:'M32 6 59 26 49 57H15L5 26z',hexagon:'M17 9h30l15 23-15 23H17L2 32z',bezier:'M6 52C12-20 52 84 58 12',free:'M9 48C-1 20 24 5 40 15S69 44 47 55 12 61 9 48',polygon:'M9 12 40 20 57 7 49 52 15 56z'};
  let drawing='';
  if(['geometry','selection-shape','stroke-mode'].includes(key)) drawing=`<path d="${shape[value]||shape.rect}" fill="${['line','bezier','free'].includes(value)?'none':'#f6c785'}" stroke="#8c5a43" stroke-width="4" stroke-linejoin="round" ${key==='selection-shape'?'stroke-dasharray="5 4"':''}/>`;
  if(key==='eraser-mode') drawing=`<rect x="5" y="7" width="54" height="50" rx="10" fill="#b8d9c8"/>${value==='rect'?'<rect x="14" y="20" width="35" height="26" rx="2" fill="#fffaf0" stroke="#8d6c55" stroke-dasharray="4 3"/>':`<path d="M15 44 44 19" stroke="#fffaf0" stroke-width="${value==='soft'?22:13}" stroke-linecap="round" opacity="${value==='soft'?.55:1}"/>`}<path d="m30 35 15-17 12 10-15 17Z" fill="#f1a396" stroke="#875944" stroke-width="2"/><path d="m30 35 6-7 12 10-6 7Z" fill="#ffe7bf"/>`;
  if(key==='fill-mode') {
    const gradient=value.includes('gradient'),base=value==='all'||value==='gradient';
    drawing='<defs><linearGradient id="fill-'+value+'"><stop stop-color="#f2b560"/><stop offset="1" stop-color="#e69aab"/></linearGradient></defs><rect x="4" y="5" width="56" height="54" rx="9" fill="#fff7e5" stroke="#d9bb8d" stroke-width="2"/>';
    drawing+=`<path d="${value==='ellipse'?'M12 32a20 17 0 1 0 40 0 20 17 0 1 0-40 0':base?'M9 10H55V54H9Z':value==='rect'?'M14 16H50V49H14Z':'M13 43V29L32 12 51 29V51H13Z'}" fill="${gradient?'url(#fill-'+value+')':'#eeb46b'}" stroke="#8c5a43" stroke-width="2"/><path d="m26 32 4 4 10-12" fill="none" stroke="#fffaf0" stroke-width="4" stroke-linecap="round"/>`;
  }
  if(key==='warp-kind')drawing=value==='push'?'<path d="M12 8v48M26 8C6 22 51 34 26 56M40 8v48M54 8v48" fill="none" stroke="#84b5a1" stroke-width="4"/><path d="M13 32h32m-8-9 9 9-9 9" stroke="#aa6347" fill="none" stroke-width="4"/>':'<circle cx="32" cy="32" r="22" fill="#b6daca"/><circle cx="32" cy="32" r="12" fill="#f7d69b"/><path d="m15 15-7-7m0 10V8h10m31 41 7 7m-10 0h10V46" stroke="#92563c" fill="none" stroke-width="4"/>';
  if(key==='board-filter-kind')drawing={ripple:'<ellipse cx="32" cy="32" rx="26" ry="20"/><ellipse cx="32" cy="32" rx="17" ry="12"/><ellipse cx="32" cy="32" rx="7" ry="5"/>',twist:'<path d="M32 31c-18-20-36 16-11 24 37 12 52-41 20-48C16 0 6 13 7 24"/>',waterfall:'<path d="M12 6c-10 18 20 25 0 49M26 6c-10 18 20 25 0 49M40 6c-10 18 20 25 0 49M54 6c-10 18 20 25 0 49"/>','point-light':'<circle cx="32" cy="32" r="10" fill="#f5c570"/><path d="M32 3v10m0 38v10M3 32h10m38 0h10M12 12l7 7m26 26 7 7M12 52l7-7m26-26 7-7"/>','direction-light':'<path d="m9 12 43 5-30 34Z" fill="#ffe5a1"/><path d="m9 12 35 26m-13-1 13 1-4-13"/>'}[value]||'';
  if(drawing){view.innerHTML='<svg viewBox="0 0 64 64" fill="none" stroke="#8d654c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</svg>';return view;}
  const icon=key.includes('fractal')?'fractal':key.includes('filter')||key==='effect-kind'?'board-filter':key==='brush'?value:key.includes('music')?'music':key.includes('eraser')?'eraser':key.includes('fill')?'fill':key.includes('warp')?'warp':key==='preset'||key==='export-format'?'paper':key.startsWith('text')?'text':'palette';view.innerHTML=playfulIcon(icon);return view;
}
