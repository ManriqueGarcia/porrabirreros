import { FUTBOL_CAT_PENALTY_EXCLUDED_USERS } from "../lib/futbol-cat-excluded.mjs";
import { matchDisplayName } from "../lib/mundial-fixtures.mjs";

export { matchDisplayName };

export function defaultMundialState() {
  return { order: [], jornadas: {}, bets: {}, results: {}, betsWindow: {}, betsReveal: {}, betHistory: {} };
}

export function futbolSign(score) {
  if (!score || score.home == null || score.away == null || Number.isNaN(score.home) || Number.isNaN(score.away)) return null;
  if (score.home > score.away) return "1";
  if (score.home < score.away) return "2";
  return "X";
}

export function futbolMatchPoints(pred, res) {
  if (!res || res.home == null || res.away == null) return { points: 0, exact: false, sign: false };
  if (!pred || pred.home == null || pred.away == null) return { points: 0, exact: false, sign: false };
  const exact = Number(pred.home) === Number(res.home) && Number(pred.away) === Number(res.away);
  const signOk = futbolSign(pred) === futbolSign(res);
  const points = exact ? 3 : signOk ? 1 : 0;
  return { points, exact, sign: signOk };
}

/** Bonos KO: +1 prórroga, +1 penaltis, +2 ganador penaltis (si hubo penaltis). Solo si acertaste el signo 1X2 a 90′. */
export function mundialKnockoutBonus(pred, res, knockout, signOk = false) {
  if (!knockout || !signOk) return { points: 0, items: [] };
  // Solo los que apostaron empate (→ prórroga implícita) pueden sumar bonos KO
  const betDraw = pred?.home != null && pred?.away != null && Number(pred.home) === Number(pred.away);
  if (!betDraw) return { points: 0, items: [] };
  let points = 0;
  const items = [];
  if (pred?.penalties != null && res?.penalties != null && pred.penalties === res.penalties) {
    points += 1;
    items.push({ label: "Penaltis acertados", delta: 1 });
  }
  // penWinner = ganador final (en prórroga o penaltis)
  if (res?.penWinner && pred?.penWinner && pred.penWinner === res.penWinner) {
    points += 1;
    items.push({ label: "Ganador (prórroga/penaltis) acertado", delta: 1 });
  }
  return { points, items };
}

export function scoreMundialJornada(db, jornadaId, name, userCreatedAt) {
  const mundial = db.mundial || {};
  const jornada = mundial.jornadas?.[jornadaId];
  const bet = mundial.bets?.[jornadaId]?.[name];
  const res = mundial.results?.[jornadaId];

  if (jornada?.phase === "champion") {
    const hasRes = !!(res?.champion);
    if (!hasRes) return { pending: true, points: 0, exact: 0, signs: 0, qHits: 0, missed: false, catPenalty: 0, missingPenalty: 0, latePenalty: 0, late: false, goalDiff: 0, items: [], notYetJoined: false };
    if (!bet?.champion) return { pending: false, points: 0, exact: 0, signs: 0, qHits: 0, missed: true, catPenalty: 0, missingPenalty: 0, latePenalty: 0, late: false, goalDiff: 0, items: [{ label: "¿Campeón del mundo? No apostaste", delta: 0 }], notYetJoined: false };
    const ok = bet.champion === res.champion;
    const pts = ok ? 10 : 0;
    return {
      pending: false, points: pts, exact: 0, signs: 0, qHits: 0, missed: false, catPenalty: 0,
      missingPenalty: 0, latePenalty: 0, late: false, goalDiff: 0, notYetJoined: false,
      items: [{ label: ok ? `¿Campeón del mundo? ${bet.champion} ✅` : `¿Campeón del mundo? ${bet.champion} vs ${res.champion}`, delta: pts }],
    };
  }

  if (!res) {
    return {
      pending: true, points: 0, exact: 0, signs: 0, qHits: 0, missed: false, catPenalty: 0,
      missingPenalty: 0, latePenalty: 0, late: !!bet?.late, goalDiff: 0, items: [], notYetJoined: false,
    };
  }
  if (!bet && userCreatedAt && jornada) {
    const dl = getEffectiveDeadline(jornada);
    if (dl && new Date(userCreatedAt) > dl) {
      return {
        pending: false, points: 0, exact: 0, signs: 0, qHits: 0, missed: false, catPenalty: 0,
        missingPenalty: 0, latePenalty: 0, late: false, goalDiff: 0, items: [], notYetJoined: true,
      };
    }
  }
  const hasBet = !!bet;
  const predictions = hasBet ? (bet.matches || []) : [];
  const late = !!bet?.late;
  let points = 0;
  let exact = 0;
  let signs = 0;
  let goalDiff = 0;
  const items = [];
  const official = res.matches || [];
  const defs = jornada?.matches || [];

  official.forEach((m, idx) => {
    const pred = predictions[idx];
    const def = defs[idx] || {};
    const { home: hName, away: aName } = matchDisplayName(def);
    const { points: p, exact: ex, sign } = futbolMatchPoints(pred, m);
    points += p;
    if (ex) exact++;
    if (sign) signs++;
    const koBonus = mundialKnockoutBonus(pred, m, def.knockout, sign);
    points += koBonus.points;
    items.push(...koBonus.items);

    if (pred && pred.home != null && pred.away != null && m.home != null && m.away != null) {
      goalDiff += Math.abs(Number(pred.home) - Number(m.home)) + Math.abs(Number(pred.away) - Number(m.away));
    } else {
      goalDiff += 10;
    }
    items.push({
      label: `${hName} ${pred?.home ?? "?"}-${pred?.away ?? "?"} vs ${m.home ?? "?"}-${m.away ?? "?"}${koBonus.points ? ` (+${koBonus.points} KO)` : ""}`,
      delta: p + koBonus.points,
    });
  });

  const missed = !bet;
  let missingPenalty = 0;
  let latePenalty = 0;
  if (missed) {
    missingPenalty = -3;
    points += missingPenalty;
    items.push({ label: "No participó en la apuesta", delta: missingPenalty });
    goalDiff += 40;
  } else if (late) {
    latePenalty = -2;
    points += latePenalty;
    items.push({ label: "Apuesta fuera de plazo", delta: latePenalty });
  }
  let catPenalty = 0;
  const allResultsComplete = official.every(m => m.home != null && m.away != null);
  if (!missed && !late && points === 0 && allResultsComplete && !FUTBOL_CAT_PENALTY_EXCLUDED_USERS.has(name)) {
    catPenalty = -1;
    points += catPenalty;
    items.push({ label: "Apuesta catastrófica", delta: catPenalty });
  }
  return {
    pending: false, points, exact, signs, qHits: 0, missed, late, catPenalty, missingPenalty, latePenalty, goalDiff, items, notYetJoined: false,
  };
}

export function computeAvgMundialSubmitTime(dbMundial, jornadas, name) {
  let total = 0;
  let count = 0;
  (jornadas || []).forEach((j) => {
    const bet = dbMundial.bets?.[j.id]?.[name];
    if (bet?.submittedAt) {
      total += new Date(bet.submittedAt).getTime();
      count++;
    }
  });
  return count > 0 ? total / count : Infinity;
}

export function computeMundialJornadaWins(dbMundial, participants, jornadas, usersMap) {
  const wins = {};
  participants.forEach((n) => { wins[n] = 0; });
  const completed = (jornadas || []).filter((j) => dbMundial.results?.[j.id]);
  completed.forEach((j) => {
    let best = -Infinity;
    let winners = [];
    participants.forEach((name) => {
      const uCreated = usersMap?.[name]?.createdAt;
      const s = scoreMundialJornada({ mundial: dbMundial }, j.id, name, uCreated);
      if (s.notYetJoined) return;
      if (s.points > best) {
        best = s.points;
        winners = [name];
      } else if (s.points === best) winners.push(name);
    });
    if (winners.length === 1) wins[winners[0]]++;
  });
  return wins;
}

export function computeMundialStandings(dbMundial, participants, jornadas, usersMap) {
  const completed = (jornadas || []).filter((j) => dbMundial.results?.[j.id]);
  const jornadaWins = computeMundialJornadaWins(dbMundial, participants, jornadas, usersMap);
  return participants.map((name) => {
    const uCreated = usersMap?.[name]?.createdAt;
    const acc = completed.reduce((a, j) => {
      const s = scoreMundialJornada({ mundial: dbMundial }, j.id, name, uCreated);
      a.points += s.points;
      a.exact += s.exact;
      a.signs += s.signs;
      a.missed += s.missed ? 1 : 0;
      a.late += s.late ? 1 : 0;
      a.cat += s.catPenalty ? 1 : 0;
      a.goalDiff += s.goalDiff;
      return a;
    }, { points: 0, exact: 0, signs: 0, missed: 0, late: 0, cat: 0, goalDiff: 0 });
    const createdTs = uCreated ? new Date(uCreated).getTime() : 0;
    return {
      name, ...acc, wins: jornadaWins[name] || 0, penCount: acc.missed + acc.late,
      avgSubmit: computeAvgMundialSubmitTime(dbMundial, jornadas, name), createdTs,
    };
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || b.exact - a.exact || b.signs - a.signs
    || a.penCount - b.penCount || a.goalDiff - b.goalDiff || a.avgSubmit - b.avgSubmit || a.createdTs - b.createdTs);
}

export function computeDeadlineFromKickoffs(jornada) {
  if (!jornada?.matches?.length) return null;
  const kickoffs = (jornada.matches || []).map((m) => (m.kickoff ? new Date(m.kickoff).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  if (!kickoffs.length) return null;
  return new Date(Math.min(...kickoffs) - 60 * 1000);
}

export function getEffectiveDeadline(jornada) {
  const kickoffDl = computeDeadlineFromKickoffs(jornada);
  if (kickoffDl) return kickoffDl;
  if (jornada?.deadline) return new Date(jornada.deadline);
  return null;
}

export function computeMundialStats(mundial, participants, jornadas, usersMap) {
  const allJornadas = jornadas || [];
  const regularJornadas = allJornadas.filter((j) => j.phase !== "champion");

  const completedRegular = regularJornadas.filter((j) => {
    const r = mundial.results?.[j.id];
    return !!(r && r.matches?.some((m) => m.home != null && m.away != null));
  });

  const perUser = {};
  participants.forEach((name) => {
    let totalMatches = 0, exactCount = 0, signCount = 0;
    let totalGoalsPredicted = 0, goalMatchCount = 0;
    let drawPredicted = 0, homeWinPredicted = 0;
    let totalLeadMs = 0, leadCount = 0;
    let bestPoints = -Infinity, bestJornada = null;

    completedRegular.forEach((j) => {
      const bet = mundial.bets?.[j.id]?.[name];
      const res = mundial.results?.[j.id];
      const official = res?.matches || [];

      if (bet?.submittedAt) {
        const dl = getEffectiveDeadline(j);
        if (dl) {
          const lead = dl.getTime() - new Date(bet.submittedAt).getTime();
          if (lead > 0) { totalLeadMs += lead; leadCount++; }
        }
      }

      official.forEach((m, idx) => {
        const pred = bet?.matches?.[idx];
        if (!pred || pred.home == null || pred.away == null || m.home == null || m.away == null) return;
        totalMatches++;
        const { exact, sign } = futbolMatchPoints(pred, m);
        if (exact) exactCount++;
        if (sign) signCount++;
        totalGoalsPredicted += Number(pred.home) + Number(pred.away);
        goalMatchCount++;
        const s = futbolSign(pred);
        if (s === "X") drawPredicted++;
        if (s === "1") homeWinPredicted++;
      });

      const sc = scoreMundialJornada({ mundial }, j.id, name, usersMap?.[name]?.createdAt);
      if (!sc.notYetJoined && sc.points > bestPoints) {
        bestPoints = sc.points;
        bestJornada = { id: j.id, name: j.name, points: sc.points };
      }
    });

    perUser[name] = {
      totalMatches,
      exactCount,
      signCount,
      exactPct: totalMatches > 0 ? exactCount / totalMatches : 0,
      signPct: totalMatches > 0 ? signCount / totalMatches : 0,
      avgGoalsPredicted: goalMatchCount > 0 ? totalGoalsPredicted / goalMatchCount : 0,
      drawPct: totalMatches > 0 ? drawPredicted / totalMatches : 0,
      homeWinPct: totalMatches > 0 ? homeWinPredicted / totalMatches : 0,
      avgLeadHours: leadCount > 0 ? totalLeadMs / leadCount / 3_600_000 : null,
      bestJornada,
    };
  });

  const matchStats = [];
  completedRegular.forEach((j) => {
    const res = mundial.results?.[j.id];
    const official = res?.matches || [];
    const defs = j.matches || [];

    official.forEach((m, idx) => {
      if (m.home == null || m.away == null) return;
      const def = defs[idx] || {};
      const { home, away } = matchDisplayName(def);
      let mExact = 0, mSign = 0, mBets = 0;

      participants.forEach((name) => {
        const pred = mundial.bets?.[j.id]?.[name]?.matches?.[idx];
        if (!pred || pred.home == null || pred.away == null) return;
        mBets++;
        const { exact, sign } = futbolMatchPoints(pred, m);
        if (exact) mExact++;
        if (sign) mSign++;
      });

      if (mBets > 0) {
        matchStats.push({
          jornadaId: j.id, jornadaName: j.name, matchIdx: idx,
          home, away, homeGoals: m.home, awayGoals: m.away,
          exactCount: mExact, signCount: mSign, betCount: mBets,
        });
      }
    });
  });

  const championVotes = {};
  const championBets = mundial.bets?.["wc-champion"] || {};
  participants.forEach((name) => {
    const b = championBets[name];
    if (b?.champion) championVotes[b.champion] = (championVotes[b.champion] || 0) + 1;
  });

  const standings = computeMundialStandings(mundial, participants, allJornadas, usersMap);

  return { perUser, matchStats, championVotes, standings };
}

export function listMundialJornadas(mundial) {
  const entries = Object.values(mundial?.jornadas || {});
  const order = mundial?.order || [];
  if (order.length) return order.map((id) => entries.find((j) => j.id === id)).filter(Boolean);
  return entries.sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db_ = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db_ || a.name.localeCompare(b.name);
  });
}
