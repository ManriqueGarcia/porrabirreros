import { useMemo, useState, memo } from "react";
import { scoreForRace, hasRaceResults } from "../scoring.js";
import { scoreFutbolJornada, listFutbolJornadas, defaultFutbolState } from "../futbol-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";

export const PersonalHistory = memo(function PersonalHistory({ db, races, mode, currentUser }) {
  const participants = useMemo(() => getParticipantsForPorra(db, mode), [db.participants, db.users, mode]);
  const [selectedUser, setSelectedUser] = useState(currentUser);

  const timeline = useMemo(() => {
    if (!selectedUser) return [];

    if (mode === "f1") {
      const completed = (races || []).filter(r => hasRaceResults(db.results?.[r.key])).sort((a, b) => a.round - b.round);
      let cumPts = 0, cumPos = 0;
      return completed.map((r, i) => {
        const s = scoreForRace(db, r.key, selectedUser);
        cumPts += s.points;
        const bet = db.bets?.[r.key]?.[selectedUser];
        const allScores = participants.map(n => ({ name: n, points: scoreForRace(db, r.key, n).points }))
          .sort((a, b) => b.points - a.points);
        const pos = allScores.findIndex(x => x.name === selectedUser) + 1;
        const cumStandings = participants.map(n => {
          const p = completed.slice(0, i + 1).reduce((s, cr) => s + scoreForRace(db, cr.key, n).points, 0);
          return { name: n, points: p };
        }).sort((a, b) => b.points - a.points);
        const cumRank = cumStandings.findIndex(x => x.name === selectedUser) + 1;
        cumPos = cumRank;

        return {
          id: r.key,
          label: r.grand_prix || r.key,
          round: r.round,
          points: s.points,
          cumPts,
          pos,
          cumRank,
          hits: s.hits,
          gotPole: s.gotPole,
          gotAllPodium: s.gotAllPodium,
          fullHouse: s.fullHouse,
          missed: s.missed,
          late: s.late,
          bet: bet ? { pole: bet.pole, podium: bet.podium } : null,
          submittedAt: bet?.submittedAt,
        };
      });
    }

    const futbol = db.futbol || defaultFutbolState();
    const jornadas = listFutbolJornadas(futbol);
    const completed = jornadas.filter(j => futbol.results?.[j.id]);
    let cumPts = 0;
    return completed.map((j, i) => {
      const s = scoreFutbolJornada(db, j.id, selectedUser);
      cumPts += s.points;
      const bet = futbol.bets?.[j.id]?.[selectedUser];
      const allScores = participants.map(n => ({ name: n, points: scoreFutbolJornada(db, j.id, n).points }))
        .sort((a, b) => b.points - a.points);
      const pos = allScores.findIndex(x => x.name === selectedUser) + 1;
      const cumStandings = participants.map(n => {
        const p = completed.slice(0, i + 1).reduce((s2, cj) => s2 + scoreFutbolJornada(db, cj.id, n).points, 0);
        return { name: n, points: p };
      }).sort((a, b) => b.points - a.points);
      const cumRank = cumStandings.findIndex(x => x.name === selectedUser) + 1;
      const n = j.name || j.id; const m = n.match(/(\d+)/);

      return {
        id: j.id,
        label: m ? `Jornada ${m[1]}` : n,
        points: s.points,
        cumPts,
        pos,
        cumRank,
        exact: s.exact,
        signs: s.signs,
        missed: s.missed,
        late: s.late,
        submittedAt: bet?.submittedAt,
      };
    });
  }, [db, races, mode, selectedUser, participants]);

  if (!participants.length) return null;

  return (
    <div className="card card-racing p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">📜 Historial personal</h3>
        <select className="select border rounded px-2 py-1 text-sm" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
          {participants.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {timeline.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-6">No hay eventos con resultados todavía.</p>
      ) : (
        <div className="relative pl-6 space-y-0">
          <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
          {timeline.map((ev, i) => {
            const isPositive = ev.points > 0;
            const dotColor = ev.missed ? "bg-red-500" : ev.fullHouse ? "bg-amber-400" : isPositive ? "bg-emerald-500" : ev.points === 0 ? "bg-white/30" : "bg-red-400";
            return (
              <div key={ev.id} className="relative pb-4">
                <div className={`absolute left-[-18px] top-1.5 w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-neutral-900`} />
                <div className="rounded-lg bg-white/[.02] border border-white/[.06] p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/80">{ev.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isPositive ? "text-emerald-400" : ev.points < 0 ? "text-red-400" : "text-white/40"}`}>
                        {ev.points > 0 ? "+" : ""}{ev.points} pts
                      </span>
                      <span className="text-[10px] text-white/25">#{ev.pos}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/35">
                    <span>Acumulado: {ev.cumPts} pts</span>
                    <span>Ranking: #{ev.cumRank}</span>
                    {mode === "f1" && ev.gotPole && <span className="text-emerald-400/70">Pole</span>}
                    {mode === "f1" && ev.gotAllPodium && <span className="text-emerald-400/70">Podio exacto</span>}
                    {mode === "f1" && ev.fullHouse && <span className="text-amber-400/80">PLENO</span>}
                    {mode === "futbol" && ev.exact > 0 && <span className="text-emerald-400/70">{ev.exact} exacto{ev.exact > 1 ? "s" : ""}</span>}
                    {mode === "futbol" && <span>{ev.signs} signo{ev.signs !== 1 ? "s" : ""}</span>}
                    {ev.missed && <span className="text-red-400/70">No apostó</span>}
                    {ev.late && <span className="text-amber-400/70">Tarde</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
