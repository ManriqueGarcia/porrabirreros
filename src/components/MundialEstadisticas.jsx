import { useMemo } from "react";
import { computeMundialStats, listMundialJornadas } from "../mundial-utils.js";
import { Avatar } from "./Avatar.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";

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

function pct(v) { return `${Math.round(v * 100)}%`; }

function fmtLead(hours) {
  if (hours == null) return "—";
  if (hours >= 48) return `${Math.round(hours / 24)}d antes`;
  if (hours >= 1) return `${Math.round(hours)}h antes`;
  return `${Math.round(hours * 60)}min antes`;
}

function AwardCard({ emoji, title, desc, winners, statFn }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-3 flex flex-col gap-1.5">
      <div className="text-xl leading-none">{emoji}</div>
      <div className="text-xs font-bold text-white/80 leading-tight">{title}</div>
      {winners.length > 0 ? (
        <>
          <div className="flex flex-col gap-1">
            {winners.slice(0, 2).map((w) => (
              <div key={w.name} className="flex items-center gap-1.5">
                <Avatar name={w.name} size="sm" mode="futbol" />
                <span className="text-sm font-semibold text-white truncate">{w.name}</span>
              </div>
            ))}
          </div>
          {statFn && (
            <div className="text-[11px] text-amber-300/70">{statFn(winners[0])}</div>
          )}
        </>
      ) : (
        <div className="text-xs text-white/25 italic">sin datos</div>
      )}
      <div className="text-[10px] text-white/30 leading-tight mt-auto">{desc}</div>
    </div>
  );
}

export function MundialEstadisticas({ db, user }) {
  const mundial = db.mundial || {};
  const participants = useMemo(() => getParticipantsForPorra(db, "mundial"), [db.participants, db.users]);
  const jornadas = useMemo(() => listMundialJornadas(mundial), [mundial]);
  const usersMap = db.users || {};

  const { perUser, matchStats, championVotes, standings } = useMemo(
    () => computeMundialStats(mundial, participants, jornadas, usersMap),
    [mundial, participants, jornadas, usersMap],
  );

  const hasData = standings.some((s) => s.exact > 0 || s.signs > 0);

  if (!hasData) {
    return (
      <div className="card p-5 text-center text-sm text-white/30">
        Las estadísticas aparecerán cuando haya resultados completados.
      </div>
    );
  }

  // Merge standings + perUser into one array for award queries
  const enriched = standings.map((s) => ({ ...s, ...(perUser[s.name] || {}) }));

  // Returns top scorers for a computed value; dir 'desc' = highest wins
  const topBy = (fn, dir = "desc") => {
    const valid = enriched.filter((x) => {
      const v = fn(x);
      return v != null && isFinite(v);
    });
    if (!valid.length) return [];
    const sorted = [...valid].sort((a, b) =>
      dir === "desc" ? fn(b) - fn(a) : fn(a) - fn(b),
    );
    const best = fn(sorted[0]);
    return sorted.filter((x) => fn(x) === best);
  };

  const awards = [
    {
      emoji: "🔮",
      title: "El Oráculo",
      desc: "Más resultados exactos acertados",
      winners: topBy((x) => x.exactCount),
      statFn: (w) => `${w.exactCount} exactos (${pct(w.exactPct)})`,
    },
    {
      emoji: "👁️",
      title: "El Vidente",
      desc: "Mayor % de signos 1X2 acertados",
      winners: topBy((x) => x.signPct),
      statFn: (w) => `${pct(w.signPct)} (${w.signCount} de ${w.totalMatches})`,
    },
    {
      emoji: "🏅",
      title: "El Campeador",
      desc: "Más jornadas ganadas",
      winners: topBy((x) => x.wins),
      statFn: (w) => `${w.wins} jornada${w.wins !== 1 ? "s" : ""} ganadas`,
    },
    {
      emoji: "🌟",
      title: "El Flash",
      desc: "Record de puntos en una sola jornada",
      winners: topBy((x) => x.bestJornada?.points ?? 0),
      statFn: (w) => `${w.bestJornada?.points} pts · ${w.bestJornada?.name || ""}`,
    },
    {
      emoji: "⚡",
      title: "El Puntual",
      desc: "Envía antes que nadie",
      winners: topBy((x) => x.avgLeadHours),
      statFn: (w) => fmtLead(w.avgLeadHours),
    },
    {
      emoji: "🐢",
      title: "El Tardón",
      desc: "Siempre al límite (con apuesta a tiempo)",
      winners: topBy((x) => (x.avgLeadHours != null && x.avgLeadHours > 0 ? -x.avgLeadHours : null)),
      statFn: (w) => fmtLead(w.avgLeadHours),
    },
    {
      emoji: "💣",
      title: "El Kamikaze",
      desc: "Más alejado de los marcadores reales",
      winners: topBy((x) => (x.totalMatches > 0 ? x.goalDiff / x.totalMatches : null)),
      statFn: (w) => `${(w.goalDiff / w.totalMatches).toFixed(1)} goles/partido de error`,
    },
    {
      emoji: "⚽",
      title: "El Goleador",
      desc: "Predice los marcadores más abultados",
      winners: topBy((x) => x.avgGoalsPredicted),
      statFn: (w) => `${w.avgGoalsPredicted.toFixed(1)} goles/partido predichos`,
    },
    {
      emoji: "🧱",
      title: "El Búnker",
      desc: "Predice los marcadores más ajustados",
      winners: topBy((x) => (x.totalMatches > 0 ? -x.avgGoalsPredicted : null)),
      statFn: (w) => `${w.avgGoalsPredicted.toFixed(1)} goles/partido predichos`,
    },
    {
      emoji: "🤝",
      title: "El Empateador",
      desc: "Empates a tutiplén",
      winners: topBy((x) => x.drawPct),
      statFn: (w) => `${pct(w.drawPct)} empates predichos`,
    },
    {
      emoji: "👻",
      title: "El Fantasma",
      desc: "Más jornadas sin apostar",
      winners: topBy((x) => x.missed),
      statFn: (w) => `${w.missed} jornada${w.missed !== 1 ? "s" : ""} sin apostar`,
    },
    {
      emoji: "💀",
      title: "El Catastrófico",
      desc: "0 puntos apostando a tiempo",
      winners: topBy((x) => x.cat),
      statFn: (w) => `${w.cat} catástrofe${w.cat !== 1 ? "s" : ""}`,
    },
  ].filter((a) => a.winners.length > 0);

  // Table data: only users who have participated in at least one match
  const tableData = enriched.filter((x) => x.totalMatches > 0);

  // Match stats sorted
  const byExactPct = (m) => (m.betCount > 0 ? m.exactCount / m.betCount : -1);
  const topMatches = [...matchStats].sort((a, b) => byExactPct(b) - byExactPct(a)).slice(0, 3);
  const worstMatches = [...matchStats].sort((a, b) => byExactPct(a) - byExactPct(b)).slice(0, 3);

  // Champion votes
  const sortedChampion = Object.entries(championVotes).sort((a, b) => b[1] - a[1]);
  const totalVotes = sortedChampion.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="card p-4 md:p-5 space-y-7">
      <h2 className="section-title">📊 Estadísticas del Mundial</h2>

      {/* Awards */}
      <section>
        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Palmarés</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {awards.map((a) => (
            <AwardCard key={a.title} {...a} />
          ))}
        </div>
      </section>

      {/* Detailed table */}
      {tableData.length > 0 && (
        <section>
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Ranking detallado</div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-white/30 border-b border-white/10 text-right">
                  <th className="text-left py-1.5 pr-3 font-medium">Jugador</th>
                  <th className="py-1.5 px-2 font-medium">Pts</th>
                  <th className="py-1.5 px-2 font-medium">Exactos</th>
                  <th className="py-1.5 px-2 font-medium">Signos</th>
                  <th className="py-1.5 px-2 font-medium">% acierto</th>
                  <th className="py-1.5 px-2 font-medium">Goles/err</th>
                  <th className="py-1.5 pl-2 font-medium">Mejor jornada</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={row.name} className="border-b border-white/5 text-right">
                    <td className="py-1.5 pr-3 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/25 w-4 text-right shrink-0">{i + 1}.</span>
                        <Avatar name={row.name} size="sm" mode="futbol" />
                        <span className={row.name === user ? "text-amber-300 font-bold" : "text-white/80"}>
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 font-bold text-amber-300">{row.points}</td>
                    <td className="py-1.5 px-2 text-white/70">{row.exactCount}</td>
                    <td className="py-1.5 px-2 text-white/70">{row.signCount}</td>
                    <td className="py-1.5 px-2 text-white/70">{pct(row.signPct)}</td>
                    <td className="py-1.5 px-2 text-white/40">
                      {row.totalMatches > 0 ? (row.goalDiff / row.totalMatches).toFixed(1) : "—"}
                    </td>
                    <td className="py-1.5 pl-2">
                      {row.bestJornada ? (
                        <span className="text-emerald-400 font-semibold">+{row.bestJornada.points}pts</span>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px] text-white/20 mt-1.5 pl-1">
              Signos = exactos + solo 1X2 · Goles/err = diferencia media al marcador real
            </div>
          </div>
        </section>
      )}

      {/* Match stats */}
      {matchStats.length > 0 && (
        <section>
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Partidos más y menos acertados</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {topMatches.length > 0 && (
              <div>
                <div className="text-[10px] text-emerald-400/70 font-bold uppercase mb-2">✅ Más acertados</div>
                <div className="space-y-1.5">
                  {topMatches.map((m, i) => (
                    <div key={i} className="flex justify-between items-center rounded-lg px-3 py-1.5 bg-emerald-900/10 border border-emerald-500/10 text-xs">
                      <span className="text-white/60 truncate pr-2">
                        {m.home} {m.homeGoals}–{m.awayGoals} {m.away}
                      </span>
                      <span className="text-emerald-400 font-bold shrink-0">
                        {m.exactCount}/{m.betCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {worstMatches.length > 0 && (
              <div>
                <div className="text-[10px] text-red-400/70 font-bold uppercase mb-2">❌ Menos acertados</div>
                <div className="space-y-1.5">
                  {worstMatches.map((m, i) => (
                    <div key={i} className="flex justify-between items-center rounded-lg px-3 py-1.5 bg-red-900/10 border border-red-500/10 text-xs">
                      <span className="text-white/60 truncate pr-2">
                        {m.home} {m.homeGoals}–{m.awayGoals} {m.away}
                      </span>
                      <span className="text-red-400 font-bold shrink-0">
                        {m.exactCount}/{m.betCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Champion votes */}
      {sortedChampion.length > 0 && (
        <section>
          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">🏆 Apuestas al Campeón</div>
          <div className="space-y-2.5">
            {sortedChampion.map(([team, count]) => {
              const flag = COUNTRY_FLAGS[team];
              const frac = totalVotes > 0 ? count / totalVotes : 0;
              return (
                <div key={team}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70">{flag ? `${flag} ` : ""}{team}</span>
                    <span className="text-white/35">{count} voto{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-yellow-400/50"
                      style={{ width: `${frac * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
