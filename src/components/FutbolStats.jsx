import { useMemo, memo } from "react";
import { PILOT_COLORS, FALLBACK_COLORS, BEER_EXCLUDED_USERS } from "../config.js";
import { scoreFutbolJornada, listFutbolJornadas, computeFutbolJornadaWins, defaultFutbolState } from "../futbol-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { BeerChart } from "./BeerChart.jsx";
import { Rivalries } from "./Rivalries.jsx";
import { HeadToHead } from "./HeadToHead.jsx";
import { Achievements } from "./Achievements.jsx";
import { PersonalHistory } from "./PersonalHistory.jsx";
import { WallOfShame } from "./WallOfShame.jsx";
import { Birrometro } from "./Birrometro.jsx";

export function FutbolStats({db,currentUser}){
  const futbol=db.futbol||defaultFutbolState();
  const participants=useMemo(()=>getParticipantsForPorra(db,"futbol"),[db.participants,db.users]);
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const completedJornadas=useMemo(()=>jornadas.filter(j=>futbol.results?.[j.id]),[jornadas,futbol.results]);

  const stats=useMemo(()=>{
    if(!completedJornadas.length||participants.length<2) return null;
    const wins=computeFutbolJornadaWins(futbol,participants,jornadas);
    const exactTotals={}, signTotals={};
    const allScores=[];
    participants.forEach(name=>{exactTotals[name]=0;signTotals[name]=0;});
    completedJornadas.forEach(j=>{
      participants.forEach(name=>{
        const s=scoreFutbolJornada(db,j.id,name);
        exactTotals[name]+=s.exact;
        signTotals[name]+=s.signs;
        allScores.push({name,jornada:j.name||j.id,points:s.points});
      });
    });
    const topList=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value])=>({name,value}));
    const sortedScores=[...allScores].sort((a,b)=>b.points-a.points);
    return {
      winners:topList(wins),
      exactLeaders:topList(exactTotals),
      signLeaders:topList(signTotals),
      bestScores:sortedScores.slice(0,5),
      worstScores:[...allScores].sort((a,b)=>a.points-b.points).slice(0,5),
    };
  },[db,futbol,participants,jornadas,completedJornadas]);

  const beerHistory=useMemo(()=>{
    const eligible=participants.filter(n=>!BEER_EXCLUDED_USERS.has(n));
    if(eligible.length<2) return [];
    return completedJornadas.map(j=>{
      const scores=eligible.map(name=>({name,...scoreFutbolJornada(db,j.id,name)}));
      scores.sort((a,b)=>b.points-a.points||a.goalDiff-b.goalDiff);
      const allTied=scores.every(s=>s.points===scores[0].points);
      return {jornada:j.name||j.id,winner:allTied?"Empate":scores[0].name,points:scores[0].points,allTied};
    });
  },[db,participants,completedJornadas]);

  const beerCount=useMemo(()=>{
    const counts={};
    beerHistory.forEach(h=>{if(!h.allTied) counts[h.winner]=(counts[h.winner]||0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  },[beerHistory]);

  const trendData=useMemo(()=>{
    if(!completedJornadas.length||participants.length<2) return null;
    return {
      jornadas:completedJornadas.map(j=>{const n=j.name||j.id;const m=n.match(/(\d+)/);return {id:j.id,label:m?`J${m[1]}`:n.substring(0,8)};}),
      participants:participants.map(name=>({name,scores:completedJornadas.map(j=>scoreFutbolJornada(db,j.id,name).points)}))
    };
  },[db,participants,completedJornadas]);

  const futbolRivalries=useMemo(()=>{
    if(completedJornadas.length<2||participants.length<3) return [];
    const totals={};
    participants.forEach(name=>{
      totals[name]=completedJornadas.reduce((sum,j)=>sum+scoreFutbolJornada(db,j.id,name).points,0);
    });
    const pairs=[];
    for(let i=0;i<participants.length;i++){
      for(let j=i+1;j<participants.length;j++){
        const a=participants[i],b=participants[j];
        let aWins=0,bWins=0,ties=0,sameChoices=0,totalChoices=0;
        completedJornadas.forEach(jrn=>{
          const sa=scoreFutbolJornada(db,jrn.id,a),sb=scoreFutbolJornada(db,jrn.id,b);
          if(sa.points>sb.points)aWins++;else if(sb.points>sa.points)bWins++;else ties++;
          const ba=futbol.bets?.[jrn.id]?.[a],bb=futbol.bets?.[jrn.id]?.[b];
          const res=futbol.results?.[jrn.id]?.matches||[];
          if(ba?.submittedAt&&bb?.submittedAt&&res.length){
            totalChoices+=res.length;
            res.forEach((_,mi)=>{
              const ma=ba.matches?.[mi],mb=bb.matches?.[mi];
              if(ma&&mb){
                const signA=Math.sign(Number(ma.home||0)-Number(ma.away||0));
                const signB=Math.sign(Number(mb.home||0)-Number(mb.away||0));
                if(signA===signB)sameChoices++;
              }
            });
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
  },[db,futbol,participants,completedJornadas]);

  const renderList=(items,emptyLabel,formatter)=> items?.length ? (
    <ul className="space-y-1 text-sm mt-1">{items.map((item,idx)=><li key={idx} className="flex items-center justify-between border border-white/10 rounded px-2 py-1 bg-neutral-900"><span>{idx+1}. {formatter?formatter(item):item.name}</span><span className="text-xs text-slate-300">{item.value!=null?item.value:""}</span></li>)}</ul>
  ) : (<p className="text-sm text-slate-400">{emptyLabel}</p>);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="card card-racing p-4 md:p-5 space-y-3">
          <h2 className="section-title">📊 Estadísticas fútbol <span className="text-xs opacity-40">· al que gane, le invitan</span></h2>
          <p className="text-[11px] text-white/30">Solo jornadas con resultados publicados.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
              <h3 className="font-semibold mb-1">Más jornadas ganadas</h3>
              {renderList(stats.winners,"Aún no hay ganadores.",item=>item.name)}
              <h3 className="font-semibold mt-3 mb-1">Más resultados exactos</h3>
              {renderList(stats.exactLeaders,"Sin exactos.",item=>item.name)}
              <h3 className="font-semibold mt-3 mb-1">Más signos acertados</h3>
              {renderList(stats.signLeaders,"Sin signos.",item=>item.name)}
            </div>
            <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
              <h3 className="font-semibold mb-1">Mejores jornadas</h3>
              {stats.bestScores?.length ? (
                <ul className="space-y-1 text-sm mt-1">{stats.bestScores.map((row,idx)=>(
                  <li key={idx} className="border border-white/10 rounded px-2 py-1 bg-neutral-900 flex items-center justify-between">
                    <span>{row.name} — {row.jornada}</span>
                    <span className="text-xs text-emerald-300">{row.points} pts</span>
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-slate-400">Sin resultados.</p>}
              <h3 className="font-semibold mt-3 mb-1">Peores jornadas</h3>
              {stats.worstScores?.length ? (
                <ul className="space-y-1 text-sm mt-1">{stats.worstScores.map((row,idx)=>(
                  <li key={idx} className="border border-white/10 rounded px-2 py-1 bg-neutral-900 flex items-center justify-between">
                    <span>{row.name} — {row.jornada}</span>
                    <span className="text-xs text-amber-300">{row.points} pts</span>
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-slate-400">Sin resultados negativos.</p>}
            </div>
          </div>
        </div>
      )}

      {beerHistory.length>0 && (
        <div className="card card-racing p-4 md:p-5 space-y-3">
          <h2 className="section-title">🍺 Histórico de birras</h2>
          <p className="text-[11px] text-white/30">Quién quedó primero en cada jornada (los demás le invitan a birras).</p>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="text-sm w-full">
              <thead><tr><th className="text-left">Jornada</th><th className="text-left">Le invitan</th><th className="text-right">Pts</th></tr></thead>
              <tbody>
                {beerHistory.map((h,i)=><tr key={i} className="border-t border-white/5"><td>{h.jornada}</td><td>{h.winner}</td><td className="text-right">{h.points}</td></tr>)}
              </tbody>
            </table>
          </div>
          {beerCount.length>0 && (
            <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
              <h3 className="font-semibold mb-2">A quién le han invitado más birras</h3>
              <BeerChart data={beerCount.map(([name,count])=>({name,count}))} />
            </div>
          )}
        </div>
      )}

      {completedJornadas.length>=2&&(()=>{
        const streaks=participants.map(name=>{
          const perJ=completedJornadas.map(j=>{
            const s=scoreFutbolJornada(db,j.id,name);
            const scores=participants.map(n=>scoreFutbolJornada(db,j.id,n));
            const best=Math.max(...scores.map(x=>x.points));
            const winners=scores.filter(x=>x.points===best);
            const won=winners.length===1&&s.points===best;
            return {won,exact:s.exact>0,positive:s.points>0,perfect:s.exact===((futbol.results?.[j.id]?.matches||[]).length)};
          });
          const calc=(fn)=>{let cur=0;for(let i=perJ.length-1;i>=0;i--){if(fn(perJ[i]))cur++;else break;}let best=0,run=0;perJ.forEach(r=>{if(fn(r)){run++;best=Math.max(best,run);}else run=0;});return {current:cur,best};};
          return {name,wins:calc(r=>r.won),exact:calc(r=>r.exact),positive:calc(r=>r.positive),perfect:calc(r=>r.perfect)};
        });
        const active=[];
        const types=[{key:"wins",label:"victorias",icon:"🏆"},{key:"positive",label:"pts positivos",icon:"📈"},{key:"exact",label:"con exactos",icon:"🎯"},{key:"perfect",label:"plenos",icon:"⭐"}];
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
              <p className="text-xs text-white/40 mb-2">Rachas activas (desde la última jornada)</p>
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

      {futbolRivalries.length>0 && <Rivalries rivalries={futbolRivalries} mode="futbol" />}

      {trendData && <FutbolTrendChart trendData={trendData} />}

      {completedJornadas.length>0 && (()=>{
        const pData=participants.map(name=>{
          const completed2=completedJornadas.filter(j=>futbol.bets?.[j.id]?.[name]?.submittedAt);
          if(!completed2.length) return {name,avgHoursBefore:null,onTime:0,late:0,betsCount:0,total:completedJornadas.length};
          let onTime=0,late=0;
          const avgMs=completed2.reduce((sum,j)=>{
            const sub=new Date(futbol.bets[j.id][name].submittedAt).getTime();
            const dl=j.deadline?new Date(j.deadline).getTime():sub;
            const diff=dl-sub;
            if(diff>=0) onTime++; else late++;
            return sum+diff;
          },0)/completed2.length;
          return {name,avgHoursBefore:avgMs/3600000,onTime,late,betsCount:completed2.length,total:completedJornadas.length};
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
        return pData.length>0 && (
          <div className="card card-racing p-4 md:p-5">
            <h3 className="section-title mb-3">⏱️ Puntualidad</h3>
            <p className="text-xs text-white/40 mb-3">Tiempo medio de envío respecto al cierre de apuestas.</p>
            <div className="space-y-2">
              {pData.map((p)=>{
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
            <div className="mt-2 text-[10px] text-white/25">Basado en {completedJornadas.length} jornada{completedJornadas.length!==1?"s":""} con resultados. Medallas solo para envíos a tiempo.</div>
          </div>
        );
      })()}

      <WallOfShame db={db} mode="futbol" currentUser={currentUser} />
      <Birrometro db={db} mode="futbol" />
      <HeadToHead db={db} mode="futbol" currentUser={currentUser} />
      <Achievements db={db} mode="futbol" currentUser={currentUser} />
      <PersonalHistory db={db} mode="futbol" currentUser={currentUser} />

      {!completedJornadas.length && (
        <div className="card card-racing p-4 md:p-5 text-center py-12">
          <div className="text-4xl mb-3">⚽</div>
          <p className="text-white/40">Aún no hay jornadas con resultados publicados.</p>
          <p className="text-white/25 text-xs mt-1">Las estadísticas se mostrarán cuando el admin publique resultados.</p>
        </div>
      )}
    </div>
  );
}

const FutbolTrendChart = memo(function FutbolTrendChart({trendData}){
  const participants=trendData.participants;
  const jornadas=trendData.jornadas;
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
  const nR=jornadas.length;
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
      <h3 className="section-title mb-3">📈 Tendencia de puntos por jornada</h3>
      <div className="overflow-x-auto -mx-2 px-2">
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",minWidth:nR>4?`${nR*70}px`:"100%",height:"auto"}} className="block">
          {ticks.map(v=>{
            const y=valToY(v);
            return <g key={`tick-${v}`}>
              <line x1={padL-4} y1={y} x2={padL+chartW} y2={y} stroke={v===0?"rgba(255,255,255,.2)":"rgba(255,255,255,.07)"} strokeDasharray={v===0?"2,4":"2,6"}/>
              <text x={padL-6} y={y+3} fill="rgba(255,255,255,.35)" fontSize="7" textAnchor="end" fontWeight="500">{v}</text>
            </g>;
          })}
          {jornadas.map((j,i)=>{
            const gx=padL+i*groupW+groupW/2;
            return <text key={j.id} x={gx} y={H-6} fill="rgba(255,255,255,.22)" fontSize="7" textAnchor="middle" fontWeight="600">{j.label}</text>;
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
