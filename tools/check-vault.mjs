import { LEVELS } from "../game/src/vault.js";
function segHits(x1,y1,x2,y2,r){
  const dx=x2-x1, dy=y2-y1; let tmin=0, tmax=1;
  if(Math.abs(dx)<1e-9){ if(x1<r.x||x1>r.x+r.w) return false; }
  else { let a=(r.x-x1)/dx, b=(r.x+r.w-x1)/dx; if(a>b)[a,b]=[b,a]; tmin=Math.max(tmin,a); tmax=Math.min(tmax,b); if(tmin>tmax) return false; }
  if(Math.abs(dy)<1e-9){ if(y1<r.y||y1>r.y+r.h) return false; }
  else { let a=(r.y-y1)/dy, b=(r.y+r.h-y1)/dy; if(a>b)[a,b]=[b,a]; tmin=Math.max(tmin,a); tmax=Math.min(tmax,b); if(tmin>tmax) return false; }
  return true;
}
function clearOf(x,y,rects,m){ for(const r of rects){ if(x>=r.x-m&&x<=r.x+r.w+m&&y>=r.y-m&&y<=r.y+r.h+m) return false; } return true; }
let fails=0;
LEVELS.forEach((lv,li)=>{
  const solids=[...lv.pillars,...lv.cases,...lv.curtains];
  for(const g of lv.guards){
    g.waypoints.forEach((wp,wi)=>{ if(!clearOf(wp[0],wp[1],solids,16)){ console.log(`L${li+1} guard wp${wi} ${wp} too close to obstacle`); fails++; } });
    for(let i=0;i<g.waypoints.length;i++){
      const a=g.waypoints[i], b=g.waypoints[(i+1)%g.waypoints.length];
      for(const r of solids){
        const er={x:r.x-16,y:r.y-16,w:r.w+32,h:r.h+32};
        if(segHits(a[0],a[1],b[0],b[1],er)){ console.log(`L${li+1} leg ${a}->${b} hits expanded rect ${JSON.stringify(r)}`); fails++; }
      }
    }
  }
  for(const p of [{...lv.spawn,n:"spawn"},...lv.loot.map(l=>({...l,n:l.label}))]){
    if(!clearOf(p.x,p.y,solids,0)){ console.log(`L${li+1} ${p.n} inside an obstacle`); fails++; }
  }
  console.log(`Level ${li+1} ${lv.name}: guards ${lv.guards.length}, cameras ${lv.cameras.length}`);
});
console.log(fails===0?"LAYOUT OK":`LAYOUT FAILS: ${fails}`);
process.exit(fails===0?0:1);
