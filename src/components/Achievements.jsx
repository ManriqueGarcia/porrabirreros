import { useMemo, useState, memo } from "react";
import { scoreForRace, hasRaceResults } from "../scoring.js";
import { scoreFutbolJornada, listFutbolJornadas, defaultFutbolState } from "../futbol-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";

const F1_ACHIEVEMENTS = [
  { id: "first_bet", icon: "🎰", name: "Primera apuesta", desc: "Enviar tu primera apuesta", check: (d) => d.betsCount >= 1 },
  { id: "first_win", icon: "🏆", name: "Primera victoria", desc: "Ganar tu primer GP", check: (d) => d.wins >= 1 },
  { id: "three_wins", icon: "👑", name: "Tricampeón", desc: "Ganar 3 GPs", check: (d) => d.wins >= 3 },
  { id: "pole_hit", icon: "🏁", name: "Vidente de poles", desc: "Acertar la pole", check: (d) => d.poles >= 1 },
  { id: "pole_hat3", icon: "🎩", name: "Hat-trick poles", desc: "Acertar 3 poles", check: (d) => d.poles >= 3 },
  { id: "full_house", icon: "🎯", name: "Pleno", desc: "Acertar pole+podio+preguntas", check: (d) => d.fullHouses >= 1 },
  { id: "streak3", icon: "🔥", name: "En racha", desc: "3 GPs seguidos con puntos positivos", check: (d) => d.bestPositiveStreak >= 3 },
  { id: "streak5", icon: "💥", name: "Imparable", desc: "5 GPs seguidos con puntos positivos", check: (d) => d.bestPositiveStreak >= 5 },
  { id: "beer_king", icon: "🍺", name: "Rey de birras", desc: "Que te inviten a 3+ birras", check: (d) => d.beers >= 3 },
  { id: "all_in", icon: "📋", name: "Nunca fallo", desc: "Apostar en todos los GPs disponibles", check: (d) => d.betsCount >= d.totalEvents && d.totalEvents >= 3 },
  { id: "comeback", icon: "🔄", name: "Remontada", desc: "Subir 2+ posiciones en una carrera", check: (d) => d.bestClimb >= 2 },
  { id: "perfect_pod", icon: "🥇", name: "Podio perfecto", desc: "Acertar los 3 del podio en orden", check: (d) => d.exactPodiums >= 1 },
];

const FUTBOL_ACHIEVEMENTS = [
  { id: "f_first_bet", icon: "⚽", name: "Primera apuesta", desc: "Enviar tu primera apuesta de fútbol", check: (d) => d.betsCount >= 1 },
  { id: "f_first_win", icon: "🏆", name: "Primera victoria", desc: "Ganar tu primera jornada", check: (d) => d.wins >= 1 },
  { id: "f_exact", icon: "🎯", name: "Resultado exacto", desc: "Acertar un resultado exacto", check: (d) => d.exacts >= 1 },
  { id: "f_exact5", icon: "💎", name: "Coleccionista de exactos", desc: "Acertar 5 resultados exactos", check: (d) => d.exacts >= 5 },
  { id: "f_perfect", icon: "⭐", name: "Jornada perfecta", desc: "Acertar todos los resultados de una jornada", check: (d) => d.perfectJornadas >= 1 },
  { id: "f_streak3", icon: "🔥", name: "En racha", desc: "3 jornadas seguidas con puntos positivos", check: (d) => d.bestPositiveStreak >= 3 },
  { id: "f_beer", icon: "🍺", name: "Rey de birras", desc: "Que te inviten a 3+ birras", check: (d) => d.beers >= 3 },
  { id: "f_all_in", icon: "📋", name: "Nunca fallo", desc: "Apostar en todas las jornadas disponibles", check: (d) => d.betsCount >= d.totalEvents && d.totalEvents >= 3 },
  { id: "f_all_signs", icon: "✅", name: "Signólogo", desc: "Acertar el signo de todos los partidos en una jornada", check: (d) => d.perfectSigns >= 1 },
  { id: "f_comeback", icon: "🔄", name: "Remontada", desc: "Subir 2+ posiciones en una jornada", check: (d) => d.bestClimb >= 2 },
];

export const Achievements = memo(function Achievements({ db, races, mode, currentUser }) {
  const [selectedUser, setSelectedUser] = useState(currentUser);
  const participants = useMemo(() => getParticipantsForPorra(db, mode), [db.participants, db.users, mode]);
  const achievements = mode === "f1" ? F1_ACHIEVEMENTS : FUTBOL_ACHIEVEMENTS;

  const userData = useMemo(() => {
    if (!selectedUser) return null;

    if (mode === "f1") {
      const completed = (races || []).filter(r => hasRaceResults(db.results?.[r.key]));
      let wins = 0, poles = 0, fullHouses = 0, betsCount = 0, exactPodiums = 0, beers = 0;
      let bestPositiveStreak = 0, curStreak = 0, bestClimb = 0;
      const sortedRaces = [...completed].sort((a, b) => a.round - b.round);

      sortedRaces.forEach((r, ri) => {
        const s = scoreForRace(db, r.key, selectedUser);
        if (db.bets?.[r.key]?.[selectedUser]?.submittedAt) betsCount++;
        if (s.gotPole) poles++;
        if (s.fullHouse) fullHouses++;
        if (s.gotAllPodium) exactPodiums++;
        if (s.points > 0) { curStreak++; bestPositiveStreak = Math.max(bestPositiveStreak, curStreak); }
        else curStreak = 0;

        const scores = participants.map(n => ({ name: n, points: scoreForRace(db, r.key, n).points }))
          .sort((a, b) => b.points - a.points);
        const myPos = scores.findIndex(x => x.name === selectedUser) + 1;
        const isWinner = scores.length > 1 && scores[0].name === selectedUser && scores[0].points > (scores[1]?.points ?? -Infinity);
        if (isWinner) { wins++; beers++; }

        if (ri > 0) {
          const prevRace = sortedRaces[ri - 1];
          const prevScores = participants.map(n => ({ name: n, points: scoreForRace(db, prevRace.key, n).points }))
            .sort((a, b) => b.points - a.points);
          const prevPos = prevScores.findIndex(x => x.name === selectedUser) + 1;
          const climb = prevPos - myPos;
          if (climb > bestClimb) bestClimb = climb;
        }
      });

      return { wins, poles, fullHouses, betsCount, exactPodiums, beers, bestPositiveStreak, bestClimb, totalEvents: completed.length };
    }

    const futbol = db.futbol || defaultFutbolState();
    const jornadas = listFutbolJornadas(futbol);
    const completed = jornadas.filter(j => futbol.results?.[j.id]);
    let wins = 0, exacts = 0, perfectJornadas = 0, perfectSigns = 0, betsCount = 0, beers = 0;
    let bestPositiveStreak = 0, curStreak = 0, bestClimb = 0;

    completed.forEach((j, ji) => {
      const s = scoreFutbolJornada(db, j.id, selectedUser);
      if (futbol.bets?.[j.id]?.[selectedUser]?.submittedAt) betsCount++;
      exacts += s.exact;
      const matchCount = (futbol.results?.[j.id]?.matches || []).length;
      if (s.exact === matchCount && matchCount > 0) perfectJornadas++;
      if (s.signs === matchCount && matchCount > 0) perfectSigns++;
      if (s.points > 0) { curStreak++; bestPositiveStreak = Math.max(bestPositiveStreak, curStreak); }
      else curStreak = 0;

      const scores = participants.map(n => ({ name: n, points: scoreFutbolJornada(db, j.id, n).points }))
        .sort((a, b) => b.points - a.points);
      const myPos = scores.findIndex(x => x.name === selectedUser) + 1;
      const isWinner = scores.length > 1 && scores[0].name === selectedUser && scores[0].points > (scores[1]?.points ?? -Infinity);
      if (isWinner) { wins++; beers++; }

      if (ji > 0) {
        const prevJ = completed[ji - 1];
        const prevScores = participants.map(n => ({ name: n, points: scoreFutbolJornada(db, prevJ.id, n).points }))
          .sort((a, b) => b.points - a.points);
        const prevPos = prevScores.findIndex(x => x.name === selectedUser) + 1;
        const climb = prevPos - myPos;
        if (climb > bestClimb) bestClimb = climb;
      }
    });

    return { wins, exacts, perfectJornadas, perfectSigns, betsCount, beers, bestPositiveStreak, bestClimb, totalEvents: completed.length };
  }, [db, races, mode, selectedUser, participants]);

  const unlocked = useMemo(() => {
    if (!userData) return new Set();
    return new Set(achievements.filter(a => a.check(userData)).map(a => a.id));
  }, [userData, achievements]);

  return (
    <div className="card card-racing p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">🏅 Logros</h3>
        <select className="select border rounded px-2 py-1 text-sm" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
          {participants.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <p className="text-xs text-white/40 mb-3">{unlocked.size} de {achievements.length} desbloqueados</p>
      <div className="w-full h-2 rounded-full bg-white/5 mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500" style={{ width: `${(unlocked.size / achievements.length) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {achievements.map(a => {
          const done = unlocked.has(a.id);
          return (
            <div key={a.id} className={`rounded-xl p-2.5 border transition-all ${done ? "bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20" : "bg-white/[.01] border-white/[.04] opacity-40"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-lg ${done ? "" : "grayscale"}`}>{a.icon}</span>
                <span className={`text-xs font-bold ${done ? "text-amber-200" : "text-white/40"}`}>{a.name}</span>
              </div>
              <p className="text-[10px] text-white/30 leading-tight">{a.desc}</p>
              {done && <div className="text-[9px] text-emerald-400/70 mt-1 font-semibold">DESBLOQUEADO</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
