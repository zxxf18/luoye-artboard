export function shapePath(kind, a, b, points = []) {
  const path = new Path2D(), x = Math.min(a.x,b.x), y = Math.min(a.y,b.y), w = Math.abs(b.x-a.x), h = Math.abs(b.y-a.y);
  if (kind === 'line') { path.moveTo(a.x,a.y); path.lineTo(b.x,b.y); }
  else if (kind === 'ellipse') path.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);
  else if (kind === 'roundrect') path.roundRect(x,y,w,h,Math.min(w,h)/5);
  else if (['triangle','pentagon','hexagon','star'].includes(kind)) {
    const count=kind==='triangle'?3:kind==='pentagon'?5:kind==='hexagon'?6:10;
    for(let i=0;i<count;i++){const angle=i/count*Math.PI*2-Math.PI/2,r=kind==='star'&&i%2?.45:1,px=x+w/2+Math.cos(angle)*w/2*r,py=y+h/2+Math.sin(angle)*h/2*r;i?path.lineTo(px,py):path.moveTo(px,py);}path.closePath();
  } else if (kind === 'polygon' || kind === 'free' || kind === 'bezier') {
    if(!points.length)return path;path.moveTo(points[0].x,points[0].y);
    if(kind==='bezier'&&points.length>=4){for(let i=1;i+2<points.length;i+=3)path.bezierCurveTo(points[i].x,points[i].y,points[i+1].x,points[i+1].y,points[i+2].x,points[i+2].y);}
    else for(const p of points.slice(1))path.lineTo(p.x,p.y);
    if(kind!=='bezier')path.closePath();
  } else path.rect(x,y,w,h);
  return path;
}
