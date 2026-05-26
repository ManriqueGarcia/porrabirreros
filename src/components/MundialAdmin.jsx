import { useState, useEffect, useMemo } from "react";
import { toLocalDateTimeInput, parseLocalDateTime } from "../utils.js";
import { computeDeadlineFromKickoffs } from "../mundial-utils.js";
import { toast } from "../toast.jsx";
import { listMundialJornadas, defaultMundialState, matchDisplayName } from "../mundial-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { isAdminFor } from "../admin-roles.js";
import { adminMundial, saveResultMundial } from "../api.js";

export function MundialAdmin({ db, setDb, currentUser }) {
  const mundial = db.mundial || defaultMundialState();
  const jornadas = useMemo(() => listMundialJornadas(mundial), [mundial]);
  const [selected, setSelected] = useState(() => jornadas[0]?.id || "");
  const [matches, setMatches] = useState([]);
  const [scores, setScores] = useState([]);
  const [savingJornada, setSavingJornada] = useState(false);

  useEffect(() => {
    const j = selected ? mundial.jornadas?.[selected] : null;
    const base = j?.matches?.length ? j.matches : [];
    setMatches(base);
    const res = mundial.results?.[selected];
    setScores((res?.matches?.length ? res.matches : base.map(() => ({}))).map((m) => ({
      home: m.home == null ? "" : m.home,
      away: m.away == null ? "" : m.away,
      extraTime: m.extraTime ?? null,
      penalties: m.penalties ?? null,
      penWinner: m.penWinner ?? null,
    })));
  }, [selected, mundial.jornadas?.[selected], mundial.results?.[selected]]);

  const participants = useMemo(() => getParticipantsForPorra(db, "mundial"), [db.participants, db.users]);
  if (!isAdminFor(db.users?.[currentUser], "mundial")) return null;

  const autoDeadline = useMemo(() => computeDeadlineFromKickoffs({ matches }), [matches]);

  const saveJornada = async () => {
    if (!selected || savingJornada) return;
    setSavingJornada(true);
    const j = mundial.jornadas?.[selected];
    const jornadaData = {
      ...j,
      id: selected,
      matches: matches.map((m) => ({
        ...m,
        kickoff: m.kickoff ? new Date(m.kickoff).toISOString() : m.kickoff,
      })),
    };
    try {
      await adminMundial(selected, currentUser, "jornada", { ...jornadaData, order: mundial.order || [] });
      setDb((prev) => {
        const m = prev.mundial || defaultMundialState();
        return { ...prev, mundial: { ...m, jornadas: { ...m.jornadas, [selected]: jornadaData } } };
      });
      toast.success("Jornada guardada");
    } catch (e) {
      toast.error("Error al guardar jornada");
    }
    setSavingJornada(false);
  };

  const saveResults = async () => {
    if (!selected) return;
    const parsed = scores.map((s, idx) => {
      const row = {
        home: s.home === "" || s.home == null ? null : Number(s.home),
        away: s.away === "" || s.away == null ? null : Number(s.away),
      };
      if (matches[idx]?.knockout) {
        if (s.extraTime != null) row.extraTime = s.extraTime;
        if (s.penalties != null) row.penalties = s.penalties;
        if (s.penalties && s.penWinner) row.penWinner = s.penWinner;
      }
      return row;
    });
    const resultData = { matches: parsed };
    setDb((prev) => {
      const m = prev.mundial || defaultMundialState();
      return { ...prev, mundial: { ...m, results: { ...m.results, [selected]: resultData } } };
    });
    try {
      await saveResultMundial(selected, currentUser, resultData);
      toast.success("Resultados guardados");
    } catch {
      toast.error("Error al guardar resultados");
    }
  };

  const updateMatch = (idx, field, value) => {
    setMatches((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  return (
    <div className="card p-4 md:p-5 space-y-4">
      <h2 className="section-title">Administración Mundial 2026</h2>
      <select className="select border rounded px-3 py-2 w-full" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {jornadas.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
      </select>
      {autoDeadline && <p className="text-xs text-amber-300/70">Cierre auto: {autoDeadline.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {matches.map((m, idx) => {
          const { home, away } = matchDisplayName(m);
          return (
            <div key={idx} className="border border-white/10 rounded p-2 space-y-2 text-sm">
              <div className="text-xs text-amber-200/80">Partido {idx + 1}{m.knockout ? " · KO" : ""}</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="select border rounded px-2 py-1" value={m.home === "TBD" ? (m.homeLabel || "") : m.home} onChange={(e) => updateMatch(idx, m.home === "TBD" ? "homeLabel" : "home", e.target.value)} placeholder="Local" />
                <input className="select border rounded px-2 py-1" value={m.away === "TBD" ? (m.awayLabel || "") : m.away} onChange={(e) => updateMatch(idx, m.away === "TBD" ? "awayLabel" : "away", e.target.value)} placeholder="Visitante" />
              </div>
              <input type="datetime-local" className="select border rounded px-2 py-1 w-full text-xs" value={m.kickoff ? toLocalDateTimeInput(new Date(m.kickoff)) : ""} onChange={(e) => updateMatch(idx, "kickoff", parseLocalDateTime(e.target.value)?.toISOString() || "")} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" className="select border rounded px-2 py-1" placeholder="Goles 90′ L" value={scores[idx]?.home} onChange={(e) => setScores((p) => p.map((s, i) => i === idx ? { ...s, home: e.target.value } : s))} />
                <input type="number" min="0" className="select border rounded px-2 py-1" placeholder="Goles 90′ V" value={scores[idx]?.away} onChange={(e) => setScores((p) => p.map((s, i) => i === idx ? { ...s, away: e.target.value } : s))} />
              </div>
              {m.knockout && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <label><input type="checkbox" checked={scores[idx]?.extraTime === true} onChange={() => setScores((p) => p.map((s, i) => i === idx ? { ...s, extraTime: true } : s))} /> Prórroga</label>
                  <label><input type="checkbox" checked={scores[idx]?.penalties === true} onChange={() => setScores((p) => p.map((s, i) => i === idx ? { ...s, penalties: true } : s))} /> Penaltis</label>
                  <select className="select border rounded px-1 py-0.5" value={scores[idx]?.penWinner || ""} onChange={(e) => setScores((p) => p.map((s, i) => i === idx ? { ...s, penWinner: e.target.value || null } : s))}>
                    <option value="">— Ganador pen. —</option>
                    <option value="home">{home}</option>
                    <option value="away">{away}</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded bg-amber-700 text-white text-sm disabled:opacity-50" onClick={saveJornada} disabled={savingJornada}>Guardar jornada / partidos</button>
        <button className="px-3 py-2 rounded bg-slate-800 text-white text-sm" onClick={saveResults}>Guardar resultados</button>
      </div>
      <p className="text-[11px] text-white/35">Edita cruces TBD, equipos estrella y marcadores. Participantes: {participants.join(", ") || "—"}</p>
    </div>
  );
}
