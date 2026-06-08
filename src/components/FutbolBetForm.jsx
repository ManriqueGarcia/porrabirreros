import { useState, useEffect, useRef } from "react";
import { toast } from "../toast.jsx";

export function FutbolBetForm({jornada,bet,disabled,onSubmit,late,canEdit}){
  const matches=jornada?.matches||[];
  const hasSavedBet=!!(bet?.submittedAt && bet?.matches?.some(m=>m?.home!=null||m?.away!=null));
  const [editing,setEditing]=useState(!hasSavedBet);
  const [saving,setSaving]=useState(false);
  const initialScores=()=>matches.map((_,idx)=>({home:bet?.matches?.[idx]?.home??"", away:bet?.matches?.[idx]?.away??""}));
  const [scores,setScores]=useState(initialScores);
  const [trashtalk,setTrashtalk]=useState(bet?.trashtalk||"");
  const betFingerprint=JSON.stringify([bet?.matches,bet?.submittedAt,bet?.trashtalk]);
  const prevJornadaIdRef=useRef(jornada?.id);
  const draftDirtyRef=useRef(false);
  useEffect(()=>{
    const jornadaChanged=prevJornadaIdRef.current!==jornada?.id;
    prevJornadaIdRef.current=jornada?.id;
    if(!jornadaChanged && draftDirtyRef.current && editing) return;
    setScores(initialScores());
    setTrashtalk(bet?.trashtalk||"");
    if(bet?.submittedAt && bet?.matches?.some(m=>m?.home!=null||m?.away!=null)) { setEditing(false); setSaving(false); }
    draftDirtyRef.current=false;
  },[betFingerprint,jornada?.id,matches.length,editing]);
  const markDraftDirty=()=>{ draftDirtyRef.current=true; };
  const handleScoreChange=(idx,field,val)=>{
    markDraftDirty();
    const clean=val===""?"":Math.min(99,Math.max(0,parseInt(val,10)||0));
    setScores(prev=>prev.map((s,i)=> i===idx ? {...s, [field]: clean===""?"":String(clean)} : s));
  };
  const allFilled=scores.length===matches.length && scores.every(s=>s.home!==""&&s.home!=null&&s.away!==""&&s.away!=null);
  const submit=async(e)=>{
    e.preventDefault();
    if(!allFilled) return toast.error("Rellena todos los marcadores antes de guardar");
    const parsedScores=scores.map(s=>({home:Number(s.home), away:Number(s.away)}));
    setSaving(true);
    try {
      await onSubmit({matches:parsedScores,trashtalk:trashtalk.trim()});
      draftDirtyRef.current=false;
      setEditing(false);
    } catch { setSaving(false); return; }
  };

  if(!editing && hasSavedBet){
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"></div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-emerald-400 text-lg">✅</span>
            <span className="text-sm font-semibold text-emerald-300">Apuesta registrada</span>
            {bet.submittedAt && <span className="text-[10px] text-white/30 ml-auto">{new Date(bet.submittedAt).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}
            {bet.late && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 ml-1">Fuera de plazo</span>}
            {bet.delegated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/20 ml-1">Delegada</span>}
          </div>
          <div className="space-y-2">
            {matches.map((m,idx)=>(
              <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[.03] border border-white/[.05]">
                <span className="text-sm text-white/60 flex-1 text-right truncate">{m.home||"Local"}</span>
                <span className="font-bold text-white/90 tabular-nums mx-3 text-base">{bet.matches?.[idx]?.home??"—"} - {bet.matches?.[idx]?.away??"—"}</span>
                <span className="text-sm text-white/60 flex-1 truncate">{m.away||"Visitante"}</span>
              </div>
            ))}
          </div>
          {bet.trashtalk && <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-1.5"><span className="text-sm">💬</span><span className="text-xs text-white/50 italic">"{bet.trashtalk}"</span></div>}
        </div>
        <button
          disabled={!canEdit}
          onClick={()=>setEditing(true)}
          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${canEdit?"bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white":"bg-white/[.02] border-white/5 text-white/20 cursor-not-allowed"}`}
        >
          {canEdit?(late?"✏️ Cambiar apuesta (fuera de plazo)":"✏️ Cambiar apuesta"):"🔒 Apuestas cerradas"}
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      {matches.map((m,idx)=>(
        <div key={idx} className="match-card">
          <div className="field-lines"></div>
          <div className="relative flex items-center justify-center gap-3">
            <div className="flex-1 text-right">
              <div className="team-name text-white/90">{m.home||"Local"}</div>
            </div>
            <div className="flex items-center gap-2">
              <input disabled={disabled} type="number" min="0" className="score-input" placeholder="–" value={scores[idx]?.home} onChange={e=>handleScoreChange(idx,"home",e.target.value)} onWheel={e=>e.target.blur()} />
              <span className="vs-badge">VS</span>
              <input disabled={disabled} type="number" min="0" className="score-input" placeholder="–" value={scores[idx]?.away} onChange={e=>handleScoreChange(idx,"away",e.target.value)} onWheel={e=>e.target.blur()} />
            </div>
            <div className="flex-1">
              <div className="team-name text-white/90">{m.away||"Visitante"}</div>
            </div>
          </div>
        </div>
      ))}
      <div className="mt-2">
        <label className="text-sm font-semibold flex items-center gap-1.5">💬 Bravuconada <span className="text-[10px] text-white/30 font-normal">(opcional — se revela con los resultados)</span></label>
        <input disabled={disabled} className="select border rounded px-3 py-2 w-full mt-1" value={trashtalk} onChange={e=>{ markDraftDirty(); setTrashtalk(e.target.value); }} placeholder="¿Algo que decir? Ej: Esta jornada es mía..." maxLength={120}/>
      </div>
      <div className="flex gap-2 mt-1">
        <button disabled={disabled||!allFilled||saving} className={`flex-1 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${disabled||saving?"bg-white/5 text-white/30 border border-white/5":!allFilled?"bg-white/5 text-white/25 border border-white/5 cursor-not-allowed":late?"bg-amber-600/20 text-amber-100 border border-amber-500/30 hover:bg-amber-600/30 shadow-lg shadow-amber-500/10":"bg-emerald-600/20 text-emerald-100 border border-emerald-500/30 hover:bg-emerald-600/30 shadow-lg shadow-emerald-500/10"}`}>{saving?"⏳ Guardando...":disabled?"⏳ Cerrado por admin":!allFilled?"⚽ Rellena todos los marcadores":late?"⚠️ Guardar apuesta (fuera de plazo, -2 pts)":"⚽ Guardar apuesta"}</button>
        {hasSavedBet && !saving && <button type="button" onClick={()=>{setScores(initialScores());setTrashtalk(bet?.trashtalk||"");setEditing(false);}} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/70 transition-colors text-sm">Cancelar</button>}
      </div>
    </form>
  );
}
