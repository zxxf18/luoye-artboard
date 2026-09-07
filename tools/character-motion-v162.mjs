// Independent articulated picture-book drawings. Coordinates describe joints,
// wings, fins and props; time never translates a complete static picture.
const C=(x,y,r,c)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'"/>';
const E=(x,y,rx,ry,c)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+c+'"/>';
const P=(d,c,s='none',w=5)=>'<path d="'+d+'" fill="'+c+'" stroke="'+s+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const G=(tr,b)=>'<g transform="'+tr+'">'+b+'</g>';
const line=(d,c,w=8)=>P(d,'none',c,w);
const rot=(angle,x,y,b)=>G('rotate('+angle+' '+x+' '+y+')',b);
const eye=(x,y)=>C(x,y,7,'#393d35')+C(x-2,y-2,2,'#fff9e2');
export const characterSpecs=[
 ['animation-0','散步的小刺猬','hedgehog','walk'],['animation-1','打哈欠的小狗','dog','yawn'],
 ['animation-2','梳羽的鹦鹉','parrot','preen'],['animation-3','举重小朋友','weight','lift'],
 ['animation-4','滴答小闹钟','clock','tick'],['animation-5','散步的小猫','cat','walk'],
 ['animation-6','走路的小鸭','duck','walk'],['animation-7','开屏的孔雀','peacock','fan'],
 ['animation-8','啄米的小鸡','chick','peck'],
 ...['turtle','fish','shrimp','crab','clam','seahorse','dolphin','snake','dolphin','ray','fish'].map((s,i)=>['animation-1-'+i,['划水的小海龟','摆尾的小金鱼','划水的小虾','挥钳的小螃蟹','开合的小贝壳','游动的小海马','跃水的海豚','游动的海蛇','摆尾的海豚','挥鳍的鳐鱼','吐泡泡的小鱼'][i],s,['paddle','tail','paddle','claws','shell','tail','dive','slither','tail','fins','bubbles'][i]]),
 ...['bird','bird','woodpecker','parrot','owl','gull','bird','heron'].map((s,i)=>['animation-2-'+i,['展翅的小鸟','拍拍翅膀','啄木鸟','点头的鹦鹉','眨眼的猫头鹰','飞翔的海鸥','啄食的小鸟','漫步的白鹭'][i],s,['wings','wings','peck','preen','blink','wings','peck','walk'][i]]),
 ...['sail','bike','weight','skip','run','read','crawl','wave','sweep','fish-child'].map((s,i)=>['animation-3-'+i,['扬帆的小朋友','骑车的小朋友','举重的小朋友','跳绳的小朋友','跑步的小朋友','读书的小朋友','爬行的小宝宝','挥手的小朋友','扫地的小朋友','钓鱼的小朋友'][i],s,s]),
 ...['car','clock','lamp','tornado','rocket','record','jug'].map((s,i)=>['animation-4-'+i,['转动车轮的小汽车','滴答小闹钟','渐渐亮起的台灯','旋转的小龙卷风','点火的小火箭','转动的唱片机','倒水的小水壶'][i],s,s])
];
function bird(kind,action,t){
 const flap=Math.sin(t*Math.PI*2),c={parrot:'#79b5a0',duck:'#e4bd62',chick:'#efd077',peacock:'#55a6aa',owl:'#aa9273',gull:'#edf0dd',heron:'#e1e8d9',woodpecker:'#607978'}[kind]||'#92b6ca';
 let b='';
 if(kind==='peacock')for(let i=0;i<11;i++){const a=-80+i*16,open=.3+.7*(.5+.5*Math.sin(t*Math.PI*2));b+=rot(a*open,252,344,E(252,223,22,139,'#71ae92')+E(252,120,16,24,'#a0c86c')+E(252,120,8,13,'#579cab'));}
 for(const side of [-1,1]){const x=256+side*33,step=action==='walk'?flap*side*22:0;b+=line('M'+x+' 342L'+(x+step)+' 394l24 0','#bb914f',9);}
 b+=P('M170 273L100 247 155 323Z',c)+E(249,293,87,69,c);
 b+=rot(action==='wings'?flap*52:-12,248,269,P('M249 265Q143 166 166 298Q204 336 263 299Z','#bacfc1','#6f958a',4));
 let head=E(315,210,49,53,c)+P('M354 211L395 226 350 237Z','#daaa5d');
 head+=(action==='blink'&&t>.4&&t<.65)?line('M322 198h14','#3a443d',4):eye(330,201);
 if(kind==='owl')head=E(302,215,64,62,c)+E(277,211,22,28,'#ede4c8')+E(327,211,22,28,'#ede4c8')+(t>.4&&t<.65?line('M267 211h20M317 211h20','#3a443d',4):eye(277,211)+eye(327,211))+P('M299 221l-9 17 21 0Z','#dca852');
 if(kind==='woodpecker')head+=P('M286 168L310 140 336 171Z','#c67559');
 b+=rot(['peck','preen'].includes(action)?flap*22:0,289,267,head);
 return b;
}
function sea(kind,t){
 const s=Math.sin(t*Math.PI*2),c='#8eafaf';let b='';
 if(kind==='clam')return E(256,323,131,25,'#dfc9a1')+rot(-12-26*(.5+.5*s),140,321,P('M141 322Q104 159 253 151Q397 164 374 322Z','#dba298','#a27e70',4))+C(256,320,22,'#fff0cb');
 if(kind==='seahorse')return P('M269 156Q207 126 214 190L181 212 227 221Q270 211 242 275Q195 336 254 367Q312 390 303 340Q289 316 275 339','none','#baad75',25)+E(260,260,38,69,'#cbbb82')+eye(237,177)+rot(s*22,288,245,P('M285 227L329 244 294 276Z','#dbcfaa'))+line('M247 245l31 8M240 267l37 8M239 289l31 7','#9e996a',4);
 if(kind==='shrimp'){
  b=P('M156 233Q229 143 326 213Q394 269 323 324L291 301Q350 261 303 238Q220 215 164 274Z','#dd9d82','#b37d6a',5)+P('M313 304L361 323 333 354 298 325Z','#d9ad8b');
  for(let i=0;i<5;i++)b+=rot(s*18,199+i*23,257,line('M'+(199+i*23)+' 253l-17 40 15 14','#bd8472',5));
  return b+eye(172,229)+line('M159 237Q80 155 101 133M158 247Q76 209 81 190','#bd8472',4);
 }
 if(kind==='crab'){
  for(let i=0;i<4;i++)for(const side of [-1,1])b+=line('M'+(256+side*55)+' '+(248+i*18)+'q'+(side*75)+' '+(s*12+i*3)+' '+(side*90)+' 58','#bd8472',7);
  b+=E(256,270,kind==='crab'?86:120,kind==='crab'?63:37,'#dd9d82')+eye(224,238)+eye(279,238);
  for(const side of [-1,1])b+=rot(side*s*18,256+side*76,267,P('M'+(256+side*76)+' 265q'+(side*50)+' -68 '+(side*34)+' -109q'+(-side*38)+' 8 '+(-side*9)+' 49q'+(side*41)+' -14 '+(side*26)+' -46','#dd9d82','#b37d6a',5));
  return b;
 }
 if(kind==='snake'||kind==='seahorse'){for(let i=25;i>=0;i--){const x=kind==='snake'?104+i*11:260+Math.sin(i*.17)*65,y=kind==='snake'?267+Math.sin(i*.25+t*Math.PI*2)*40:140+i*9+Math.sin(i*.4+t*Math.PI*2)*10;b+=C(x,y,10+i*.2,'#a6bb75');}return b+eye(kind==='snake'?382:269,kind==='snake'?260:141);}
 if(kind==='turtle'){
  for(const side of [-1,1])for(const dy of [-1,1])b+=rot(s*side*dy*25,256+side*65,263+dy*45,E(256+side*85,263+dy*65,23,48,'#8fb89a'));
  return b+E(254,265,102,78,'#b7bc79')+P('M205 225L263 195 306 243 287 309 222 321 195 275Z','#d5d297','#919e65',5)+E(376,263,38,31,'#8fb89a')+eye(383,252);
 }
 if(kind==='ray')return P('M250 155Q'+(130+s*40)+' 285 99 325Q194 290 251 320Q331 278 416 325Q'+(365-s*40)+' 206 250 155Z','#b2a9cb','#8c87a8',5)+line('M251 313Q221 415 290 438','#9b96b8',8)+eye(230,209)+eye(270,209);
 b+=rot(s*23,160,261,P('M176 256L95 168Q114 261 92 350Z',kind==='dolphin'?'#8bafc0':'#e8b77d'));
 b+=E(258,263,111,64,kind==='dolphin'?'#8bafc0':'#eccb83')+P('M357 247l47 19-56 13Z',kind==='dolphin'?'#8bafc0':'#eccb83');
 b+=P('M222 203Q247 153 280 205Z',c)+rot(s*24,254,273,P('M253 269Q292 254 291 312Q264 306 253 269Z',c))+eye(325,246);
 for(let i=0;i<3;i++)b+=C(401+i*15,211-((t+i*.2)%1)*85,5+i*2,'#cce5df');
 return b;
}
function animal(kind,action,t){
 const s=Math.sin(t*Math.PI*2),c=kind==='cat'?'#a8aab2':kind==='hedgehog'?'#b6a181':'#caa779';let b='';
 for(const side of [-1,1])for(const x of [191,306])b+=rot(s*side*22,x,307,line('M'+x+' 303v65l23 0',c,20));
 b+=rot(s*25,156,253,P('M171 269Q91 267 126 206','none',c,18))+E(244,272,106,70,c);
 if(kind==='hedgehog')for(let i=0;i<16;i++){const a=Math.PI+i*Math.PI/15,x=239+Math.cos(a)*98,y=257+Math.sin(a)*66;b+=P('M'+(x-10)+' '+(y+18)+'l10 -42 16 37Z','#897d65');}
 b+=E(340,239,48,47,c)+E(369,261,26,20,'#e7d4b1')+C(388,253,9,'#64554b')+eye(349,227);
 b+=kind==='cat'?P('M303 216l9 -39 31 27 28 -24 6 43Z',c):rot(s*8,320,211,E(316,227,18,35,'#9e7e62'));
 if(action==='yawn')b+=E(374,279,13,4+17*(.5+.5*s),'#8f6456');
 return b;
}
function person(kind,t){
 const s=Math.sin(t*Math.PI*2),skin='#ecc5a0';let b='';
 if(kind==='crawl')return line('M187 308l'+(-s*14)+' 56 48 10',skin,23)+line('M319 307l'+(s*14)+' 63 31 0',skin,20)+E(245,290,89,42,'#d69877')+line('M185 318l'+(s*18)+' 58 45 0','#748f98',24)+line('M301 314l'+(-s*18)+' 64 29 0',skin,21)+C(340,251,44,skin)+P('M301 240Q305 196 349 207Q389 210 382 246L356 228 333 239Z','#73645b')+eye(356,251)+line('M360 274q9 3 16 -4','#b2826e',3);
 if(kind==='sail')b+=P('M96 353L398 353 365 395 149 395Z','#c18f67')+line('M277 352V94','#a18b69',8)+P('M280 111Q'+(368+s*13)+' 175 373 275L280 275Z','#e6bc70');
 if(kind==='bike')for(const x of [151,365])b+=C(x,368,63,'#797d73')+C(x,368,52,'#fff0cb')+rot(t*360,x,368,line('M'+x+' 316v104M'+(x-52)+' 368h104','#aaa894',4));
 const move=['run','skip','crawl','bike'].includes(kind)?s*27:0;
 for(const side of [-1,1])b+=rot(move*side,255+side*20,302,line('M'+(255+side*20)+' 300v73l'+side*22+' 7','#748f98',21));
 b+=P('M209 225Q254 209 300 229L289 309H220Z','#d69877');
 let angle=kind==='wave'?s*25-90:kind==='weight'?s*30-85:kind==='read'?-45:move;
 for(const side of [-1,1])b+=rot(angle*side,255+side*38,238,line('M'+(255+side*38)+' 238l'+side*29+' 49',skin,17));
 b+=C(253,168,44,skin)+P('M210 163Q201 109 252 118Q302 109 298 165L276 141 250 151 227 144Z','#73645b')+eye(239,170)+eye(269,170)+line('M245 190q10 7 20 -1','#b2826e',3);
 if(kind==='weight')b+=G('translate(0 '+s*17+')',line('M127 173H383','#858b82',9)+P('M123 137H148V211H123ZM361 137H386V211H361Z','#8eaaa4'));
 if(kind==='read')b+=rot(s*3,260,291,P('M188 250L252 269 321 248 310 310 253 331 196 311Z','#e8c978','#9e9c75',4)+line('M253 271V324','#fff6d1',4));
 if(kind==='skip')b+=P('M183 275Q'+(75+s*40)+' '+(430-s*190)+' 256 '+(444-s*230)+'Q'+(425-s*40)+' '+(430-s*190)+' 333 275','none','#d7ab68',5);
 if(kind==='sweep')b+=rot(s*12,321,271,line('M307 206L345 398','#ad946d',8)+P('M327 365L360 362 381 413 316 413Z','#d5bc76'));
 if(kind==='fish-child')b+=rot(s*6,327,260,line('M323 281L397 110','#a29774',6)+P('M397 110Q451 180 434 370','none','#9bada6',2));
 return b;
}
function object(kind,t){
 const s=Math.sin(t*Math.PI*2);let b='';
 if(kind==='clock')return E(256,272,124,118,'#91b7b4')+C(256,272,101,'#f9ebbd')+rot(t*360,256,272,line('M256 272V198','#657e78',7))+rot(t*45,256,272,line('M256 272L301 281','#ac805e',8))+C(256,272,9,'#d19f6d');
 if(kind==='car'){b=P('M105 330V263Q127 240 169 241L212 181H308L358 242Q407 249 408 330Z','#ce9375','#aa7e67',5)+P('M213 198H253V240H183ZM270 198H302L334 240H270Z','#c3dddc');for(const x of [171,346])b+=C(x,329,40,'#727d7a')+rot(t*360,x,329,C(x,329,26,'#dacda8')+line('M'+x+' 307v44M'+(x-22)+' 329h44','#a49f88',5));return b;}
 if(kind==='tornado'){for(let i=0;i<13;i++)b+=E(256+Math.sin(i*.55+t*6.28)*17,392-i*21,18+i*9,5+i*.6,i%2?'#c4ceca':'#aabbb7');return b;}
 if(kind==='rocket')return P('M219 349Q'+(209+s*9)+' '+(443+s*17)+' 256 460Q'+(298-s*9)+' '+(426+s*17)+' 293 349Z','#e6b963')+P('M218 352Q176 211 256 94Q337 213 294 352Z','#a9c4be','#7e9e99',5)+P('M211 278L174 335V387L227 353ZM298 278L339 335V387L287 353Z','#cc9c83')+C(256,237,31,'#ede1b8')+C(256,237,22,'#91b2c3');
 if(kind==='record')return P('M105 236H410V364H105Z','#bf9878')+E(256,250,125,45,'#616d6b')+rot(t*360,256,250,E(256,250,81,26,'#929e90')+E(297,244,16,5,'#ece1b7'))+C(256,251,14,'#d5b06f')+line('M375 273L342 202 258 208','#e2c595',9);
 if(kind==='jug')return rot(-15-25*(.5+.5*s),255,287,P('M208 160H304L292 214Q353 335 288 369H216Q159 330 211 213Z','#b8d7d2','#88aaa4',6)+P('M217 277H301V337Q277 364 219 342Z','#83babc')+P('M305 234Q399 217 345 316','none','#88aaa4',11))+P('M171 282Q'+(128+s*12)+' 338 143 395','none','#a3cfce',8);
 return b;
}
export function characterSVG(spec,frame,count=8){
 const [, ,kind,action]=spec,t=frame/count;
 const body=['hedgehog','dog','cat'].includes(kind)?animal(kind,action,t):
 ['turtle','fish','shrimp','crab','clam','seahorse','dolphin','snake','ray'].includes(kind)?sea(kind,t):
 ['bird','parrot','duck','chick','peacock','owl','gull','heron','woodpecker'].includes(kind)?bird(kind,action,t):
 ['car','clock','tornado','rocket','record','jug'].includes(kind)?object(kind,t):person(kind,t);
 return '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 512 512">'+body+'</svg>';
}
