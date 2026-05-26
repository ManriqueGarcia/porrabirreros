import { useMemo, useCallback, memo } from "react";
import { PILOT_COLORS, FALLBACK_COLORS } from "../config.js";
import { scoreForRace, computeGPWins, computeAvgSubmitTime, hasRaceResults } from "../scoring.js";

const PositionEvolutionChart = memo(function PositionEvolutionChart({db,races,scope,participants}){
  const chartData=useMemo(()=>{
    if(participants.length<2) return null;
    const withRes=(races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r));
    let target;
    if(scope==="all"){ target=withRes; }
    else{
      const allIdx=(races||[]).findIndex(r=>r.key===scope);
      target=withRes.filter(r=>{const ri=(races||[]).findIndex(rx=>rx.key===r.key); return ri<=allIdx;});
    }
    const bp=db.meta?.basePoints||{};
    const startPos={};
    const sorted=[...participants].sort();
    sorted.forEach((name,i)=>{startPos[name]=i+1;});
    const startEntry={race:{round:0,grand_prix:"Inicio"},positions:startPos,label:"🏁"};
    const evol=[startEntry];
    target.forEach((_race,ri)=>{
      const racesUpTo=target.slice(0,ri+1);
      const gw=computeGPWins(db,racesUpTo,participants,db.participants);
      const st=participants.map(name=>{
        const uCreated=db.participants?.[name]?.createdAt;
        const acc=racesUpTo.reduce((a,race)=>{const s=scoreForRace(db,race.key,name,race,uCreated);a.points+=s.points;a.hits+=s.hits;a.exact+=s.exact;a.pen+=s.pen;return a;},{points:Number(bp[name]||0),hits:0,exact:0,pen:0});
        const createdTs=uCreated?new Date(uCreated).getTime():0;
        return{name,...acc,wins:gw[name]||0,avgSubmit:computeAvgSubmitTime(db,racesUpTo,name),createdTs};
      }).sort((A,B)=>B.points-A.points||B.wins-A.wins||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen||A.avgSubmit-B.avgSubmit||A.createdTs-B.createdTs);
      const pos={};st.forEach((s,i)=>{pos[s.name]=i+1;});
      evol.push({race:_race,positions:pos});
    });
    return evol;
  },[db,races,scope,participants]);

  if(!chartData||chartData.length<1) return null;
  const sorted=useMemo(()=>[...participants].sort(),[participants]);
  const colorOf=useCallback(n=>PILOT_COLORS[n]||FALLBACK_COLORS[sorted.indexOf(n)%FALLBACK_COLORS.length],[sorted]);
  const nR=chartData.length;
  const nP=participants.length;
  const padL=28,padR=82,padT=22,padB=32;
  const colW=Math.max(48,280/nR);
  const chartW=nR>1?(nR-1)*colW:colW;
  const rowH=Math.max(26,160/nP);
  const chartH=nP>1?(nP-1)*rowH:rowH;
  const W=padL+chartW+padR,H=padT+chartH+padB;
  const xOf=i=>padL+(nR>1?(i/(nR-1))*chartW:chartW/2);
  const yOf=p=>padT+(nP>1?((p-1)/(nP-1))*chartH:chartH/2);

  const smooth=pts=>{
    if(pts.length<2) return `M${pts[0].x} ${pts[0].y}`;
    let d=`M${pts[0].x} ${pts[0].y}`;
    for(let i=1;i<pts.length;i++){
      const dx=(pts[i].x-pts[i-1].x)/3;
      d+=` C${pts[i-1].x+dx} ${pts[i-1].y} ${pts[i].x-dx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const lastEvol=chartData[nR-1];
  const endPositions=sorted.map(n=>({name:n,y:yOf(lastEvol.positions[n]||nP)}));
  endPositions.sort((a,b)=>a.y-b.y);
  const minGap=11;
  for(let i=1;i<endPositions.length;i++){
    if(endPositions[i].y-endPositions[i-1].y<minGap) endPositions[i].y=endPositions[i-1].y+minGap;
  }
  const labelY={};endPositions.forEach(e=>{labelY[e.name]=e.y;});

  return (
    <div className="card card-racing p-4 md:p-5">
      <h3 className="section-title mb-3">🏎️ Evolución de posiciones</h3>
      <div className="overflow-x-auto -mx-2 px-2">
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",minWidth:nR>6?`${nR*52}px`:"100%",height:"auto"}} className="block">
          {Array.from({length:nP},(_,i)=><line key={`g${i}`} x1={padL} y1={yOf(i+1)} x2={padL+chartW} y2={yOf(i+1)} stroke="rgba(255,255,255,.04)" strokeDasharray="2,4"/>)}
          {Array.from({length:nP},(_,i)=><text key={`yl${i}`} x={padL-5} y={yOf(i+1)+3} fill="rgba(255,255,255,.22)" fontSize="8" textAnchor="end" fontWeight="700">{i+1}º</text>)}
          {chartData.map((e,i)=><text key={`xl${i}`} x={xOf(i)} y={H-6} fill="rgba(255,255,255,.22)" fontSize="7" textAnchor="middle" fontWeight="600">{e.label||`R${e.race.round}`}</text>)}
          {sorted.map(name=>{
            const c=colorOf(name);
            const pts=chartData.map((e,i)=>({x:xOf(i),y:yOf(e.positions[name]||nP)}));
            return <path key={`l-${name}`} d={smooth(pts)} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" opacity=".6"/>;
          })}
          {sorted.map(name=>{
            const c=colorOf(name);
            const pts=chartData.map((e,i)=>({x:xOf(i),y:yOf(e.positions[name]||nP)}));
            return pts.map((p,i)=><circle key={`d-${name}-${i}`} cx={p.x} cy={p.y} r={i===nR-1?4:2.2} fill={c} opacity=".7" stroke="rgba(255,255,255,.15)" strokeWidth=".5"/>);
          })}
          {sorted.map(name=>{
            const c=colorOf(name);
            const lx=xOf(nR-1);
            const ly=yOf(lastEvol.positions[name]||nP);
            return <g key={`car-${name}`} transform={`translate(${lx+8},${ly})`}>
              <rect x="-1" y="-3" width="13" height="6" rx="2" fill={c} opacity=".7" stroke="rgba(255,255,255,.25)" strokeWidth=".5"/>
              <rect x="7" y="-4.5" width="4.5" height="2" rx=".6" fill={c} opacity=".5" stroke="rgba(255,255,255,.2)" strokeWidth=".4"/>
              <rect x="7" y="2.5" width="4.5" height="2" rx=".6" fill={c} opacity=".5" stroke="rgba(255,255,255,.2)" strokeWidth=".4"/>
              <rect x="1" y="-1.5" width="4" height="3" rx=".8" fill="rgba(255,255,255,.15)"/>
              <circle cx="1.5" cy="-4" r="1.3" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
              <circle cx="1.5" cy="4" r="1.3" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
              <circle cx="8.5" cy="-4" r="1.1" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
              <circle cx="8.5" cy="4" r="1.1" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
            </g>;
          })}
          {sorted.map(name=>{
            const c=colorOf(name);
            return <text key={`n-${name}`} x={padL+chartW+26} y={labelY[name]+3} fill={c} fontSize="8.5" fontWeight="600" opacity=".8">{name}</text>;
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-white/5">
        {sorted.map(name=><div key={name} className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:colorOf(name)}}></div><span className="text-white/50">{name}</span></div>)}
      </div>
    </div>
  );
});

export { PositionEvolutionChart };
