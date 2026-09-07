// Original vector artwork for looping fairy-bag sprites. Every pose uses the
// same anchor and design; no generated story panels are used as animation.
const pi=Math.PI,round=n=>Math.round(n*100)/100;
const path=(d,fill,stroke='#66513e',width=5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ellipse=(x,y,rx,ry,fill,stroke='none',width=4)=>`<ellipse cx="${round(x)}" cy="${round(y)}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const circle=(x,y,r,fill,stroke='none',width=4)=>ellipse(x,y,r,r,fill,stroke,width);
const group=(transform,body)=>`<g transform="${transform}">${body}</g>`;
const line=(d,color='#5b814b',width=6)=>path(d,'none',color,width);
function face(){return '';}
function leaf(x,y,angle,size=1,color='url(#leaf)'){
 return group(`translate(${x} ${y}) rotate(${angle}) scale(${size})`,path('M0 0C-71-6-111-65-121-119C-47-120 9-77 0 0Z',color,'#598757',3)+line('M0 0Q-48-68-101-102','#d1df8c',3)+line('M-47-64-47-96M-66-82-97-77','#bdd88b',2));
}
function flower(kind,variant,t){
 const grow=Math.min(1,.08+t*2),sway=0,bloom=Math.max(.05,Math.min(1,(t-.42)*3));
 const color={0:'#ed7cab',4:'#6cb9ea',5:'#f5c94f',6:'#a898d9',12:'#fff3d8'}[kind];
 let body=path('M252 466Q282 356 247 172','none','#55884e',12)+line('M256 459Q280 340 247 175','#a4c581',4)+leaf(258,371,-12,.72)+leaf(267,316,116,.61)+leaf(257,417,119,.68);
 if(kind===5||kind===6){body+=line('M265 335Q175 299 173 226M269 292Q355 241 352 188','#659952',8);}
 function blossom(x,y,s=1){
  let p='';
  if(kind===4)p=path('M-65-32Q-62 64 0 63Q63 62 68-36Q42-37 25-9L0-64-24-9Q-47-41-65-32Z',color,'#598cc1',4)+line('M0-46V51M-49-19Q-37 20-18 44M47-20Q37 16 19 44','#bceaf8',5);
  else{const count=kind===12?6:5+(variant%2);for(let i=0;i<count;i++)p+=group(`rotate(${i*360/count})`,path(kind===12?'M0 12Q-44-34 0-96Q48-42 0 12Z':'M0 12C-69-2-70-74-26-79C13-82 33-35 0 12Z',color,kind===12?'#d8cba8':'#aa6b87',3));p+=circle(0,0,27,'#ffe18a','#c99c49',3);for(let i=0;i<9;i++)p+=circle(Math.cos(i*2.4)*16,Math.sin(i*2.4)*16,3,'#c99847');}
  return group(`translate(${x} ${y}) scale(${s*bloom} ${s*(.65+.35*bloom)})`,p);
 }
 body+=blossom(247,168,1.15);if(kind===5||kind===6)body+=blossom(173,223,.67)+blossom(352,182,.72);
 return group(`translate(256 465) rotate(${sway}) scale(${grow}) translate(-256 -465)`,body);
}
function grass(kind,variant,t){
 let b='';const count=kind===8?3:kind===7?7:11;
 for(let i=0;i<count;i++){
  const a=(i-(count-1)/2),x=256+a*(kind===1?18:12),height=(kind===8?210:270)+Math.sin(i*2.1+variant)*90;
  const growth=Math.min(1,.04+t*1.8),tip=x+a*12*growth+Math.sin(t*2*pi+variant+i*.16)*6*growth,y=470-height*growth;
  b+=path(`M${x-10} 472Q${x-42} ${y+115} ${tip} ${y}Q${x+25} ${y+100} ${x+13} 472Z`,i%2?'url(#leaf)':'#86bc69','#648d50',3)+line(`M${x+2} 465Q${x-12} ${y+150} ${tip} ${y+20}`,'#c3df93',2);
 }
 return b;
}
function bubbles(kind,variant,t){
 let b='';for(let i=0;i<4;i++){
  const phase=(t+i*.25)%1,r=[46,32,23,15][i]*(.6+.4*phase),x=[238,351,151,359][i]+Math.sin(t*2*pi+i)*8,y=430-phase*340;
  b+=circle(x,y,r,kind===17?'url(#clearBubble)':'url(#bubble)',kind===17?'#a2d5df':'#78b9dc',3)+path(`M${x-r*.6} ${y-r*.18}Q${x-r*.61} ${y-r*.65} ${x-r*.1} ${y-r*.73}`,'none','#ffffff',7)+circle(x+r*.5,y+r*.51,r*.1,'#d9b7e2');
 }return b;
}
function smoke(variant,t){let b='';for(let i=4;i>=0;i--){const phase=(t+i/5)%1,r=18+phase*54,x=256+Math.sin(phase*pi*2+variant)*24,y=455-phase*360; b+=group(`translate(${x} ${y}) rotate(${Math.sin(t*2*pi)*8})`,circle(0,0,r,'url(#smoke)')+path(`M${-r*.5} 8C${-r*.5} ${-r*.6} ${r*.65} ${-r*.6} ${r*.3} 6C${r*.12} 28 ${-r*.25} 14 0 2`,'none','#c1cbd6',4));}return b;}
function dandelion(variant,t){
 const sx=256+Math.sin(t*2*pi+variant)*15,sy=177-variant*7;
 let b=line(`M252 469Q292 290 ${sx} ${sy}`,'#71964f',8)+leaf(258,389,30,.53)+leaf(266,352,120,.6);
 for(let i=0;i<28;i++){
  const a=i*pi*2/28,r=76+variant*5+Math.sin(i*7)*12,ex=sx+Math.cos(a)*r,ey=sy+Math.sin(a)*r;
  b+=line(`M${sx} ${sy}L${ex} ${ey}`,'#a8a681',2);
  for(let j=-2;j<=2;j++)b+=line(`M${ex} ${ey}l${Math.cos(a+j*.25)*17} ${Math.sin(a+j*.25)*17}`,'#f9f3df',3);
 }return group('translate(256 469) scale('+Math.min(1,.1+t*1.8)+') translate(-256 -469)',b+circle(sx,sy,17,'#c5b887'));
}
function ladybug(variant,t){
 let b='';for(const side of [-1,1])for(let i=0;i<3;i++){const y=218+i*49,step=Math.sin(t*2*pi+i*pi)*13;b+=line(`M${256+side*73} ${y}q${side*68} ${step-28} ${side*77} ${step+15}`,'#685b4d',9);}
 b+=ellipse(256,278,107,129,['#ef6f67','#f39858','#ed8899'][variant%3],'#815349',5)+ellipse(219,232,33,66,'#ffb696');
 b+=line('M256 165V405','#895349',5);
 for(const side of [-1,1])for(let i=0;i<3;i++)b+=circle(256+side*(i===1?65:45),217+i*64,16,'#61584d');
 b+=ellipse(256,157,69,56,'#6b6256')+circle(233,145,5,'#171f20')+circle(279,145,5,'#171f20')+face(256,166,.7)+line('M221 119Q180 88 192 69M286 118Q327 89 316 68','#6b6256',6)+circle(193,70,10,'#f7bc6b')+circle(316,68,10,'#f7bc6b');
 return group(`translate(0 ${Math.sin(t*2*pi)*5})`,b);
}
function butterfly(variant,t){
 const colors=['#ee9abc','#a695d7','#83c9d0','#f4c970'],c=colors[variant%4],sx=.42+.58*(.5+.5*Math.cos(t*2*pi));let b='';
 for(const side of [-1,1])b+=group(`translate(256 265) scale(${side*sx} 1)`,path('M0 0C-27-80-140-193-185-116C-229-47-99 22-27 27C-166 0-192 138-100 132C-39 128-13 62 0 0Z',c,'#8a709c',5)+path('M-33-9C-59-58-139-117-158-83C-172-54-100-24-33-9Z','#ffe3a6','#d0a085',3)+path('M-40 42Q-135 42-119 92Q-83 113-40 42Z','#ffedc4','#d0a085',3)+circle(-162,-103,11,'#fff3d7')+circle(-124,111,9,'#fff3d7'));
 b+=ellipse(256,284,22,81,'#d99e62','#a4714e',4)+ellipse(256,202,18,24,'#655342')+face(256,203,.48)+line('M239 177Q199 125 213 120M270 176Q304 128 297 119','#987148',5)+circle(213,120,7,'#e9a8bc')+circle(298,119,7,'#e9a8bc');return b;
}
function star(variant,t){
 let d='';for(let i=0;i<10;i++){const a=-pi/2+i*pi/5,r=i%2?65:145;d+=(i?'L':'M')+round(256+Math.cos(a)*r)+' '+round(256+Math.sin(a)*r);}d+='Z';
 return group(`rotate(${t*360} 256 256)`,path(d,['#f9cf6f','#f3a97c','#dbc0ec'][variant%3],'#c39654',6)+ellipse(213,187,17,31,'#ffecc3'))+circle(98,119,8,'#f7d897')+circle(405,360,10,'#f9dc9d');
}
function fish(variant,t){
 const c=['#eead5a','#82bacd','#b1c480'][variant%3],tail=12*Math.sin(t*2*pi);
 return group(`translate(0 ${Math.sin(t*2*pi)*10})`,group(`rotate(${tail} 353 255)`,path('M344 254Q411 152 452 162Q417 251 452 351Q391 328 344 254Z',c,'#8c8864',5)+line('M363 255L427 196M364 258 426 319','#efddb0',4))+path('M230 165Q250 104 310 142L335 190M231 338Q271 394 316 326',c,'#8c8864',5)+ellipse(253,258,126,93,c,'#8c8864',5)+path('M253 181Q224 255 255 335M300 180Q277 260 303 335','none','#f9e5ac',14)+path('M248 263Q304 231 287 291Q269 314 248 263Z','#e8d5a8','#b49972',3)+circle(179,235,22,'#fffaf0')+circle(176,236,12,'#51483c')+circle(172,231,4,'white')+line('M133 266L146 269','#856451',3));
}
function seaweed(variant,t){let b='';for(let i=0;i<5;i++){const x=192+i*28,h=235+Math.sin(variant+i*1.5)*70,wave=Math.sin(t*2*pi+i)*22;b+=path(`M${x} 467C${x-62} 383 ${x+61} 282 ${x+wave} ${467-h}C${x+85} 293 ${x-13} 374 ${x+24} 467Z`,i%2?'#8fb779':'#75afa0','#609980',3)+line(`M${x+12} 450Q${x-11} 390 ${x+29} 336`,'#b1d6a4',3);}return b;}
function coral(variant,t){let b='';const color=['#e99588','#cf94b5','#e8b080'][variant%3];for(let i=0;i<5;i++){const x=147+i*54,h=165+(i%3)*67,tip=x+Math.sin(t*2*pi+i)*5;b+=path(`M256 463Q${x} 392 ${tip} ${h}M${x} 335Q${x-47} 298 ${x-39} ${h+53}M${x} 291Q${x+37} 252 ${x+39} ${h+17}`,'none',color,23);for(let j=0;j<5;j++)b+=circle(x+Math.sin(i+j)*9,h+j*42,3,'#ffe9c7');}return group('translate(256 463) scale('+Math.min(1,.15+t*1.7)+') translate(-256 -463)',b);}
function mushroom(variant,t){let b='';for(let i=0;i<3;i++){const x=[254,135,370][i],y=[272,338,345][i],scale=[1,.65,.62][i],bob=0;let cap=path('M-25 11Q-39 84-22 155Q0 170 31 151L25 12Z','#f7dfb6','#bd9b75',4)+path('M-107 13Q-109-97 0-115Q106-100 112 11Q34 48-107 13Z',['#dc8f80','#d5ad78','#b39ac4'][variant%3],'#a67666',5)+ellipse(0,20,96,15,'#f3cda8')+circle(-49,-40,16,'#ffeac4')+circle(18,-73,18,'#ffeac4')+circle(57,-24,13,'#ffeac4')+face(1,79,.4);b+=group(`translate(${x} ${y+bob}) scale(${scale*Math.min(1,.08+t*1.8)})`,cap);}return b;}
function windmill(variant,t){let b=path('M195 252H307L333 462H173Z','#f0dba8','#b0956c',5)+path('M183 268L250 180 317 268Z','#d88972','#a16f5d',5)+path('M231 462V389Q255 367 279 389V462Z','#baa780','#947d61',4)+path('M236 320H273V355H236Z','#a3c8d2','#998669',4)+line('M255 320V355M236 338H273','#faf0d4',3);let blades='';for(let i=0;i<4;i++)blades+=group(`rotate(${i*90})`,path('M-10-8-22-150 25-172 36-20Z',['#f1b97b','#a9ccbb','#dfa8b6','#b7afd7'][i],'#a58c73',4)+line('M-7-40 27-44M-10-72 25-78M-13-107 20-117','#fff0cf',4));return b+group(`translate(255 269) rotate(${t*360+variant*12})`,blades)+circle(255,269,19,'#f5d07a','#b19664',5);}
function fallingLeaf(kind,variant,t){
 let b;if(kind===20)b=path('M256 417L228 341 140 355 166 292 91 235 161 213 143 151 216 174 251 74 288 173 359 147 347 215 422 235 350 290 372 355 282 341Z',['#e5a25e','#d98969','#e9bd6b','#cb805f','#e5af86'][variant%5],'#b8895f',5)+line('M256 450 256 139M255 340 164 238M257 336 349 237M255 273 195 192M257 275 316 187','#946f4a',5);
 else b=path('M253 429C87 351 105 159 366 91C401 300 356 407 253 429Z',['#91b476','#77b096','#b5c487'][variant%3],'#69936c',5)+line('M211 459Q305 305 346 130M278 340 170 284M301 279 213 225M322 219 270 173M268 361 352 325M301 281 364 242','#dae2ae',5);
 return group(`translate(${Math.sin(t*2*pi)*30} ${-35+t*70}) rotate(${-25+50*t+variant*8} 256 256)`,b);
}
export function fairyMotionSVG(kind,variant,frame,count=8,size=2048){
 const t=frame/count;let body;
 if([0,4,5,6,12].includes(kind))body=flower(kind,variant,t);
 else if([1,7,8].includes(kind))body=grass(kind,variant,t);
 else if([3,17].includes(kind))body=bubbles(kind,variant,t);
 else if(kind===2)body=smoke(variant,t);
 else if(kind===9)body=dandelion(variant,t);
 else if(kind===10)body=ladybug(variant,t);
 else if(kind===11)body=butterfly(variant,t);
 else if(kind===13)body=star(variant,t);
 else if(kind===14)body=fish(variant,t);
 else if(kind===15)body=seaweed(variant,t);
 else if(kind===16)body=coral(variant,t);
 else if(kind===18)body=mushroom(variant,t);
 else if(kind===19)body=windmill(variant,t);
 else body=fallingLeaf(kind,variant,t);
 const defs='<defs><linearGradient id="leaf" x2=".8" y2="1"><stop stop-color="#bdd98a"/><stop offset="1" stop-color="#669b5c"/></linearGradient><radialGradient id="bubble" cx=".35" cy=".3"><stop stop-color="#f0faff" stop-opacity=".18"/><stop offset=".65" stop-color="#b3e3eb" stop-opacity=".22"/><stop offset="1" stop-color="#83c7df" stop-opacity=".75"/></radialGradient><radialGradient id="clearBubble" cx=".4" cy=".4"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#e8d7ed" stop-opacity=".1"/><stop offset="1" stop-color="#b5d7e4" stop-opacity=".52"/></radialGradient><radialGradient id="smoke"><stop stop-color="#e8e9ed" stop-opacity=".65"/><stop offset="1" stop-color="#c2c8d4" stop-opacity=".12"/></radialGradient></defs>';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${defs}${body}</svg>`;
}
