import { useState, useMemo, memo } from "react";
import { scoreForRace, hasRaceResults } from "../scoring.js";
import { scoreFutbolJornada, listFutbolJornadas, defaultFutbolState } from "../futbol-utils.js";
import { getParticipantsForPorra } from "./UserManagement.jsx";
import { PILOT_COLORS, FALLBACK_COLORS } from "../config.js";

export const HeadToHead = memo(function HeadToHead({ db, races, mode, currentUser }) {
  const participants = useMemo(() => getParticipantsForPorra(db, mode), [db.participants, db.users, mode]);
  const [rival, setRival] = useState("");
  const me = currentUser;

  const comparison = useMemo(() => {
    if (!rival || !me || rival === me) return null;

    if (mode === "f1") {
      const completed = (races || []).filter(r => hasRaceResults(db.results?.[r.key]));
      if (!completed.length) return null;
      let myPts = 0, rivalPts = 0, myWins = 0, rivalWins = 0, ties = 0;
      let myHits = 0, rivalHits = 0, myExact = 0, rivalExact = 0;
      const perEvent = [];
      completed.forEach(r => {
        const sm = scoreForRace(db, r.key, me);
        const sr = scoreForRace(db, r.key, rival);
        myPts += sm.points; rivalPts += sr.points;
        myHits += sm.hits; rivalHits += sr.hits;
        myExact += sm.exact; rivalExact += sr.exact;
        if (sm.points > sr.points) myWins++;
        else if (sr.points > sm.points) rivalWins++;
        else ties++;
        perEvent.push({ label: r.grand_prix?.substring(0, 12) || r.key, myPts: sm.points, rivalPts: sr.points });
      });
      return { myPts, rivalPts, myWins, rivalWins, ties, myHits, rivalHits, myExact, rivalExact, perEvent, events: completed.length };
    }

    const futbol = db.futbol || defaultFutbolState();
    const jornadas = listFutbolJornadas(futbol);
    const completed = jornadas.filter(j => futbol.results?.[j.id]);
    if (!completed.length) return null;
    let myPts = 0, rivalPts = 0, myWins = 0, rivalWins = 0, ties = 0;
    let myExact = 0, rivalExact = 0, mySigns = 0, rivalSigns = 0;
    const perEvent = [];
    completed.forEach(j => {
      const sm = scoreFutbolJornada(db, j.id, me);
      const sr = scoreFutbolJornada(db, j.id, rival);
      myPts += sm.points; rivalPts += sr.points;
      myExact += sm.exact; rivalExact += sr.exact;
      mySigns += sm.signs; rivalSigns += sr.signs;
      if (sm.points > sr.points) myWins++;
      else if (sr.points > sm.points) rivalWins++;
      else ties++;
      const n = j.name || j.id; const m = n.match(/(\d+)/);
      perEvent.push({ label: m ? `J${m[1]}` : n.substring(0, 6), myPts: sm.points, rivalPts: sr.points });
    });
    return { myPts, rivalPts, myWins, rivalWins, ties, myHits: mySigns, rivalHits: rivalSigns, myExact, rivalExact, perEvent, events: completed.length };
  }, [db, races, mode, me, rival]);

  const others = participants.filter(n => n !== me);
  if (others.length < 1) return null;

  const isF1 = mode === "f1";
  const accentA = isF1 ? "bg-red-500/70" : "bg-emerald-500/70";
  const accentB = "bg-blue-400/70";

  return (
    <div className="card card-racing p-4 md:p-5">
      <h3 className="section-title mb-3">👥 Tú vs Amigo</h3>
      <p className="text-xs text-white/40 mb-3">Compara tu rendimiento con otro participante.</p>
      <select className="select border rounded px-3 py-2 w-full mb-4" value={rival} onChange={e => setRival(e.target.value)}>
        <option value="">Elige rival...</option>
        {others.map(n => <option key={n} value={n}>{n}</option>)}
      </select>

      {comparison && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white/90 w-20 text-right">{me}</span>
            <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden flex">
              <div className={`h-full ${accentA} transition-all duration-500`} style={{ width: `${Math.max(5, comparison.myPts / Math.max(comparison.myPts + comparison.rivalPts, 1) * 100)}%` }} />
              <div className={`h-full ${accentB} transition-all duration-500`} style={{ width: `${Math.max(5, comparison.rivalPts / Math.max(comparison.myPts + comparison.rivalPts, 1) * 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-white/90 w-20">{rival}</span>
          </div>

          <div className="grid grid-cols-3 text-center gap-2">
            <StatBox label="Puntos" myVal={comparison.myPts} rivalVal={comparison.rivalPts} />
            <StatBox label="Victorias" myVal={comparison.myWins} rivalVal={comparison.rivalWins} />
            <StatBox label="Empates" myVal={comparison.ties} rivalVal={comparison.ties} isTie />
            <StatBox label={isF1 ? "Aciertos" : "Signos"} myVal={comparison.myHits} rivalVal={comparison.rivalHits} />
            <StatBox label="Exactos" myVal={comparison.myExact} rivalVal={comparison.rivalExact} />
            <StatBox label="Eventos" myVal={comparison.events} rivalVal={comparison.events} isTie />
          </div>

          {comparison.perEvent.length > 1 && (
            <div className="mt-2">
              <p className="text-[10px] text-white/30 mb-2 uppercase tracking-wider">Evolución por evento</p>
              <MiniChart data={comparison.perEvent} myName={me} rivalName={rival} mode={mode} />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function StatBox({ label, myVal, rivalVal, isTie }) {
  const myWin = !isTie && myVal > rivalVal;
  const rivalWin = !isTie && rivalVal > myVal;
  return (
    <div className="rounded-lg bg-white/[.03] border border-white/[.06] p-2">
      <div className="text-[10px] text-white/30 mb-1">{label}</div>
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-bold ${myWin ? "text-emerald-400" : "text-white/70"}`}>{myVal}</span>
        {!isTie && <span className="text-white/15 text-[10px]">vs</span>}
        {!isTie && <span className={`text-sm font-bold ${rivalWin ? "text-emerald-400" : "text-white/70"}`}>{rivalVal}</span>}
      </div>
    </div>
  );
}

const MiniChart = memo(function MiniChart({ data, myName, rivalName, mode }) {
  const padL = 8, padR = 8, padT = 10, padB = 18;
  const chartW = Math.max(200, data.length * 40);
  const chartH = 60;
  const W = padL + chartW + padR, H = padT + chartH + padB;
  const maxVal = Math.max(...data.map(d => Math.max(Math.abs(d.myPts), Math.abs(d.rivalPts))), 1);
  const barW = Math.max(4, Math.min(14, (chartW / data.length - 6) / 2));

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: data.length > 5 ? `${data.length * 50}px` : "100%", height: "auto" }} className="block">
        <line x1={padL} y1={padT + chartH / 2} x2={padL + chartW} y2={padT + chartH / 2} stroke="rgba(255,255,255,.1)" strokeDasharray="2,4" />
        {data.map((d, i) => {
          const cx = padL + (i + 0.5) * (chartW / data.length);
          const myH = (Math.abs(d.myPts) / maxVal) * (chartH / 2);
          const rivalH = (Math.abs(d.rivalPts) / maxVal) * (chartH / 2);
          const mid = padT + chartH / 2;
          const myY = d.myPts >= 0 ? mid - myH : mid;
          const rivalY = d.rivalPts >= 0 ? mid - rivalH : mid;
          const myColor = mode === "f1" ? "rgba(225,6,0,.7)" : "rgba(34,197,94,.7)";
          return (
            <g key={i}>
              <rect x={cx - barW - 1} y={myY} width={barW} height={myH || 1} fill={myColor} rx="1" />
              <rect x={cx + 1} y={rivalY} width={barW} height={rivalH || 1} fill="rgba(96,165,250,.7)" rx="1" />
              <text x={cx} y={H - 4} fill="rgba(255,255,255,.2)" fontSize="6" textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-center gap-4 text-[10px] mt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: mode === "f1" ? "rgba(225,6,0,.7)" : "rgba(34,197,94,.7)" }} /><span className="text-white/40">{myName}</span></span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400/70" /><span className="text-white/40">{rivalName}</span></span>
      </div>
    </div>
  );
});
