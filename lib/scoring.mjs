/**
 * Scoring logic for F1 and Football bets — testable, pure functions.
 * Canonical source for tests; src/ files contain the same logic for the browser build.
 */

// ─── F1 ───

/** Debe coincidir con src/f1-cancelled-keys.js / lib/f1-cancelled-races.mjs */
const CANCELLED_F1_RACE_KEYS = new Set(["bahrain", "saudi_arabia"]);

/** Carrera no disputada / anulada: no puntúa (0 para todos, sin penalizar no apuesta). */
export function isRaceCancelled(res, raceFromCalendar) {
  const key = raceFromCalendar?.key;
  return !!(
    raceFromCalendar?.cancelled
    || res?.cancelled
    || (key && CANCELLED_F1_RACE_KEYS.has(key))
  );
}

export function hasRaceResults(res, raceFromCalendar) {
  if (isRaceCancelled(res, raceFromCalendar)) return false;
  return !!(res && (res.pole || res.podium?.some(Boolean)));
}

export function scoreForRace(db, raceKey, name, raceFromCalendar) {
  const bet = db.bets?.[raceKey]?.[name];
  const res = db.results?.[raceKey];
  if (isRaceCancelled(res, raceFromCalendar)) {
    return {
      points: 0, hits: 0, exact: 0, pen: 0,
      gotPole: false, gotAllPodium: false, gotAllQuestions: false, fullHouse: false,
      submittedAt: bet?.submittedAt || null, missed: false, late: false, cancelled: true,
    };
  }
  const realResults = hasRaceResults(res, raceFromCalendar);
  const noBet = !bet;
  if (noBet) {
    return {
      points: realResults ? -3 : 0, hits: 0, exact: 0, pen: realResults ? 1 : 0,
      gotPole: false, gotAllPodium: false, gotAllQuestions: false, fullHouse: false,
      submittedAt: null, missed: realResults, late: false,
    };
  }
  if (!realResults) {
    return {
      points: 0, hits: 0, exact: 0, pen: 0,
      gotPole: false, gotAllPodium: false, gotAllQuestions: false, fullHouse: false,
      submittedAt: bet.submittedAt || null, missed: false, late: false,
    };
  }
  let pts = 0, hits = 0, pen = 0, exact = 0;
  if (res?.pole && bet.pole === res.pole) { pts++; hits++; }
  if (res?.podium) {
    bet.podium?.forEach((p, i) => { if (p === res.podium[i]) { pts++; hits++; } });
  }
  if (res?.qAnswers) {
    bet.q?.forEach((a, i) => {
      if ((a || "").toLowerCase().trim() === (res.qAnswers[i] || "").toLowerCase().trim()) { pts++; hits++; }
    });
  }
  const gotPole = res?.pole && bet.pole === res.pole;
  const gotAllPod = res?.podium && bet.podium?.every((p, i) => p === res.podium[i]);
  const gotAllQ = res?.qAnswers && bet.q?.every((a, i) =>
    (a || "").toLowerCase().trim() === (res.qAnswers[i] || "").toLowerCase().trim()
  );
  if (gotPole && gotAllPod) pts += 2;
  if (gotPole && gotAllPod && gotAllQ) pts += 2;
  if (!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length < 3)) { pts -= 1; pen++; }
  if (bet.late) { pts -= 2; pen++; }
  if (gotAllPod) exact = 1;
  const fullHouse = !!(gotPole && gotAllPod && gotAllQ);
  const manualAdj = Number(db.scoreAdjustments?.[raceKey]?.[name] || 0) || 0;
  const finalPoints = pts + manualAdj;
  return {
    points: finalPoints, hits, exact, pen,
    gotPole: !!gotPole, gotAllPodium: !!gotAllPod, gotAllQuestions: !!gotAllQ,
    fullHouse, manualAdj, submittedAt: bet.submittedAt || null, missed: false, late: !!bet.late,
  };
}

export function computeGPWins(db, races, participants) {
  const wins = {};
  participants.forEach(n => { wins[n] = 0; });
  (races || []).forEach(race => {
    const res = db.results?.[race.key];
    if (!hasRaceResults(res, race)) return;
    let best = -Infinity;
    let winners = [];
    participants.forEach(name => {
      const s = scoreForRace(db, race.key, name, race);
      if (s.points > best) { best = s.points; winners = [name]; }
      else if (s.points === best) winners.push(name);
    });
    if (winners.length === 1) wins[winners[0]]++;
  });
  return wins;
}

export function computeAvgSubmitTime(db, races, name) {
  let total = 0, count = 0;
  (races || []).forEach(race => {
    if (isRaceCancelled(db.results?.[race.key], race)) return;
    const bet = db.bets?.[race.key]?.[name];
    if (bet?.submittedAt) { total += new Date(bet.submittedAt).getTime(); count++; }
  });
  return count > 0 ? total / count : Infinity;
}

export function computeGlobalStandings(db, races, participantsOverride) {
  const participants = participantsOverride || Object.keys(db.participants || {});
  const gpWins = computeGPWins(db, races, participants);
  return participants.map(name => {
    const acc = (races || []).reduce((a, race) => {
      const s = scoreForRace(db, race.key, name, race);
      a.points += s.points; a.hits += s.hits; a.exact += s.exact; a.pen += s.pen;
      return a;
    }, { points: 0, hits: 0, exact: 0, pen: 0 });
    return { ...acc, name, wins: gpWins[name] || 0, avgSubmit: computeAvgSubmitTime(db, races, name) };
  }).sort((A, B) =>
    B.points - A.points || B.wins - A.wins || B.exact - A.exact || B.hits - A.hits ||
    A.pen - B.pen || A.avgSubmit - B.avgSubmit
  );
}

export function topList(obj, limit = 5) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

export function buildStats(db, races, participantsOverride) {
  const participants = participantsOverride || Object.keys(db.participants || {});
  const wins = {}, fulls = {}, hitsTotals = {};
  const best = [], worst = [];
  const votes = { pole: {}, p1: {}, p2: {}, p3: {} };
  (races || []).forEach(race => {
    const bets = db.bets?.[race.key] || {};
    Object.values(bets).forEach(b => {
      if (b.pole) votes.pole[b.pole] = (votes.pole[b.pole] || 0) + 1;
      if (Array.isArray(b.podium)) {
        if (b.podium[0]) votes.p1[b.podium[0]] = (votes.p1[b.podium[0]] || 0) + 1;
        if (b.podium[1]) votes.p2[b.podium[1]] = (votes.p2[b.podium[1]] || 0) + 1;
        if (b.podium[2]) votes.p3[b.podium[2]] = (votes.p3[b.podium[2]] || 0) + 1;
      }
    });
    if (!hasRaceResults(db.results?.[race.key], race)) return;
    const standings = participants.map(name => {
      const s = scoreForRace(db, race.key, name, race);
      hitsTotals[name] = (hitsTotals[name] || 0) + s.hits;
      return { ...s, name };
    });
    if (!standings.length) return;
    const points = standings.map(s => s.points);
    const maxPts = Math.max(...points);
    const minPts = Math.min(...points);
    standings.forEach(s => {
      if (s.points === maxPts) { wins[s.name] = (wins[s.name] || 0) + 1; best.push({ name: s.name, points: s.points, race: race.grand_prix }); }
      if (s.points === minPts) { worst.push({ name: s.name, points: s.points, race: race.grand_prix }); }
      if (s.fullHouse) fulls[s.name] = (fulls[s.name] || 0) + 1;
    });
  });
  const bestScores = [...best].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, 5);
  const worstScores = [...worst].sort((a, b) => a.points - b.points || a.name.localeCompare(b.name)).slice(0, 5);
  return {
    winners: topList(wins, 5), fulls: topList(fulls, 5), hitsLeaders: topList(hitsTotals, 5),
    votePole: topList(votes.pole, 5), voteP1: topList(votes.p1, 5), voteP2: topList(votes.p2, 5), voteP3: topList(votes.p3, 5),
    bestScores, worstScores,
  };
}

export function describeBetAgainstResult(bet, res, manualAdj = 0, raceFromCalendar) {
  if (isRaceCancelled(res, raceFromCalendar)) {
    return { points: 0, items: [{ label: "Gran Premio cancelado — no puntúa", delta: 0 }] };
  }
  if (!bet) return { points: res ? -3 : 0, items: [{ label: "No participó en la apuesta", delta: res ? -3 : 0 }] };
  let pts = 0;
  const items = [];
  const push = (label, delta) => { pts += delta; items.push({ label, delta }); };
  if (res?.pole) {
    const ok = bet.pole === res.pole;
    push(`Pole: ${bet.pole || "—"} vs ${res.pole || "—"}`, ok ? 1 : 0);
  }
  if (Array.isArray(res?.podium)) {
    res.podium.forEach((p, i) => {
      const sel = bet.podium?.[i] || "";
      const ok = sel === p;
      push(`P${i + 1}: ${sel || "—"} vs ${p || "—"}`, ok ? 1 : 0);
    });
  }
  if (Array.isArray(res?.qAnswers)) {
    res.qAnswers.forEach((ans, i) => {
      const sel = (bet.q?.[i] || "").trim();
      const ok = sel.toLowerCase() === (ans || "").trim().toLowerCase();
      push(`Pregunta ${i + 1}: ${sel || "—"} vs ${ans || "—"}`, ok ? 1 : 0);
    });
  }
  const gotPole = res?.pole && bet.pole === res.pole;
  const gotAllPod = res?.podium && bet.podium?.every((p, i) => p === res.podium[i]);
  const gotAllQ = res?.qAnswers && bet.q?.every((a, i) =>
    (a || "").trim().toLowerCase() === (res.qAnswers[i] || "").trim().toLowerCase()
  );
  if (gotPole && gotAllPod) push("Bonus pole + podio", 2);
  if (gotPole && gotAllPod && gotAllQ) push("Bonus pleno (pole+podio+preguntas)", 2);
  if (!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length < 3)) push("Penalización por apuesta incompleta", -1);
  if (bet.late) push("Penalización por fuera de plazo", -2);
  if (manualAdj !== 0) push("Ajuste manual", manualAdj);
  return { points: pts, items };
}

// ─── Fútbol ───

export function defaultFutbolState() {
  return { order: [], jornadas: {}, bets: {}, results: {}, betsWindow: {}, betsReveal: {}, betHistory: {}, questions: {}, questionsStatus: {} };
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

export function scoreFutbolJornada(db, jornadaId, name) {
  const futbol = db.futbol || {};
  const jornada = futbol.jornadas?.[jornadaId];
  const bet = futbol.bets?.[jornadaId]?.[name];
  const res = futbol.results?.[jornadaId];
  if (!res) return { pending: true, points: 0, exact: 0, signs: 0, qHits: 0, missed: false, catPenalty: 0, missingPenalty: 0, latePenalty: 0, late: !!bet?.late, goalDiff: 0, items: [] };
  const hasBet = !!bet;
  const predictions = hasBet ? (bet.matches || []) : [];
  const late = !!bet?.late;
  let points = 0, exact = 0, signs = 0, qHits = 0, goalDiff = 0;
  const items = [];
  const official = res.matches || [];
  official.forEach((m, idx) => {
    const pred = predictions[idx];
    const { points: p, exact: ex, sign } = futbolMatchPoints(pred, m);
    points += p; if (ex) exact++; if (sign) signs++;
    if (pred && pred.home != null && pred.away != null && m.home != null && m.away != null) {
      goalDiff += Math.abs(Number(pred.home) - Number(m.home)) + Math.abs(Number(pred.away) - Number(m.away));
    } else {
      goalDiff += 10;
    }
    items.push({ label: `${jornada?.matches?.[idx]?.home || "Local"} ${pred?.home ?? "?"}-${pred?.away ?? "?"} vs ${m?.home ?? "?"}-${m?.away ?? "?"}`, delta: p });
  });
  const missed = !bet;
  let missingPenalty = 0, latePenalty = 0;
  if (missed) { missingPenalty = -3; points += missingPenalty; items.push({ label: "No participó en la apuesta", delta: missingPenalty }); goalDiff += 40; }
  else if (late) { latePenalty = -2; points += latePenalty; items.push({ label: "Apuesta fuera de plazo", delta: latePenalty }); }
  let catPenalty = 0;
  if (!missed && !late && points === 0) { catPenalty = -1; points += catPenalty; items.push({ label: "Apuesta catastrófica", delta: catPenalty }); }
  return { pending: false, points, exact, signs, qHits, missed, late, catPenalty, missingPenalty, latePenalty, goalDiff, items };
}

export function computeAvgFutbolSubmitTime(dbFutbol, jornadas, name) {
  let total = 0, count = 0;
  (jornadas || []).forEach(j => {
    const bet = dbFutbol.bets?.[j.id]?.[name];
    if (bet?.submittedAt) { total += new Date(bet.submittedAt).getTime(); count++; }
  });
  return count > 0 ? total / count : Infinity;
}

export function computeFutbolJornadaWins(dbFutbol, participants, jornadas) {
  const wins = {};
  participants.forEach(n => { wins[n] = 0; });
  const completed = (jornadas || []).filter(j => dbFutbol.results?.[j.id]);
  completed.forEach(j => {
    let best = -Infinity;
    let winners = [];
    participants.forEach(name => {
      const s = scoreFutbolJornada({ futbol: dbFutbol }, j.id, name);
      if (s.points > best) { best = s.points; winners = [name]; }
      else if (s.points === best) winners.push(name);
    });
    if (winners.length === 1) wins[winners[0]]++;
  });
  return wins;
}

export function computeFutbolStandings(dbFutbol, participants, jornadas) {
  const completed = (jornadas || []).filter(j => dbFutbol.results?.[j.id]);
  const jornadaWins = computeFutbolJornadaWins(dbFutbol, participants, jornadas);
  return participants.map(name => {
    const acc = completed.reduce((a, j) => {
      const s = scoreFutbolJornada({ futbol: dbFutbol }, j.id, name);
      a.points += s.points; a.exact += s.exact; a.signs += s.signs;
      a.missed += s.missed ? 1 : 0; a.late += s.late ? 1 : 0;
      a.cat += s.catPenalty ? 1 : 0; a.goalDiff += s.goalDiff;
      return a;
    }, { points: 0, exact: 0, signs: 0, missed: 0, late: 0, cat: 0, goalDiff: 0 });
    return { name, ...acc, wins: jornadaWins[name] || 0, penCount: acc.missed + acc.late, avgSubmit: computeAvgFutbolSubmitTime(dbFutbol, jornadas, name) };
  }).sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.exact - a.exact || b.signs - a.signs ||
    a.penCount - b.penCount || a.goalDiff - b.goalDiff || a.avgSubmit - b.avgSubmit
  );
}

export function computeDeadlineFromKickoffs(jornada) {
  if (!jornada?.matches?.length) return null;
  const kickoffs = (jornada.matches || []).map(m => m.kickoff ? new Date(m.kickoff).getTime() : NaN).filter(t => !Number.isNaN(t));
  if (!kickoffs.length) return null;
  return new Date(Math.min(...kickoffs) - 60_000);
}

export function getEffectiveDeadline(jornada) {
  if (jornada?.deadline) return new Date(jornada.deadline);
  return computeDeadlineFromKickoffs(jornada);
}

export function listFutbolJornadas(futbol) {
  const entries = Object.values(futbol?.jornadas || {});
  const order = futbol?.order || [];
  if (order.length) {
    return order.map(id => entries.find(j => j.id === id)).filter(Boolean);
  }
  return entries.sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db_ = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db_ || a.name.localeCompare(b.name);
  });
}
