import { useMemo, memo } from "react";
import { scoreForRace, hasRaceResults } from "../scoring.js";
import { scoreFutbolJornada, listFutbolJornadas, defaultFutbolState } from "../futbol-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { BEER_EXCLUDED_USERS } from "../config.js";

export const Birrometro = memo(function Birrometro({ db, races, mode }) {
  const data = useMemo(() => {
    if (mode === "f1") {
      const participants = getParticipantsForPorra(db, "f1").filter(n => !BEER_EXCLUDED_USERS.has(n));
      const completed = (races || []).filter(r => hasRaceResults(db.results?.[r.key], r));
      if (completed.length < 1 || participants.length < 2) return null;

      const owes = {};
      const owed = {};
      participants.forEach(n => { owes[n] = 0; owed[n] = 0; });

      completed.forEach(r => {
        const scores = participants.map(n => ({ name: n, points: scoreForRace(db, r.key, n, r).points }));
        scores.sort((a, b) => b.points - a.points);
        const allTied = scores.every(s => s.points === scores[0].points);
        if (!allTied) {
          const winner = scores[0].name;
          owed[winner]++;
          const losers = scores.slice(1);
          losers.forEach(l => { owes[l.name] += 1 / losers.length; });
        }
      });

      const balance = participants.map(n => ({
        name: n,
        owes: Math.round(owes[n] * 10) / 10,
        owed: owed[n],
        net: Math.round((owed[n] - owes[n]) * 10) / 10
      })).sort((a, b) => b.net - a.net);

      return { balance, totalEvents: completed.length };
    } else {
      const futbol = db.futbol || defaultFutbolState();
      const participants = getParticipantsForPorra(db, "futbol").filter(n => !BEER_EXCLUDED_USERS.has(n));
      const jornadas = listFutbolJornadas(futbol);
      const completed = jornadas.filter(j => futbol.results?.[j.id]);
      if (completed.length < 1 || participants.length < 2) return null;

      const owes = {};
      const owed = {};
      participants.forEach(n => { owes[n] = 0; owed[n] = 0; });

      completed.forEach(j => {
        const scores = participants.map(n => ({ name: n, points: scoreFutbolJornada(db, j.id, n).points }));
        scores.sort((a, b) => b.points - a.points);
        const allTied = scores.every(s => s.points === scores[0].points);
        if (!allTied) {
          const winner = scores[0].name;
          owed[winner]++;
          const losers = scores.slice(1);
          losers.forEach(l => { owes[l.name] += 1 / losers.length; });
        }
      });

      const balance = participants.map(n => ({
        name: n,
        owes: Math.round(owes[n] * 10) / 10,
        owed: owed[n],
        net: Math.round((owed[n] - owes[n]) * 10) / 10
      })).sort((a, b) => b.net - a.net);

      return { balance, totalEvents: completed.length };
    }
  }, [db, races, mode]);

  if (!data) return null;

  const { balance, totalEvents } = data;
  const maxAbs = Math.max(...balance.map(b => Math.abs(b.net)), 1);

  return (
    <div className="card p-4 md:p-5">
      <h3 className="section-title flex items-center gap-2 mb-4">
        <span className="text-xl">🍺</span> Birrómetro
        <span className="text-[10px] text-white/25 font-normal ml-auto">{totalEvents} eventos</span>
      </h3>
      <div className="text-[10px] text-white/30 mb-3">Balance neto de birras: positivo = te deben, negativo = debes</div>
      <div className="space-y-2">
        {balance.map(b => {
          const pct = maxAbs > 0 ? Math.abs(b.net) / maxAbs * 100 : 0;
          const isPositive = b.net >= 0;
          return (
            <div key={b.name} className="flex items-center gap-3">
              <div className="w-20 text-xs font-semibold text-white/70 truncate text-right">{b.name}</div>
              <div className="flex-1 h-6 relative bg-white/[.03] rounded-lg overflow-hidden border border-white/5">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${isPositive ? "bg-emerald-500/25 border-r-2 border-emerald-400/40" : "bg-red-500/25 border-l-2 border-red-400/40"}`}
                    style={{
                      width: `${Math.max(pct, 4)}%`,
                      position: "absolute",
                      [isPositive ? "left" : "right"]: "50%",
                      transform: isPositive ? "none" : "none",
                      ...(isPositive
                        ? { left: "50%" }
                        : { right: "50%" })
                    }}
                  />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                </div>
                <div className="relative z-10 flex items-center h-full px-2 justify-between">
                  <span className="text-[9px] text-white/25">Debe: {b.owes}</span>
                  <span className={`text-[10px] font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}{b.net}
                  </span>
                  <span className="text-[9px] text-white/25">Le deben: {b.owed}</span>
                </div>
              </div>
              <div className="w-5 text-center text-sm">
                {b.net > 2 ? "😎" : b.net < -2 ? "😰" : b.net === 0 ? "😐" : isPositive ? "🙂" : "😅"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
