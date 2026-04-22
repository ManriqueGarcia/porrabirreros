import { useState, useEffect, useMemo, useCallback } from "react";
import { useNow, nowISO, shareBet, betsAreEqual, parseLocalDateTime, formatDateTime, formatTime } from "../utils.js";
import { MADRID_TZ } from "../config.js";
import { saveBetFutbol } from "../api.js";
import { toast } from "../toast.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { scoreFutbolJornada, listFutbolJornadas, computeFutbolStandings, defaultFutbolState, getEffectiveDeadline } from "../futbol-utils.js";
import { Avatar } from "./Avatar.jsx";
import { FutbolBetForm } from "./FutbolBetForm.jsx";
import { CountdownBadge } from "./CountdownBadge.jsx";
import { fireConfetti } from "../confetti.js";

export function FutbolParticipante({user,db,setDb}){
  const now=useNow();
  const [showOthers,setShowOthers]=useState(false);
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const [selected,setSelected]=useState(()=>{
    const nowMs=Date.now();
    const closedWithoutResults=jornadas.find(j=>{
      const dl=getEffectiveDeadline(j);
      if(!dl || dl.getTime()>nowMs) return false;
      const res=futbol.results?.[j.id];
      const hasAllResults=!!(res && res.matches?.length>0 && res.matches.every(m=>m.home!=null && m.away!=null));
      return !hasAllResults;
    });
    if(closedWithoutResults) return closedWithoutResults.id;
    const upcoming=jornadas.find(j=>{const dl=getEffectiveDeadline(j); return dl && dl.getTime()>nowMs;});
    return upcoming?.id || jornadas[jornadas.length-1]?.id || "";
  });
  useEffect(()=>{
    if((!selected || !jornadas.find(j=>j.id===selected)) && jornadas.length){
      const nowMs=Date.now();
      const closedWithoutResults=jornadas.find(j=>{
        const dl=getEffectiveDeadline(j);
        if(!dl || dl.getTime()>nowMs) return false;
        const res=futbol.results?.[j.id];
        const hasAllResults=!!(res && res.matches?.length>0 && res.matches.every(m=>m.home!=null && m.away!=null));
        return !hasAllResults;
      });
      if(closedWithoutResults){ setSelected(closedWithoutResults.id); return; }
      const upcoming=jornadas.find(j=>{const dl=getEffectiveDeadline(j); return dl && dl.getTime()>nowMs;});
      setSelected(upcoming?.id || jornadas[jornadas.length-1]?.id);
    }
  },[selected,jornadas]);
  const jornada=jornadas.find(j=>j.id===selected);
  const deadline=jornada?getEffectiveDeadline(jornada):null;
  const manualWindow=futbol.betsWindow?.[selected];
  const manualReveal=futbol.betsReveal?.[selected];
  const isBeforeDeadline=deadline ? now<deadline : true;
  const isFutbolLate=deadline ? now>=deadline : false;
  const jornadaResult=jornada ? futbol.results?.[selected] : null;
  const hasResult=!!(jornadaResult && jornadaResult.matches?.length>0 && jornadaResult.matches.every(m=>m.home!=null && m.away!=null));
  const canEdit=!manualWindow?.forceClosed && !hasResult;
  const revealAt=deadline?new Date(deadline.getTime()+60*1000):null;
  const canViewFull=manualReveal?.forceShow || (!!revealAt && now>revealAt);
  const bet=jornada ? (futbol.bets?.[selected]?.[user]||{matches:[],submittedAt:null,late:false}) : null;
  const res=jornada ? futbol.results?.[selected] : null;
  const futbolParticipants=useMemo(()=>getParticipantsForPorra(db,"futbol"),[db.participants,db.users]);
  const others=futbolParticipants.filter(n=>n!==user).map(name=>({name,bet:jornada?futbol.bets?.[selected]?.[name]:null}));
  const myScore=jornada && res ? scoreFutbolJornada(db,selected,user) : null;
  const betsStatus=jornada ? (hasResult?"Cerrado (resultados publicados)":manualWindow?.forceClosed?"Cerrado por admin":isFutbolLate?"Fuera de plazo (penalización -2 pts)":deadline?`Cierre: ${formatDateTime(deadline,MADRID_TZ)}`:"Abierto") : "—";
  const [saving,setSaving]=useState(false);
  const saveBet=async(payload)=>{
    if(!jornada||saving) return;
    setSaving(true);
    const ts=nowISO();
    const late=deadline ? new Date()>=deadline : false;
    const nextBet={matches:payload.matches, trashtalk:payload.trashtalk, submittedAt:ts, late};
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
    if(late){toast.warn("Apuesta registrada (fuera de plazo: penalización -2 pts)");}else{toast.success("Apuesta guardada correctamente");fireConfetti();}
    setSaving(false);
  };
  const betCount=useMemo(()=>{
    if(!jornada) return {done:0,total:0};
    const betsForJornada=futbol.bets?.[selected]||{};
    const done=futbolParticipants.filter(n=>betsForJornada[n]?.submittedAt).length;
    return {done,total:futbolParticipants.length};
  },[selected,futbol.bets,futbolParticipants]);
  const showOthersPanel=showOthers && !!jornada;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,340px)]":"";
  return (
    <div className={`grid gap-4 ${layoutCols}`}>
      <div className="card card-racing p-4 md:p-5 min-w-0">
        <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title">⚽ Tu apuesta <span className="text-xs opacity-40">· que te inviten a birras</span></h2>
          {jornada && (<button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15 text-emerald-300/70 hover:bg-emerald-500/15 hover:text-emerald-200 transition-all" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar":"👀 Ver otras apuestas"}</button>)}
        </div>
        <select className="select select-strong border rounded px-3 py-2 mb-3 w-full" value={selected} onChange={e=>setSelected(e.target.value)}>
          {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id} {j.deadline?`— ${new Date(j.deadline).toLocaleDateString("es-ES")}`:""}</option>)}
        </select>
        {jornada && betCount.total>0 && !hasResult && (
          <div className="flex items-center gap-2 mb-3 text-xs">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{width:`${(betCount.done/betCount.total)*100}%`,background:betCount.done===betCount.total?"#22c55e":"linear-gradient(90deg,#22c55e,#16a34a)"}}></div>
            </div>
            <span className={`font-semibold whitespace-nowrap ${betCount.done===betCount.total?"text-emerald-400":"text-emerald-300/70"}`}>
              {betCount.done===betCount.total?"✓ Todos han apostado":`${betCount.done}/${betCount.total} han apostado`}
            </span>
          </div>
        )}
        {jornada ? (<>
          <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-900/5 to-transparent border border-emerald-500/20 p-4 text-center group hover:border-emerald-400/35 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/[.03] to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">⚽</div>
                <div className="text-[10px] uppercase tracking-[.15em] text-emerald-300/60 font-bold mb-2">Partidos</div>
                <div className="text-2xl font-black text-emerald-200">{jornada.matches?.length||0}</div>
                <div className="text-[10px] text-white/25 mt-1.5 leading-relaxed">{(jornada.matches||[]).map(m=>m.home).join(" · ")}</div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-900/5 to-transparent border border-amber-500/20 p-4 text-center group hover:border-amber-400/35 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-amber-400/[.03] to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">⏰</div>
                <div className="text-[10px] uppercase tracking-[.15em] text-amber-300/60 font-bold mb-2">Cierre apuestas</div>
                {deadline ? (<>
                  <div className="text-base font-black text-amber-200 leading-tight">{formatDateTime(deadline,MADRID_TZ)}</div>
                  <div className="text-[10px] text-amber-300/40 mt-1 font-medium">🇪🇸 hora España</div>
                </>) : <div className="text-sm text-white/25 italic">Sin límite</div>}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/10 via-sky-900/5 to-transparent border border-sky-500/20 p-4 text-center group hover:border-sky-400/35 transition-all">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/60 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-sky-400/[.03] to-transparent pointer-events-none"></div>
              <div className="relative">
                <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">📊</div>
                <div className="text-[10px] uppercase tracking-[.15em] text-sky-300/60 font-bold mb-2">Estado</div>
                {hasResult
                  ? <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-semibold">🔒 Cerrado</span>
                  : manualWindow?.forceClosed
                    ? <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-semibold">🔒 Cerrado por admin</span>
                    : isFutbolLate
                      ? <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-semibold">⚠️ Fuera de plazo</span>
                      : <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-semibold">✓ Abierto</span>}
                <div className="text-[10px] text-white/25 mt-2">{manualReveal?.forceShow?"Apuestas visibles":"Ocultas hasta cierre"}</div>
              </div>
            </div>
          </div>
          {deadline && (()=>{
            const noBet=!bet?.submittedAt && canEdit && deadline.getTime()>Date.now();
            const hoursLeft=Math.max(0,(deadline.getTime()-Date.now())/3600000);
            const urgent=noBet && hoursLeft<24;
            return (
              <div className={`mb-4 p-3 rounded-xl relative overflow-hidden ${urgent?"bg-gradient-to-r from-red-500/12 to-amber-500/8 border border-red-500/25":noBet?"bg-gradient-to-r from-emerald-500/8 to-sky-500/5 border border-emerald-500/15":"bg-white/[.025] border border-white/[.06]"}`}>
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${urgent?"from-red-500/60 via-amber-500/40 to-transparent":noBet?"from-emerald-500/30 via-sky-500/20 to-transparent":"from-transparent via-emerald-500/30 to-transparent"}`}></div>
                {noBet && (
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{urgent?"🔥":"⚽"}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${urgent?"text-red-300":"text-emerald-200"}`}>{urgent?`¡Solo quedan ${hoursLeft<1?`${Math.ceil(hoursLeft*60)} minutos`:Math.ceil(hoursLeft)+" horas"}!`:"¡Apuesta disponible!"}</div>
                      <div className="text-xs text-white/50 mt-0.5">{urgent?"No apostar son -3 pts. ¡Rellena los marcadores!":"Rellena tus pronósticos antes del cierre. ¡Que te inviten a las birras!"}</div>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-bold text-white/85">⏰ Cierre:</span>
                    <span className="text-amber-300 font-bold text-lg tabular-nums">{formatTime(deadline,MADRID_TZ)}</span>
                    <span className="text-amber-100 text-xs">(España)</span>
                  </div>
                </div>
                <CountdownBadge target={deadline}/>
              </div>
            );
          })()}
        </>) : (
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
                  {other ? (<>
                    <div className="space-y-1">
                      {(jornada.matches||[]).map((m,idx)=>(
                        <div key={idx} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-white/[.02]">
                          <span className="text-white/40 truncate flex-1">{m.home||"Local"}</span>
                          <span className="font-bold text-white/70 mx-2 tabular-nums">{other.matches?.[idx]?.home??"—"} - {other.matches?.[idx]?.away??"—"}</span>
                          <span className="text-white/40 truncate flex-1 text-right">{m.away||"Visitante"}</span>
                        </div>
                      ))}
                    </div>
                    {hasResult && other?.trashtalk && <div className="mt-1.5 text-xs italic text-white/40 flex items-start gap-1">💬 "{other.trashtalk}"</div>}
                  </>) : (<div className="text-xs text-slate-400 text-center py-2">Sin apuesta</div>)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
