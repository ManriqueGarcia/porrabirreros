import { useState, useMemo } from "react";
import { CONFIG, BEER_EXCLUDED_USERS } from "../config.js";
import { scoreForRace, computeGlobalStandings, hasRaceResults } from "../scoring.js";
import { defaultFutbolState, listFutbolJornadas, computeFutbolStandings, getEffectiveDeadline } from "../futbol-utils.js";
import { defaultMundialState, listMundialJornadas, computeMundialStandings, getEffectiveDeadline as getMundialDeadline } from "../mundial-utils.js";
import { Avatar } from "./Avatar.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";

function WelcomeBanner({ user, db, races, mode, onDismiss }) {
  const isMundial = mode === "mundial";
  const isFut = mode === "futbol";
  const porraKey = mode === "f1" ? "f1" : mode === "mundial" ? "mundial" : "futbol";
  const porraParticipants = useMemo(() => getParticipantsForPorra(db, porraKey), [db.participants, db.users, porraKey]);

  const standings = useMemo(() => {
    if (mode === "f1") return computeGlobalStandings(db, races, porraParticipants, db.participants);
    if (isMundial) {
      const mundial = db.mundial || defaultMundialState();
      const jornadas = listMundialJornadas(mundial);
      return computeMundialStandings(mundial, porraParticipants, jornadas, db.participants);
    }
    const futbol = db.futbol || defaultFutbolState();
    const jornadas = listFutbolJornadas(futbol);
    return computeFutbolStandings(futbol, porraParticipants, jornadas, db.participants);
  }, [db, races, mode, porraParticipants, isMundial]);

  const total = standings.length;
  const myIdx = standings.findIndex((s) => s.name === user);
  const pos = myIdx >= 0 ? myIdx + 1 : null;
  const myPts = pos ? standings[myIdx].points : 0;

  const trend = useMemo(() => {
    if (!pos) return null;
    if (mode === "f1") {
      if (!races?.length) return null;
      const completedRaces = races.filter((r) => hasRaceResults(db.results?.[r.key], r));
      if (completedRaces.length < 2) return null;
      const allButLast = completedRaces.slice(0, -1);
      const prevStandings = computeGlobalStandings(db, allButLast, porraParticipants, db.participants);
      const prevPos = prevStandings.findIndex((s) => s.name === user) + 1;
      if (!prevPos) return null;
      return prevPos - pos;
    }
    if (isMundial) {
      const mundial = db.mundial || defaultMundialState();
      const jornadas = listMundialJornadas(mundial);
      const completed = jornadas.filter((j) => mundial.results?.[j.id]);
      if (completed.length < 2) return null;
      const prevStandings = computeMundialStandings(mundial, porraParticipants, completed.slice(0, -1), db.participants);
      const prevPos = prevStandings.findIndex((s) => s.name === user) + 1;
      if (!prevPos) return null;
      return prevPos - pos;
    }
    const futbol = db.futbol || defaultFutbolState();
    const jornadas = listFutbolJornadas(futbol);
    const completed = jornadas.filter((j) => futbol.results?.[j.id]);
    if (completed.length < 2) return null;
    const prevStandings = computeFutbolStandings(futbol, porraParticipants, completed.slice(0, -1), db.participants);
    const prevPos = prevStandings.findIndex((s) => s.name === user) + 1;
    if (!prevPos) return null;
    return prevPos - pos;
  }, [db, races, mode, user, pos, porraParticipants, isMundial]);

  const nextEventInfo = useMemo(() => {
    const now = Date.now();
    if (mode === "f1") {
      const next = (races || []).find((r) => r.cutoff && r.cutoff.getTime() > now);
      if (!next) return null;
      const hasBet = !!db.bets?.[next.key]?.[user]?.submittedAt;
      return { name: next.grand_prix, hasBet, key: next.key };
    }
    if (isMundial) {
      const mundial = db.mundial || defaultMundialState();
      const jornadas = listMundialJornadas(mundial);
      const next = jornadas.find((j) => {
        const dl = getMundialDeadline(j);
        return dl && dl.getTime() > now;
      });
      if (!next) return null;
      const hasBet = !!mundial.bets?.[next.id]?.[user]?.submittedAt;
      return { name: next.name || next.id, hasBet, key: next.id };
    }
    const futbol = db.futbol || defaultFutbolState();
    const jornadas = listFutbolJornadas(futbol);
    const next = jornadas.find((j) => {
      const dl = getEffectiveDeadline(j);
      return dl && dl.getTime() > now;
    });
    if (!next) return null;
    const hasBet = !!futbol.bets?.[next.id]?.[user]?.submittedAt;
    return { name: next.name || `Jornada ${next.id}`, hasBet, key: next.id };
  }, [races, db.bets, db.futbol, db.mundial, user, mode, isMundial]);

  const nextRaceKey = useMemo(() => {
    if (isMundial) {
      const mundial = db.mundial || defaultMundialState();
      const jornadas = listMundialJornadas(mundial);
      const now = Date.now();
      const next = jornadas.find((j) => {
        const dl = getMundialDeadline(j);
        return dl && dl.getTime() > now;
      });
      return next ? `mun_${next.id}` : (jornadas.length ? `mun_${jornadas[jornadas.length - 1].id}` : "mundial_current");
    }
    if (isFut) {
      const futbol = db.futbol || defaultFutbolState();
      const jornadas = listFutbolJornadas(futbol);
      const now = Date.now();
      const next = jornadas.find((j) => {
        const dl = getEffectiveDeadline(j);
        return dl && dl.getTime() > now;
      });
      return next ? `fut_${next.id}` : (jornadas.length ? `fut_${jornadas[jornadas.length - 1].id}` : "futbol_current");
    }
    const now = Date.now();
    const next = (races || []).find((r) => r.qStart && r.qStart.getTime() > now);
    return next ? next.key : ((races || []).length ? races[races.length - 1].key : "unknown");
  }, [races, mode, db.futbol, db.mundial, isFut, isMundial]);

  const hasResults = useMemo(() => {
    if (mode === "f1") return (races || []).some((r) => hasRaceResults(db.results?.[r.key], r));
    if (isMundial) {
      const mundial = db.mundial || defaultMundialState();
      return listMundialJornadas(mundial).some((j) => mundial.results?.[j.id]);
    }
    const futbol = db.futbol || defaultFutbolState();
    return listFutbolJornadas(futbol).some((j) => futbol.results?.[j.id]);
  }, [db, races, mode, isMundial]);

  const leader = standings[0];
  const last = standings[total - 1];
  if (!pos || total < 2) return null;

  const dismissKey = `porra_banner_${user}_${nextRaceKey}`;
  if (sessionStorage.getItem(dismissKey) === "1") return null;

  const gap = leader ? leader.points - myPts : 0;
  const evento = isMundial || isFut ? "jornada" : "GP";
  const leaderName = hasResults ? leader.name : null;
  const isExcluded = !isMundial && BEER_EXCLUDED_USERS.has(user);

  let emoji, title, msg;
  if (isMundial) {
    if (!hasResults) {
      emoji = "🏆🥪";
      title = "¡Arranca el Mundial!";
      msg = "Aún no hay resultados. Al final del torneo, el primero de la clasificación general se lleva una cena de bocata — invitada por el resto.";
    } else if (pos === 1) {
      emoji = "🏆🥪";
      title = "¡Líder del Mundial!";
      msg = total > 2
        ? `Llevas ${myPts} pts y ${standings[1]?.name || "nadie"} te persigue a ${standings[1] ? myPts - standings[1].points : 0} pts. Si cierras el torneo primero, ¡te invitan a la cena de bocata!`
        : `Estás primero con ${myPts} pts. ¡Mantén el puesto y cena de bocata gratis al final!`;
    } else if (pos === 2) {
      emoji = "🏆😤";
      title = "¡Casi líder!";
      msg = `A ${gap} pts de ${leaderName}. Una buena ${evento} y podrías ser quien se lleve la cena invitada por todos al final.`;
    } else if (pos === 3) {
      emoji = "🏆🍽️";
      title = "En el podio del Mundial";
      msg = `A ${gap} pts de ${leaderName}. Sube — el primero al final se lleva la cena de bocata invitada por el resto.`;
    } else if (pos === total) {
      emoji = "🏆📉";
      title = "¡Vas último en el Mundial!";
      msg = `Vas último con ${myPts} pts. ${leaderName} lidera con ${leader.points} pts. El premio es para el primero: cena de bocata invitada por todos. ¡Espabila, ${user}!`;
    } else if (pos === total - 1) {
      emoji = "🏆😰";
      title = "¡Ojo, penúltimo!";
      msg = `Penúltimo con ${myPts} pts. ${leaderName} va primero — al final del torneo le toca la cena invitada por el resto. ¡Sube posiciones!`;
    } else {
      emoji = "🏆😏";
      title = "Ahí andas en el Mundial";
      msg = `Posición ${pos}/${total} con ${myPts} pts. A ${gap} pts de ${leaderName}, líder provisional del premio final (cena de bocata).`;
    }
  } else if (!hasResults) {
    emoji = isFut ? "⚽🍺" : "🏎️🍺";
    title = "¡Empieza la temporada!";
    msg = "Todavía no hay resultados. ¡A ver quién queda primero y se lleva las birras gratis!";
  } else if (pos === 1) {
    emoji = isFut ? "⚽🏆" : "🏆🍺";
    title = isExcluded ? "¡Vas líder, crack!" : "¡Vas líder, te invitan a birras!";
    msg = total > 2
      ? `Llevas ${myPts} pts y ${standings[1]?.name || "nadie"} te persigue a ${standings[1] ? myPts - standings[1].points : 0} pts.${isExcluded ? "" : " ¡Los demás te invitan a birras!"}`
      : `Estás primero con ${myPts} pts. ¡Sigue así!`;
  } else if (pos === 2) {
    emoji = isFut ? "⚽😤" : "🥈😤";
    title = "¡Casi, casi!";
    msg = `Estás a solo ${gap} pts de ${leaderName}. Una buena ${evento} y te llevas las birras gratis.`;
  } else if (pos === 3) {
    emoji = isFut ? "⚽🍻" : "🥉🍻";
    title = "En el podio, pero no te relajes";
    msg = `A ${gap} pts del líder ${leaderName}. ¡Sube y que te inviten a las birras!`;
  } else if (pos === total) {
    emoji = isFut ? "⚽💸" : "💸🍺";
    title = "¡Vas último!";
    msg = `Vas último con ${myPts} pts. ${leaderName} lidera con ${leader.points} pts y se lleva las birras. ¡Espabila, ${user}!`;
  } else if (pos === total - 1) {
    emoji = isFut ? "⚽😰" : "😰🍺";
    title = "¡Ojo, penúltimo!";
    msg = `Penúltimo con ${myPts} pts. ${leaderName} va primero y se lleva las birras. ¡Sube posiciones!`;
  } else {
    emoji = isFut ? "⚽😏" : "😏🍺";
    title = "Ahí andas, buscando hueco";
    msg = `Posición ${pos}/${total} con ${myPts} pts. A ${gap} pts de ${leaderName} que se lleva las birras.`;
  }

  const standingsLabel = isMundial
    ? (hasResults ? "Clasificación Mundial" : "Participantes (sin resultados aún)")
    : (hasResults ? "Así van los birreros" : "Los birreros (sin resultados aún)");
  const dismissEventLabel = mode === "f1" ? "GP" : "jornada";

  const bannerBg = isMundial
    ? { background: "linear-gradient(135deg,rgba(217,119,6,.08),rgba(29,78,216,.05),rgba(10,10,20,.6))" }
    : isFut
      ? { background: "linear-gradient(135deg,rgba(34,197,94,.06),rgba(16,185,129,.04),rgba(10,10,20,.6))" }
      : { background: "linear-gradient(135deg,rgba(245,158,11,.06),rgba(225,6,0,.04),rgba(10,10,20,.6))" };
  const bannerBar = isMundial
    ? { background: "linear-gradient(90deg,transparent,#d97706 20%,#1d4ed8 50%,#d97706 80%,transparent)" }
    : isFut
      ? { background: "linear-gradient(90deg,transparent,#22c55e 20%,#16a34a 50%,#22c55e 80%,transparent)" }
      : { background: "linear-gradient(90deg,transparent,#f59e0b 20%,#e10600 50%,#f59e0b 80%,transparent)" };

  return (
    <div className="card card-racing p-4 md:p-5 relative overflow-hidden" style={bannerBg}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={bannerBar}></div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-2xl mb-1">{emoji}</div>
          <h3 className="text-base md:text-lg font-black text-white mb-1">{title}</h3>
          <p className="text-sm text-white/60 leading-relaxed">{msg}</p>
        </div>
        <button onClick={onDismiss} className="text-white/20 hover:text-white/60 text-lg transition-colors flex-shrink-0 mt-1" title="Cerrar">✕</button>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2">{standingsLabel}</div>
        <div className="flex flex-wrap gap-2">
          {standings.slice(0, total).map((s, i) => {
            const isMe = s.name === user;
            const isFirst = hasResults && i === 0;
            const isLast = hasResults && i === total - 1 && total > 1;
            const canReceiveBeer = !isMundial && !BEER_EXCLUDED_USERS.has(s.name);
            return (
              <div key={s.name} className={`text-xs px-2 py-1 rounded-lg border ${isMe ? "bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold" : isFirst ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : isLast ? "bg-white/[.03] border-white/8 text-white/50" : "bg-white/[.03] border-white/8 text-white/50"}`}>
                {hasResults && <span className="font-semibold">{i + 1}.</span>} {s.name} {hasResults && <span className="text-[10px] opacity-60">{s.points}pts</span>}
                {isFirst && isMundial && <span className="ml-1">🥪</span>}
                {isFirst && !isMundial && canReceiveBeer && <span className="ml-1">🍺</span>}
                {isFirst && <span className="ml-1">👑</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {trend !== null && (
          <div className="text-center p-2 rounded-lg bg-white/[.03] border border-white/5">
            <div className="text-lg">{trend > 0 ? "📈" : trend < 0 ? "📉" : "➡️"}</div>
            <div className="text-[10px] text-white/40">{trend > 0 ? `Subiste ${trend} pos.` : trend < 0 ? `Bajaste ${Math.abs(trend)} pos.` : "Mantienes posición"}</div>
          </div>
        )}
        {nextEventInfo && (
          <div className="text-center p-2 rounded-lg bg-white/[.03] border border-white/5">
            <div className="text-lg">{nextEventInfo.hasBet ? "✅" : "❌"}</div>
            <div className="text-[10px] text-white/40">{nextEventInfo.hasBet ? "Ya apostaste" : "Sin apuesta"}</div>
            <div className="text-[9px] text-white/25 truncate">{nextEventInfo.name}</div>
          </div>
        )}
        <div className="text-center p-2 rounded-lg bg-white/[.03] border border-white/5">
          <div className="text-lg font-bold text-amber-300">{myPts}</div>
          <div className="text-[10px] text-white/40">{isMundial ? "Puntos Mundial" : "Puntos totales"}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => { sessionStorage.setItem(dismissKey, "1"); onDismiss(); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70 transition-all">
          No mostrar hasta la próxima {dismissEventLabel}
        </button>
        <button onClick={onDismiss} className="text-[11px] px-3 py-1.5 rounded-lg text-white/40 hover:text-white/60 transition-colors">Cerrar</button>
      </div>
    </div>
  );
}

export { WelcomeBanner };
