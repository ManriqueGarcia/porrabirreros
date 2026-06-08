import { useState, useEffect, useRef } from "react";
import { toast } from "../toast.jsx";
import { MADRID_TZ } from "../config.js";
import { formatDateTime, formatTime } from "../utils.js";
import { matchDisplayName } from "../mundial-utils.js";

function emptyKo() {
  return { extraTime: null, penalties: null, penWinner: null };
}

export function MundialBetForm({ jornada, bet, disabled, onSubmit, late, canEdit }) {
  const matches = jornada?.matches || [];
  const hasSavedBet = !!(bet?.submittedAt && bet?.matches?.some((m) => m?.home != null || m?.away != null));
  const [editing, setEditing] = useState(!hasSavedBet);
  const [saving, setSaving] = useState(false);

  const initialScores = () => matches.map((m, idx) => {
    const b = bet?.matches?.[idx];
    return {
      home: b?.home ?? "",
      away: b?.away ?? "",
      extraTime: b?.extraTime ?? null,
      penalties: b?.penalties ?? null,
      penWinner: b?.penWinner ?? null,
    };
  });

  const [scores, setScores] = useState(initialScores);
  const [trashtalk, setTrashtalk] = useState(bet?.trashtalk || "");
  const betFingerprint = JSON.stringify([bet?.matches, bet?.submittedAt, bet?.trashtalk]);
  const prevJornadaIdRef = useRef(jornada?.id);
  const draftDirtyRef = useRef(false);

  useEffect(() => {
    const jornadaChanged = prevJornadaIdRef.current !== jornada?.id;
    prevJornadaIdRef.current = jornada?.id;
    if (!jornadaChanged && draftDirtyRef.current && editing) return;

    setScores(initialScores());
    setTrashtalk(bet?.trashtalk || "");
    if (bet?.submittedAt && bet?.matches?.some((m) => m?.home != null || m?.away != null)) {
      setEditing(false);
      setSaving(false);
    }
    draftDirtyRef.current = false;
  }, [betFingerprint, jornada?.id, matches.length, editing]);

  const markDraftDirty = () => { draftDirtyRef.current = true; };

  const handleScoreChange = (idx, field, val) => {
    markDraftDirty();
    const clean = val === "" ? "" : Math.min(99, Math.max(0, parseInt(val, 10) || 0));
    setScores((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: clean === "" ? "" : String(clean) } : s)));
  };

  const setKoField = (idx, field, value) => {
    markDraftDirty();
    setScores((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const allFilled = scores.length === matches.length && scores.every((s) => s.home !== "" && s.home != null && s.away !== "" && s.away != null);

  const buildPayloadMatches = () => scores.map((s, idx) => {
    const row = { home: Number(s.home), away: Number(s.away) };
    if (matches[idx]?.knockout) {
      if (s.extraTime != null) row.extraTime = s.extraTime;
      if (s.penalties != null) row.penalties = s.penalties;
      if (s.penalties && s.penWinner) row.penWinner = s.penWinner;
    }
    return row;
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!allFilled) return toast.error("Rellena todos los marcadores (90′) antes de guardar");
    setSaving(true);
    try {
      await onSubmit({ matches: buildPayloadMatches(), trashtalk: trashtalk.trim() });
      draftDirtyRef.current = false;
      setEditing(false);
    } catch {
      setSaving(false);
    }
  };

  const renderMatchHeader = (m) => {
    const { home, away } = matchDisplayName(m);
    const kick = m.kickoff ? new Date(m.kickoff) : null;
    const tz = m.timezone || "UTC";
    return (
      <div className="mb-2">
        <div className="text-[10px] text-amber-300/60 uppercase tracking-wide">{m.venue}{m.city ? ` · ${m.city}` : ""}</div>
        {kick && (
          <div className="text-[10px] text-white/35">
            🇪🇸 {formatDateTime(kick, MADRID_TZ)} · 🏟 {formatTime(kick, tz)} local
          </div>
        )}
        <div className="team-name text-white/90 text-sm mt-1">{home} <span className="text-white/30">vs</span> {away}</div>
      </div>
    );
  };

  if (!editing && hasSavedBet) {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[.04] relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-400 text-lg">✅</span>
            <span className="text-sm font-semibold text-amber-200">Apuesta registrada</span>
            {bet.late && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 ml-1">Fuera de plazo</span>}
          </div>
          <div className="space-y-2">
            {matches.map((m, idx) => {
              const { home, away } = matchDisplayName(m);
              const b = bet.matches?.[idx];
              return (
                <div key={idx} className="px-3 py-2 rounded-lg bg-white/[.03] border border-white/[.05] text-sm">
                  <div className="text-white/50 text-xs mb-1">{home} vs {away}</div>
                  <span className="font-bold text-white/90 tabular-nums">{b?.home ?? "—"} - {b?.away ?? "—"}</span>
                  {m.knockout && (b?.extraTime != null || b?.penalties != null) && (
                    <div className="text-[10px] text-white/40 mt-1">
                      {b?.extraTime != null && <span>Prórroga: {b.extraTime ? "sí" : "no"} · </span>}
                      {b?.penalties != null && <span>Penaltis: {b.penalties ? "sí" : "no"}</span>}
                      {b?.penalties && b?.penWinner && <span> · Ganador pen.: {b.penWinner === "home" ? home : away}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <button disabled={!canEdit} onClick={() => setEditing(true)} className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${canEdit ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}>
          {canEdit ? "✏️ Cambiar apuesta" : "🔒 Apuestas cerradas"}
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      {matches.map((m, idx) => {
        const { home, away } = matchDisplayName(m);
        return (
          <div key={idx} className="match-card p-3">
            {renderMatchHeader(m)}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-white/50 w-16 text-right truncate">{home}</span>
              <input disabled={disabled} type="number" min="0" className="score-input w-12" value={scores[idx]?.home} onChange={(e) => handleScoreChange(idx, "home", e.target.value)} onWheel={(e) => e.target.blur()} />
              <span className="vs-badge text-xs">90′</span>
              <input disabled={disabled} type="number" min="0" className="score-input w-12" value={scores[idx]?.away} onChange={(e) => handleScoreChange(idx, "away", e.target.value)} onWheel={(e) => e.target.blur()} />
              <span className="text-xs text-white/50 w-16 truncate">{away}</span>
            </div>
            {m.knockout && (
              <div className="mt-3 pt-2 border-t border-white/10 space-y-2 text-xs">
                <p className="text-amber-200/50 text-[10px]">Bonos KO: no hace falta el marcador exacto; basta acertar el signo 1X2 a 90′.</p>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name={`et-${idx}`} disabled={disabled} checked={scores[idx]?.extraTime === true} onChange={() => setKoField(idx, "extraTime", true)} />
                    <span>Prórroga sí</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name={`et-${idx}`} disabled={disabled} checked={scores[idx]?.extraTime === false} onChange={() => setKoField(idx, "extraTime", false)} />
                    <span>Prórroga no</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name={`pen-${idx}`} disabled={disabled} checked={scores[idx]?.penalties === true} onChange={() => setKoField(idx, "penalties", true)} />
                    <span>Penaltis sí</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name={`pen-${idx}`} disabled={disabled} checked={scores[idx]?.penalties === false} onChange={() => setKoField(idx, "penalties", false)} />
                    <span>Penaltis no</span>
                  </label>
                </div>
                {scores[idx]?.penalties && (
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name={`pw-${idx}`} disabled={disabled} checked={scores[idx]?.penWinner === "home"} onChange={() => setKoField(idx, "penWinner", "home")} />
                      <span>Gana {home} (pen.)</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name={`pw-${idx}`} disabled={disabled} checked={scores[idx]?.penWinner === "away"} onChange={() => setKoField(idx, "penWinner", "away")} />
                      <span>Gana {away} (pen.)</span>
                    </label>
                  </div>
                )}
                <p className="text-[10px] text-white/30">Opcional en apuesta; +1/+1/+2 si aciertas prórroga, penaltis y ganador en penaltis.</p>
              </div>
            )}
          </div>
        );
      })}
      <input disabled={disabled} className="select border rounded px-3 py-2 w-full text-sm" value={trashtalk} onChange={(e) => { markDraftDirty(); setTrashtalk(e.target.value); }} placeholder="Bravuconada (opcional)" maxLength={120} />
      <button disabled={disabled || !allFilled || saving} type="submit" className="w-full px-5 py-3 rounded-xl font-bold text-sm bg-amber-600/20 text-amber-100 border border-amber-500/30 disabled:opacity-40">
        {saving ? "⏳ Guardando..." : late ? "⚠️ Guardar (fuera de plazo)" : "🏆 Guardar apuesta mundial"}
      </button>
      {hasSavedBet && !saving && (
        <button type="button" onClick={() => { setScores(initialScores()); setEditing(false); }} className="w-full text-sm text-white/40">Cancelar</button>
      )}
    </form>
  );
}
