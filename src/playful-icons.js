const art={
 pencil:'<path fill="#ffd66b" d="M15 45 43 9q3-3 6 0l7 6q3 3 0 6L28 55 11 60z"/><path fill="#ffe8bc" d="m15 45 13 10-17 5z"/><path fill="#695145" d="m12 54 5 4-6 2z"/><path d="m25 44 25-29"/><path fill="#ee9484" d="m43 9 13 12 3-4q2-3-1-6l-6-5q-3-2-6 1z"/>',
 spray:'<rect x="18" y="24" width="29" height="34" rx="8" fill="#8fc7c3"/><path fill="#fbe4a4" d="M22 24v-7h20v7"/><path d="M28 17V9h12v8" fill="#ed9274"/><path d="m43 9 8-3m-6 9h12m-11 5 7 4"/><circle cx="29" cy="34" r="3" fill="#fff" stroke="none"/><path d="M25 48h14"/>',
 watercolor:'<path fill="#a8b6dd" d="m34 39 17-31q3-5 8-1 4 3 0 7L39 44z"/><path fill="#f1d7a8" d="m29 40 5-7 10 7-5 9z"/><path fill="#6a9ecc" d="M30 40c-17-1-6 17-21 15 14 12 31 1 29-10z"/><path d="M20 53q9 0 12-9" stroke="#d4ebfb"/>',
 brush:'<path fill="#de9564" d="M27 33 34 9q2-6 8-4 5 2 3 7l-9 25z"/><path fill="#e3e7dc" d="m19 30 25 9-4 10-26-9z"/><path fill="#e7bd80" d="m14 40 26 9-7 12-26-9z"/><path d="m17 43-6 10m13-8-6 10m13-8-6 10"/>',
 marker:'<path fill="#b99bcd" d="m14 46 25-31 16 13-26 30z"/><path fill="#f5e8cf" d="m39 15 5-6 15 13-4 6z"/><path fill="#695d92" d="m13 46 14 11-9 2-8-6z"/><path d="m24 39 14 11m-9-32 12 10"/>',
 crayon:'<path fill="#ef8d74" d="m17 44 24-31 15 11-24 31z"/><path fill="#ffe2a1" d="m17 44 15 11-17 4z"/><path fill="#d76456" d="m41 13 2-8 17 13-4 6z"/><path fill="#ffcc84" d="m26 32 9-12 15 11-9 12z"/><path d="m31 28 13 10"/>',
 chalk:'<path fill="#a9c697" d="M16 44 39 12q3-4 8-1l8 6q4 3 1 8L33 56q-4 5-9 1l-7-5q-4-3-1-8z"/><path d="m18 42 17 12m6-36 8 5" stroke="#eff6df"/><path d="m9 57 3 1m29 2 1-1m-6 5 1-1"/>',
 tube:'<path fill="#ffe2a3" d="m15 17 36-2-2 33-12 8-17-7z"/><path fill="#f7af66" d="m13 10 40-2 1 9-40 3z"/><path fill="#ee8b69" d="m18 27 32-2-2 16-28 3z"/><path fill="#ae9eb7" d="M26 51h16v10H26z"/><path d="m30 56 1 4m5-4 1 4"/>',
 effect:'<path d="M12 57 40 28" stroke="#b995c8" stroke-width="9"/><path fill="#ffce62" d="m43 7 5 12 13 2-10 9 2 13-11-7-12 6 3-13-9-10 13-1z"/><path d="m13 10 2 7m-5-3 8-1m42 35v7m-4-3h8" stroke="#db8760"/>',
 eraser:'<path fill="#ed9aab" d="M8 40 32 12q4-4 8 0l18 17q4 4 0 8L36 60H26z"/><path fill="#fbe4ba" d="m9 39 22 21h9l18-22-25-21z"/><path d="m16 47 13 12m17-1h13"/>',
 stamp:'<path fill="#efb08b" d="M13 24q-4 35 19 37 26 0 20-37z"/><path fill="#e28174" d="m14 24 6-8 5 8 8-10 8 10 7-8 4 8z"/><path fill="#ffdc73" d="m32 30 4 8 9 1-6 6 1 9-8-5-8 4 2-8-6-7 9-1z"/>',
 fill:'<path fill="#a5c9cd" d="m28 13 26 24-22 22L7 36z"/><path d="M23 20V11q0-9 8-6l17 12q8 8 1 18" fill="none"/><path fill="#ffbd67" d="m8 36 24 23 21-21z"/><path fill="#ee8a75" d="M57 42c-12 13-3 19 2 13q4-5-2-13z"/>',
 picker:'<path fill="#c1b0d7" d="m27 27 19-19q5-5 10 1 5 5 0 10L38 38z"/><path fill="#d5edf0" d="m25 24 17 16-24 21-10-1v-9z"/><path d="m14 48 10 10"/><path fill="#ec9778" d="M9 58v-9l10-10 13 12-15 10z"/>',
 line:'<path fill="#ffd47b" d="M9 10h35v34H9z"/><path fill="#a6c8bb" d="m36 29 24 32H16z"/><circle cx="45" cy="22" r="13" fill="#ec9c96"/>',
 text:'<path fill="#f6c875" d="M8 10h49v13H41v37H26V23H8z"/><path d="M13 16h37M31 53h6" stroke="#fff3d2"/>',
 select:'<rect x="9" y="10" width="45" height="43" rx="8" fill="#ffefd0" stroke-dasharray="5 5"/><path fill="#ed9c7e" d="m30 29 3 31 8-9 10 3z"/>',
 magic:'<path d="m13 56 28-30" stroke="#b399cf" stroke-width="10"/><path fill="#ffe192" d="m42 6 4 13 13 4-13 4-4 13-4-13-13-4 13-4z"/><path d="m13 8 2 8m-6-3 9-2m39 33 2 8m-6-3 9-2"/>',
 move:'<path fill="#f4bc73" d="M26 8h12v15h15V11l10 17-10 17V34H38v21h12L32 65 14 55h12V34H11v11L1 28l10-17v12h15z" transform="translate(3 1) scale(.9)"/>',
 warp:'<path fill="#b1c8d6" d="M9 15c21-18 28 19 46 0v34c-20 20-31-17-46 0z"/><path d="M24 12v34m14-21v31M10 31q23-17 44 3" fill="none"/>',
 'board-filter':'<circle cx="31" cy="31" r="24" fill="#f9dba0"/><circle cx="31" cy="31" r="14" fill="#ef9a8f"/><path d="M31 8c31 26-25 48-16 12m29 31C13 27 59 13 49 40" fill="none"/>',
 clone:'<path fill="#e1b489" d="M14 42h38l6 14H8z"/><path fill="#b5a8cc" d="M22 42v-8q18-5 6-16-6-9 5-13 15-2 15 9 0 9-7 13v15z"/><path d="M10 61h46" stroke="#dc8c79" stroke-width="4"/>',
 fractal:'<path d="M31 61V25M31 50 15 37m16 2 19-19M22 44 8 43m14 1-4-19m22 6 17-1M40 31l-1-18M31 32 20 15m11 11L40 8" stroke="#87ac83" stroke-width="5" fill="none"/><circle cx="31" cy="59" r="3" fill="#e1b578"/>',
 palette:'<path fill="#ffdb94" d="M8 25c10-27 54-17 51 10-1 10-14 3-18 12-4 18-27 12-32-2-2-6-3-12-1-20z"/><circle cx="22" cy="22" r="5" fill="#ee8b79"/><circle cx="39" cy="18" r="5" fill="#91bda4"/><circle cx="48" cy="31" r="5" fill="#a6aed7"/><circle cx="18" cy="39" r="5" fill="#efb45b"/><circle cx="32" cy="43" r="5" fill="#fff5dc"/>',
 music:'<path d="M27 45V13l28-6v30" stroke-width="5" fill="none"/><path d="m28 22 26-6" stroke-width="5"/><ellipse cx="18" cy="49" rx="11" ry="8" fill="#e79daf"/><ellipse cx="46" cy="41" rx="11" ry="8" fill="#e79daf"/>',
 save:'<path fill="#a9c9ae" d="M10 8h39l9 10v42H10z"/><path fill="#fff2d3" d="M20 8h24v19H20zm-1 32h30v20H19z"/><path d="M36 12v10m-10 25h15m-15 7h15"/>',
 folder:'<path fill="#ffc979" d="M7 15h22l7 8h22v35H7z"/><path fill="#ffe0a0" d="M8 30h53l-8 29H5z"/>',
 download:'<path fill="#a6c6c5" d="M25 7h14v25h12L32 51 13 32h12z"/><path d="M8 48v13h48V48" fill="none"/>',
 layers:'<path fill="#d3b1cd" d="m7 22 26-16 25 16-25 16z"/><path fill="#f3c982" d="m7 33 26 16 25-16v12L33 61 7 45z"/>',
 undo:'<path fill="#f2b97b" d="M25 10 5 28l20 16V32c21-5 28 8 22 24 17-14 10-39-22-37z"/>',
 redo:'<g transform="translate(64 0) scale(-1 1)"><path fill="#a9c9c0" d="M25 10 5 28l20 16V32c21-5 28 8 22 24 17-14 10-39-22-37z"/></g>',
 paper:'<path fill="#fff8e7" d="M13 5h31l10 12v44H13z"/><path fill="#ffd188" d="M44 5v14h10"/><path d="M33 31v19M23 41h20" stroke="#d18161" stroke-width="4"/>',
 display:'<rect x="6" y="10" width="52" height="37" rx="7" fill="#a9c5cd"/><path fill="#fff4d6" d="M12 16h40v25H12z"/><path d="M26 48v9h13v-9m-21 13h29"/><path d="m18 24 6-3m-6 12 6 3m17-15 5 3m-5 12 5-3" stroke="#ce835e"/>',
 more:'<path fill="#eeb591" d="M8 23h48v35H8z"/><path fill="#f8d592" d="M21 23V10h24v13"/><path d="M8 37h48m-29-5v10h10V32" fill="#fff3cd"/>',
};
Object.assign(art,{
 cut:'<circle cx="16" cy="47" r="10" fill="#efa59b"/><circle cx="46" cy="47" r="10" fill="#a8cbbd"/><path d="M22 40 49 8 31 36 14 8 40 40" fill="#d8e0dc"/><circle cx="31" cy="33" r="3" fill="#f7d18c"/>',
 copy:'<rect x="8" y="7" width="34" height="43" rx="5" fill="#a7c9bc"/><rect x="22" y="19" width="34" height="43" rx="5" fill="#fff2d2"/><path d="M30 31h18m-18 9h18m-18 9h12"/>',
 paste:'<rect x="10" y="12" width="45" height="48" rx="6" fill="#ecc18b"/><rect x="17" y="21" width="31" height="32" rx="3" fill="#fff7e6"/><rect x="23" y="6" width="20" height="13" rx="4" fill="#a9cbbb"/><path d="m24 38 7 6 11-15"/>',
 rotate:'<path d="M13 24a22 22 0 1 1 0 20" fill="none" stroke-width="6" stroke="#c77c59"/><path d="M8 10v18h18" fill="#f1c881"/><rect x="24" y="25" width="18" height="18" rx="4" fill="#b7d0ba" transform="rotate(20 33 34)"/>',
 play:'<circle cx="32" cy="32" r="26" fill="#b5d3bc"/><path d="m26 18 20 14-20 14z" fill="#fff7df"/>',
 stop:'<circle cx="32" cy="32" r="26" fill="#edb4a1"/><rect x="21" y="21" width="22" height="22" rx="4" fill="#fff7df"/>',
});
Object.assign(art,{
 forest:'<path d="M8 53Q32 40 59 53V61H8Z" fill="#aad3a0"/><path d="M27 26h10v31H27Z" fill="#c79764"/><path d="M10 29C0 14 19 7 26 11 32-3 51 5 49 17 67 21 60 40 44 38 32 48 15 41 10 29Z" fill="#aacd83"/><circle cx="25" cy="26" r="2" fill="#705142"/><circle cx="40" cy="26" r="2" fill="#705142"/><path d="M28 33q5 5 10 0" fill="none"/><circle cx="20" cy="32" r="3" fill="#f1b0a1" stroke="none"/>',
 friend:'<path d="M16 25 10 6 29 16 44 8 54 25" fill="#efbc7b"/><ellipse cx="33" cy="37" rx="26" ry="23" fill="#efbc7b"/><ellipse cx="32" cy="43" rx="15" ry="12" fill="#ffe7bd"/><circle cx="23" cy="31" r="3" fill="#705142"/><circle cx="43" cy="31" r="3" fill="#705142"/><path d="m28 40 5 4 5-4z" fill="#b77668"/><path d="M24 48q9 8 18 0" fill="none"/><path d="M7 39h10M6 47l11-3m31-5h12m-12 5 12 3"/>',
 butterfly:'<path d="M30 29C13-9-11 15 12 37-10 61 28 68 31 43 34 70 69 63 54 39 78 11 43-8 35 29" fill="#f0acbc"/><path d="M31 25q7-4 6 7l-3 21q-4 7-7-1Z" fill="#e7b167"/><circle cx="33" cy="24" r="8" fill="#ffdfa0"/><circle cx="30" cy="23" r="1.5" fill="#705142"/><circle cx="36" cy="23" r="1.5" fill="#705142"/><path d="M30 28q3 3 6 0M29 17 24 9m12 8 6-8"/><path d="m9 24 10 6m28-6 8-6" stroke="#fff0db" stroke-width="5"/>',
});
art['grow']='<circle cx="30" cy="28" r="23" fill="#b8d7ae"/><circle cx="23" cy="22" r="2" fill="#705142"/><circle cx="37" cy="22" r="2" fill="#705142"/><path d="M23 31q7 9 14 0" fill="none"/><circle cx="48" cy="48" r="15" fill="#ffe5a4"/><path d="M40 48h16m-8-8v16" stroke-width="4"/>';
art['shrink']='<circle cx="27" cy="29" r="17" fill="#b8d7ae"/><circle cx="22" cy="24" r="1.6" fill="#705142"/><circle cx="32" cy="24" r="1.6" fill="#705142"/><path d="M22 31q5 6 10 0" fill="none"/><circle cx="48" cy="48" r="15" fill="#f5c1ab"/><path d="M40 48h16" stroke-width="4"/>';
const faces={eraser:[34,37],fill:[28,39],stamp:[32,43],tube:[33,34],spray:[32,40],text:[33,38],paper:[30,43],folder:[31,42]};
export function playfulIcon(name){return `<svg viewBox="0 0 68 68" class="playful-icon" aria-hidden="true" focusable="false"><g transform="translate(2 1)" stroke="#705142" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">${art[name]||art.palette}${faces[name]?`<g transform="translate(${faces[name][0]} ${faces[name][1]})"><ellipse cx="-5" cy="0" rx="1.7" ry="2.3" fill="#684438" stroke="none"/><ellipse cx="5" cy="0" rx="1.7" ry="2.3" fill="#684438" stroke="none"/><path d="M-4 5q4 5 8 0" stroke-width="1.5" fill="none"/><circle cx="-9" cy="4" r="2.5" fill="#e7978e" stroke="none"/><circle cx="9" cy="4" r="2.5" fill="#e7978e" stroke="none"/></g>`:''}</g></svg>`;}
