import { useState, useEffect, useMemo } from "react";
import { DRIVER_TEAMS, TEAMS_ORDER_2025 } from "../config.js";
import { toast } from "../toast.jsx";

function SelectDriver({value,onChange,drivers,placeholder,exclude}){
  const excKey=(exclude||[]).filter(Boolean).join(",");
  const excSet=useMemo(()=>new Set((exclude||[]).filter(Boolean)),[excKey]);
  const grouped=useMemo(()=>{
    const byTeam={};
    TEAMS_ORDER_2025.forEach(t=>{byTeam[t]=[];});
    const ungrouped=[];
    (drivers||[]).forEach(d=>{
      const team=DRIVER_TEAMS[d];
      if(team && byTeam[team]) byTeam[team].push(d);
      else ungrouped.push(d);
    });
    return {byTeam,ungrouped};
  },[drivers]);
  return (
    <select className="select border rounded px-3 py-2 w-full min-w-0" value={value||""} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {TEAMS_ORDER_2025.map(team=>{
        const tDrivers=grouped.byTeam[team];
        if(!tDrivers||!tDrivers.length) return null;
        return <optgroup key={team} label={team}>{tDrivers.map(d=><option key={d} value={d} disabled={excSet.has(d)}>{d}</option>)}</optgroup>;
      })}
      {grouped.ungrouped.length>0 && <optgroup label="Otros">{grouped.ungrouped.map(d=><option key={d} value={d} disabled={excSet.has(d)}>{d}</option>)}</optgroup>}
    </select>
  );
}

function BetForm({bet,disabled,onSubmit,questions,drivers,late,canEdit}){
  const hasSavedBet=!!(bet.submittedAt && (bet.pole || bet.podium?.some(Boolean)));
  const [editing,setEditing]=useState(!hasSavedBet);
  const [pole,setPole]=useState(bet.pole||""); const [p1,setP1]=useState(bet.podium?.[0]||""); const [p2,setP2]=useState(bet.podium?.[1]||""); const [p3,setP3]=useState(bet.podium?.[2]||"");
  const [q1,setQ1]=useState(bet.q?.[0]||""); const [q2,setQ2]=useState(bet.q?.[1]||""); const [q3,setQ3]=useState(bet.q?.[2]||"");
  const betFingerprint=JSON.stringify([bet.pole,bet.podium,bet.q,bet.submittedAt]);
  useEffect(()=>{
    setPole(bet.pole||"");
    setP1(bet.podium?.[0]||""); setP2(bet.podium?.[1]||""); setP3(bet.podium?.[2]||"");
    setQ1(bet.q?.[0]||""); setQ2(bet.q?.[1]||""); setQ3(bet.q?.[2]||"");
    if(bet.submittedAt && (bet.pole || bet.podium?.some(Boolean))) setEditing(false);
  },[betFingerprint]);
  const hasQuestions=questions.some(q=>q&&q.trim());
  const handleSubmit=(e)=>{
    e.preventDefault();
    const pod=[p1,p2,p3].filter(Boolean);
    if(pod.length!==new Set(pod).size) return toast.error("No puedes repetir piloto en el podio");
    onSubmit({pole,podium:[p1,p2,p3],q:[q1,q2,q3]});
    setEditing(false);
  };

  if(!editing && hasSavedBet){
    return (
      <div className="grid gap-3">
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[.04]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-emerald-400 text-lg">✅</span>
            <span className="text-sm font-semibold text-emerald-300">Apuesta registrada</span>
            {bet.submittedAt && <span className="text-[10px] text-white/30 ml-auto">{new Date(bet.submittedAt).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}
            {bet.late && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 ml-1">Fuera de plazo</span>}
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-white/40 w-12 shrink-0">Pole:</span>
              <span className="text-white/90 font-medium">{bet.pole||<span className="text-white/25 italic">Sin seleccionar</span>}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-white/40 w-12 shrink-0">Podio:</span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {["🥇","🥈","🥉"].map((m,i)=><span key={i} className="text-white/90">{m} {bet.podium?.[i]||<span className="text-white/25 italic">—</span>}</span>)}
              </div>
            </div>
            {hasQuestions && <div className="mt-1 pt-2 border-t border-white/5">
              {[0,1,2].map(i=><div key={i} className="flex items-baseline gap-2 mt-1">
                <span className="text-amber-400/50 text-xs shrink-0">P{i+1}:</span>
                <span className="text-xs text-white/40 truncate">{questions[i]||"—"}</span>
                <span className="text-white/80 text-sm ml-auto shrink-0">{bet.q?.[i]||<span className="text-white/25 italic">—</span>}</span>
              </div>)}
            </div>}
          </div>
        </div>
        <button
          disabled={!canEdit}
          onClick={()=>setEditing(true)}
          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${canEdit?"bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white":"bg-white/[.02] border-white/5 text-white/20 cursor-not-allowed"}`}
        >
          {canEdit?(late?"✏️ Cambiar apuesta (fuera de plazo)":"✏️ Cambiar apuesta"):"🔒 Apuestas cerradas"}
        </button>
      </div>
    );
  }

  return (
    <form className="grid gap-2" onSubmit={handleSubmit}>
      <label className="text-sm font-semibold">Pole</label><SelectDriver value={pole} onChange={setPole} drivers={drivers} placeholder="Selecciona piloto" />
      <label className="text-sm font-semibold mt-2">Podio</label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div><div className="text-[11px] text-white/40 mb-1">🥇 1º</div><SelectDriver value={p1} onChange={setP1} drivers={drivers} placeholder="1º" exclude={[p2,p3]} /></div>
        <div><div className="text-[11px] text-white/40 mb-1">🥈 2º</div><SelectDriver value={p2} onChange={setP2} drivers={drivers} placeholder="2º" exclude={[p1,p3]} /></div>
        <div><div className="text-[11px] text-white/40 mb-1">🥉 3º</div><SelectDriver value={p3} onChange={setP3} drivers={drivers} placeholder="3º" exclude={[p1,p2]} /></div>
      </div>
      <label className="text-sm font-semibold mt-3">Preguntas adicionales</label>
      {hasQuestions ? (
        <div className="grid gap-3">
          {[0,1,2].map(i=>{const qText=questions[i]; const val=[q1,q2,q3][i]; const setter=[setQ1,setQ2,setQ3][i]; return (
            <div key={i}>
              <div className="text-xs text-amber-300/80 mb-1 flex items-start gap-1"><span className="text-amber-400/60 font-bold">{i+1}.</span> {qText||<span className="text-white/30 italic">Pregunta pendiente</span>}</div>
              <input disabled={disabled} className="select border rounded px-3 py-2 w-full" value={val} onChange={e=>setter(e.target.value)} placeholder={`Tu respuesta a la pregunta ${i+1}`}/>
            </div>
          );})}
        </div>
      ) : (
        <div className="text-xs text-white/30 italic p-2 border border-white/5 rounded bg-white/[.02]">Las preguntas aún no han sido publicadas por el autor.</div>
      )}
      <div className="flex gap-2 mt-3">
        <button disabled={disabled} className={`flex-1 px-4 py-2 rounded ${disabled?"bg-slate-200 text-slate-500":late?"bg-amber-600 text-white":"bg-emerald-600 text-white"}`}>{disabled?"Cerrado por admin":late?"Guardar (fuera de plazo, -2 pts)":"Guardar apuesta"}</button>
        {hasSavedBet && <button type="button" onClick={()=>setEditing(false)} className="px-4 py-2 rounded bg-white/5 border border-white/10 text-white/50 hover:text-white/70 transition-colors">Cancelar</button>}
      </div>
    </form>
  );
}

export { SelectDriver, BetForm };
