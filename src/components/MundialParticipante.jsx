import { useState, useEffect, useMemo } from "react";
import { useNow, nowISO, formatDateTime, formatTime } from "../utils.js";
import { MADRID_TZ } from "../config.js";
import { saveBetMundial } from "../api.js";
import { toast } from "../toast.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { scoreMundialJornada, listMundialJornadas, defaultMundialState, getEffectiveDeadline, matchDisplayName } from "../mundial-utils.js";
import { Avatar } from "./Avatar.jsx";
import { MundialBetForm } from "./MundialBetForm.jsx";
import { CountdownBadge } from "./CountdownBadge.jsx";
import { fireConfetti } from "../confetti.js";

export function MundialParticipante({ user, db, setDb }) {
  const now = useNow();
  const [showOthers, setShowOthers] = useState(false);
  const mundial = db.mundial || defaultMundialState();
  const jornadas = useMemo(() => listMundialJornadas(mundial), [mundial]);
  const [selected, setSelected] = useState(() => {
    const nowMs = Date.now();
    const upcoming = jornadas.find((j) => {
      const dl = getEffectiveDeadline(j);
      return dl && dl.getTime() > nowMs;
    });
    return upcoming?.id || jornadas[0]?.id || "";
  });

  useEffect(() => {
    if ((!selected || !jornadas.find((j) => j.id === selected)) && jornadas.length) {
      const nowMs = Date.now();
      const upcoming = jornadas.find((j) => {
        const dl = getEffectiveDeadline(j);
        return dl && dl.getTime() > nowMs;
      });
      setSelected(upcoming?.id || jornadas[0]?.id);
    }
  }, [selected, jornadas]);

  const jornada = jornadas.find((j) => j.id === selected);
  const deadline = jornada ? getEffectiveDeadline(jornada) : null;
  const manualWindow = mundial.betsWindow?.[selected];
  const manualReveal = mundial.betsReveal?.[selected];
  const isLate = deadline ? now >= deadline : false;
  const jornadaResult = jornada ? mundial.results?.[selected] : null;
  const hasResult = !!(jornadaResult && jornadaResult.matches?.length > 0 && jornadaResult.matches.every((m) => m.home != null && m.away != null));
  const canEdit = !manualWindow?.forceClosed && !hasResult;
  const revealAt = deadline ? new Date(deadline.getTime() + 60 * 1000) : null;
  const canViewFull = manualReveal?.forceShow || (!!revealAt && now > revealAt);
  const bet = jornada ? (mundial.bets?.[selected]?.[user] || { matches: [], submittedAt: null, late: false }) : null;
  const res = jornada ? mundial.results?.[selected] : null;
  const participants = useMemo(() => getParticipantsForPorra(db, "mundial"), [db.participants, db.users]);
  const others = participants.filter((n) => n !== user).map((name) => ({ name, bet: jornada ? mundial.bets?.[selected]?.[name] : null }));
  const myScore = jornada && res ? scoreMundialJornada(db, selected, user) : null;
  const [saving, setSaving] = useState(false);

  const saveBet = async (payload) => {
    if (!jornada || saving) throw new Error("busy");
    setSaving(true);
    const ts = nowISO();
    const late = deadline ? new Date() >= deadline : false;
    const nextBet = { matches: payload.matches, trashtalk: payload.trashtalk, submittedAt: ts, late };
    try {
      await saveBetMundial(selected, user, nextBet);
    } catch (err) {
      console.error("[BET_MUNDIAL_FAIL]", JSON.stringify({ user, jornadaId: selected, error: err.message }));
      toast.error("Error al guardar la apuesta.");
      setSaving(false);
      throw err;
    }
    setDb((prev) => {
      const m = prev.mundial || defaultMundialState();
      const raceBets = { ...(m.bets?.[selected] || {}) };
      raceBets[user] = { ...raceBets[user], ...nextBet };
      return { ...prev, mundial: { ...m, bets: { ...m.bets, [selected]: raceBets } } };
    });
    if (late) toast.warn("Apuesta fuera de plazo (-2 pts)");
    else { toast.success("Apuesta guardada"); fireConfetti(); }
    setSaving(false);
  };

  const betCount = useMemo(() => {
    if (!jornada) return { done: 0, total: 0 };
    const betsFor = mundial.bets?.[selected] || {};
    const done = participants.filter((n) => betsFor[n]?.submittedAt).length;
    return { done, total: participants.length };
  }, [selected, mundial.bets, participants, jornada]);

  return (
    <div className={`grid gap-4 ${showOthers ? "md:grid-cols-[minmax(0,1fr)_minmax(220px,340px)]" : ""}`}>
      <div className="card card-racing p-4 md:p-5 min-w-0">
        <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title">🏆 Mundial 2026 <span className="text-xs opacity-40">· al final, cena de bocata al campeón</span></h2>
          {jornada && (
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/80" onClick={() => setShowOthers((p) => !p)}>
              {showOthers ? "Ocultar" : "👀 Ver otras apuestas"}
            </button>
          )}
        </div>
        <select className="select select-strong border rounded px-3 py-2 mb-3 w-full" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {jornadas.map((j) => <option key={j.id} value={j.id}>{j.name || j.id}</option>)}
        </select>
        {jornada && betCount.total > 0 && !hasResult && (
          <div className="text-xs text-amber-300/70 mb-3">{betCount.done}/{betCount.total} han apostado</div>
        )}
        {jornada && deadline && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-sm">
            <span className="font-semibold text-amber-200">Cierre: </span>
            <span className="text-amber-100">{formatDateTime(deadline, MADRID_TZ)}</span>
            <span className="text-white/40 text-xs"> (España)</span>
            <CountdownBadge target={deadline} />
          </div>
        )}
        {jornada ? (
          <MundialBetForm jornada={jornada} bet={bet} disabled={!canEdit || saving} canEdit={canEdit && !saving} late={isLate} onSubmit={saveBet} />
        ) : (
          <p className="text-sm text-white/40 text-center py-6">Calendario no cargado. Recarga o contacta al admin.</p>
        )}
        {myScore && (
          <div className="mt-4 p-4 rounded-xl border border-amber-500/15 bg-amber-500/5">
            <div className="font-bold text-lg text-amber-200 mb-2">{myScore.points} pts</div>
            <div className="space-y-1">
              {myScore.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-white/50">
                  <span className="truncate pr-2">{item.label}</span>
                  <span className={item.delta > 0 ? "text-emerald-300" : item.delta < 0 ? "text-red-400" : ""}>{item.delta > 0 ? `+${item.delta}` : item.delta}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showOthers && jornada && (
        <div className="card p-4">
          <h3 className="section-title mb-3">Apuestas de otros</h3>
          {!canViewFull ? <p className="text-xs text-white/40">Visibles tras el cierre.</p> : (
            <div className="space-y-3">
              {others.map(({ name, bet: ob }) => (
                <div key={name} className="border border-white/10 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1"><Avatar name={name} size="sm" mode="futbol" /> <b>{name}</b></div>
                  {ob?.matches ? (jornada.matches || []).map((m, idx) => {
                    const { home, away } = matchDisplayName(m);
                    return <div key={idx} className="text-white/50">{home} {ob.matches[idx]?.home}-{ob.matches[idx]?.away} {away}</div>;
                  }) : <span className="text-white/30">Sin apuesta</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
