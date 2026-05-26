import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNow, nowISO, shareBet, betsAreEqual, formatDateTime, formatTime } from "../utils.js";
import { CURRENT_SEASON_YEAR, MADRID_TZ, REAL_HISTORICAL_2025_KEYS } from "../config.js";
import { isKnownCancelledF1Key } from "../f1-cancelled-keys.js";
import { loadHistorical, saveBetF1 } from "../api.js";
import { toast } from "../toast.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { scoreForRace, hasRaceResults, isRaceCancelled } from "../scoring.js";
import { Avatar } from "./Avatar.jsx";
import { CircuitCard } from "./CircuitCard.jsx";
import { BetForm } from "./BetForm.jsx";
import { CountdownBadge } from "./CountdownBadge.jsx";
import { fireConfetti } from "../confetti.js";

export function Participante({user,races,db,setDb,drivers,circuits,selectedRaceKey,setSelectedRaceKey}){
  const now=useNow();
  const selected=selectedRaceKey||"";
  const setSelected=setSelectedRaceKey||(()=>{});
  const race=races?.find(r=>r.key===selected);
  const [showOthers,setShowOthers]=useState(false);
  const [historicalPrev,setHistoricalPrev]=useState(null);
  useEffect(()=>{
    if(races?.length){
      const valid=races.some(r=>r.key===selected);
      if(!selected||!valid){
        const nowMs=Date.now();
        const upcoming=races.find(r=>!r.cancelled && r.cutoff && r.cutoff.getTime()>nowMs);
        setSelected(upcoming?.key || races.filter(r=>!r.cancelled).pop()?.key || races[races.length-1].key);
      }
    }
  },[races,selected]);
  useEffect(()=>{ if(selected) sessionStorage.setItem("porra_selected_race",selected); },[selected]);
  useEffect(()=>{ loadHistorical(CURRENT_SEASON_YEAR-1).then(setHistoricalPrev).catch(()=>setHistoricalPrev(null)); },[]);
  useEffect(()=>{ if(!race) setShowOthers(false); },[race]);
  const prevYearResult=race && historicalPrev?.resultsByKey?.[race.key];
  const prevYearPoints=race && historicalPrev?.pointsByKey?.[race.key]?.[user];
  const last3RacesDisplay=useMemo(()=>{
    const nowMs=Date.now();
    const withResults=(races||[]).filter(r=>hasRaceResults(db.results?.[r.key],r) && r.raceStart && r.raceStart.getTime()<nowMs).sort((a,b)=>b.round-a.round).slice(0,3).map(r=>({race:r,score:scoreForRace(db,r.key,user,r),hasData:true}));
    if(withResults.length>0) return withResults;
    return (races||[]).slice(0,3).map(r=>({race:r,score:null,hasData:false}));
  },[races,db.results,db.bets,user]);
  const bet=race?(db.bets?.[race.key]?.[user]||{pole:"",podium:["","",""],q:["","",""],submittedAt:null,late:false}):null;
  const owner=race?(db.questionOwner?.[race.key]||""):""; const questions=race?(db.questions?.[race.key]||["","",""]):["","",""];
  const manualWindow=race ? db.betsWindow?.[race.key] : null;
  const manualReveal=race ? db.betsReveal?.[race.key] : null;
  const isBeforeCutoff=race && now<race.cutoff;
  const isLate=race && !isBeforeCutoff;
  const raceResult=race ? db.results?.[race.key] : null;
  /** Incluye isKnownCancelledF1Key: no depende solo de scoring si config.local sustituye config en el build. */
  const raceOff=race ? (isRaceCancelled(raceResult, race) || isKnownCancelledF1Key(race.key)) : false;
  const hasResult=hasRaceResults(raceResult, race);
  const canEdit=race ? (!manualWindow?.forceClosed && !hasResult && !raceOff) : false;
  const isAdmin=!!db.users?.[user]?.isAdmin;
  const canViewFull=race && (manualReveal?.forceShow || now>race.showBetsAt);
  const showStatusOnly=isAdmin && race && !canViewFull;
  const f1Participants=useMemo(()=>getParticipantsForPorra(db,"f1"),[db.participants,db.users]);
  const others=f1Participants.filter(n=>n!==user).map(name=>({name,bet:race?db.bets?.[race.key]?.[name]:null}));
  const driverList=(db.meta?.drivers&&db.meta.drivers.length)?db.meta.drivers:drivers; const authorDeadline = race ? race.authorCutoff : null;
  const [savingF1, setSavingF1] = useState(false);
  const savingF1Ref = useRef(false);
  const handleBetSubmit=useCallback(async(b)=>{
    if (race && (isRaceCancelled(raceResult, race) || isKnownCancelledF1Key(race.key))) {
      toast.error("Gran Premio cancelado: no se admiten apuestas ni penalizaciones.");
      throw new Error("cancelled");
    }
    const late=new Date()>=race?.cutoff;
    const timestamp=nowISO();
    const rk=race?.key; if(!rk || savingF1Ref.current) throw new Error("busy");
    const nextBet={...b,submittedAt:timestamp,late};
    setSavingF1(true); savingF1Ref.current = true;
    try {
      await saveBetF1(rk, user, nextBet, race?.cutoff?.toISOString());
    } catch(err) {
      console.error("[BET_F1_FAIL]", JSON.stringify({ user, raceKey: rk, error: err.message, status: err.status, ts: new Date().toISOString() }));
      toast.error(err.message === "Sesión expirada" ? "Sesión expirada. Recarga la página." : "Error al guardar la apuesta. Inténtalo de nuevo.");
      setSavingF1(false); savingF1Ref.current = false;
      throw err;
    }
    setDb(prev=>{
      const prevRaceBets={...(prev.bets?.[rk]||{})};
      const prevBet=prevRaceBets[user];
      const nextBets={...(prev.bets||{}), [rk]:{...prevRaceBets, [user]:nextBet}};
      let betHistory=prev.betHistory||{};
      if(!prevBet || !betsAreEqual(prevBet,b)){
        const raceHistory={...(betHistory[rk]||{})};
        const userLog=[...(raceHistory[user]||[])];
        userLog.push({ts:timestamp,pole:b.pole||"",podium:[...(b.podium||["","",""])],q:[...(b.q||["","",""])],late});
        betHistory={...betHistory,[rk]:{...raceHistory,[user]:userLog}};
      }
      return {...prev, bets:nextBets, betHistory};
    });
    if(late){toast.warn("Apuesta registrada (fuera de plazo: penalización -2 pts)");}else{toast.success("Apuesta guardada correctamente");fireConfetti();}
    setSavingF1(false); savingF1Ref.current = false;
  },[race?.key,race?.cutoff,raceResult,race,user,setDb]);
  const betsStatus=race ? (raceOff?"Cancelado (no puntúa)":hasResult?"Cerrado (resultados publicados)":manualWindow?.forceClosed?"Cerrado por admin":isLate?"Fuera de plazo (penalización -2 pts)":manualWindow?.forceOpen?"Abierto por admin":"Abierto") : "—";
  const betCount=useMemo(()=>{
    if(!race) return {done:0,total:0};
    const betsForRace=db.bets?.[race.key]||{};
    const done=f1Participants.filter(n=>betsForRace[n]?.submittedAt).length;
    return {done,total:f1Participants.length};
  },[race?.key,db.bets,f1Participants]);
  const showOthersPanel=showOthers && !!race;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]":"";
  return (<div className={`grid gap-4 ${layoutCols}`}>
    <div className="card card-racing p-4 md:p-5 min-w-0">
      {race && raceOff && (
        <div className="mb-4 p-4 rounded-2xl border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/90 via-neutral-950/95 to-neutral-900 shadow-[0_0_24px_-4px_rgba(245,158,11,0.35)]" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-2xl" aria-hidden>⛔</span>
            <span className="text-lg font-black tracking-tight text-amber-100">Gran Premio cancelado</span>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-200 border border-amber-400/40">No puntúa</span>
          </div>
          <p className="text-sm text-amber-100/90 leading-relaxed">
            <strong className="text-white">{race.grand_prix}</strong> no se disputa: no hay apuestas, preguntas ni puntos para esta carrera. Elige otro GP en el desplegable.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title flex flex-wrap items-center gap-2">
            🏁 Tu apuesta
            {raceOff && <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/35">GP cancelado</span>}
            <span className="text-xs opacity-40 font-normal">· que te inviten a birras</span>
          </h2>
        {race && (<button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar":"👀 Ver otras apuestas"}</button>)}
      </div>
      <select className="select select-strong border rounded px-3 py-2 mb-3 w-full" value={selected} onChange={e=>setSelected(e.target.value)} aria-label="Elegir Gran Premio">{(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix} — {r.date_local}{(r.cancelled||isKnownCancelledF1Key(r.key))?" · CANCELADO":""}</option>)}</select>
      {race && !raceOff && betCount.total>0 && !hasResult && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{width:`${(betCount.done/betCount.total)*100}%`,background:betCount.done===betCount.total?"#22c55e":"linear-gradient(90deg,#f59e0b,#e10600)"}}></div>
          </div>
          <span className={`font-semibold whitespace-nowrap ${betCount.done===betCount.total?"text-emerald-400":"text-amber-300/70"}`}>
            {betCount.done===betCount.total?"✓ Todos han apostado":`${betCount.done}/${betCount.total} han apostado`}
          </span>
        </div>
      )}
      {race && !raceOff && (<>
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/10 via-sky-900/5 to-transparent border border-sky-500/20 p-4 text-center group hover:border-sky-400/35 transition-all">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-sky-400/[.03] to-transparent pointer-events-none"></div>
            <div className="relative">
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🏁</div>
              <div className="text-[10px] uppercase tracking-[.15em] text-sky-300/60 font-bold mb-2">Clasificación</div>
              <div className="text-base font-black text-sky-200 leading-tight">{race.labels?.qMadrid||"—"}</div>
              <div className="text-[10px] text-sky-300/40 mt-1 font-medium">🇪🇸 hora España</div>
              {race.labels?.qLocal && race.timeZone!==MADRID_TZ && <div className="text-[10px] text-white/25 mt-1">{race.labels.qLocal} (local)</div>}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-500/12 via-red-900/5 to-transparent border border-red-500/20 p-4 text-center group hover:border-red-400/35 transition-all">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/[.03] to-transparent pointer-events-none"></div>
            <div className="relative">
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🏎️</div>
              <div className="text-[10px] uppercase tracking-[.15em] text-red-300/60 font-bold mb-2">Carrera</div>
              {race.labels?.raceMadrid ? (<>
                <div className="text-base font-black text-red-200 leading-tight">{race.labels.raceMadrid}</div>
                <div className="text-[10px] text-red-300/40 mt-1 font-medium">🇪🇸 hora España</div>
                {race.labels?.raceLocal && race.timeZone!==MADRID_TZ && <div className="text-[10px] text-white/25 mt-1">{race.labels.raceLocal} (local)</div>}
              </>) : <div className="text-sm text-white/25 italic">Por confirmar</div>}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-900/5 to-transparent border border-amber-500/20 p-4 text-center group hover:border-amber-400/35 transition-all">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-amber-400/[.03] to-transparent pointer-events-none"></div>
            <div className="relative">
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">❓</div>
              <div className="text-[10px] uppercase tracking-[.15em] text-amber-300/60 font-bold mb-2">Preguntas</div>
              <div className="text-sm font-bold text-amber-200">{owner||"Sin asignar"}</div>
              {db.questionsStatus?.[race.key]?.published
                ? <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-semibold">✓ Publicadas</span>
                : <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 font-semibold">Pendientes</span>}
              {authorDeadline && <div className="text-[10px] text-white/25 mt-1.5">Cierre: {formatTime(authorDeadline,MADRID_TZ)}</div>}
            </div>
          </div>
        </div>
        {(()=>{
          const noBet=!raceOff && !bet?.submittedAt && canEdit && race.cutoff && race.cutoff.getTime()>Date.now();
          const hoursLeft=race.cutoff?Math.max(0,(race.cutoff.getTime()-Date.now())/3600000):999;
          const urgent=noBet && hoursLeft<24;
          return (
            <div className={`mb-4 p-3 rounded-xl relative overflow-hidden ${urgent?"bg-gradient-to-r from-red-500/12 to-amber-500/8 border border-red-500/25":noBet?"bg-gradient-to-r from-amber-500/8 to-sky-500/5 border border-amber-500/15":"bg-white/[.025] border border-white/[.06]"}`}>
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${urgent?"from-red-500/60 via-amber-500/40 to-transparent":noBet?"from-amber-500/30 via-sky-500/20 to-transparent":"from-transparent via-red-500/30 to-transparent"}`}></div>
              {noBet && (
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{urgent?"🔥":"🏁"}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${urgent?"text-red-300":"text-amber-200"}`}>{urgent?`¡Solo quedan ${hoursLeft<1?`${Math.ceil(hoursLeft*60)} minutos`:Math.ceil(hoursLeft)+" horas"}!`:"¡Apuesta disponible!"}</div>
                    <div className="text-xs text-white/50 mt-0.5">{urgent?"No apostar son -3 pts. ¡Rellena el formulario!":"Rellena tu apuesta antes del cierre. ¡Que te inviten a las birras!"}</div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-bold text-white/85">⏰ Cierre:</span>
                  <span className="text-amber-300 font-bold text-lg tabular-nums">{formatTime(race.cutoff,MADRID_TZ)}</span>
                  <span className="text-amber-100 text-xs">(España)</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span><span className="text-slate-400">Estado:</span> <span className={betsStatus.includes("Abierto")?"text-emerald-300":"text-slate-300"}>{betsStatus}</span></span>
                  <span><span className="text-slate-400">Visibilidad:</span> <span className="text-slate-300">{manualReveal?.forceShow?"Publicadas por admin":"Ocultas hasta quali"}</span></span>
                </div>
              </div>
              <CountdownBadge target={race.cutoff}/>
            </div>
          );
        })()}
      </>)}
      {race && !raceOff && owner===user && !db.questionsStatus?.[race.key]?.published && (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-red-500/[.06] border border-amber-400/25 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400/40 via-red-400/30 to-transparent"></div>
          <div className="flex items-start gap-2.5">
            <span className="text-2xl mt-0.5">📝</span>
            <div>
              <div className="font-bold text-amber-200">¡Te toca poner las preguntas!</div>
              <div className="text-sm text-amber-300/70 mt-0.5">Eres el autor de las preguntas del <b className="text-amber-200">{race.grand_prix}</b>. Escríbelas y publícalas antes del cierre.</div>
              {authorDeadline && <div className="text-xs text-white/35 mt-1">Límite: {formatDateTime(authorDeadline,MADRID_TZ)} (España)</div>}
            </div>
          </div>
        </div>
      )}
      {race && !raceOff && owner===user && authorDeadline && now<authorDeadline && !(db.questionsStatus?.[race.key]?.locked) && (
        <div className="mb-3 space-y-2 bg-neutral-900 border border-white/10 rounded p-3">
          <div className="text-xs text-slate-300">✏️ Editor de preguntas (hasta 24h antes de quali)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=>(<input key={i} className="select border rounded px-3 py-2 w-full" placeholder={"Pregunta "+(i+1)} value={(db.questions?.[race.key]?.[i]||"")} onChange={e=>{const curr=db.questions?.[race.key]||["","",""]; const next=[...curr]; next[i]=e.target.value; setDb(prev=>({...prev, questions:{...(prev.questions||{}), [race.key]: next}})); }}/>))}</div>
          <div className="flex gap-2">{!db.questionsStatus?.[race.key]?.published ? (<button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={()=>{ const list=(db.questions?.[race.key]||["","",""]); if(list.some(q=>!q||!q.trim())) return toast.error("Rellena las 3 preguntas"); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [race.key]:{published:true, author:user, publishedAt:new Date().toISOString()}}})); toast.success("Publicado"); }}>Publicar</button>):(<button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>{ const list=(db.questions?.[race.key]||["","",""]); if(list.some(q=>!q||!q.trim())) return toast.error("Rellena las 3 preguntas"); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [race.key]:{...prev.questionsStatus[race.key], updatedAt:new Date().toISOString()}}})); toast.success("Actualizado"); }}>Actualizar</button>)}</div>
        </div>
      )}
      {race && !raceOff && isLate && canEdit && (
        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30">
          <div className="font-semibold text-amber-200">⚠️ Apuesta fuera de plazo</div>
          <div className="text-sm text-amber-300/80 mt-1">El plazo de apuestas ha cerrado. Puedes apostar igualmente, pero se aplicará una <b>penalización de -2 puntos</b>. No apostar supone <b>-3 puntos</b>.</div>
        </div>
      )}
      {race && !raceOff && <BetForm key={race.key} bet={bet} disabled={!canEdit||savingF1} canEdit={canEdit&&!savingF1} late={isLate} questions={((db.questionsStatus?.[race.key]?.published||db.questionsStatus?.[race.key]?.force)?(questions||["","",""]):["","",""])} drivers={driverList} onSubmit={handleBetSubmit}/>}
      {race && !raceOff && bet?.submittedAt && <button className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors" onClick={()=>{
        const qs=questions||["","",""];
        const lines=[`🏎️ Porra Birreros — ${race.grand_prix}`,`📋 Apuesta de ${user}:`,bet.pole?`🏁 Pole: ${bet.pole}`:"",bet.podium?.filter(Boolean).length?`🥇🥈🥉 Podio: ${bet.podium.filter(Boolean).join(", ")}`:""];
        if(bet.q?.some(Boolean)){
          lines.push("❓ Preguntas:");
          bet.q.forEach((a,i)=>{if(a) lines.push(`  ${i+1}. ${qs[i]?qs[i]+": ":""}${a}`);});
        }
        shareBet(lines.filter(Boolean).join("\n"));
      }}>📤 Compartir apuesta</button>}
      {race && prevYearResult && REAL_HISTORICAL_2025_KEYS.includes(race.key) && (
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">📋 Resultado año anterior ({race.grand_prix} {CURRENT_SEASON_YEAR-1})</h3>
          <div className="text-sm text-slate-300 space-y-1">
            <div>Pole: <span className="text-emerald-300">{prevYearResult.pole||"—"}</span></div>
            <div>Podio: <span className="text-emerald-300">{(prevYearResult.podium||[]).join(" · ")}</span></div>
            {(prevYearResult.qAnswers||[]).length>0 && <div>Preguntas: <span className="text-amber-200">{(prevYearResult.qAnswers||[]).join(" · ")}</span></div>}
          </div>
        </div>
      )}
      {last3RacesDisplay.some(r=>r.hasData) && (
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">🏁 Últimos 3 GP de esta temporada</h3>
          <div className="space-y-2">
            {last3RacesDisplay.filter(r=>r.hasData).map(({race:rc})=>{
              const res=db.results?.[rc.key];
              if(!hasRaceResults(res,rc)) return null;
              return (
                <div key={rc.key} className="text-sm border-b border-slate-600/40 pb-2 last:border-0 last:pb-0">
                  <div className="font-medium text-slate-200">{rc.round}. {rc.grand_prix}</div>
                  <div className="text-xs text-slate-400">Pole: {res.pole||"—"} · Podio: {(res.podium||[]).join(" · ")} · Preg: {(res.qAnswers||[]).join(" · ")}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {race && prevYearPoints!=null && REAL_HISTORICAL_2025_KEYS.includes(race.key) && (
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">🏆 Tus puntos en este circuito ({CURRENT_SEASON_YEAR-1})</h3>
          <div className="text-lg font-bold text-emerald-300">{prevYearPoints} pts</div>
          <p className="text-xs text-slate-400 mt-1">Puntos que conseguiste en {race.grand_prix} la temporada pasada</p>
        </div>
      )}
      {last3RacesDisplay.length>0 && (
        <div className="mt-4 border border-white/10 rounded p-3 bg-neutral-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Puntos por carrera</h3>
            <span className="text-xs text-slate-400">Incluye bonus/penalizaciones</span>
          </div>
          <div className="space-y-2">
            {last3RacesDisplay.map(({race:rc,score,hasData})=>(
              <div key={rc.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-white/5 rounded px-2 py-2">
                <div className="text-sm font-medium">{rc.round}. {rc.grand_prix}</div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold">{hasData ? `${score.points} pts` : '—'}</span>
                  <span className="text-xs text-slate-300">Aciertos: {hasData ? score.hits : '—'}</span>
                  <span className="text-xs text-slate-300">Exactos: {hasData ? score.exact : '—'}</span>
                  {hasData && score.pen>0 && <span className="text-xs text-amber-300">Pen: {score.pen}</span>}
                  {hasData && score.manualAdj!==0 && <span className="text-xs text-emerald-300">Ajuste: {score.manualAdj>0?`+${score.manualAdj}`:score.manualAdj}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {race && <div className="md:hidden mt-4"><CircuitCard race={race} circuits={circuits}/></div>}
    </div>
    {showOthersPanel && (<div className="card p-4 md:min-w-[220px] md:max-w-[320px] self-start"><h2 className="section-title mb-4">Apuestas de otros {showStatusOnly && <span className="text-xs text-emerald-300">(estado admin)</span>}</h2>
      {!race && <p className="text-sm text-slate-300">Selecciona un GP para ver apuestas.</p>}
      {race && showStatusOnly && (
        <ul className="space-y-2">
          {others.map(({name,bet})=>(<li key={name} className="border border-white/10 rounded p-3 bg-neutral-900 flex items-center gap-3">
            <Avatar name={name} avatar={db.meta?.avatars?.[name]} avatarFutbol={db.meta?.avatarsFutbol?.[name]} size="sm" mode="f1"/>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-slate-400">{bet?(bet.submittedAt?`Enviada ${new Date(bet.submittedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"Enviada"):"Sin apuesta"}</div>
            </div>
            {bet?.late && <span className="text-xs text-amber-300">Fuera de plazo</span>}
            {bet?.delegated && <span className="text-xs text-sky-300">Delegada</span>}
          </li>))}
        </ul>
      )}
      {race && !showStatusOnly && !canViewFull && <p className="text-sm text-slate-300">Se verán 1 minuto después del inicio de la quali (o si el admin las publica antes).</p>}
      {race && canViewFull && (
        <ul className="space-y-2">
          {others.map(({name,bet})=>(<li key={name} className="border border-white/10 rounded p-3 bg-neutral-900 flex items-start gap-3"><Avatar name={name} avatar={db.meta?.avatars?.[name]} avatarFutbol={db.meta?.avatarsFutbol?.[name]} size="sm" mode="f1"/><div className="flex-1 min-w-0"><div className="font-medium">{name}</div>{bet?<div className="text-sm"><div><b>Pole:</b> {bet.pole||"—"}</div><div><b>Podio:</b> {(bet.podium||["","",""]).join(" · ")}</div><div><b>P.Adic.:</b> {(bet.q||["","",""]).join(" · ")}</div>{bet.trashtalk?.trim() && <div className="mt-2 pt-2 border-t border-amber-500/20 text-xs text-amber-200/95 leading-snug">💬 <span className="italic">«{bet.trashtalk.trim()}»</span></div>}</div>:<div className="text-xs text-slate-400">Sin apuesta</div>}</div></li>))}
        </ul>
      )}
    </div>)}
  </div>);
}
