import { useMemo, useState, useEffect, memo } from "react";
import { buildStats, scoreForRace, computeGlobalStandings, hasRaceResults } from "../scoring.js";
import { PILOT_COLORS, FALLBACK_COLORS, BEER_EXCLUDED_USERS } from "../config.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { BeerChart } from "./BeerChart.jsx";
import { Rivalries } from "./Rivalries.jsx";
import { HeadToHead } from "./HeadToHead.jsx";
import { Achievements } from "./Achievements.jsx";
import { PersonalHistory } from "./PersonalHistory.jsx";
import { WallOfShame } from "./WallOfShame.jsx";
import { Birrometro } from "./Birrometro.jsx";

function Stats({db,races,currentUser}){
  const f1Participants=useMemo(()=>getParticipantsForPorra(db,"f1"),[db.participants,db.users]);
  const stats=useMemo(()=>buildStats(db,races,f1Participants),[db,races,f1Participants]);
  const beerHistory=useMemo(()=>{
    const eligible=f1Participants.filter(n=>!BEER_EXCLUDED_USERS.has(n));
    if(eligible.length<2) return [];
    return (races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r)).map(race=>{
      const scores=eligible.map(name=>({name,...scoreForRace(db,race.key,name,race)}));
      scores.sort((a,b)=>b.points-a.points||a.pen-b.pen);
      const allTied=scores.every(s=>s.points===scores[0].points);
      return {race:race.grand_prix,round:race.round,winner:allTied?"Empate":scores[0].name,points:scores[0].points,allTied};
    });
  },[db,races]);
  const beerCount=useMemo(()=>{
    const counts={};
    beerHistory.forEach(h=>{if(!h.allTied) counts[h.winner]=(counts[h.winner]||0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  },[beerHistory]);
  const trendData=useMemo(()=>{
    const completedRaces=(races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r));
    if(!completedRaces.length||f1Participants.length<2) return null;
    return {
      races:completedRaces.map(r=>({key:r.key,label:r.grand_prix?.substring(0,3)||r.round,round:r.round})),
      participants:f1Participants.map(name=>({name,scores:completedRaces.map(r=>scoreForRace(db,r.key,name,r).points)}))
    };
  },[db,races,f1Participants]);
  const luckIndex=useMemo(()=>{
    const completed=(races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r));
    if(completed.length<2||f1Participants.length<2) return null;
    return f1Participants.map(name=>{
      const raceScores=completed.map(r=>scoreForRace(db,r.key,name,r));
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
  const f1Rivalries=useMemo(()=>{
    const completed=(races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r));
    if(completed.length<2||f1Participants.length<3) return [];
    const totals={};
    f1Participants.forEach(name=>{
      totals[name]=completed.reduce((sum,r)=>sum+scoreForRace(db,r.key,name,r).points,0);
    });
    const pairs=[];
    for(let i=0;i<f1Participants.length;i++){
      for(let j=i+1;j<f1Participants.length;j++){
        const a=f1Participants[i],b=f1Participants[j];
        let aWins=0,bWins=0,ties=0,sameChoices=0,totalChoices=0;
        completed.forEach(r=>{
          const sa=scoreForRace(db,r.key,a,r),sb=scoreForRace(db,r.key,b,r);
          if(sa.points>sb.points)aWins++;else if(sb.points>sa.points)bWins++;else ties++;
          const ba=db.bets?.[r.key]?.[a],bb=db.bets?.[r.key]?.[b];
          if(ba?.submittedAt&&bb?.submittedAt){
            totalChoices+=4;
            if(ba.pole&&ba.pole===bb.pole)sameChoices++;
            (ba.podium||[]).forEach((p,idx)=>{if(p&&p===(bb.podium||[])[idx])sameChoices++;});
          }
        });
        const pointDiff=Math.abs(totals[a]-totals[b]);
        const maxPts=Math.max(totals[a],totals[b],1);
        const closeness=1-(pointDiff/maxPts);
        const h2hBalance=1-Math.abs(aWins-bWins)/Math.max(aWins+bWins,1);
        const sim=totalChoices>0?sameChoices/totalChoices:0;
        const intensity=Math.min(100,Math.round((closeness*40+h2hBalance*40+sim*20)*100)/100);
        pairs.push({
          a:{name:a,points:totals[a]},b:{name:b,points:totals[b]},
          h2h:{aWins,bWins,ties},pointDiff,
          similarity:Math.round(sim*100),intensity
        });
      }
    }
    pairs.sort((a,b)=>b.intensity-a.intensity);
    return pairs.slice(0,3);
  },[db,races,f1Participants]);
  const allDrivers=useMemo(()=>{
    const seen=new Set();
    (db.meta?.drivers||[]).forEach(d=>seen.add(d));
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
  const completedRaces=useMemo(()=>(races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r)),[races,db]);
  useEffect(()=>{
    if(whatIfRaceKey&&hasRaceResults(db.results?.[whatIfRaceKey],(races||[]).find(r=>r.key===whatIfRaceKey))){
      const r=db.results[whatIfRaceKey];
      setWhatIfResult({pole:r.pole||"",podium:[...(r.podium||["","",""])],qAnswers:[...(r.qAnswers||["","",""])]});
    }else{
      setWhatIfResult(null);
    }
  },[whatIfRaceKey,db.results,races]);
  const whatIfStandings=useMemo(()=>{
    if(!whatIfRaceKey||!whatIfResult) return null;
    if(f1Participants.length<2) return null;
    const modifiedDb={
      ...db,
      results:{...db.results,[whatIfRaceKey]:{...db.results[whatIfRaceKey],pole:whatIfResult.pole,podium:whatIfResult.podium,qAnswers:whatIfResult.qAnswers}}
    };
    const original=computeGlobalStandings(db,races,f1Participants);
    const modified=computeGlobalStandings(modifiedDb,races,f1Participants);
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
        <h2 className="section-title">📊 Estadísticas <span className="text-xs opacity-40">· al que gane, le invitan</span></h2>
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
        <p className="text-[11px] text-white/30">Quién quedó primero en cada GP (los demás le invitan a birras).</p>
        {beerHistory.length?(
          <>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="text-sm w-full">
                <thead><tr><th className="text-left">GP</th><th className="text-left">Le invitan</th><th className="text-right">Pts</th></tr></thead>
                <tbody>
                  {beerHistory.map((h,i)=><tr key={i} className="border-t border-white/5"><td>{h.race}</td><td>{h.winner}</td><td className="text-right">{h.points}</td></tr>)}
                </tbody>
              </table>
            </div>
            {beerCount.length>0&&(
              <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
                <h3 className="font-semibold mb-2">A quién le han invitado más birras</h3>
                <BeerChart data={beerCount.map(([name,count])=>({name,count}))} />
              </div>
            )}
          </>
        ):(<p className="text-sm text-slate-400">Aún no hay suficientes resultados o participantes.</p>)}
      </div>
      {completedRaces.length>=2&&(()=>{
        const sorted=[...completedRaces].sort((a,b)=>a.round-b.round);
        const streaks=f1Participants.map(name=>{
          const perRace=sorted.map(r=>{
            const s=scoreForRace(db,r.key,name,r);
            const scores=f1Participants.map(n=>scoreForRace(db,r.key,n,r));
            const best=Math.max(...scores.map(x=>x.points));
            const winners=scores.filter(x=>x.points===best);
            const won=winners.length===1&&s.points===best;
            const top3=[...scores].sort((a,b)=>b.points-a.points);
            const rank=top3.findIndex(x=>x===s)+1;
            return {won,pole:s.gotPole,positive:s.points>0,top3:rank<=3,hits:s.hits>0};
          });
          const calc=(fn)=>{let cur=0,max=0;for(let i=perRace.length-1;i>=0;i--){if(fn(perRace[i])){cur++;max=Math.max(max,cur);}else if(cur>0)break;}let best=0,run=0;perRace.forEach(r=>{if(fn(r)){run++;best=Math.max(best,run);}else run=0;});return {current:cur,best};};
          return {name,wins:calc(r=>r.won),poles:calc(r=>r.pole),positive:calc(r=>r.positive),top3:calc(r=>r.top3),hits:calc(r=>r.hits)};
        });
        const active=[];
        const types=[{key:"wins",label:"victorias",icon:"🏆"},{key:"positive",label:"pts positivos",icon:"📈"},{key:"top3",label:"en top 3",icon:"🥉"},{key:"poles",label:"pole acertada",icon:"🏁"},{key:"hits",label:"con aciertos",icon:"🎯"}];
        types.forEach(t=>{
          streaks.forEach(s=>{if(s[t.key].current>=2) active.push({name:s.name,type:t.label,icon:t.icon,current:s[t.key].current,best:s[t.key].best});});
        });
        active.sort((a,b)=>b.current-a.current);
        const records=[];
        types.forEach(t=>{
          let best=0,who=[];
          streaks.forEach(s=>{const b=s[t.key].best;if(b>best){best=b;who=[s.name];}else if(b===best&&b>=2) who.push(s.name);});
          if(best>=2) records.push({type:t.label,icon:t.icon,best,who});
        });
        return (active.length>0||records.length>0)&&(
          <div className="card card-racing p-4 md:p-5">
            <h3 className="section-title mb-3">🔥 Rachas</h3>
            {active.length>0&&(<>
              <p className="text-xs text-white/40 mb-2">Rachas activas (desde la última carrera)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {active.map((s,i)=>(
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/8 to-transparent border border-amber-500/15">
                    <span className="text-lg">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-amber-200">{s.name}</div>
                      <div className="text-[10px] text-white/40">{s.current} {s.type} seguidas{s.best>s.current?` (récord: ${s.best})`:s.current===s.best?" ⭐ récord":""}</div>
                    </div>
                    <div className="text-xl font-black text-amber-400/80">{s.current}</div>
                  </div>
                ))}
              </div>
            </>)}
            {records.length>0&&(
              <div className={active.length>0?"mt-3 pt-3 border-t border-white/5":""}>
                <p className="text-xs text-white/40 mb-2">Récords históricos</p>
                <div className="flex flex-wrap gap-2">
                  {records.map((r,i)=>(
                    <div key={i} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/[.03] border border-white/5">
                      <span>{r.icon} {r.best} {r.type}</span>
                      <span className="text-white/30 ml-1">— {r.who.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {f1Rivalries.length>0 && <Rivalries rivalries={f1Rivalries} mode="f1" />}
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
      {completedRaces.length>0&&(()=>{
        const pData=f1Participants.map(name=>{
          const completed2=completedRaces.filter(r=>db.bets?.[r.key]?.[name]?.submittedAt);
          if(!completed2.length) return {name,avgHoursBefore:null,onTime:0,late:0,betsCount:0,total:completedRaces.length};
          let onTime=0,late=0;
          const avgMs=completed2.reduce((sum,r)=>{
            const sub=new Date(db.bets[r.key][name].submittedAt).getTime();
            const cut=r.cutoff?r.cutoff.getTime():sub;
            const diff=cut-sub;
            if(diff>=0) onTime++; else late++;
            return sum+diff;
          },0)/completed2.length;
          return {name,avgHoursBefore:avgMs/3600000,onTime,late,betsCount:completed2.length,total:completedRaces.length};
        }).filter(p=>p.betsCount>0).sort((a,b)=>{
          const aRatio=a.onTime/a.betsCount, bRatio=b.onTime/b.betsCount;
          if(bRatio!==aRatio) return bRatio-aRatio;
          return b.avgHoursBefore-a.avgHoursBefore;
        });
        const fmtTime=h=>{
          if(h<0) return `${Math.abs(h).toFixed(1)}h tarde`;
          if(h<1) return `${Math.round(h*60)}min antes`;
          if(h<24) return `${h.toFixed(1)}h antes`;
          const d=Math.floor(h/24);
          const rem=h%24;
          return `${d}d ${Math.round(rem)}h antes`;
        };
        const maxAbs=Math.max(...pData.map(x=>Math.abs(x.avgHoursBefore||0)),1);
        let medalIdx=0;
        return pData.length>0&&(
          <div className="card card-racing p-4 md:p-5">
            <h3 className="section-title mb-3">⏱️ Puntualidad</h3>
            <p className="text-xs text-white/40 mb-3">Tiempo medio de envío respecto al cierre de apuestas. ¿Quién es el más previsor?</p>
            <div className="space-y-2">
              {pData.map((p,i)=>{
                const isEarly=p.avgHoursBefore>=0;
                const pct=Math.max(8,(Math.abs(p.avgHoursBefore)/maxAbs)*100);
                const medal=isEarly&&medalIdx<3?["🥇","🥈","🥉"][medalIdx++]:"";
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium text-white/80 truncate">{medal} {p.name}</div>
                    <div className="flex-1 h-5 rounded-full bg-white/5 overflow-hidden relative">
                      <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:isEarly?"linear-gradient(90deg,#22c55e,#16a34a)":"linear-gradient(90deg,#ef4444,#dc2626)"}}></div>
                      <span className={`absolute inset-0 flex items-center px-3 text-[11px] font-semibold ${isEarly?"text-white/70":"text-red-200/80"}`}>{fmtTime(p.avgHoursBefore)}</span>
                    </div>
                    <div className="text-[10px] text-white/30 w-16 text-right" title={`${p.onTime} a tiempo, ${p.late} tarde`}>{p.onTime}✓ {p.late>0?`${p.late}✗`:""}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-white/25">Basado en {completedRaces.length} carrera{completedRaces.length!==1?"s":""} con resultados. Medallas solo para envíos a tiempo. A la derecha: a tiempo (✓) y tarde (✗).</div>
          </div>
        );
      })()}
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
              <div>
                <label className="text-[10px] text-white/40 uppercase mb-1 block">Respuestas a preguntas</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0,1,2].map(i=>{
                    const qLabel=db.questions?.[whatIfRaceKey]?.[i];
                    return (
                      <div key={i}>
                        <input className="select border rounded px-2 py-1.5 w-full text-sm" placeholder={qLabel?`Q${i+1}: ${qLabel}`:`Pregunta ${i+1}`} value={whatIfResult.qAnswers?.[i]||""} onChange={e=>setWhatIfResult(prev=>{const q=[...(prev.qAnswers||["","",""])];q[i]=e.target.value;return{...prev,qAnswers:q};})}/>
                      </div>
                    );
                  })}
                </div>
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
      <WallOfShame db={db} races={races} mode="f1" currentUser={currentUser} />
      <Birrometro db={db} races={races} mode="f1" />
      <HeadToHead db={db} races={races} mode="f1" currentUser={currentUser} />
      <Achievements db={db} races={races} mode="f1" currentUser={currentUser} />
      <PersonalHistory db={db} races={races} mode="f1" currentUser={currentUser} />
    </div>
  );
}

const PointsTrendChart = memo(function PointsTrendChart({trendData}){
  const participants=trendData.participants;
  const races=trendData.races;
  const sorted=[...participants].sort((a,b)=>a.name.localeCompare(b.name));
  const sortedNames=sorted.map(p=>p.name);
  const colorOf=n=>PILOT_COLORS[n]||FALLBACK_COLORS[sortedNames.indexOf(n)%FALLBACK_COLORS.length];
  const allScores=participants.flatMap(p=>p.scores);
  const minPts=Math.min(...allScores,0);
  const maxPts=Math.max(...allScores,0);
  const range=Math.max(maxPts-minPts,1);
  const niceStep=(r)=>{const raw=r/5;const mag=Math.pow(10,Math.floor(Math.log10(raw)));const norm=raw/mag;return (norm<=1?1:norm<=2?2:norm<=5?5:10)*mag;};
  const step=niceStep(range);
  const ticks=[];
  for(let v=Math.ceil(minPts/step)*step;v<=maxPts;v+=step) ticks.push(Math.round(v*100)/100);
  if(!ticks.includes(0)&&minPts<=0&&maxPts>=0) ticks.push(0);
  ticks.sort((a,b)=>b-a);
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
  const valToY=v=>padT+chartH*((maxPts-v)/range);
  return (
    <div className="card card-racing p-4 md:p-5">
      <h3 className="section-title mb-3">📈 Tendencia de puntos por carrera</h3>
      <div className="overflow-x-auto -mx-2 px-2">
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",minWidth:nR>4?`${nR*70}px`:"100%",height:"auto"}} className="block">
          {ticks.map(v=>{
            const y=valToY(v);
            return <g key={`tick-${v}`}>
              <line x1={padL-4} y1={y} x2={padL+chartW} y2={y} stroke={v===0?"rgba(255,255,255,.2)":"rgba(255,255,255,.07)"} strokeDasharray={v===0?"2,4":"2,6"}/>
              <text x={padL-6} y={y+3} fill="rgba(255,255,255,.35)" fontSize="7" textAnchor="end" fontWeight="500">{v}</text>
            </g>;
          })}
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
        {sorted.map(p=><div key={p.name} className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:colorOf(p.name)}}></div><span className="text-white/50">{p.name}</span></div>)}
      </div>
    </div>
  );
});

export { Stats };
