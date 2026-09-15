import { playfulIcon } from './playful-icons.js';

// Coordinates belong to the artwork itself, before scaling to the 40 px cursor.
// A contact is a nib, edge, nozzle, or working center — never a separate marker.
const iconContacts = {
  pencil:[13,61], crayon:[17,60], watercolor:[11,56], brush:[22,57],
  marker:[12,54], chalk:[26,58], spray:[42,14], tube:[36,62], effect:[45,8],
  stamp:[34,44], friend:[35,38], butterfly:[35,33], picker:[10,61],
  magic:[44,7], move:[32,27], text:[28,61], clone:[34,57], fractal:[33,62],
};
const cursorShapes = {
  line:'M8 52 56 12',rect:'M10 14h46v36H10z',roundrect:'M19 12h28q10 0 10 10v22q0 10-10 10H19q-10 0-10-10V22q0-10 10-10z',
  triangle:'M32 8 59 55H5z',ellipse:'M8 32a24 18 0 1 0 48 0 24 18 0 1 0-48 0',star:'m32 6 8 17 20 3-14 13 3 20-17-9-17 9 3-20L4 26l20-3z',
  pentagon:'M32 6 59 26 49 57H15L5 26z',hexagon:'M17 9h30l15 23-15 23H17L2 32z',
  bezier:'M6 52C12-20 52 84 58 12',free:'M9 48C-1 20 24 5 40 15S69 44 47 55 12 61 9 48',polygon:'M9 12 40 20 57 7 49 52 15 56z',
};
function pouringBucket(value) {
  const gradient=value.includes('gradient'),id='cursor-paint-'+value;
  const paint=gradient?`url(#${id})`:'#edaa4c';
  const shape=value.startsWith('ellipse')?'<ellipse cx="33" cy="33" rx="7" ry="5"/>':value.startsWith('rect')?'<rect x="27" y="28" width="13" height="10"/>':value==='all'||value==='gradient'?'<rect x="25" y="27" width="17" height="13"/>':'<path d="M26 39V31l7-6 8 6v8Z" stroke-dasharray="3 2"/>';
  return `<defs><linearGradient id="${id}"><stop stop-color="#efb34f"/><stop offset="1" stop-color="#da779c"/></linearGradient></defs>
    <g transform="rotate(40 32 27)"><path d="M18 19v-5a14.5 14.5 0 0 1 29 0v5" fill="none"/>
    <path d="M18 19h29l-3 25q-11 6-22 0Z" fill="#a9cdd0"/><path d="M23 24l3 17" stroke="#e5f5ed"/>
    <ellipse cx="32.5" cy="19" rx="15.5" ry="5" fill="#fff0ce"/><ellipse cx="32.5" cy="20" rx="12" ry="2.5" fill="${paint}" stroke="none"/>
    <g fill="${paint}" stroke="#986440" stroke-width="1.6">${shape}</g>${gradient?'<path d="M27 34h11m-3-3 3 3-3 3" fill="none" stroke="#fff8e0" stroke-width="1.5"/>':''}</g>
    <path d="M47 31c10 4 5 12 5 17" fill="none" stroke="${paint}" stroke-width="5"/>
    <path d="M52 46c-1 5-6 8-5 12 1 5 10 5 11 0 1-4-4-7-6-12Z" fill="${paint}" stroke="#aa713f" stroke-width="1.4"/>`;
}
function cursorArt(entry) {
  if(entry.tool==='fill')return {body:pouringBucket(entry.value),contact:[52,61]};
  if(entry.tool==='eraser') {
    const soft=entry.value==='soft',rect=entry.value==='rect';
    return {contact:soft?[18,54]:[21,51],body:`${rect?'<path d="M7 23V8h44v14M7 39v17h7m19 0h18v-9" fill="none" stroke-dasharray="4 4"/>':''}
      <path d="M10 44 35 14q${soft?'8-8 15 0l8 8q8 8 0 16L33 59q-4 4-8 0L11 49q-3-2-1-5':'3-3 6 0l17 14q3 3 0 6L33 59 10 44'}Z" fill="${soft?'#c3aedb':'#ee9bad'}"/>
      <path d="m10 44 10-12 24 20-11 7Z" fill="#ffdfb3"/><path d="m25 24 15-5" stroke="#fff3e7"/>${soft?'<path d="m17 45 14 11" stroke="#fff5e3" stroke-width="4"/>':''}`};
  }
  if(entry.tool==='geometry'||entry.tool==='select') {
    const selecting=entry.tool==='select';
    return {contact:selecting?[8,7]:[16,58],body:`<path d="${cursorShapes[entry.value]}" fill="${selecting||['line','bezier'].includes(entry.value)?'none':'#f6cf8c'}" stroke="#b47852" ${selecting?'stroke-dasharray="4 4"':''}/>
      ${selecting?'<path d="m8 7 4 26 6-8 10 1Z" fill="#fff0c8"/>':'<path d="m16 58 3-13 19-24 9 7-19 24Z" fill="#e9a090"/><path d="m16 58 3-13 9 7Z" fill="#ffe6b0"/><path d="m16 58 1-5 4 3Z" fill="#705142"/>'}`};
  }
  if(entry.tool==='warp')return entry.value==='push'?{contact:[46,32],body:'<path d="M12 8v48M26 8C6 22 51 34 26 56M40 8v48M54 8v48" fill="none" stroke="#84b5a1" stroke-width="4"/><path d="M13 32h33m-9-9 9 9-9 9" stroke="#aa6347" fill="none" stroke-width="4"/>'}:{contact:[32,32],body:'<circle cx="32" cy="32" r="22" fill="#b6daca"/><circle cx="32" cy="32" r="12" fill="#f7d69b"/><path d="m15 15-7-7m0 10V8h10m31 41 7 7m-10 0h10V46" fill="none"/>'};
  if(entry.tool==='board-filter')return {
    contact:entry.value==='direction-light'?[9,12]:entry.value==='waterfall'?[27,54]:[32,32],
    body:{ripple:'<ellipse cx="32" cy="32" rx="26" ry="20"/><ellipse cx="32" cy="32" rx="17" ry="12"/><ellipse cx="32" cy="32" rx="7" ry="5"/>',twist:'<path d="M32 31c-18-20-36 16-11 24 37 12 52-41 20-48C16 0 6 13 7 24"/>',waterfall:'<path d="M12 6c-10 18 20 25 0 49M26 6c-10 18 20 25 0 49M40 6c-10 18 20 25 0 49M54 6c-10 18 20 25 0 49"/>','point-light':'<circle cx="32" cy="32" r="10" fill="#f5c570"/><path d="M32 3v10m0 38v10M3 32h10m38 0h10M12 12l7 7m26 26 7 7M12 52l7-7m26-26 7-7"/>','direction-light':'<path d="m9 12 43 5-30 34Z" fill="#ffe5a1"/><path d="m9 12 35 26m-13-1 13 1-4-13"/>'}[entry.value],
  };
  return {icon:entry.icon,contact:iconContacts[entry.icon]};
}

export function toolCursor(entry) {
  const art=cursorArt(entry),size=art.icon?68:64;
  const artwork=art.icon?playfulIcon(art.icon):`<svg viewBox="0 0 64 64" fill="none" stroke="#705142" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${art.body}</svg>`;
  const svg=artwork.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" ');
  return {svg,hotspot:art.contact.map(n=>Math.round(n*40/size))};
}
