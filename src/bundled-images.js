// Request just the selected local bitmap. Large libraries must not be embedded
// into one base64 script or decoded when the application starts.
const bundledImageRequests=new Map();
if(typeof window!=='undefined')window.addEventListener('native-asset-result',event=>{
  const value=event.detail,request=bundledImageRequests.get(value.id);if(!request)return;
  clearTimeout(request.timer);bundledImageRequests.delete(value.id);
  value.error?request.reject(new Error(value.error)):request.resolve(value.data);
});
export async function bundledImageSource(src){
  const bridge=globalThis.webkit?.messageHandlers?.assets;
  if(!bridge||! /^(assets|classic)\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$/.test(src))return src;
  const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{bundledImageRequests.delete(id);reject(new Error('素材读取超时，请重新选择。'));},30000);
    bundledImageRequests.set(id,{resolve,reject,timer});bridge.postMessage({id,path:src});
  });
}
