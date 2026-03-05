import { useMemo, useState, useEffect } from "react";
import { buildStats, scoreForRace, computeGlobalStandings } from "../scoring.js";
import { PILOT_COLORS, FALLBACK_COLORS } from "../config.js";

function Stats({db,races}){
  const stats=useMemo(()=>buildStats(db,races),[db,races]);
  const beerHistory=useMemo(()=>{
    const participants=Object.keys(db.participants||{});
    if(participants.length<2) return [];
    return (races||[]).filter(r=>db.results?.[r.key]).map(race=>{
      const scores=participants.map(name=>({name,...scoreForRace(db,race.key,name)}));
      scores.sort((a,b)=>a.points-b.points||b.pen-a.pen);
      const allTied=scores.every(s=>s.points===scores[0].points);
      return {race:race.grand_prix,round:race.round,payer:allTied?"Todos":scores[0].name,points:scores[0].points,allTied};
    });
  },[db,races]);
  const beerCount=useMemo(()=>{
    const counts={};
    beerHistory.forEach(h=>{if(!h.allTied) counts[h.payer]=(counts[h.payer]||0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  },[beerHistory]);
  const trendData=useMemo(()=>{
    const participants=Object.keys(db.participants||{});
    const completedRaces=(races||[]).filter(r=>db.results?.[r.key]);
    if(!completedRaces.length||participants.length<2) return null;
    return {
      races:completedRaces.map(r=>({key:r.key,label:r.grand_prix?.substring(0,3)||r.round,round:r.round})),
      participants:participants.map(name=>({name,scores:completedRaces.map(r=>scoreForRace(db,r.key,name).points)}))
    };
  },[db,races]);
  const luckIndex=useMemo(()=>{
    const participants=Object.keys(db.participants||{});
    const completed=(races||[]).filter(r=>db.results?.[r.key]);
    if(completed.length<2||participants.length<2) return null;
    return participants.map(name=>{
      const raceScores=completed.map(r=>scoreForRace(db,r.key,name));
      const totalPts=raceScores.reduce((s,r)=>s+r.points,0);
      const totalHits=raceScores.reduce((s,r)=>s+r.hits,0);
      const maxPossibleHits=completed.length*7;
      const hitRate=maxPossibleHits>0?totalHits/maxPossibleHits:0;
      const ptsPerHit=totalHits>0?totalPts/totalHits:0;
      const totalPen=raceScores.reduce((s,r)=>s+(r.pen>0?(r.late?2:0)+(r.missed?3:0):0),0);
      const bonusPts=totalPts-totalHits+totalPen;
      const avg=totalPts/completed.length;
      const variance=raceScores.reduce((s,r)=>s+Math.pow(r.points-avg,2),0)/completed.length;
      const stdDev=Math.sqrt(variance);
      const luckScore=(ptsPerHit*20+hitRate*50+(bonusPts>0?15:0));
      return {
        name,
        totalPts,
        totalHits,
        hitRate:(hitRate*100).toFixed(1),
        ptsPerHit:ptsPerHit.toFixed(2),
        consistency:stdDev.toFixed(1),
        bonusPts,
        luckScore:Math.min(100,Math.max(0,luckScore)).toFixed(0),
        fullHouses:raceScores.filter(r=>r.fullHouse).length,
        missedRaces:raceScores.filter(r=>r.missed).length
      };
    }).sort((a,b)=>b.luckScore-a.luckScore);
  },[db,races]);
  const allDrivers=useMemo(()=>{
    const fromMeta=db.meta?.drivers;
    if(fromMeta?.length) return fromMeta;
    const seen=new Set();
    (races||[]).forEach(r=>{
      const res=db.results?.[r.key];
      if(res?.pole) seen.add(res.pole);
      (res?.podium||[]).forEach(p=>p&&seen.add(p));
      Object.values(db.bets?.[r.key]||{}).forEach(b=>{
        if(b?.pole) seen.add(b.pole);
        (b?.podium||[]).forEach(p=>p&&seen.add(p));
      });
    });
    return [...seen].sort();
  },[db.meta?.drivers,db.results,db.bets,races]);
  const [whatIfRaceKey,setWhatIfRaceKey]=useState("");
  const [whatIfResult,setWhatIfResult]=useState(null);
  const completedRaces=useMemo(()=>(races||[]).filter(r=>db.results?.[r.key]),[races,db]);
  useEffect(()=>{
    if(whatIfRaceKey&&db.results?.[whatIfRaceKey]){
      const r=db.results[whatIfRaceKey];
      setWhatIfResult({pole:r.pole||"",podium:[...(r.podium||["","",""])]});
    }else{
      setWhatIfResult(null);
    }
  },[whatIfRaceKey,db.results]);
  const whatIfStandings=useMemo(()=>{
    if(!whatIfRaceKey||!whatIfResult) return null;
    const participants=Object.keys(db.participants||{});
    if(participants.length<2) return null;
    const modifiedDb={
      ...db,
      results:{...db.results,[whatIfRaceKey]:{...db.results[whatIfRaceKey],pole:whatIfResult.pole,podium:whatIfResult.podium}}
    };
    const original=computeGlobalStandings(db,races);
    const modified=computeGlobalStandings(modifiedDb,races);
    return modified.map((m,newPos)=>{
      const oldPos=original.findIndex(o=>o.name===m.name);
      const origEntry=original[oldPos];
      return{
        name:m.name,
        newPos:newPos+1,
        oldPos:oldPos+1,
        newPts:m.points,
        oldPts:origEntry?.points||0,
        diff:(newPos+1)-(oldPos+1)
      };
    });
  },[whatIfRaceKey,whatIfResult,db,races]);
  const renderList=(items,emptyLabel,formatter)=> items?.length ? (
    <ul className="space-y-1 text-sm mt-1">{items.map((item,idx)=><li key={idx} className="flex items-center justify-between border border-white/10 rounded px-2 py-1 bg-neutral-900"><span>{idx+1}. {formatter?formatter(item):item.name}</span><span className="text-xs text-slate-300">{item.value!=null?item.value:""}</span></li>)}</ul>
  ) : (<p className="text-sm text-slate-400">{emptyLabel}</p>);
  return (
    <div className="space-y-4">
      <div className="card card-racing p-4 md:p-5 space-y-3">
        <h2 className="section-title">📊 Estadísticas <span className="text-xs opacity-40">· el que pierda, invita</span></h2>
        <p className="text-[11px] text-white/30">Solo carreras con resultados publicados.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
            <h3 className="font-semibold mb-1">Más carreras ganadas</h3>
            {renderList(stats.winners,"Aún no hay ganadores registrados.",(item)=>`${item.name}`)} 
            <h3 className="font-semibold mt-3 mb-1">Plenos (pole+podio+preguntas)</h3>
            {renderList(stats.fulls,"Nadie ha hecho pleno todavía.",(item)=>`${item.name}`)}
            <h3 className="font-semibold mt-3 mb-1">Más aciertos totales</h3>
            {renderList(stats.hitsLeaders,"Sin aciertos calculados.",(item)=>`${item.name}`)}
          </div>
          <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
            <h3 className="font-semibold mb-1">Mejores jornadas</h3>
            {stats.bestScores?.length ? (<ul className="space-y-1 text-sm mt-1">{stats.bestScores.map((row,idx)=>(<li key={idx} className="border border-white/10 rounded px-2 py-1 bg-neutral-900 flex items-center justify-between"><span>{row.name} — {row.race}</span><span className="text-xs text-emerald-300">{row.points} pts</span></li>))}</ul>) : (<p className="text-sm text-slate-400">Todavía no hay resultados.</p>)}
            <h3 className="font-semibold mt-3 mb-1">Peores jornadas</h3>
            {stats.worstScores?.length ? (<ul className="space-y-1 text-sm mt-1">{stats.worstScores.map((row,idx)=>(<li key={idx} className="border border-white/10 rounded px-2 py-1 bg-neutral-900 flex items-center justify-between"><span>{row.name} — {row.race}</span><span className="text-xs text-amber-300">{row.points} pts</span></li>))}</ul>) : (<p className="text-sm text-slate-400">Sin resultados negativos registrados.</p>)}
          </div>
        </div>
        <div className="border border-white/10 rounded p-3 bg-neutral-900">
          <h3 className="font-semibold mb-2">Pilotos más votados</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-slate-400">Pole</div>
              {renderList(stats.votePole,"Sin votos en pole.",(item)=>item.name)}
            </div>
            <div>
              <div className="text-xs text-slate-400">Ganador (P1)</div>
              {renderList(stats.voteP1,"Sin apuestas en P1.",(item)=>item.name)}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            <div>
              <div className="text-xs text-slate-400">Segundo (P2)</div>
              {renderList(stats.voteP2,"Sin apuestas en P2.",(item)=>item.name)}
            </div>
            <div>
              <div className="text-xs text-slate-400">Tercero (P3)</div>
              {renderList(stats.voteP3,"Sin apuestas en P3.",(item)=>item.name)}
            </div>
          </div>
        </div>
      </div>
      <div className="card card-racing p-4 md:p-5 space-y-3">
        <h2 className="section-title">🍺 Histórico de birras</h2>
        <p className="text-[11px] text-white/30">Quién quedó último en cada GP (el que paga las birras).</p>
        {beerHistory.length?(
          <>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="text-sm w-full">
                <thead><tr><th className="text-left">GP</th><th className="text-left">Paga</th><th className="text-right">Pts</th></tr></thead>
                <tbody>
                  {beerHistory.map((h,i)=><tr key={i} className="border-t border-white/5"><td>{h.race}</td><td>{h.payer}</td><td className="text-right">{h.points}</td></tr>)}
                </tbody>
              </table>
            </div>
            {beerCount.length>0&&(
              <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
                <h3 className="font-semibold mb-1">Quién ha pagado más birras</h3>
                <ul className="space-y-1 text-sm mt-1">{beerCount.map(([name,count],idx)=><li key={name} className="flex items-center justify-between border border-white/10 rounded px-2 py-1 bg-neutral-900"><span>{idx+1}. {name}</span><span className="text-xs text-amber-300">{count} {count===1?"vez":"veces"}</span></li>)}</ul>
              </div>
            )}
          </>
        ):(<p className="text-sm text-slate-400">Aún no hay suficientes resultados o participantes.</p>)}
      </div>
      {trendData&&(
        <PointsTrendChart trendData={trendData} />
      )}
      {luckIndex&&(
        <div className="card p-4 md:p-5">
          <h3 className="section-title mb-3">🍀 Índice de suerte</h3>
          <p className="text-xs text-white/40 mb-3">¿Quién acierta más? ¿Quién aprovecha mejor sus aciertos?</p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-xs text-white/40 border-b border-white/5">
                  <th className="text-left py-2 pr-2">#</th>
                  <th className="text-left py-2">Nombre</th>
                  <th className="text-right py-2 px-2">Aciertos</th>
                  <th className="text-right py-2 px-2">Tasa %</th>
                  <th className="text-right py-2 px-2">Pts/acierto</th>
                  <th className="text-right py-2 px-2">Bonus</th>
                  <th className="text-right py-2 px-2">Consistencia</th>
                  <th className="text-right py-2 px-2">Plenos</th>
                  <th className="text-right py-2 pl-2">Índice</th>
                </tr>
              </thead>
              <tbody>
                {luckIndex.map((s,i)=>(
                  <tr key={s.name} className="border-b border-white/3">
                    <td className="py-2 pr-2 text-white/30">{i+1}</td>
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 px-2 text-right">{s.totalHits}</td>
                    <td className="py-2 px-2 text-right">{s.hitRate}%</td>
                    <td className="py-2 px-2 text-right text-amber-300">{s.ptsPerHit}</td>
                    <td className="py-2 px-2 text-right">{s.bonusPts>0?`+${s.bonusPts}`:s.bonusPts}</td>
                    <td className="py-2 px-2 text-right text-white/60">σ {s.consistency}</td>
                    <td className="py-2 px-2 text-right">{s.fullHouses>0?`🎯 ${s.fullHouses}`:"—"}</td>
                    <td className="py-2 pl-2 text-right font-bold text-emerald-300">{s.luckScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[10px] text-white/30">
            Tasa = aciertos/posibles · Pts/acierto = eficiencia · Consistencia (σ) = menor es mejor · Índice combina todos los factores
          </div>
        </div>
      )}
      {completedRaces.length>0&&(
        <div className="card card-racing p-4 md:p-5">
          <h3 className="section-title mb-3">🔮 ¿Qué habría pasado si...?</h3>
          <p className="text-xs text-white/40 mb-3">Cambia el resultado de una carrera y mira cómo cambiaría el ranking global.</p>
          <select className="select border rounded px-3 py-2 mb-3 w-full" value={whatIfRaceKey} onChange={e=>setWhatIfRaceKey(e.target.value)}>
            <option value="">Selecciona un GP...</option>
            {completedRaces.map(r=> <option key={r.key} value={r.key}>{r.round}. {r.grand_prix}</option>)}
          </select>
          {whatIfResult&&(
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-white/40 uppercase">Pole</label>
                  <select className="select border rounded px-2 py-1.5 w-full text-sm" value={whatIfResult.pole} onChange={e=>setWhatIfResult(prev=>({...prev,pole:e.target.value}))}>
                    <option value="">—</option>
                    {allDrivers.map(d=> <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {[0,1,2].map(i=> (
                  <div key={i}>
                    <label className="text-[10px] text-white/40 uppercase">P{i+1}</label>
                    <select className="select border rounded px-2 py-1.5 w-full text-sm" value={whatIfResult.podium[i]} onChange={e=>setWhatIfResult(prev=>{const p=[...prev.podium];p[i]=e.target.value;return{...prev,podium:p};})}>
                      <option value="">—</option>
                      {allDrivers.map(d=> <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {whatIfStandings&&(
                <div className="overflow-x-auto rounded-lg border border-white/5">
                  <table className="text-sm w-full">
                    <thead><tr><th className="text-left">Nombre</th><th className="text-right">Pos. real</th><th className="text-right">Pos. simulada</th><th className="text-right">Cambio</th><th className="text-right">Pts reales</th><th className="text-right">Pts simulados</th></tr></thead>
                    <tbody>{whatIfStandings.map(s=> (
                      <tr key={s.name} className={s.diff<0?"text-emerald-300/80":s.diff>0?"text-red-300/80":""}>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-right text-white/50">{s.oldPos}</td>
                        <td className="text-right font-bold">{s.newPos}</td>
                        <td className="text-right">{s.diff<0?`▲${Math.abs(s.diff)}`:s.diff>0?`▼${s.diff}`:"—"}</td>
                        <td className="text-right text-white/50">{s.oldPts}</td>
                        <td className="text-right font-bold">{s.newPts}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PointsTrendChart({trendData}){
  const participants=trendData.participants;
  const races=trendData.races;
  const sorted=[...participants].sort((a,b)=>a.name.localeCompare(b.name));
  const colorOf=n=>PILOT_COLORS[n]||FALLBACK_COLORS[sorted.indexOf(n)%FALLBACK_COLORS.length];
  const allScores=participants.flatMap(p=>p.scores);
  const minPts=Math.min(...allScores,0);
  const maxPts=Math.max(...allScores,0);
  const range=Math.max(maxPts-minPts,1);
  const padL=40,padR=90,padT=20,padB=28;
  const nR=races.length;
  const nP=participants.length;
  const barGap=2;
  const groupW=Math.max(24,Math.min(80,280/nR));
  const barW=Math.max(3,(groupW-barGap*(nP-1))/nP);
  const chartW=nR*groupW;
  const chartH=120;
  const W=padL+chartW+padR,H=padT+chartH+padB;
  const zeroY=padT+chartH*(maxPts/range);
  return (
    <div className="card card-racing p-4 md:p-5">
      <h3 className="section-title mb-3">📈 Tendencia de puntos por carrera</h3>
      <div className="overflow-x-auto -mx-2 px-2">
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",minWidth:nR>4?`${nR*70}px`:"100%",height:"auto"}} className="block">
          <line x1={padL} y1={zeroY} x2={padL+chartW} y2={zeroY} stroke="rgba(255,255,255,.2)" strokeDasharray="2,4"/>
          {races.map((r,i)=>{
            const gx=padL+i*groupW+groupW/2;
            return <text key={r.key} x={gx} y={H-6} fill="rgba(255,255,255,.22)" fontSize="7" textAnchor="middle" fontWeight="600">{r.label}</text>;
          })}
          {participants.map((p,pi)=>{
            const c=colorOf(p.name);
            return p.scores.map((pts,ri)=>{
              const x=padL+ri*groupW+pi*(barW+barGap);
              const h=Math.abs(pts)/range*chartH;
              const y=pts>=0?zeroY-h:zeroY;
              return <rect key={`${p.name}-${ri}`} x={x} y={y} width={barW} height={h||(pts===0?1:0)} fill={c} opacity=".75" rx="1"/>;
            });
          })}
          {sorted.map((p,i)=><text key={`n-${p.name}`} x={padL+chartW+8} y={padT+12+i*14} fill={colorOf(p.name)} fontSize="8" fontWeight="600" opacity=".8">{p.name}</text>)}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-white/5">
        {sorted.map(name=><div key={name} className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:colorOf(name)}}></div><span className="text-white/50">{name}</span></div>)}
      </div>
    </div>
  );
}

export { Stats };
