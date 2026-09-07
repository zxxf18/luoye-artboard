const el=id=>document.getElementById(id);
document.querySelector('[data-color="#d9715f"]').click();document.querySelector('[data-tool="text"]').click();[...document.querySelectorAll('.subtool-box button')].find(b=>b.textContent==='写几个字').click();
el('text-content').value='把梦想画出来';el('text-content').dispatchEvent(new Event('input',{bubbles:true}));
await new Promise(r=>setTimeout(r,150));
const styles=el('text-dialog').querySelectorAll('.text-style').length,fonts=el('text-font').options.length;
if(styles!==10||fonts<10||el('text-add').disabled)throw Error('文字面板没有准备好');
return {passed:true,styles,fonts,nativeDropdownVisible:el('text-font').getClientRects().length>0};
