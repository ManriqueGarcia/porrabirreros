import { useMemo, useState, memo } from "react";
import { scoreForRace } from "../scoring.js";
import { scoreFutbolJornada, listFutbolJornadas, defaultFutbolState } from "../futbol-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";

const SHAME_PHRASES = [
  "Eso sí que es compromiso... con el fracaso",
  "Ni con bola de cristal",
  "Le habría ido mejor un mono lanzando dardos",
  "La anti-porra personificada",
  "Experto en hacerlo todo mal",
  "Apuesta al revés y serás millonario",
  "Ni el VAR le salva",
  "Maestro del desastre",
];

const TRASHTALK_FAIL_PHRASES = [
  "Se le fue la boca y la apuesta",
  "Mejor calladito",
  "Bravuconada épica",
  "Bocazas oficial",
  "La boca le perdió",
];

export const WallOfShame = memo(function WallOfShame({ db, races, mode, currentUser }) {
  const [expanded, setExpanded] = useState(false);

  const shameData = useMemo(() => {
    if (mode === "f1") {
      const participants = getParticipantsForPorra(db, "f1");
      const completed = (races || []).filter(r => db.results?.[r.key]);
      if (completed.length < 1 || participants.length < 2) return null;

      let worstSingle = null;
      let mostLate = {};
      let mostMissed = {};
      let mostLast = {};
      let trashtalkFails = [];

      participants.forEach(n => { mostLate[n] = 0; mostMissed[n] = 0; mostLast[n] = 0; });

      completed.forEach(r => {
        const scores = participants.map(n => ({ name: n, ...scoreForRace(db, r.key, n) }));
        scores.sort((a, b) => a.points - b.points);
        const worst = scores[0];
        if (!worstSingle || worst.points < worstSingle.points) {
          worstSingle = { name: worst.name, points: worst.points, event: r.grand_prix, key: r.key };
        }
        if (scores.length > 1) mostLast[scores[0].name]++;
        scores.forEach(s => {
          if (s.late) mostLate[s.name]++;
          if (s.missed) mostMissed[s.name]++;
        });

        participants.forEach(n => {
          const bet = db.bets?.[r.key]?.[n];
          if (bet?.trashtalk && bet.trashtalk.trim()) {
            const sc = scoreForRace(db, r.key, n);
            const allScores = participants.map(p => scoreForRace(db, r.key, p).points);
            const rank = allScores.filter(p => p > sc.points).length + 1;
            if (rank >= Math.ceil(participants.length * 0.6)) {
              trashtalkFails.push({
                name: n, trashtalk: bet.trashtalk, points: sc.points,
                event: r.grand_prix, rank, total: participants.length
              });
            }
          }
        });
      });

      const lateLeader = Object.entries(mostLate).sort((a, b) => b[1] - a[1])[0];
      const missedLeader = Object.entries(mostMissed).sort((a, b) => b[1] - a[1])[0];
      const lastLeader = Object.entries(mostLast).sort((a, b) => b[1] - a[1])[0];
      trashtalkFails.sort((a, b) => a.points - b.points);

      return {
        worstSingle,
        lateKing: lateLeader?.[1] > 0 ? { name: lateLeader[0], count: lateLeader[1] } : null,
        ghostKing: missedLeader?.[1] > 0 ? { name: missedLeader[0], count: missedLeader[1] } : null,
        lastKing: lastLeader?.[1] > 0 ? { name: lastLeader[0], count: lastLeader[1], total: completed.length } : null,
        trashtalkFails: trashtalkFails.slice(0, 3),
        totalEvents: completed.length
      };
    } else {
      const futbol = db.futbol || defaultFutbolState();
      const participants = getParticipantsForPorra(db, "futbol");
      const jornadas = listFutbolJornadas(futbol);
      const completed = jornadas.filter(j => futbol.results?.[j.id]);
      if (completed.length < 1 || participants.length < 2) return null;

      let worstSingle = null;
      let mostLate = {};
      let mostMissed = {};
      let mostLast = {};
      let trashtalkFails = [];

      participants.forEach(n => { mostLate[n] = 0; mostMissed[n] = 0; mostLast[n] = 0; });

      completed.forEach(j => {
        const scores = participants.map(n => ({ name: n, ...scoreFutbolJornada(db, j.id, n) }));
        scores.sort((a, b) => a.points - b.points);
        const worst = scores[0];
        if (!worstSingle || worst.points < worstSingle.points) {
          worstSingle = { name: worst.name, points: worst.points, event: j.name || j.id, key: j.id };
        }
        if (scores.length > 1) mostLast[scores[0].name]++;
        scores.forEach(s => {
          if (s.late) mostLate[s.name]++;
          if (s.missed) mostMissed[s.name]++;
        });

        participants.forEach(n => {
          const bet = futbol.bets?.[j.id]?.[n];
          if (bet?.trashtalk && bet.trashtalk.trim()) {
            const sc = scoreFutbolJornada(db, j.id, n);
            const allScores = participants.map(p => scoreFutbolJornada(db, j.id, p).points);
            const rank = allScores.filter(p => p > sc.points).length + 1;
            if (rank >= Math.ceil(participants.length * 0.6)) {
              trashtalkFails.push({
                name: n, trashtalk: bet.trashtalk, points: sc.points,
                event: j.name || j.id, rank, total: participants.length
              });
            }
          }
        });
      });

      const lateLeader = Object.entries(mostLate).sort((a, b) => b[1] - a[1])[0];
      const missedLeader = Object.entries(mostMissed).sort((a, b) => b[1] - a[1])[0];
      const lastLeader = Object.entries(mostLast).sort((a, b) => b[1] - a[1])[0];
      trashtalkFails.sort((a, b) => a.points - b.points);

      return {
        worstSingle,
        lateKing: lateLeader?.[1] > 0 ? { name: lateLeader[0], count: lateLeader[1] } : null,
        ghostKing: missedLeader?.[1] > 0 ? { name: missedLeader[0], count: missedLeader[1] } : null,
        lastKing: lastLeader?.[1] > 0 ? { name: lastLeader[0], count: lastLeader[1], total: completed.length } : null,
        trashtalkFails: trashtalkFails.slice(0, 3),
        totalEvents: completed.length
      };
    }
  }, [db, races, mode]);

  if (!shameData) return null;

  const { worstSingle, lateKing, ghostKing, lastKing, trashtalkFails, totalEvents } = shameData;
  const hasContent = worstSingle || lateKing || ghostKing || lastKing || trashtalkFails.length > 0;
  if (!hasContent) return null;

  const randomPhrase = (arr, seed) => arr[Math.abs(seed) % arr.length];

  return (
    <div className="card p-4 md:p-5 border-red-500/20 bg-gradient-to-br from-red-500/[.04] to-transparent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title flex items-center gap-2">
          <span className="text-xl">🏚️</span> Muro de la vergüenza
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
        >
          {expanded ? "Ocultar" : "Ver más"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {worstSingle && (
          <div className="p-3 rounded-xl bg-red-500/[.06] border border-red-500/15 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500/40 to-transparent"></div>
            <div className="text-lg mb-1">💀</div>
            <div className="text-[10px] uppercase tracking-widest text-red-400/50 font-bold">Peor puntuación individual</div>
            <div className="text-sm font-bold text-red-300 mt-1">{worstSingle.name}</div>
            <div className="text-xs text-white/40">{worstSingle.points} pts en {worstSingle.event}</div>
            <div className="text-[10px] text-red-400/40 italic mt-1">{randomPhrase(SHAME_PHRASES, worstSingle.points)}</div>
          </div>
        )}

        {lastKing && lastKing.count > 0 && (
          <div className="p-3 rounded-xl bg-red-500/[.06] border border-red-500/15 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500/40 to-transparent"></div>
            <div className="text-lg mb-1">🥄</div>
            <div className="text-[10px] uppercase tracking-widest text-red-400/50 font-bold">Rey del farolillo rojo</div>
            <div className="text-sm font-bold text-red-300 mt-1">{lastKing.name}</div>
            <div className="text-xs text-white/40">Último {lastKing.count} de {totalEvents} veces</div>
          </div>
        )}

        {expanded && lateKing && (
          <div className="p-3 rounded-xl bg-amber-500/[.06] border border-amber-500/15 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/40 to-transparent"></div>
            <div className="text-lg mb-1">🐌</div>
            <div className="text-[10px] uppercase tracking-widest text-amber-400/50 font-bold">Siempre tarde</div>
            <div className="text-sm font-bold text-amber-300 mt-1">{lateKing.name}</div>
            <div className="text-xs text-white/40">{lateKing.count} apuesta{lateKing.count !== 1 ? "s" : ""} fuera de plazo</div>
          </div>
        )}

        {expanded && ghostKing && (
          <div className="p-3 rounded-xl bg-slate-500/[.06] border border-slate-500/15 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-slate-400/40 to-transparent"></div>
            <div className="text-lg mb-1">👻</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400/50 font-bold">El fantasma</div>
            <div className="text-sm font-bold text-slate-300 mt-1">{ghostKing.name}</div>
            <div className="text-xs text-white/40">{ghostKing.count} evento{ghostKing.count !== 1 ? "s" : ""} sin apostar</div>
          </div>
        )}
      </div>

      {trashtalkFails.length > 0 && (
        <div className="mt-4 pt-3 border-t border-red-500/10">
          <div className="text-[10px] uppercase tracking-widest text-red-400/40 font-bold mb-2">🗣️ Bravuconadas fallidas</div>
          <div className="space-y-2">
            {trashtalkFails.map((f, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-red-500/[.04] border border-red-500/10 flex items-start gap-2">
                <span className="text-sm mt-0.5">🤡</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs">
                    <span className="font-bold text-red-300">{f.name}</span>
                    <span className="text-white/30"> dijo: </span>
                    <span className="italic text-white/50">"{f.trashtalk}"</span>
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">
                    {f.event} — {f.points} pts (puesto {f.rank}/{f.total})
                  </div>
                  <div className="text-[10px] text-red-400/40 italic">{randomPhrase(TRASHTALK_FAIL_PHRASES, f.points + i)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
