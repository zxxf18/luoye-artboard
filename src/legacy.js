// Supported evidence: the three single-DIB 0x0426 FLY samples in lan/chs/file.
// Refuse other layouts; the original file is never modified.
export function decodeLegacyFly(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const fail=()=>{throw new Error('暂不支持这种旧 FLY 结构。目前仅支持已验证的单张 24 位 DIB 档案；原文件未修改。');};
  const prefix=[0x26,4,0,0,0,0,1,0,0,0,1,0,0,0,0,0];
  if(bytes.length<76||prefix.some((v,i)=>bytes[i]!==v)||view.getUint16(24,true)!==65534||view.getUint32(30,true)!==40)fail();
  const width=view.getInt32(34,true),height=view.getInt32(38,true);
  if(width<=0||height<=0||width>4096||height>4096||width*height>8388608||width!==view.getInt32(16,true)||height!==view.getInt32(20,true)||view.getUint16(42,true)!==1||view.getUint16(44,true)!==24||view.getUint32(46,true)!==0)fail();
  const stride=Math.ceil(width*3/4)*4,dibLength=40+stride*height;
  if(view.getUint32(26,true)!==dibLength||bytes.length!==30+dibLength+6||bytes[bytes.length-6]!==255||bytes[bytes.length-5]!==255||bytes.slice(-4).some(v=>v!==0))fail();
  const rgba=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const source=70+(height-1-y)*stride+x*3,target=(y*width+x)*4;rgba[target]=bytes[source+2];rgba[target+1]=bytes[source+1];rgba[target+2]=bytes[source];rgba[target+3]=255;}
  return {width,height,rgba,compatibility:'verified-single-dib'};
}
