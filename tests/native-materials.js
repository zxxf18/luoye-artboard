const el=id=>document.getElementById(id);
const wait=async()=>{for(let n=0;n<200;n++){await new Promise(r=>setTimeout(r,20));if(!document.body.hasAttribute('aria-busy'))return;}throw new Error('素材操作超时');};
const checked=[];
for(const [id,values] of [['paper-grain',['grain-0','grain-1','none']],['paint-source',['texture-0','texture-1','color']]]){
 for(const value of values){el('toast').textContent='';el(id).value=value;el(id).dispatchEvent(new Event('change',{bubbles:true}));await wait();if(el('toast').textContent)return {passed:false,control:id,error:el('toast').textContent,checked};checked.push(value);}
}
return {passed:true,checked,canvasReadable:el('painting').toDataURL().startsWith('data:image/png')};
