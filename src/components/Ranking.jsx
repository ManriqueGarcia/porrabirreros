import { useState, useMemo } from "react";
import { scoreForRace, computeGPWins, computeAvgSubmitTime, describeBetAgainstResult } from "../scoring.js";
import { exportCSV, exportPDF } from "../utils.js";
import { toast } from "../toast.jsx";
import { Avatar } from "./Avatar.jsx";
import { PositionEvolutionChart } from "./Charts.jsx";

function Ranking({db,races,setDb,currentUser}){
  const [scope,setScope]=useState("all"); const participants=Object.keys(db.participants||{});
  const isAdmin=!!db.users?.[currentUser]?.isAdmin;
  const forceAuto=!!db.meta?.forceAutoStandings;
  const basePoints=db.meta?.basePoints||{};
  const baseEntries=Object.entries(basePoints).filter(([_,v])=>Number(v)>0);
  const manualStandings=useMemo(()=>{
    const entries=Object.entries(db.standings||{});
    if(!entries.length) return [];
    return entries.map(([name,info])=>({name,points:Number(info?.points||0),rank:info?.rank!=null?Number(info.rank):null}))
      .sort((a,b)=>{
        const rankA=a.rank??Infinity; const rankB=b.rank??Infinity;
        if(rankA!==rankB) return rankA-rankB;
        if(b.points!==a.points) return b.points-a.points;
        return a.name.localeCompare(b.name);
      });
  },[db.standings]);
  const computedData=useMemo(()=>{
    if(scope==="all"){
      const keys=(races||[]).map(r=>r.key);
      const gpWins=computeGPWins(db, races, participants);
      return participants.map(n=>{
        const acc=keys.reduce((a,k)=>{
          const s=scoreForRace(db,k,n);
          a.points+=s.points; a.hits+=s.hits; a.exact+=s.exact; a.pen+=s.pen; return a;
        },{points:Number(basePoints[n]||0),hits:0,exact:0,pen:0});
        return {name:n,...acc, wins:gpWins[n]||0, avgSubmit:computeAvgSubmitTime(db,races,n)};
      }).sort((A,B)=>B.points-A.points||B.wins-A.wins||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen||A.avgSubmit-B.avgSubmit);
    } else {
      const k=scope;
      return participants.map(n=>{const s=scoreForRace(db,k,n); return {name:n,points:s.points,hits:s.hits,exact:s.exact,pen:s.pen,wins:0};})
        .sort((A,B)=>B.points-A.points||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen);
    }
  },[db,races,scope,participants,basePoints]);
  const manualActive=scope==="all" && manualStandings.length>0 && !forceAuto;
  const data=manualActive?manualStandings.map((item,idx)=>({name:item.name,points:item.points,wins:"—",hits:"—",exact:"—",pen:"—",manualRank:item.rank??(idx+1)})):computedData;
  const latestRaceSummary=useMemo(()=>{
    const parts=Object.keys(db.participants||{});
    const completed=(races||[]).filter(r=>db.results?.[r.key]).sort((a,b)=>b.round-a.round);
    if(!completed.length||parts.length<2) return null;
    const race=completed[0];
    const res=db.results[race.key];
    const scores=parts.map(name=>{
      const s=scoreForRace(db,race.key,name);
      return {name,...s};
    }).sort((a,b)=>b.points-a.points);
    const winner=scores[0];
    const loser=scores[scores.length-1];
    const poleHitters=scores.filter(s=>s.gotPole);
    const podiumHitters=scores.filter(s=>s.gotAllPodium);
    const fullHouseHitters=scores.filter(s=>s.fullHouse);
    return {race,res,scores,winner,loser,poleHitters,podiumHitters,fullHouseHitters};
  },[db,races]);
  const championships=db.meta?.championships||{};
  const champData=participants.map(name=>({name,titles:Number(championships[name]||0)})).sort((A,B)=>B.titles-A.titles||A.name.localeCompare(B.name));
  const resetManual=()=>{
    if(!setDb) return;
    if(!window.confirm("Volver a clasificación automática y sumar estos puntos como base?")) return;
    const baseFromManual=manualStandings.reduce((acc,item)=>{ acc[item.name]=Number(item.points||0); return acc; },{});
    setDb(prev=>{ const next={...prev, meta:{...(prev.meta||{}), basePoints:baseFromManual, forceAutoStandings:true}}; delete next.standings; return next; });
  };
  const updateBasePoint=(name,value)=>{
    if(!setDb) return;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const base={...(meta.basePoints||{})};
      base[name]=Number.isNaN(value)?0:value;
      return {...prev, meta:{...meta, basePoints:base}};
    });
  };
  const podiumIcon=i=>i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1;
  const hasCompletedRaces=(races||[]).some(r=>db.results?.[r.key]);
  return (<div className="space-y-4">
    <div className="card card-racing p-4 md:p-5"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4"><h2 className="section-title text-lg">🏎️ Ranking F1 <span className="text-sm opacity-60">🍺</span></h2><select className="select select-strong border rounded-xl px-3 py-2" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Global</option>{(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix}</option>)}</select></div><div className="overflow-x-auto rounded-xl border border-white/5"><table className="text-sm w-full"><thead><tr><th className="text-left w-10"></th><th className="text-left">Piloto</th><th className="text-right">PTS</th>{scope==="all"&&<th className="text-right hidden sm:table-cell">Vict.</th>}<th className="text-right hidden sm:table-cell">Pod.</th><th className="text-right hidden sm:table-cell">Aciert.</th><th className="text-right hidden sm:table-cell">Pen.</th></tr></thead><tbody>{data.map((r,i)=>{const pos=manualActive?(r.manualRank||i+1):i+1;const allTied=data.length>1&&data.every(d=>d.points===data[0].points);const isLast=hasCompletedRaces&&i===data.length-1&&data.length>1&&!allTied;const pCls=i===0&&!allTied&&hasCompletedRaces?"podium-1":i===1&&!allTied&&hasCompletedRaces?"podium-2":i===2&&!allTied&&hasCompletedRaces?"podium-3":isLast?"border-l-2 border-l-amber-600/30 bg-gradient-to-r from-amber-900/[.04] to-transparent":"";return(<tr key={r.name} className={pCls} style={i<3&&!allTied&&hasCompletedRaces?{animationDelay:`${i*0.08}s`}:{}}><td className="text-white/50">{allTied||!hasCompletedRaces?"—":podiumIcon(i)}</td><td><div className="flex items-center gap-2.5"><Avatar name={r.name} avatar={db.meta?.avatars?.[r.name]} size="sm" mode="f1"/><div><span className={`font-semibold ${i===0&&!allTied&&hasCompletedRaces?"text-white":""}`}>{r.name}</span>{isLast&&<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/15">🍺 paga las birras</span>}{hasCompletedRaces&&allTied&&i===0&&<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/15">🍺 todos pagamos</span>}<div className="sm:hidden text-[11px] text-white/35 mt-0.5">{scope==="all"?`Vict:${r.wins} `:``}Pod:${r.exact} Aciert:${r.hits} Pen:${r.pen}</div></div></div></td><td className="text-right pts-cell">{r.points}</td>{scope==="all"&&<td className="text-right text-white/45 hidden sm:table-cell">{r.wins}</td>}<td className="text-right text-white/45 hidden sm:table-cell">{r.exact}</td><td className="text-right text-white/45 hidden sm:table-cell">{r.hits}</td><td className="text-right text-white/30 hidden sm:table-cell">{r.pen}</td></tr>)})}</tbody></table></div>{manualActive?<div className="text-xs text-amber-300 mt-3 flex flex-wrap items-center gap-2">Clasificación importada.<button className="px-2 py-1 rounded bg-slate-800 text-white" onClick={resetManual}>Usar automática</button></div>:<p className="text-[11px] text-white/35 mt-3">Desempates: puntos → victorias → podios exactos → aciertos → menos pen. → apuesta más temprana.</p>}{!manualActive && baseEntries.length>0 && <p className="text-[11px] text-emerald-300/50 mt-1">Incluye puntos base: {baseEntries.map(([n,v])=>`${n} ${v}`).join(" · ")}</p>}
    <button className="mt-3 text-xs text-white/30 hover:text-white/60 transition-colors" onClick={()=>{
      exportCSV("ranking_f1.csv",["Pos","Nombre","Puntos","Victorias","Podios","Aciertos","Pen."],data.map((r,i)=>[i+1,r.name,r.points,r.wins,r.exact,r.hits,r.pen]));
    }}>📥 Exportar CSV</button><button className="mt-3 ml-2 text-xs text-white/30 hover:text-white/60 transition-colors" onClick={()=>{
      exportPDF("Ranking F1 — Porra Birreros",["Pos","Nombre","Puntos","Victorias","Podios","Aciertos","Pen."],data.map((r,i)=>[i+1,r.name,r.points,r.wins,r.exact,r.hits,r.pen]));
    }}>📄 Exportar PDF</button></div>
    {latestRaceSummary&&(
      <div className="card card-racing p-4 md:p-5">
        <h3 className="section-title mb-3">🏁 Resumen último GP: {latestRaceSummary.race.grand_prix}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-2xl">🏆</div>
            <div className="text-sm font-bold text-emerald-300">{latestRaceSummary.winner.name}</div>
            <div className="text-[10px] text-white/40">{latestRaceSummary.winner.points} pts</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="text-2xl">🍺</div>
            <div className="text-sm font-bold text-red-300">{latestRaceSummary.loser.name}</div>
            <div className="text-[10px] text-white/40">{latestRaceSummary.loser.points} pts</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-2xl">🏁</div>
            <div className="text-sm font-bold text-amber-300">{latestRaceSummary.poleHitters.length>0?latestRaceSummary.poleHitters.map(s=>s.name).join(", "):"Nadie"}</div>
            <div className="text-[10px] text-white/40">Acertó la pole</div>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="text-2xl">{latestRaceSummary.fullHouseHitters.length>0?"🎯":"🥇"}</div>
            <div className="text-sm font-bold text-purple-300">{latestRaceSummary.fullHouseHitters.length>0?latestRaceSummary.fullHouseHitters.map(s=>s.name).join(", "):(latestRaceSummary.podiumHitters.length>0?latestRaceSummary.podiumHitters.map(s=>s.name).join(", "):"Nadie")}</div>
            <div className="text-[10px] text-white/40">{latestRaceSummary.fullHouseHitters.length>0?"Pleno total":"Podio exacto"}</div>
          </div>
        </div>
      </div>
    )}
    <PositionEvolutionChart db={db} races={races} scope={scope} participants={participants}/>
    <RaceBreakdown db={db} races={races} raceKey={scope} rows={data} />
    <div className="card card-racing p-4 md:p-5"><h3 className="section-title mb-3">🏆 Campeonatos mundiales <span className="text-sm opacity-50">🍻</span></h3>{champData.length?(<ul className="space-y-2">{champData.map((item,idx)=>(<li key={item.name} className="flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900"><div className="flex items-center gap-2"><Avatar name={item.name} avatar={db.meta?.avatars?.[item.name]} size="sm" mode="f1"/><span className="font-medium">{idx+1}. {item.name}</span></div><span className="text-sm">{item.titles} 🏆</span></li>))}</ul>):(<p className="text-sm text-slate-300">No hay participantes registrados.</p>)}<p className="text-xs text-slate-400 mt-2">Se edita desde Admin &gt; Campeonatos mundiales.</p></div>
  </div>);
}
function RaceBreakdown({db,races,raceKey,rows}){
  if(!raceKey || raceKey==="all"){
    const latest=(races||[]).find(r=>db.results?.[r.key]);
    return <div className="card p-4 md:p-5"><h3 className="section-title">Detalle puntos</h3><p className="text-sm text-white/40 mt-2">{latest?"Selecciona un GP en el selector de arriba para ver su desglose.":"No hay resultados publicados aún."}</p></div>;
  }
  const race=(races||[]).find(r=>r.key===raceKey);
  const res=db.results?.[raceKey];
  if(!res) return <div className="card p-4 md:p-5"><h3 className="section-title">Detalle puntos — {race?.grand_prix||raceKey}</h3><p className="text-sm text-slate-300">Añade resultados oficiales para ver el desglose.</p></div>;
  const podium=res.podium||["","",""]; const questions=res.qAnswers||["","",""];
  return (
    <div className="card card-racing p-4 space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="section-title">Detalle — {race?.grand_prix||raceKey}</h3>
        <div className="text-sm text-slate-300">Oficial: Pole {res.pole||"—"} · Podio {podium.join(" · ")} · Preguntas {questions.join(" · ")}</div>
        <div className="text-xs text-slate-400">Desempates: puntos → victorias GP → podios exactos → aciertos → menos penalizaciones → apuesta más temprana.</div>
      </div>
      <div className="grid gap-3">
        {rows.map(row=>{
          const bet=db.bets?.[raceKey]?.[row.name];
          const manualAdj=db.scoreAdjustments?.[raceKey]?.[row.name]||0;
          const detail=describeBetAgainstResult(bet,res,manualAdj);
          return (
            <div key={row.name} className="border border-white/10 rounded p-3 bg-neutral-900">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Avatar name={row.name} avatar={db.meta?.avatars?.[row.name]} size="sm" mode="f1"/><span className="font-medium">{row.name}</span></div>
                <div className="text-sm">{row.points} pts {!bet && <span className="text-xs text-red-300 ml-2">(sin apuesta)</span>}{bet?.late && <span className="text-xs text-amber-300 ml-2">(fuera de plazo)</span>}</div>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {detail.items.map((item,idx)=>(<li key={idx} className="flex items-center justify-between border border-white/5 rounded px-2 py-1"><span>{item.label}</span><span className={`ml-2 ${item.delta>0?"text-emerald-300":item.delta<0?"text-amber-300":"text-slate-400"}`}>{item.delta>0?`+${item.delta}`:item.delta}</span></li>))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionsHistory({db,races}){
  return (<div className="card card-racing p-4 md:p-5 space-y-3"><h2 className="section-title">❓ Histórico de preguntas</h2>{(races||[]).map(r=>{ const qs=db.questions?.[r.key]||["","",""]; const st=db.questionsStatus?.[r.key]; const owner=db.questionOwner?.[r.key]||""; return (<div key={r.key} className="border border-white/10 rounded p-3 bg-neutral-900"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium min-w-0"><span className="break-words">{r.round}. {r.grand_prix}</span> <span className="text-slate-300 text-sm">— {r.date_local}</span></div><div className="flex-shrink-0">{st?.published?<span className="badge badge-green">Publicado</span>:<span className="badge badge-amber">Pendiente</span>}</div></div><div className="text-xs text-slate-300">Autor: {owner||"—"}</div>{st?.published?<ol className="list-decimal pl-5 text-sm">{qs.map((q,i)=><li key={i}>{q||"—"}</li>)}</ol>:<div className="text-sm text-slate-400">Aún no publicadas.</div>}</div>); })}</div>);
}

export { Ranking, RaceBreakdown, QuestionsHistory };
