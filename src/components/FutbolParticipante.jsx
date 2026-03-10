import { useState, useEffect, useMemo, useCallback } from "react";
import { useNow, nowISO, shareBet, betsAreEqual, parseLocalDateTime, formatDateTime } from "../utils.js";
import { MADRID_TZ } from "../config.js";
import { saveBetFutbol } from "../api.js";
import { toast } from "../toast.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { scoreFutbolJornada, listFutbolJornadas, computeFutbolStandings, defaultFutbolState } from "../futbol-utils.js";
import { Avatar } from "./Avatar.jsx";
import { FutbolBetForm } from "./FutbolBetForm.jsx";

function CountdownBadge({target}){
  const [tick,setTick]=useState(()=>Date.now());
  useEffect(()=>{
    const id=setInterval(()=>setTick(Date.now()),1000);
    return ()=>clearInterval(id);
  },[]);
  if(!target) return null;
  const diff=target.getTime()-tick;
  if(diff<=0) return (
    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
      <div className="text-red-400 text-lg font-bold">🔒 Apuestas cerradas</div>
      <div className="text-xs text-red-300/60 mt-1">El plazo de apuestas ha finalizado</div>
    </div>
  );
  const totalSec=Math.floor(diff/1000);
  const days=Math.floor(totalSec/86400);
  const hours=Math.floor((totalSec%86400)/3600);
  const mins=Math.floor((totalSec%3600)/60);
  const secs=totalSec%60;
  const totalMin=Math.floor(totalSec/60);
  const urgent=totalMin<120;
  const warn=totalMin<720 && !urgent;
  const bgCls=urgent?"bg-red-500/10 border-red-500/25":"bg-amber-500/8 border-amber-500/20";
  const timeCls=urgent?"text-red-300":warn?"text-amber-300":"text-emerald-300";
  const labelCls=urgent?"text-red-400/60":warn?"text-amber-400/50":"text-emerald-400/50";
  const msgCls=urgent?"text-red-300/70":warn?"text-amber-300/60":"text-white/40";
  const msg=urgent?"¡Queda poco! Date prisa para apostar":(warn?"Todavía tienes tiempo, pero no te duermas":"Tienes tiempo de sobra para apostar");
  const p2=n=>String(n).padStart(2,"0");
  return (
    <div className={`mt-3 p-3 rounded-xl border ${bgCls}`}>
      <div className={`text-[10px] uppercase tracking-widest font-semibold mb-1.5 text-center ${labelCls}`}>⏱ Tiempo restante para apostar</div>
      <div className="flex items-baseline gap-1 justify-center">
        {days>0 && <><span className={`text-2xl font-black tabular-nums ${timeCls}`}>{days}</span><span className={`text-[10px] font-medium mr-1.5 ${labelCls}`}>d</span></>}
        <span className={`text-2xl font-black tabular-nums ${timeCls}`}>{p2(hours)}</span><span className={`text-[10px] font-medium ${labelCls}`}>h</span>
        <span className={`text-lg ${timeCls} opacity-40 mx-0.5`}>:</span>
        <span className={`text-2xl font-black tabular-nums ${timeCls}`}>{p2(mins)}</span><span className={`text-[10px] font-medium ${labelCls}`}>m</span>
        <span className={`text-lg ${timeCls} opacity-40 mx-0.5`}>:</span>
        <span className={`text-2xl font-black tabular-nums ${timeCls} ${urgent?"animate-pulse":""}`}>{p2(secs)}</span><span className={`text-[10px] font-medium ${labelCls}`}>s</span>
      </div>
      <div className={`text-xs mt-1.5 text-center ${msgCls}`}>{msg}</div>
    </div>
  );
}

export function FutbolParticipante({user,db,setDb}){
  const now=useNow();
  const [showOthers,setShowOthers]=useState(false);
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const [selected,setSelected]=useState(()=>jornadas[0]?.id||"");
  useEffect(()=>{ if((!selected || !jornadas.find(j=>j.id===selected)) && jornadas.length) setSelected(jornadas[0].id); },[selected,jornadas]);
  const jornada=jornadas.find(j=>j.id===selected);
  const deadline=jornada?.deadline?new Date(jornada.deadline):null;
  const manualWindow=futbol.betsWindow?.[selected];
  const manualReveal=futbol.betsReveal?.[selected];
  const isBeforeDeadline=deadline ? now<deadline : true;
  const isFutbolLate=deadline ? now>=deadline : false;
  const canEdit=manualWindow?.forceClosed?false:true;
  const revealAt=deadline?new Date(deadline.getTime()+60*1000):null;
  const canViewFull=manualReveal?.forceShow || (!!revealAt && now>revealAt);
  const bet=jornada ? (futbol.bets?.[selected]?.[user]||{matches:[],submittedAt:null,late:false}) : null;
  const res=jornada ? futbol.results?.[selected] : null;
  const futbolParticipants=useMemo(()=>getParticipantsForPorra(db,"futbol"),[db.participants,db.users]);
  const others=futbolParticipants.filter(n=>n!==user).map(name=>({name,bet:jornada?futbol.bets?.[selected]?.[name]:null}));
  const myScore=jornada && res ? scoreFutbolJornada(db,selected,user) : null;
  const betsStatus=jornada ? (manualWindow?.forceClosed?"Cerrado por admin":(isFutbolLate?`Fuera de plazo (penalización -2 pts)`:(deadline?`Cierre: ${formatDateTime(deadline,MADRID_TZ)}`:"Abierto"))) : "—";
  const [saving,setSaving]=useState(false);
  const saveBet=async(payload)=>{
    if(!jornada||saving) return;
    setSaving(true);
    const ts=nowISO();
    const late=deadline ? new Date()>=deadline : false;
    const nextBet={matches:payload.matches, submittedAt:ts, late};
    try {
      await saveBetFutbol(selected, user, nextBet);
    } catch(err) {
      console.error("Error guardando apuesta futbol:", err);
      toast.error("Error al guardar la apuesta. Inténtalo de nuevo.");
      setSaving(false);
      return;
    }
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const raceBets={...(futbolPrev.bets?.[selected]||{})};
      const prevBet=raceBets[user];
      const fullBet={...prevBet, ...nextBet};
      const nextBets={...(futbolPrev.bets||{}), [selected]:{...raceBets, [user]:fullBet}};
      let betHistory=futbolPrev.betHistory||{};
      const sameMatch=JSON.stringify(prevBet?.matches||[])===JSON.stringify(payload.matches||[]);
      if(!prevBet || !sameMatch || (!!prevBet?.late)!==late){
        const raceHistory={...(betHistory[selected]||{})};
        const logs=[...(raceHistory[user]||[])];
        logs.push({ts:ts,matches:payload.matches,late});
        betHistory={...betHistory,[selected]:{...raceHistory,[user]:logs}};
      }
      return {...prev, futbol:{...futbolPrev, bets:nextBets, betHistory}};
    });
    late?toast.warn("Apuesta registrada (fuera de plazo: penalización -2 pts)"):toast.success("Apuesta guardada correctamente");
    setSaving(false);
  };
  const showOthersPanel=showOthers && !!jornada;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,340px)]":"";
  return (
    <div className={`grid gap-4 ${layoutCols}`}>
      <div className="card card-racing p-4 md:p-5 min-w-0">
        <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title">⚽ Tu apuesta <span className="text-xs opacity-40">· por las birras</span></h2>
          {jornada && (<button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-emerald-300/70 hover:bg-emerald-500/15 hover:text-emerald-200 transition-all" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar":"👀 Ver otras apuestas"}</button>)}
        </div>
        <select className="select select-strong border rounded px-3 py-2 mb-3 w-full" value={selected} onChange={e=>setSelected(e.target.value)}>
          {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id} {j.deadline?`— ${new Date(j.deadline).toLocaleDateString("es-ES")}`:""}</option>)}
        </select>
        {jornada ? (
          <div className="futbol-info-panel mb-4">
            <h3 className="text-sm font-bold text-white/85 mb-2.5 flex items-center gap-2">🏟️ Info de la jornada</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-slate-400">Partidos:</span>
                <span className="text-white/70 font-medium">{jornada.matches?.length||0}</span>
                <span className="text-slate-500 text-xs">({(jornada.matches||[]).map(m=>m.home).join(" · ")})</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-slate-400">Cierre apuestas:</span>
                {deadline ? (
                  <span className="text-emerald-300 font-bold">{formatDateTime(deadline,MADRID_TZ)}</span>
                ) : (
                  <span className="text-slate-500">Sin límite</span>
                )}
              </div>
              <div className="mt-1 pt-2 border-t border-slate-600/30">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span><span className="text-slate-400">Estado:</span> <span className={betsStatus.includes("Abierto")||betsStatus.includes("Cierre")?"text-emerald-300":"text-amber-300"}>{betsStatus.includes("Cierre")?betsStatus.replace("Cierre: ","Abierto — cierre "):betsStatus}</span></span>
                  <span><span className="text-slate-400">Visibilidad:</span> <span className="text-slate-300">{manualReveal?.forceShow?"Publicadas":"Ocultas hasta cierre"}</span></span>
                </div>
              </div>
            </div>
            {deadline && <CountdownBadge target={deadline}/>}
          </div>
        ) : (
          <div className="futbol-info-panel mb-4 text-center py-6">
            <div className="text-2xl mb-2">⚽</div>
            <p className="text-sm text-white/40">No hay jornadas creadas. Pide al admin que añada una.</p>
          </div>
        )}
        {jornada && isFutbolLate && canEdit && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400/40 via-amber-400/30 to-transparent"></div>
            <div className="font-semibold text-amber-200">⚠️ Apuesta fuera de plazo</div>
            <div className="text-sm text-amber-300/80 mt-1">El plazo de apuestas ha cerrado. Puedes apostar igualmente, pero se aplicará una <b>penalización de -2 puntos</b>. No apostar supone <b>-3 puntos</b>.</div>
          </div>
        )}
        {jornada && (
          <FutbolBetForm jornada={jornada} bet={bet} disabled={!canEdit||saving} canEdit={canEdit&&!saving} late={isFutbolLate} onSubmit={saveBet} />
        )}
        {myScore && (
          <div className="mt-4 futbol-result-card">
            <div className="relative flex items-center justify-between mb-3">
              <h3 className="font-bold text-white/90 flex items-center gap-2">🏆 Tus puntos</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black bg-gradient-to-r from-emerald-300 to-white bg-clip-text text-transparent">{myScore.points}</span>
                <span className="text-xs text-emerald-300/50 font-semibold">pts</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="futbol-score-badge futbol-score-exact">{myScore.exact} exacto{myScore.exact!==1?"s":""}</span>
              <span className="futbol-score-badge futbol-score-sign">{myScore.signs} signo{myScore.signs!==1?"s":""}</span>
              {myScore.missed && <span className="futbol-score-badge" style={{background:"rgba(239,68,68,.12)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.2)"}}>sin apuesta</span>}
              {myScore.catPenalty<0 && <span className="futbol-score-badge" style={{background:"rgba(239,68,68,.12)",color:"#fca5a5",border:"1px solid rgba(239,68,68,.2)"}}>catastrófica</span>}
            </div>
            <div className="space-y-1.5">
              {myScore.items.map((item,idx)=>{
                const isMatch=item.label.includes(" vs ");
                return (<div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[.02] border border-white/[.04]">
                  <span className="text-xs text-white/50 flex-1 min-w-0 truncate">{isMatch?"⚽ ":""}{item.label}</span>
                  <span className={`text-xs font-bold flex-shrink-0 ${item.delta>0?"text-emerald-300":item.delta<0?"text-red-400":"text-white/20"}`}>{item.delta>0?`+${item.delta}`:item.delta}</span>
                </div>);
              })}
            </div>
          </div>
        )}
        {res && !myScore && (
          <div className="mt-4 futbol-result-card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">📋 Resultados oficiales</h3>
            <div className="space-y-2">
              {(res.matches||[]).map((m,idx)=>(
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[.03] border border-white/[.05]">
                  <span className="text-sm text-white/60">{jornada?.matches?.[idx]?.home||"Local"}</span>
                  <span className="font-bold text-white/90 tabular-nums">{m?.home??"—"} - {m?.away??"—"}</span>
                  <span className="text-sm text-white/60 text-right">{jornada?.matches?.[idx]?.away||"Visitante"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showOthersPanel && (
        <div className="card p-4 md:min-w-[220px] md:max-w-[340px] self-start">
          <h2 className="section-title mb-4">👀 Apuestas de otros</h2>
          {!jornada && <p className="text-sm text-slate-300">Selecciona una jornada.</p>}
          {jornada && !canViewFull && (
            <div className="text-center py-6">
              <div className="text-3xl mb-2 opacity-40">🔒</div>
              <p className="text-sm text-slate-400">Se publicarán tras el cierre o si el admin las muestra antes.</p>
            </div>
          )}
          {jornada && canViewFull && (
            <div className="space-y-3">
              {others.map(({name,bet:other})=>(
                <div key={name} className="border border-emerald-500/8 rounded-xl p-3 bg-white/[.02] hover:bg-white/[.04] transition-colors">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar name={name} avatar={db.meta?.avatars?.[name]} avatarFutbol={db.meta?.avatarsFutbol?.[name]} size="sm" mode="futbol"/>
                    <span className="font-semibold text-white/80">{name}</span>
                    {other?.late && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">fuera de plazo</span>}
                    {other?.delegated && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20">delegada</span>}
                  </div>
                  {other ? (
                    <div className="space-y-1">
                      {(jornada.matches||[]).map((m,idx)=>(
                        <div key={idx} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-white/[.02]">
                          <span className="text-white/40 truncate flex-1">{m.home||"Local"}</span>
                          <span className="font-bold text-white/70 mx-2 tabular-nums">{other.matches?.[idx]?.home??"—"} - {other.matches?.[idx]?.away??"—"}</span>
                          <span className="text-white/40 truncate flex-1 text-right">{m.away||"Visitante"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (<div className="text-xs text-slate-400 text-center py-2">Sin apuesta</div>)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
