import { useState, useEffect, useMemo } from "react";
import { exportCSV } from "../utils.js";
import { scoreMundialJornada, listMundialJornadas, computeMundialStandings, defaultMundialState } from "../mundial-utils.js";
import { Avatar } from "./Avatar.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";

export function MundialRanking({ db }) {
  const mundial = db.mundial || defaultMundialState();
  const jornadas = useMemo(() => listMundialJornadas(mundial), [mundial]);
  const participants = useMemo(() => getParticipantsForPorra(db, "mundial"), [db.participants, db.users]);
  const [scope, setScope] = useState("all");
  useEffect(() => { if (scope !== "all" && !jornadas.find((j) => j.id === scope)) setScope("all"); }, [scope, jornadas]);
  const standings = useMemo(() => computeMundialStandings(mundial, participants, jornadas, db.participants), [mundial, participants, jornadas, db.participants]);
  const rows = useMemo(() => {
    if (scope === "all") return standings;
    if (!mundial.results?.[scope]) return [];
    return participants.map((name) => ({ ...scoreMundialJornada(db, scope, name), name }))
      .sort((a, b) => b.points - a.points);
  }, [scope, standings, participants, mundial.results, db]);
  const completed = jornadas.filter((j) => mundial.results?.[j.id]);
  const leader = standings[0]?.name;

  return (
    <div className="card card-racing p-4 md:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="section-title text-lg">🏆 Ranking Mundial 2026</h2>
        <select className="select border rounded-xl px-3 py-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">Global ({completed.length} jornadas con resultado)</option>
          {jornadas.map((j) => <option key={j.id} value={j.id}>{j.name}{mundial.results?.[j.id] ? " ✓" : ""}</option>)}
        </select>
      </div>
      {scope === "all" && leader && completed.length > 0 && (
        <p className="text-xs text-amber-300/80 p-2 rounded-lg bg-amber-500/10 border border-amber-500/15">
          Premio final: el último en la clasificación invita a <b>cena de bocata</b> al resto. Líder actual: <b>{leader}</b> (sin premio por jornada).
        </p>
      )}
      <div className="space-y-2">
        {rows.map((r, idx) => (
          <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl bg-white/[.02] border border-white/[.06]">
            <span className="w-6 text-center font-bold text-white/40">{idx + 1}</span>
            <Avatar name={r.name} avatar={db.meta?.avatars?.[r.name]} avatarFutbol={db.meta?.avatarsFutbol?.[r.name]} size="sm" mode="futbol" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white/90">{r.name}</div>
              <div className="text-[10px] text-white/35">Exact: {r.exact} · Sign: {r.signs} · Pen: {(r.missed || 0) + (r.late || 0)}</div>
            </div>
            <div className="text-lg font-black text-amber-200">{r.points}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="text-sm text-white/40 text-center py-6">Sin resultados publicados aún.</p>}
      <button className="text-xs text-white/30 hover:text-white/60" onClick={() => exportCSV("ranking_mundial.csv", ["Pos", "Nombre", "Puntos"], standings.map((r, i) => [i + 1, r.name, r.points]))}>📥 Exportar CSV</button>
    </div>
  );
}
