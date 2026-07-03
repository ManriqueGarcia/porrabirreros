import { useState, useEffect, useMemo } from "react";
import { useNow, nowISO, formatDateTime } from "../utils.js";
import { MADRID_TZ } from "../config.js";
import { saveBetMundial } from "../api.js";
import { toast } from "../toast.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { scoreMundialJornada, listMundialJornadas, defaultMundialState, getEffectiveDeadline, matchDisplayName } from "../mundial-utils.js";
import { Avatar } from "./Avatar.jsx";
import { MundialBetForm } from "./MundialBetForm.jsx";
import { CountdownBadge } from "./CountdownBadge.jsx";
import { fireConfetti } from "../confetti.js";

const COUNTRY_FLAGS = {
  "Argentina": "🇦🇷", "Brasil": "🇧🇷", "España": "🇪🇸", "Francia": "🇫🇷",
  "Alemania": "🇩🇪", "Portugal": "🇵🇹", "Países Bajos": "🇳🇱", "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "México": "🇲🇽", "Uruguay": "🇺🇾", "Colombia": "🇨🇴", "Marruecos": "🇲🇦",
  "Japón": "🇯🇵", "Corea del Sur": "🇰🇷", "Suiza": "🇨🇭", "Austria": "🇦🇹",
  "Bélgica": "🇧🇪", "Turquía": "🇹🇷", "Croacia": "🇭🇷", "Senegal": "🇸🇳",
  "Australia": "🇦🇺", "Estados Unidos": "🇺🇸", "Canadá": "🇨🇦", "Ecuador": "🇪🇨",
  "Ghana": "🇬🇭", "Egipto": "🇪🇬", "Suecia": "🇸🇪", "Noruega": "🇳🇴",
  "Polonia": "🇵🇱", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Arabia Saudita": "🇸🇦", "Irán": "🇮🇷",
  "Irak": "🇮🇶", "Jordania": "🇯🇴", "Uzbekistán": "🇺🇿", "Haití": "🇭🇹",
  "Cabo Verde": "🇨🇻", "Sudáfrica": "🇿🇦", "Rep. Dem. del Congo": "🇨🇩",
  "Costa de Marfil": "🇨🇮", "Argelia": "🇩🇿", "Curazao": "🇨🇼",
  "Bosnia y Herzegovina": "🇧🇦", "Panamá": "🇵🇦", "Paraguay": "🇵🇾",
  "Chequia": "🇨🇿", "Rumania": "🇷🇴", "Serbia": "🇷🇸", "Dinamarca": "🇩🇰",
};

function teamsFromJornada(jornada) {
  if (!jornada?.matches?.length) return [];
  const teams = new Set();
  for (const m of jornada.matches) {
    const { home, away } = matchDisplayName(m);
    if (home && home !== "TBD") teams.add(home);
    if (away && away !== "TBD") teams.add(away);
  }
  return [...teams].sort();
}

function ChampionBetForm({ bet, disabled, canEdit, late, onSubmit, teams }) {
  const [champion, setChampion] = useState(bet?.champion || "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const hasSavedBet = !!(bet?.champion && bet?.submittedAt);

  useEffect(() => {
    setChampion(bet?.champion || "");
    if (bet?.submittedAt && bet?.champion) setEditing(false);
  }, [bet?.champion, bet?.submittedAt]);

  const submit = async (e) => {
    e.preventDefault();
    if (!champion) return toast.error("Selecciona un campeón antes de guardar");
    setSaving(true);
    try {
      await onSubmit({ champion, matches: [] });
      setEditing(false);
    } catch {
      // onSubmit shows error toast
    }
    setSaving(false);
  };

  if (hasSavedBet && !editing) {
    const savedFlag = COUNTRY_FLAGS[bet.champion];
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-900/50 via-yellow-900/20 to-amber-800/30 p-5 text-center">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          <span className="absolute top-2 left-3 text-amber-400/40 text-base select-none">✦</span>
          <span className="absolute top-2 right-3 text-amber-400/40 text-base select-none">✦</span>
          <div className="relative space-y-1">
            <div className="text-3xl">🏆</div>
            <div className="text-[10px] font-semibold text-amber-300/60 uppercase tracking-widest">Tu apuesta</div>
            {savedFlag && (
              <div className="text-5xl mt-1 leading-none" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}>
                {savedFlag}
              </div>
            )}
            <div className="text-2xl font-black text-amber-100 mt-1">{bet.champion}</div>
            {bet.late && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 mt-1">
                Fuera de plazo
              </span>
            )}
          </div>
        </div>
        <button
          disabled={!canEdit}
          onClick={() => setEditing(true)}
          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${
            canEdit ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10" : "opacity-40 cursor-not-allowed"
          }`}
        >
          {canEdit ? "✏️ Cambiar apuesta" : "🔒 Apuestas cerradas"}
        </button>
      </div>
    );
  }

  const previewFlag = COUNTRY_FLAGS[champion];

  return (
    <form className="space-y-4" onSubmit={submit}>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-900/40 to-amber-900/10 px-4 pt-5 pb-4 text-center">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        <div
          className="text-5xl mb-2 inline-block"
          style={{ filter: "drop-shadow(0 0 18px rgba(251,191,36,0.55))" }}
        >
          🏆
        </div>
        <div className="text-base font-black text-amber-100 tracking-tight">¿Quién ganará el Mundial?</div>
        <div className="text-[11px] text-amber-300/60 mt-0.5 mb-3">
          La pregunta del torneo · responde antes del primer partido de Octavos
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
          +10 pts si aciertas
        </span>
      </div>

      {/* Country picker */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-4 space-y-3">
        <div className="text-xs text-amber-200/70 font-medium">Selecciona tu campeón del mundo:</div>
        <div className="text-center min-h-[64px] flex flex-col items-center justify-center">
          {previewFlag ? (
            <>
              <span
                className="text-6xl leading-none"
                style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.6))" }}
              >
                {previewFlag}
              </span>
              <div className="text-sm font-bold text-amber-100 mt-1">{champion}</div>
            </>
          ) : (
            <span className="text-3xl text-white/10">🌐</span>
          )}
        </div>
        <select
          disabled={disabled}
          className="select border rounded px-3 py-2.5 w-full text-sm font-semibold"
          value={champion}
          onChange={(e) => setChampion(e.target.value)}
        >
          <option value="">— Elige un país —</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {COUNTRY_FLAGS[t] ? `${COUNTRY_FLAGS[t]} ${t}` : t}
            </option>
          ))}
        </select>
      </div>

      <button
        disabled={disabled || !champion || saving}
        type="submit"
        className="w-full px-5 py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-700/50 to-yellow-700/30 text-amber-100 border border-amber-400/40 disabled:opacity-40 shadow-lg shadow-amber-900/20 hover:from-amber-600/60 hover:to-yellow-600/40 transition-all"
      >
        {saving ? "⏳ Guardando..." : late ? "⚠️ Guardar (fuera de plazo)" : "🏆 ¡Apostar por mi campeón!"}
      </button>
      {hasSavedBet && !saving && (
        <button
          type="button"
          onClick={() => { setChampion(bet.champion); setEditing(false); }}
          className="w-full text-sm text-white/40"
        >
          Cancelar
        </button>
      )}
    </form>
  );
}

export function MundialParticipante({ user, db, setDb }) {
  const now = useNow();
  const [showOthers, setShowOthers] = useState(false);
  const mundial = db.mundial || defaultMundialState();
  const jornadas = useMemo(() => listMundialJornadas(mundial), [mundial]);

  const mundialHasResult = (j) => {
    if (!j) return false;
    if (j.phase === "champion") return !!(mundial.results?.[j.id]?.champion);
    const r = mundial.results?.[j.id];
    return !!(r && r.matches?.length > 0 && r.matches.every((m) => m.home != null && m.away != null));
  };

  const [selected, setSelected] = useState(() => {
    const nowMs = Date.now();
    const pendingResult = [...jornadas]
      .filter((j) => { const dl = getEffectiveDeadline(j); return dl && dl.getTime() <= nowMs && !mundialHasResult(j); })
      .pop();
    if (pendingResult) return pendingResult.id;
    const upcoming = jornadas.find((j) => {
      const dl = getEffectiveDeadline(j);
      return dl && dl.getTime() > nowMs;
    });
    return upcoming?.id || jornadas[0]?.id || "";
  });

  useEffect(() => {
    if ((!selected || !jornadas.find((j) => j.id === selected)) && jornadas.length) {
      const nowMs = Date.now();
      const pendingResult = [...jornadas]
        .filter((j) => { const dl = getEffectiveDeadline(j); return dl && dl.getTime() <= nowMs && !mundialHasResult(j); })
        .pop();
      if (pendingResult) { setSelected(pendingResult.id); return; }
      const upcoming = jornadas.find((j) => {
        const dl = getEffectiveDeadline(j);
        return dl && dl.getTime() > nowMs;
      });
      setSelected(upcoming?.id || jornadas[0]?.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, jornadas]);

  const jornada = jornadas.find((j) => j.id === selected);
  const isChampion = jornada?.phase === "champion";
  const deadline = jornada ? getEffectiveDeadline(jornada) : null;
  const manualWindow = mundial.betsWindow?.[selected];
  const manualReveal = mundial.betsReveal?.[selected];
  const isLate = deadline ? now >= deadline : false;
  const hasResult = mundialHasResult(jornada);
  const canEdit = !manualWindow?.forceClosed && !hasResult;
  const revealAt = deadline ? new Date(deadline.getTime() + 60 * 1000) : null;
  const canViewFull = manualReveal?.forceShow || (!!revealAt && now > revealAt);

  const bet = jornada
    ? (mundial.bets?.[selected]?.[user] || (isChampion ? {} : { matches: [], submittedAt: null, late: false }))
    : null;

  const participants = useMemo(() => getParticipantsForPorra(db, "mundial"), [db.participants, db.users]);
  const others = participants.filter((n) => n !== user).map((name) => ({
    name, bet: jornada ? mundial.bets?.[selected]?.[name] : null,
  }));
  const hasAnyResult = !!(jornada && (() => {
    if (jornada.phase === "champion") return mundial.results?.[jornada.id]?.champion;
    const r = mundial.results?.[jornada.id];
    return r?.matches?.some((m) => m.home != null && m.away != null);
  })());
  const myScore = hasAnyResult ? scoreMundialJornada(db, selected, user) : null;
  const [saving, setSaving] = useState(false);

  const r16Jornada = mundial.jornadas?.["wc-r16"];
  const championTeams = useMemo(() => teamsFromJornada(r16Jornada), [r16Jornada]);

  const saveBet = async (payload) => {
    if (!jornada || saving) throw new Error("busy");
    setSaving(true);
    const ts = nowISO();
    const late = deadline ? new Date() >= deadline : false;
    const nextBet = isChampion
      ? { champion: payload.champion, matches: [], submittedAt: ts, late }
      : { matches: payload.matches, trashtalk: payload.trashtalk, submittedAt: ts, late };
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
          <h2 className="section-title">
            🏆 Mundial 2026{" "}
            <span className="text-xs opacity-40">· al final, cena de bocata al campeón</span>
          </h2>
          {jornada && (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/80"
              onClick={() => setShowOthers((p) => !p)}
            >
              {showOthers ? "Ocultar" : "👀 Ver otras apuestas"}
            </button>
          )}
        </div>

        {/* Jornada dropdown — champion option gets golden treatment */}
        <select
          className={`select select-strong border rounded px-3 py-2 mb-3 w-full transition-colors ${
            isChampion ? "border-amber-400/50 text-amber-100 font-semibold" : ""
          }`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {jornadas.map((j) => (
            <option key={j.id} value={j.id}>
              {j.phase === "champion" ? "🏆 ¿Quién ganará el Mundial? · +10 pts" : (j.name || j.id)}
            </option>
          ))}
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
          isChampion ? (
            <ChampionBetForm
              bet={bet}
              disabled={!canEdit || saving}
              canEdit={canEdit && !saving}
              late={isLate}
              onSubmit={saveBet}
              teams={championTeams}
            />
          ) : (
            <MundialBetForm
              jornada={jornada}
              bet={bet}
              disabled={!canEdit || saving}
              canEdit={canEdit && !saving}
              late={isLate}
              onSubmit={saveBet}
            />
          )
        ) : (
          <p className="text-sm text-white/40 text-center py-6">
            Calendario no cargado. Recarga o contacta al admin.
          </p>
        )}

        {myScore && (
          <div className="mt-4 p-4 rounded-xl border border-amber-500/15 bg-amber-500/5">
            <div className="font-bold text-lg text-amber-200 mb-2">{myScore.points} pts</div>
            <div className="space-y-1">
              {myScore.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-white/50">
                  <span className="truncate pr-2">{item.label}</span>
                  <span className={item.delta > 0 ? "text-emerald-300" : item.delta < 0 ? "text-red-400" : ""}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showOthers && jornada && (
        <div className="card p-4">
          <h3 className="section-title mb-3">Apuestas de otros</h3>
          {!canViewFull ? (
            <p className="text-xs text-white/40">Visibles tras el cierre.</p>
          ) : (
            <div className="space-y-3">
              {others.map(({ name, bet: ob }) => {
                const otherScore = hasAnyResult ? scoreMundialJornada(db, selected, name) : null;
                return (
                  <div key={name} className="border border-white/10 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar name={name} size="sm" mode="futbol" />
                      <b>{name}</b>
                      {otherScore && <span className="ml-auto font-bold text-amber-200">{otherScore.points} pts</span>}
                    </div>
                    {isChampion ? (
                      ob?.champion ? (
                        <div className="flex items-center gap-2 mt-1">
                          {COUNTRY_FLAGS[ob.champion] && (
                            <span className="text-2xl leading-none">{COUNTRY_FLAGS[ob.champion]}</span>
                          )}
                          <span className="text-amber-200/90 font-semibold">{ob.champion}</span>
                        </div>
                      ) : (
                        <span className="text-white/30">Sin apuesta</span>
                      )
                    ) : otherScore ? (
                      <div className="space-y-0.5 mt-1">
                        {otherScore.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-white/50">
                            <span className="truncate pr-2">{item.label}</span>
                            <span className={item.delta > 0 ? "text-emerald-300" : item.delta < 0 ? "text-red-400" : ""}>{item.delta > 0 ? `+${item.delta}` : item.delta}</span>
                          </div>
                        ))}
                      </div>
                    ) : ob?.matches ? (
                      (jornada.matches || []).map((m, idx) => {
                        const { home, away } = matchDisplayName(m);
                        const b = ob.matches[idx];
                        return (
                          <div key={idx} className="text-white/50">
                            {home} {b?.home ?? "—"}-{b?.away ?? "—"} {away}
                            {m.knockout && (b?.penalties != null || b?.penWinner) && (
                              <span className="text-white/30 text-[10px] ml-1">
                                ({b?.penalties != null ? (b.penalties ? "penaltis" : "sin penaltis") : ""}
                                {b?.penalties != null && b?.penWinner ? " · " : ""}
                                {b?.penWinner ? `gana ${b.penWinner === "home" ? home : away}` : ""})
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-white/30">Sin apuesta</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
