import { useState, useEffect, useMemo, useCallback } from "react";
import { useNow, nowISO, hashPassword, betsAreEqual, getSession } from "../utils.js";
import { DEFAULT_PASSWORD_HASH, MADRID_TZ } from "../config.js";
import { toast } from "../toast.jsx";
import { scoreForRace, computeGlobalStandings } from "../scoring.js";
import { Avatar } from "./Avatar.jsx";
import { SelectDriver } from "./BetForm.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { isAdminFor } from "../admin-roles.js";
import { adminF1 } from "../api.js";

export function Admin({db,setDb,races,drivers,teams,calendar,currentUser}){
  const [selected,setSelected]=useState(()=> (races&&races[0]?.key)||"");
  const [importText,setImportText]=useState("");
  const now=useNow();
  const [editName,setEditName]=useState("");
  const [editBet,setEditBet]=useState({pole:"",podium:["","",""],q:["","",""],late:false});
  const [qDateInput,setQDateInput]=useState("");
  const [qTimeInput,setQTimeInput]=useState("");
const [raceDateInput,setRaceDateInput]=useState("");
const [raceTimeInput,setRaceTimeInput]=useState("");
const [tzInput,setTzInput]=useState("");
const selectedRace=useMemo(()=>races?.find(r=>r.key===selected),[selected,races]);
const gpCancelled=!!selectedRace?.cancelled;
const baseCal=useMemo(()=>calendar?.find(r=>r.key===selected),[calendar,selected]);
// Compat: algunos navegadores podían tener código cacheado que refería a baseCalendar.
const baseCalendar=baseCal;
  useEffect(()=>{
    if(!selected && Array.isArray(races) && races.length){ setSelected(races[0].key); }
  },[selected,races]);
  useEffect(()=>{
    const baseBet=(selected && editName)?(db.bets?.[selected]?.[editName]||{}):{};
    setEditBet({
      pole:baseBet.pole||"",
      podium:[...(baseBet.podium||["","",""])],
      q:[...(baseBet.q||["","",""])],
      late:!!baseBet.late,
      delegated:!!baseBet.delegated,
    });
  },[selected,editName]);
  useEffect(()=>{
    const override=db.meta?.raceOverrides?.[selected]||{};
    const base=baseCal||{};
    const qDate=override.qDate || base.q_date_local || base.date_local || "";
    const qTime=override.qTime || base.qualifying_time_local || "";
    const raceDate=override.raceDate || base.race_date_local || base.date_local || "";
    const raceTime=override.raceTime || base.race_time_local || "";
    const tz=override.timezone || base.timezone || "";
    setQDateInput(qDate);
    setQTimeInput(qTime);
    setRaceDateInput(raceDate);
    setRaceTimeInput(raceTime);
    setTzInput(tz);
  },[selected,db.meta?.raceOverrides,baseCal]);
  const user=getSession()?.user||"";
  const participantNames=useMemo(()=>getParticipantsForPorra(db,"f1"),[db.participants,db.users]);
  const computedStandings=useMemo(()=>computeGlobalStandings(db,races,undefined,db.participants).map((row,idx)=>({name:row.name,points:row.points,rank:idx+1})),[db,races]);
  const manualStandingsExists=Object.keys(db.standings||{}).length>0;
  const standingsObject=useMemo(()=>{
    if(manualStandingsExists) return db.standings;
    return computedStandings.reduce((acc,item)=>{acc[item.name]={points:item.points,rank:item.rank}; return acc;},{});
  },[manualStandingsExists,db.standings,computedStandings]);
  const exportPayload=useMemo(()=>({...db, standings:standingsObject}),[db,standingsObject]);
  const exportJson=useMemo(()=>JSON.stringify(exportPayload,null,2),[exportPayload]);
  if(!isAdminFor(db.users?.[user], "f1")) return null;
  const driversText=(db.meta?.drivers||[]).join("\n");
  const teamsText=(db.meta?.teams||[]).join("\n");
  const driverList=(db.meta?.drivers?.length?db.meta.drivers:drivers)||[];
  const teamList=(db.meta?.teams?.length?db.meta.teams:teams)||[];
  const manualBets=db.betsWindow?.[selected];
  const manualReveal=db.betsReveal?.[selected];
  const historyLocked=selectedRace ? now < selectedRace.qStart : true;
  const historyForRace=historyLocked ? {} : (db.betHistory?.[selected]||{});
  const scoreAdjustments=db.scoreAdjustments?.[selected]||{};
  const currentRes=db.results?.[selected]||{pole:"",podium:["","",""],qAnswers:["","",""]};
  const updateRes=(updater)=>{ if(gpCancelled) return; setDb(prev=>{ const base=prev.results?.[selected]||{pole:"",podium:["","",""],qAnswers:["","",""]}; const next=updater({...base, podium:[...(base.podium||["","",""])], qAnswers:[...(base.qAnswers||["","",""])]}); return {...prev, results:{...(prev.results||{}), [selected]:next}}; }); };
  const setBetsOverride=(mode)=>{ if(gpCancelled) return toast.error("GP cancelado."); setDb(prev=>{ const map={...(prev.betsWindow||{})}; if(mode==="auto"){ delete map[selected]; return {...prev, betsWindow:map}; } map[selected]={forceOpen:mode==="open", forceClosed:mode==="close"}; return {...prev, betsWindow:map}; }); };
  const betsStatusLabel=manualBets?.forceOpen?"Abierto manualmente":manualBets?.forceClosed?"Cerrado manualmente":"Automático por horario";
  const setBetsReveal=(mode)=>{ if(!selected) return; if(gpCancelled) return toast.error("GP cancelado."); setDb(prev=>{ const map={...(prev.betsReveal||{})}; if(mode==="auto"){ delete map[selected]; return {...prev, betsReveal:map}; } map[selected]={forceShow:true}; return {...prev, betsReveal:map}; }); };
  const betsRevealLabel=manualReveal?.forceShow?"Publicadas manualmente":"Automático 1 min tras quali";
  const updateScoreAdjustment=(name,value)=>{ if(gpCancelled) return toast.error("GP cancelado — no se pueden ajustar puntos."); if(!selected) return; setDb(prev=>{ const adjustments={...(prev.scoreAdjustments||{})}; const raceMap={...(adjustments[selected]||{})}; if(!Number.isFinite(value) || value===0){ delete raceMap[name]; } else { raceMap[name]=value; } if(Object.keys(raceMap).length){ adjustments[selected]=raceMap; } else { delete adjustments[selected]; } return {...prev, scoreAdjustments:adjustments}; }); };
  const saveSchedule=()=>{
    if(gpCancelled) return toast.error("GP cancelado — no se edita horario.");
    if(!selected) return toast.error("Selecciona un GP");
    if(!qDateInput || !qTimeInput) return toast.error("Completa fecha y hora de quali");
    if(!raceDateInput || !raceTimeInput) return toast.error("Completa fecha y hora de carrera");
    const tzValue=tzInput || baseCal?.timezone || MADRID_TZ;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const overrides={...(meta.raceOverrides||{})};
      overrides[selected]={qDate:qDateInput,qTime:qTimeInput,raceDate:raceDateInput,raceTime:raceTimeInput,timezone:tzValue};
      return {...prev, meta:{...meta, raceOverrides:overrides}};
    });
    toast.success("Horario actualizado");
  };
  const resetSchedule=()=>{
    if(gpCancelled) return toast.error("GP cancelado.");
    if(!selected) return;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const overrides={...(meta.raceOverrides||{})};
      delete overrides[selected];
      if(Object.keys(overrides).length===0) delete meta.raceOverrides;
      else meta.raceOverrides=overrides;
      return {...prev, meta};
    });
    const base=baseCal||{};
    setQDateInput(base.q_date_local||base.date_local||"");
    setQTimeInput(base.qualifying_time_local||"");
    setRaceDateInput(base.race_date_local||base.date_local||"");
    setRaceTimeInput(base.race_time_local||"");
    setTzInput(base.timezone||"");
    toast("Horario restablecido al calendario");
  };
  const updateChampionship=(name,value)=>{
    const parsed=Math.max(0,Number.isNaN(value)?0:value);
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const champs={...(meta.championships||{})};
      champs[name]=parsed;
      return {...prev, meta:{...meta, championships:champs}};
    });
  };
  const [savingAdminBet,setSavingAdminBet]=useState(false);
  const saveAdminBet=async()=>{
    if(gpCancelled) return toast.error("GP cancelado — no se guardan apuestas.");
    if(!selected) return toast.error("Selecciona un GP");
    if(!editName) return toast.error("Elige un participante");
    if(savingAdminBet) return;
    const ts=nowISO();
    const nextBet={pole:editBet.pole||"", podium:[...(editBet.podium||["","",""])], q:[...(editBet.q||["","",""])], submittedAt:ts, late:!!editBet.late, adminEdited:true, delegated:!!editBet.delegated};
    setSavingAdminBet(true);
    try {
      await adminF1(selected, user, "bet", {userName:editName, bet:nextBet});
    } catch(err) {
      console.error("Error guardando apuesta delegada F1:", err);
      toast.error("Error al guardar en el servidor. Inténtalo de nuevo.");
      setSavingAdminBet(false);
      return;
    }
    setDb(prev=>{
      const raceBets={...(prev.bets?.[selected]||{})};
      const prevBet=raceBets[editName];
      const fullBet={...prevBet, ...nextBet};
      const nextBets={...(prev.bets||{}), [selected]:{...raceBets, [editName]:fullBet}};
      let betHistory=prev.betHistory||{};
      if(!prevBet || !betsAreEqual(prevBet,nextBet) || !!prevBet?.late!==!!nextBet.late){
        const raceHistory={...(betHistory[selected]||{})};
        const userLog=[...(raceHistory[editName]||[])];
        userLog.push({ts:ts,pole:fullBet.pole||"",podium:[...fullBet.podium],q:[...fullBet.q],late:fullBet.late,editedByAdmin:true,delegated:!!editBet.delegated});
        betHistory={...betHistory,[selected]:{...raceHistory,[editName]:userLog}};
      }
      return {...prev, bets:nextBets, betHistory};
    });
    setSavingAdminBet(false);
    toast.success(editBet.delegated ? `Apuesta delegada de ${editName} guardada (a tiempo)` : "Apuesta actualizada por admin");
  };
  const downloadBackup=()=>{
    const blob=new Blob([exportJson],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=`porra_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyBackup=()=>{
    if(typeof navigator!=="undefined" && navigator.clipboard?.writeText){
      navigator.clipboard.writeText(exportJson).then(()=>toast.success("JSON copiado al portapapeles"))
        .catch(()=>toast.error("No se pudo copiar automáticamente"));
    } else {
      if(typeof window!=="undefined") window.prompt("Copia manualmente el JSON", exportJson);
    }
  };
  const importFromText=()=>{
    if(!importText.trim()) return toast.error("Pega un JSON para importarlo");
    try{
      const parsed=JSON.parse(importText);
      if(typeof parsed!=="object" || parsed===null) throw new Error("Formato no válido");
      if(!parsed.users && !parsed.bets && !parsed.meta && !parsed.futbol) throw new Error("El JSON no parece un backup válido de la porra");
      setDb(parsed);
      setImportText("");
      toast.success("Backup importado. Revisa y exporta antes del próximo sync.");
    }catch(err){
      toast.error("JSON inválido: "+err.message);
    }
  };
  const handleBackupFile=(event)=>{
    const file=event.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const text=reader.result;
      if(typeof text==="string") setImportText(text);
    };
    reader.readAsText(file);
    event.target.value="";
  };
  return (<div className="card p-4 md:p-5 space-y-4">
    <h2 className="section-title">Administración F1</h2>
    <div className="border border-white/10 rounded p-3">
      <h3 className="font-semibold mb-2">Gran Premio seleccionado</h3>
      <div className="grid gap-2 md:grid-cols-[2fr,1fr] md:items-center">
        <select className="select border rounded px-3 py-2" value={selected} onChange={e=>setSelected(e.target.value)}>
          {(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix}{r.cancelled?" · CANCELADO":""}</option>)}
        </select>
        {selectedRace && (
          <div className="text-xs text-slate-300 space-y-1">
            <div>Quali: {selectedRace.q_date_local} · {selectedRace.labels?.qLocal||"—"} (Local) · {selectedRace.labels?.qMadrid||"—"} (España)</div>
            {selectedRace.labels?.raceLocal && <div>Carrera: {selectedRace.race_date_local} · {selectedRace.labels.raceLocal} (Local) · {selectedRace.labels.raceMadrid||"—"} (España)</div>}
          </div>
        )}
      </div>
    </div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Parrilla (pilotos) — desplegables</h3><textarea key={driversText} className="w-full h-40 select border rounded px-3 py-2" defaultValue={driversText} onBlur={(e)=>{ const lines=e.target.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); setDb(prev=>({...prev, meta:{...prev.meta, drivers:lines}})); toast.success("Lista de pilotos actualizada"); }}></textarea></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Escuderías (F1 2026)</h3><textarea key={teamsText} className="w-full h-40 select border rounded px-3 py-2" defaultValue={teamsText} onBlur={(e)=>{ const lines=e.target.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); setDb(prev=>({...prev, meta:{...prev.meta, teams:lines}})); toast.success("Lista de escuderías actualizada"); }}></textarea><p className="text-xs text-slate-400 mt-2">Una por línea. Usada para preguntas adicionales (ej. ¿Qué escudería ganará?).</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Horario del GP</h3>{selectedRace ? (<div className="text-sm text-slate-200 space-y-1 mb-3"><div>Quali local: {selectedRace.q_date_local} {selectedRace.labels?.qLocal||"—"} · España: {selectedRace.labels?.qMadrid||"—"}</div>{selectedRace.labels?.raceLocal && <div>Carrera local: {selectedRace.race_date_local} {selectedRace.labels.raceLocal} · España: {selectedRace.labels.raceMadrid||"—"}</div>}<div className="text-xs text-slate-400">Usa hora local del circuito; las horas de España se recalculan.</div></div>):(<p className="text-sm text-slate-300 mb-2">Selecciona un GP para editar su horario.</p>)}<div className="grid gap-2 md:grid-cols-2"><label className="text-sm">Fecha quali (local)</label><label className="text-sm">Hora quali (local)</label><input type="date" className="select border rounded px-3 py-2" value={qDateInput} onChange={e=>setQDateInput(e.target.value)} /><input type="time" className="select border rounded px-3 py-2" value={qTimeInput} onChange={e=>setQTimeInput(e.target.value)} /><label className="text-sm">Fecha carrera (local)</label><label className="text-sm">Hora carrera (local)</label><input type="date" className="select border rounded px-3 py-2" value={raceDateInput} onChange={e=>setRaceDateInput(e.target.value)} /><input type="time" className="select border rounded px-3 py-2" value={raceTimeInput} onChange={e=>setRaceTimeInput(e.target.value)} /></div><label className="text-sm mt-2 block">Zona horaria (IANA, ej. Europe/Madrid)</label><input className="select border rounded px-3 py-2 mb-2" placeholder={baseCal?.timezone||"Asia/Dubai"} value={tzInput} onChange={e=>setTzInput(e.target.value)} /><div className="flex flex-wrap gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={saveSchedule}>Guardar horario</button><button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={resetSchedule}>Volver al calendario</button></div><p className="text-xs text-slate-400 mt-2">El horario ajusta el cierre de apuestas y la publicación automática.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Resultados oficiales</h3><div className="grid gap-2"><label className="text-sm">Pole</label><SelectDriver value={currentRes.pole||""} onChange={(val)=>updateRes(prev=>({...prev, pole:val}))} drivers={driverList} placeholder="Selecciona piloto" /><label className="text-sm">Podio</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><SelectDriver key={i} value={currentRes.podium?.[i]||""} onChange={(val)=>updateRes(prev=>{ const next=[...(prev.podium||["","",""])]; next[i]=val; return {...prev, podium:next}; })} drivers={driverList} placeholder={`P${i+1}`} />)}</div><label className="text-sm">Respuestas a preguntas</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" value={currentRes.qAnswers?.[i]||""} onChange={e=>updateRes(prev=>{ const next=[...(prev.qAnswers||["","",""])]; next[i]=e.target.value; return {...prev, qAnswers:next}; })}/>)}</div><button className="mt-2 px-3 py-2 rounded bg-slate-900 text-white" onClick={()=>{ if(gpCancelled){ toast.error("GP cancelado — no se guardan resultados."); return;} setDb(prev=>({...prev, results:{...(prev.results||{}), [selected]:currentRes}})); toast.success("Resultados guardados (puedes guardar parciales)"); }}>Guardar</button></div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Control de apuestas</h3><p className="text-xs text-slate-400">Fuerza apertura o cierre sin depender del horario.</p><div className="flex flex-wrap gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={()=>setBetsOverride("open")}>Abrir</button><button className="px-3 py-2 rounded bg-red-700 text-white" onClick={()=>setBetsOverride("close")}>Cerrar</button><button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={()=>setBetsOverride("auto")}>Automático</button></div><div className="text-xs text-slate-300 mt-2">Estado actual: {betsStatusLabel}</div>{selectedRace && (<div className="text-xs text-slate-400 mt-1">Quedará automático 1 minuto antes de la quali ({selectedRace.labels?.qLocal||"—"} · España: {selectedRace.labels?.qMadrid||"—"})</div>)}<div className="mt-3 border border-white/5 rounded p-3 bg-neutral-900"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium text-sm">Publicar apuestas</div><div className="text-xs text-slate-400">Enséñalas antes de la hora de quali.</div></div><div className="flex flex-wrap gap-2"><button className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm" onClick={()=>setBetsReveal("show")}>Publicar ya</button><button className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm" onClick={()=>setBetsReveal("auto")}>Volver a automático</button></div></div><div className="text-xs text-slate-300 mt-2">Visibilidad: {betsRevealLabel}</div>{selectedRace && <div className="text-[11px] text-slate-500">Automático: 1 minuto después del inicio de quali ({selectedRace.labels?.qMadrid||"—"}).</div>}</div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Introducir / editar apuestas de participantes</h3><p className="text-xs text-slate-400 mb-3">Introduce apuestas de usuarios que las han enviado por otra vía (WhatsApp, email...) o edita las existentes. Las apuestas delegadas se guardan como dentro de tiempo y sin penalización.</p><div className="grid gap-2 md:grid-cols-[2fr,1fr]"><select className="select border rounded px-3 py-2" value={editName} onChange={e=>setEditName(e.target.value)}><option value="">— Elige participante —</option>{participantNames.map(n=><option key={n} value={n}>{n}</option>)}</select><div className="space-y-1"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="f1BetTiming" checked={!!editBet.delegated && !editBet.late} onChange={()=>setEditBet(prev=>({...prev, late:false, delegated:true}))} /><span className="text-emerald-300">Apuesta delegada (a tiempo, sin penalización)</span></label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="f1BetTiming" checked={!editBet.late && !editBet.delegated} onChange={()=>setEditBet(prev=>({...prev, late:false, delegated:false}))} /><span>Dentro de plazo</span></label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="f1BetTiming" checked={!!editBet.late} onChange={()=>setEditBet(prev=>({...prev, late:true, delegated:false}))} /><span className="text-amber-300">Fuera de plazo (-2 pts)</span></label></div></div><div className="grid gap-2 mt-3"><label className="text-sm">Pole</label><SelectDriver value={editBet.pole} onChange={(val)=>setEditBet(prev=>({...prev, pole:val}))} drivers={driverList} placeholder="Selecciona piloto" /><label className="text-sm">Podio</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><SelectDriver key={i} value={editBet.podium?.[i]||""} onChange={(val)=>setEditBet(prev=>{ const next=[...(prev.podium||["","",""])]; next[i]=val; return {...prev, podium:next}; })} drivers={driverList} placeholder={`P${i+1}`} />)}</div><label className="text-sm">Preguntas adicionales</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" value={editBet.q?.[i]||""} onChange={e=>setEditBet(prev=>{ const next=[...(prev.q||["","",""])]; next[i]=e.target.value; return {...prev, q:next}; })} placeholder={`Respuesta ${i+1}`}/>)}</div><button className="mt-2 px-3 py-2 rounded bg-emerald-700 text-white disabled:opacity-50" onClick={saveAdminBet} disabled={savingAdminBet}>{savingAdminBet?"Guardando...":"Guardar apuesta"}</button></div>{editBet.delegated && <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">Esta apuesta se guardará como delegada: dentro de tiempo, válida y sin penalización por retraso.</div>}</div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Ajustes manuales de puntuación ({selected||"—"})</h3><p className="text-xs text-slate-400 mb-2">Suma o resta puntos de esta carrera. Afecta ranking, detalle y estadísticas.</p><div className="grid gap-2 md:grid-cols-2">{participantNames.map(name=>{ const val=Number(scoreAdjustments[name]||0); return (<label key={name} className="flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900 text-sm"><span>{name}</span><input type="number" className="w-24 text-right select border rounded px-2 py-1" value={val} onChange={e=>{ const parsed=parseInt(e.target.value,10); updateScoreAdjustment(name, Number.isNaN(parsed)?0:parsed); }} /></label>); })}</div><p className="text-[11px] text-slate-500 mt-2">Deja en 0 para eliminar ajustes.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Autor y publicación de preguntas</h3><p className="text-xs text-slate-400 mb-2">Orden cíclico por clasificación de la temporada anterior</p><div className="flex gap-2 items-center"><span className="text-sm">Autor asignado:</span><select className="select border rounded px-3 py-2" disabled={gpCancelled} value={db.questionOwner?.[selected]||""} onChange={e=>setDb(prev=>({...prev, questionOwner:{...(prev.questionOwner||{}), [selected]:e.target.value}}))}><option value="">— Sin asignar —</option>{Object.keys(db.participants||{}).map(n=><option key={n} value={n}>{n}</option>)}</select></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" disabled={gpCancelled} placeholder={`Pregunta ${i+1}`} value={(db.questions?.[selected]?.[i]||"")} onChange={e=>{const val=e.target.value; setDb(prev=>{const curr=prev.questions?.[selected]||["","",""]; const next=[...curr]; next[i]=val; return {...prev, questions:{...(prev.questions||{}), [selected]: next}};});}}/>)}</div><div className="flex flex-wrap items-center gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-emerald-700 text-white disabled:opacity-40" disabled={gpCancelled} onClick={()=>{ setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), published:true, force:true}}})); toast.success("Publicación forzada"); }}>Forzar publicar</button><button type="button" className="px-3 py-2 rounded bg-gray-700 text-white disabled:opacity-40" disabled={gpCancelled} onClick={()=>{ setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), published:false, force:false}}})); toast("Despublicado"); }}>Despublicar</button><button type="button" className="px-3 py-2 rounded bg-red-700 text-white disabled:opacity-40" disabled={gpCancelled} onClick={()=>{ const v=!(db.questionsStatus?.[selected]?.locked); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), locked:v}}})); toast(v?"Edición bloqueada":"Edición desbloqueada"); }}>{db.questionsStatus?.[selected]?.locked ? "Desbloquear edición" : "Bloquear edición"}</button><button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>{ if(!confirm("¿Borrar preguntas de Las Vegas, Qatar y Abu Dhabi (GP 22–24)? Son datos de 2025 que no deberían mostrarse en 2026.")) return; const keys=["las_vegas","qatar","abu_dhabi"]; setDb(prev=>{ const q={...(prev.questions||{})}; const qs={...(prev.questionsStatus||{})}; const qo={...(prev.questionOwner||{})}; keys.forEach(k=>{ delete q[k]; delete qs[k]; delete qo[k]; }); return {...prev, questions:q, questionsStatus:qs, questionOwner:qo}; }); toast.success("Preguntas de GP 22–24 borradas"); }}>Limpiar GP 22–24 (legacy)</button></div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Historial de apuestas ({selected||"—"})</h3>{historyLocked ? (
      <p className="text-sm text-slate-300">Disponible al inicio de la quali ({selectedRace?.labels?.qMadrid||"hora España"}).</p>
    ) : Object.keys(historyForRace).length ? (
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {Object.entries(historyForRace).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,logs])=>{
          const list=Array.isArray(logs)?logs:[];
          const ordered=[...list].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
          return (
            <div key={name} className="border border-white/10 rounded px-3 py-2 bg-neutral-900">
              <div className="font-medium mb-1">{name}</div>
              <ul className="text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto pr-2">
                {ordered.map((entry,idx)=>{ const timeLabel=entry?.ts?new Date(entry.ts).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—"; return (<li key={idx} className="border border-white/5 rounded px-2 py-1">
                  <div className="flex items-center justify-between gap-1"><span>{timeLabel}</span>{entry?.delegated && <span className="text-xs px-1 rounded bg-sky-500/15 text-sky-300 border border-sky-500/20">Delegada</span>}{entry?.late && <span className="text-xs uppercase text-amber-300">Tarde</span>}{entry?.editedByAdmin && !entry?.delegated && <span className="text-xs text-slate-400">Admin</span>}</div>
                  <div>Pole: {entry.pole||"—"}</div>
                  <div>Podio: {(entry.podium||["","",""]).join(" · ")}</div>
                  <div>P.Adic.: {(entry.q||["","",""]).join(" · ")}</div>
                </li>); })}
              </ul>
            </div>
          );
        })}
      </div>
    ) : (<p className="text-sm text-slate-300">Sin movimientos registrados para este GP.</p>)}<p className="text-xs text-slate-400 mt-2">Se guarda cada vez que alguien actualiza su apuesta.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Campeonatos mundiales</h3><p className="text-xs text-slate-400 mb-3">Estos valores alimentan el ranking extra de títulos.</p>{participantNames.length?(<div className="space-y-2 max-h-64 overflow-y-auto">{participantNames.map(name=>{ const value=db.meta?.championships?.[name]??0; return (<div key={name} className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2 bg-neutral-900"><span className="font-medium">{name}</span><input type="number" min="0" className="w-20 text-center select border rounded px-2 py-1" value={value} onChange={e=>{ const next=parseInt(e.target.value,10); updateChampionship(name, Number.isNaN(next)?0:next); }} /></div>); })}</div>):(<p className="text-sm text-slate-300">No hay participantes para mostrar.</p>)}</div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Puntos base (backup inicial)</h3><p className="text-xs text-slate-400 mb-3">Se suman al cálculo automático del ranking global. Úsalos si vienes de un backup.</p><div className="flex flex-wrap gap-2 mb-3"><button type="button" className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm" onClick={()=>{ setDb(prev=>({...prev, meta:{...(prev.meta||{}), basePoints:Object.fromEntries(participantNames.map(n=>[n,0])), forceAutoStandings:true}})); }}>Poner todos a 0</button></div><div className="grid gap-2 md:grid-cols-2 max-h-64 overflow-y-auto">{participantNames.map(name=>{ const val=Number(db.meta?.basePoints?.[name]||0); return (<div key={name} className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2 bg-neutral-900 text-sm"><span className="font-medium">{name}</span><input type="number" className="w-20 text-right select border rounded px-2 py-1" value={val} onChange={e=>{ const parsed=parseInt(e.target.value,10); const v=Number.isNaN(parsed)?0:parsed; setDb(prev=>{ const meta=prev.meta||{}; const base={...(meta.basePoints||{})}; base[name]=v; return {...prev, meta:{...meta, basePoints:base}}; }); }} /></div>); })}</div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Backup antes del sync</h3><p className="text-xs text-slate-400">Descarga o copia el JSON antes de sincronizar con S3 y vuélvelo a importar después.</p><div className="flex flex-wrap gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={downloadBackup}>Descargar JSON</button><button type="button" className="px-3 py-2 rounded bg-slate-800 text-white" onClick={copyBackup}>Copiar JSON</button></div><textarea className="w-full h-32 select border rounded px-3 py-2 mt-3" placeholder="Pega aquí el JSON que quieres importar" value={importText} onChange={e=>setImportText(e.target.value)}></textarea><div className="flex flex-wrap items-center gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-slate-900 text-white" onClick={importFromText}>Importar JSON</button><label className="cursor-pointer text-sm text-slate-200"><span className="inline-block px-3 py-2 rounded bg-slate-800 text-white">Cargar archivo</span><input type="file" accept="application/json" className="hidden" onChange={handleBackupFile} /></label></div></div>
  </div>);
}
