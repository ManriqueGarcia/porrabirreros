import { useState, useEffect, useMemo, useCallback } from "react";
import { useNow, nowISO, parseLocalDateTime, toLocalDateTimeInput, nextFridayAt2100, betsAreEqual } from "../utils.js";
import { toast } from "../toast.jsx";
import { scoreFutbolJornada, listFutbolJornadas, defaultFutbolState, computeDeadlineFromKickoffs } from "../futbol-utils.js";
import { FUTBOL_BASE_TEAMS } from "../config.js";
import { Avatar } from "./Avatar.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { isAdminFor } from "../admin-roles.js";
import { adminFutbol, saveResultFutbol } from "../api.js";

export function FutbolAdmin({db,setDb,currentUser}){
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const [selected,setSelected]=useState(()=>jornadas[0]?.id||"");
  const [jId,setJId]=useState("");
  const [jName,setJName]=useState("");
  const [deadlineInput,setDeadlineInput]=useState(()=>toLocalDateTimeInput(nextFridayAt2100()));
  const [laligaMatchdayInput,setLaligaMatchdayInput]=useState("");
  const [matches,setMatches]=useState(()=>FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
  const [scores,setScores]=useState(()=>matches.map(()=>({home:"",away:""})));
  const [editUser,setEditUser]=useState("");
  const [editLate,setEditLate]=useState(false);
  const [editDelegated,setEditDelegated]=useState(false);
  const [editingMode,setEditingMode]=useState("results"); // "results" or "bet"
  useEffect(()=>{
    const j=selected?futbol.jornadas?.[selected]:null;
    if(j){
      setJId(j.id);
      setJName(j.name||j.id);
      setDeadlineInput(toLocalDateTimeInput(j.deadline?new Date(j.deadline):nextFridayAt2100()));
      setLaligaMatchdayInput(j.laligaMatchday!=null&&j.laligaMatchday!==""?String(j.laligaMatchday):"");
      const baseMatches=(j.matches?.length?j.matches:FUTBOL_BASE_TEAMS.map(team=>({home:team,away:"",kickoff:""})));
      setMatches(baseMatches);
      if(editingMode==="results"){
        const res=futbol.results?.[j.id];
        setScores((res?.matches?.length?res.matches:baseMatches.map(()=>({home:"",away:""}))).map(m=>({home:m.home==null?"":m.home, away:m.away==null?"":m.away})));
      }
    } else {
      setJId("");
      setJName("");
      setDeadlineInput(toLocalDateTimeInput(nextFridayAt2100()));
      setLaligaMatchdayInput("");
      setMatches(FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
      setScores(FUTBOL_BASE_TEAMS.map(()=>({home:"",away:""})));
    }
  },[selected,editingMode,futbol.jornadas?.[selected]]);
  useEffect(()=>{
    if(editUser && selected && editingMode==="bet"){
      const bet=futbol.bets?.[selected]?.[editUser];
      const baseMatches=matches;
      setEditLate(!!bet?.late);
      setEditDelegated(!!bet?.delegated);
      if(bet){
        const betMatches=(bet.matches||[]).map(m=>({home:m.home==null?"":String(m.home), away:m.away==null?"":String(m.away)}));
        while(betMatches.length<baseMatches.length) betMatches.push({home:"",away:""});
        setScores(betMatches);
      } else {
        setScores(baseMatches.map(()=>({home:"",away:""})));
      }
    } else if(editingMode==="results" && selected){
      const j=futbol.jornadas?.[selected];
      const baseMatches=(j?.matches?.length?j.matches:FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
      const res=futbol.results?.[selected];
      setScores((res?.matches?.length?res.matches:baseMatches.map(()=>({home:"",away:""}))).map(m=>({home:m.home==null?"":String(m.home), away:m.away==null?"":String(m.away)})));
    }
  },[editUser,selected,editingMode]);
  const participants=useMemo(()=>getParticipantsForPorra(db,"futbol"),[db.participants,db.users]);
  if(!isAdminFor(db.users?.[currentUser], "futbol")) return null;
  const ensureId=()=>{
    const id=(jId||jName||"").trim();
    return id || "";
  };
  const autoDeadline=useMemo(()=>computeDeadlineFromKickoffs({matches}),[matches]);
  const [savingJornada,setSavingJornada]=useState(false);
  const saveJornada=async()=>{
    const id=ensureId();
    if(!id) return toast.error("Define ID o nombre de jornada");
    if(savingJornada) return;
    setSavingJornada(true);
    const fixedMatches=(matches.length?matches:FUTBOL_BASE_TEAMS.map(team=>({home:team,away:"",kickoff:""}))).slice(0,4).map((m,idx)=>({home:m.home||FUTBOL_BASE_TEAMS[idx]||`Local ${idx+1}`, away:m.away||`Visitante ${idx+1}`, ...(m.kickoff?{kickoff:new Date(m.kickoff).toISOString()}:{})}));
    const computedDl=computeDeadlineFromKickoffs({matches:fixedMatches});
    const manualDl=parseLocalDateTime(deadlineInput);
    const finalDeadline=computedDl ? null : (manualDl||nextFridayAt2100());
    const mdRaw=laligaMatchdayInput.trim();
    const laligaMatchday=mdRaw===""?undefined:parseInt(mdRaw,10);
    if(mdRaw!==""&&!Number.isFinite(laligaMatchday)) {
      toast.error("Jornada La Liga: introduce un número (1–38) o déjalo vacío");
      setSavingJornada(false);
      return;
    }
    const jornadaData={id,name:jName||id,deadline:finalDeadline?finalDeadline.toISOString():null,matches:fixedMatches,...(laligaMatchday!=null?{laligaMatchday}:{})};
    let merged=jornadaData;
    try {
      const resp=await adminFutbol(id, currentUser, "jornada", {...jornadaData, order:[...(futbol.order||[]), ...(futbol.order?.includes(id)?[]:[id])]});
      merged=resp?.jornada||jornadaData;
      const k=resp?.kickoffEnrichment;
      if(k?.filled>0) toast.success(`Jornada guardada. Horarios API: ${k.filled} partido(s).`);
      else if(k?.attempted&&k?.apiError) toast.warn(`Calendario API: ${k.apiError}`);
      else toast.success("Jornada guardada");
    } catch(err) {
      console.error("Error sync jornada:", err);
      toast.error("Error al sincronizar jornada con el servidor");
      setSavingJornada(false);
      return;
    }
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const jornadasMap={...(futbolPrev.jornadas||{})};
      jornadasMap[id]=merged;
      const order=[...(futbolPrev.order||[])];
      if(!order.includes(id)) order.push(id);
      return {...prev, futbol:{...futbolPrev, jornadas:jornadasMap, order}};
    });
    setSelected(id);
    setSavingJornada(false);
    toast.success("Jornada guardada");
  };
  const deleteJornada=()=>{
    if(!selected) return;
    if(!window.confirm(`Eliminar jornada ${selected}?`)) return;
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const jornadasMap={...(futbolPrev.jornadas||{})};
      delete jornadasMap[selected];
      const order=(futbolPrev.order||[]).filter(id=>id!==selected);
      const resultsMap={...(futbolPrev.results||{})}; delete resultsMap[selected];
      const betsMap={...(futbolPrev.bets||{})}; delete betsMap[selected];
      const windowMap={...(futbolPrev.betsWindow||{})}; delete windowMap[selected];
      const revealMap={...(futbolPrev.betsReveal||{})}; delete revealMap[selected];
      return {...prev, futbol:{...futbolPrev, jornadas:jornadasMap, order, results:resultsMap, bets:betsMap, betsWindow:windowMap, betsReveal:revealMap}};
    });
    adminFutbol(selected, currentUser, "delete", {})
      .catch(err => console.error("Error sync delete jornada:", err));
    setSelected("");
  };
  const saveResults=()=>{
    const id=ensureId()||selected;
    if(!id) return toast.error("Guarda la jornada primero");
    const parsedScores=scores.slice(0,matches.length).map(s=>({home:s.home===""||s.home==null?null:Number(s.home), away:s.away===""||s.away==null?null:Number(s.away)}));
    const resultData={matches:parsedScores};
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const resultsMap={...(futbolPrev.results||{})};
      resultsMap[id]=resultData;
      return {...prev, futbol:{...futbolPrev, results:resultsMap}};
    });
    saveResultFutbol(id, currentUser, resultData)
      .catch(err => { console.error("Error sync resultados futbol:", err); toast.error("Error al guardar resultados en el servidor"); });
    toast.success("Resultados guardados");
  };
  const setBetsOverride=(mode)=>{
    const id=ensureId()||selected;
    if(!id) return;
    const windowData=mode==="auto"?{}:{forceOpen:mode==="open", forceClosed:mode==="close"};
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const windowMap={...(futbolPrev.betsWindow||{})};
      if(mode==="auto"){ delete windowMap[id]; }
      else windowMap[id]=windowData;
      const revealMap={...(futbolPrev.betsReveal||{})};
      if(mode==="close") revealMap[id]={forceShow:true};
      return {...prev, futbol:{...futbolPrev, betsWindow:windowMap, betsReveal:revealMap}};
    });
    adminFutbol(id, currentUser, "window", mode==="auto"?{}:windowData)
      .catch(err => { console.error("Error sync betsWindow:", err); toast.error("Error al sincronizar con el servidor"); });
    if(mode==="close"){
      adminFutbol(id, currentUser, "reveal", {forceShow:true})
        .catch(err => { console.error("Error sync betsReveal:", err); toast.error("Error al sincronizar con el servidor"); });
    }
  };
  const setReveal=(mode)=>{
    const id=ensureId()||selected;
    if(!id) return;
    const revealData=mode==="auto"?{}:{forceShow:true};
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const map={...(futbolPrev.betsReveal||{})};
      if(mode==="auto"){ delete map[id]; }
      else map[id]={forceShow:true};
      return {...prev, futbol:{...futbolPrev, betsReveal:map}};
    });
    adminFutbol(id, currentUser, "reveal", revealData)
      .catch(err => { console.error("Error sync betsReveal:", err); toast.error("Error al sincronizar con el servidor"); });
  };
  const [savingAdminBet,setSavingAdminBet]=useState(false);
  const saveAdminBet=async()=>{
    const id=ensureId()||selected;
    if(!id) return toast.error("Selecciona jornada");
    if(!editUser) return toast.error("Selecciona participante");
    if(savingAdminBet) return;
    const ts=nowISO();
    const payload={matches:scores.map(s=>({home:s.home===""?null:Number(s.home), away:s.away===""?null:Number(s.away)}))};
    const nextBet={...payload, submittedAt:ts, late:editLate, adminEdited:true, delegated:editDelegated};
    setSavingAdminBet(true);
    try {
      await adminFutbol(id, currentUser, "bet", {userName:editUser, bet:nextBet});
    } catch(err) {
      console.error("Error guardando apuesta delegada fútbol:", err);
      toast.error("Error al guardar en el servidor. Inténtalo de nuevo.");
      setSavingAdminBet(false);
      return;
    }
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const raceBets={...(futbolPrev.bets?.[id]||{})};
      const prevBet=raceBets[editUser];
      const fullBet={...prevBet, ...nextBet};
      const nextBets={...(futbolPrev.bets||{}), [id]:{...raceBets, [editUser]:fullBet}};
      let betHistory=futbolPrev.betHistory||{};
      const sameMatch=prevBet && JSON.stringify(prevBet.matches)===JSON.stringify(nextBet.matches);
      if(!prevBet || !sameMatch || !!prevBet?.late!==!!nextBet.late){
        const jHistory={...(betHistory[id]||{})};
        const userLog=[...(jHistory[editUser]||[])];
        userLog.push({ts,matches:nextBet.matches,late:editLate,editedByAdmin:true,delegated:editDelegated});
        betHistory={...betHistory,[id]:{...jHistory,[editUser]:userLog}};
      }
      return {...prev, futbol:{...futbolPrev, bets:nextBets, betHistory}};
    });
    setSavingAdminBet(false);
    toast.success(editDelegated ? `Apuesta delegada de ${editUser} guardada (a tiempo)` : "Apuesta guardada para el usuario");
  };
  const manualStatus=selected ? (futbol.betsWindow?.[selected]?.forceOpen?"Abierto manualmente":futbol.betsWindow?.[selected]?.forceClosed?"Cerrado manualmente":"Automático (viernes 15:00)") : "—";
  const revealStatus=selected ? (futbol.betsReveal?.[selected]?.forceShow?"Publicadas manualmente":"Automático tras cierre") : "—";
  return (
    <div className="card p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="section-title">Administración Fútbol</h2>
        <div className="flex gap-2 items-center">
          <select className="select border rounded px-3 py-2" value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="">— Nueva jornada —</option>
            {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id}</option>)}
          </select>
          <button className="px-3 py-2 rounded bg-neutral-900 text-white" onClick={()=>{setSelected("");}}>Nueva</button>
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm">ID jornada</label>
          <input className="select border rounded px-3 py-2" placeholder="J1" value={jId} onChange={e=>setJId(e.target.value)} />
          <label className="text-sm">Nombre visible</label>
          <input className="select border rounded px-3 py-2" placeholder="Jornada 1" value={jName} onChange={e=>setJName(e.target.value)} />
          <label className="text-sm">Cierre (España)</label>
          <input type="datetime-local" className="select border rounded px-3 py-2" value={deadlineInput} onChange={e=>setDeadlineInput(e.target.value)} />
          <label className="text-sm">Jornada La Liga (1–38, opcional)</label>
          <input type="number" min="1" max="38" className="select border rounded px-3 py-2" placeholder="p. ej. 34" value={laligaMatchdayInput} onChange={e=>setLaligaMatchdayInput(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">Si la Lambda tiene <code className="text-slate-400">FOOTBALL_DATA_ORG_TOKEN</code>, al guardar se rellenan solos los horarios vacíos (API football-data.org). El matchday afina la búsqueda; si lo dejas vacío se usa una ventana de fechas.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>setMatches(FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})))}>Cargar equipos base</button>
          <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-50" onClick={saveJornada} disabled={savingJornada}>{savingJornada?"Guardando...":"Guardar jornada"}</button>
          {selected && <button className="px-3 py-2 rounded bg-red-700 text-white text-sm" onClick={deleteJornada}>Eliminar</button>}
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Partidos (4)</h3>
        {autoDeadline && <div className="text-xs text-emerald-300 mb-1">Cierre auto-calculado: {autoDeadline.toLocaleString("es-ES",{timeZone:"Europe/Madrid"})} (1 min antes del primer partido)</div>}
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((m,idx)=>(
            <div key={idx} className="border border-white/10 rounded p-2 bg-neutral-900 space-y-2">
              <div className="text-xs text-slate-300">Partido {idx+1}</div>
              <input className="select border rounded px-3 py-2" placeholder="Local" value={m.home} onChange={e=>setMatches(prev=>prev.map((p,i)=>i===idx?{...p,home:e.target.value}:p))} />
              <input className="select border rounded px-3 py-2" placeholder="Visitante" value={m.away} onChange={e=>setMatches(prev=>prev.map((p,i)=>i===idx?{...p,away:e.target.value}:p))} />
              <input type="datetime-local" className="select border rounded px-3 py-2 text-xs" placeholder="Hora inicio" value={m.kickoff?toLocalDateTimeInput(new Date(m.kickoff)):""} onChange={e=>setMatches(prev=>prev.map((p,i)=>i===idx?{...p,kickoff:e.target.value}:p))} />
              <div className="text-[10px] text-slate-500">Hora inicio (para cierre automático)</div>
            </div>
          ))}
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Resultados oficiales</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((m,idx)=>(
            <div key={idx} className="border border-white/10 rounded p-2 bg-neutral-900 space-y-2">
              <div className="text-xs text-slate-300">{m.home||"Local"} vs {m.away||"Visitante"}</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" className="select border rounded px-3 py-2" placeholder="Goles local" value={scores[idx]?.home} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,home:e.target.value}:p))} />
                <input type="number" min="0" className="select border rounded px-3 py-2" placeholder="Goles visitante" value={scores[idx]?.away} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,away:e.target.value}:p))} />
              </div>
            </div>
          ))}
        </div>
        <button className="px-3 py-2 rounded bg-slate-900 text-white" onClick={saveResults}>Guardar resultados</button>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Control de apuestas</h3>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>setBetsOverride("open")}>Abrir</button>
          <button className="px-3 py-2 rounded bg-red-700 text-white text-sm" onClick={()=>setBetsOverride("close")}>Cerrar</button>
          <button className="px-3 py-2 rounded bg-slate-800 text-white text-sm" onClick={()=>setBetsOverride("auto")}>Automático</button>
        </div>
        <div className="text-xs text-slate-300">Estado actual: {manualStatus}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>setReveal("show")}>Publicar apuestas ya</button>
          <button className="px-3 py-2 rounded bg-slate-800 text-white text-sm" onClick={()=>setReveal("auto")}>Automático</button>
        </div>
        <div className="text-xs text-slate-300">Visibilidad: {revealStatus}</div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Introducir / editar apuestas de participantes</h3>
        <p className="text-xs text-slate-400 mb-1">Introduce apuestas de usuarios que las han enviado por otra vía (WhatsApp, email...) o edita las existentes.</p>
        <div className="flex gap-2 mb-2">
          <button className={`px-3 py-1.5 rounded text-sm ${editingMode==="results"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>{setEditingMode("results"); setEditUser("");}}>Editar resultados</button>
          <button className={`px-3 py-1.5 rounded text-sm ${editingMode==="bet"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>{setEditingMode("bet");}}>Editar apuesta usuario</button>
        </div>
        {editingMode==="bet" && (
          <>
            <div className="grid gap-2 md:grid-cols-[2fr,1fr] md:items-center">
              <select className="select border rounded px-3 py-2" value={editUser} onChange={e=>{setEditUser(e.target.value);}}>
                <option value="">— Elige participante —</option>
                {participants.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="futbolBetTiming" checked={editDelegated && !editLate} onChange={()=>{setEditLate(false);setEditDelegated(true);}} /><span className="text-emerald-300">Delegada (a tiempo)</span></label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="futbolBetTiming" checked={!editLate && !editDelegated} onChange={()=>{setEditLate(false);setEditDelegated(false);}} /><span>Dentro de plazo</span></label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="futbolBetTiming" checked={editLate} onChange={()=>{setEditLate(true);setEditDelegated(false);}} /><span className="text-amber-300">Fuera de plazo (-2 pts)</span></label>
              </div>
            </div>
            {editUser && (
              <div className="border border-white/10 rounded p-2 bg-neutral-900 mt-2">
                <div className="text-xs text-slate-300 mb-2">Marcadores del usuario:</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {matches.map((m,idx)=>(
                    <div key={idx} className="text-xs">
                      <div className="text-slate-400">{m.home||"Local"} vs {m.away||"Visitante"}</div>
                      <div className="grid grid-cols-2 gap-1">
                        <input type="number" min="0" className="select border rounded px-2 py-1 text-xs" placeholder="Local" value={scores[idx]?.home} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,home:e.target.value}:p))} />
                        <input type="number" min="0" className="select border rounded px-2 py-1 text-xs" placeholder="Visitante" value={scores[idx]?.away} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,away:e.target.value}:p))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {editDelegated && <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">Esta apuesta se guardará como delegada: dentro de tiempo, válida y sin penalización por retraso.</div>}
            <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm mt-2 disabled:opacity-50" onClick={saveAdminBet} disabled={!editUser||savingAdminBet}>{savingAdminBet?"Guardando...":"Guardar apuesta del usuario"}</button>
          </>
        )}
        {editingMode==="results" && (
          <div className="text-xs text-slate-400">Usa la sección de resultados oficiales arriba para editar resultados.</div>
        )}
      </div>
    </div>
  );
}
