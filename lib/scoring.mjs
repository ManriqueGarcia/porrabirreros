/**
 * Scoring logic for F1 and Football bets.
 * These functions are pure (no React/DOM deps) and can be tested independently.
 * The same logic is duplicated in app.jsx for runtime use (browser global scope).
 */

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

export function scoreForRace(db, raceKey, name) {
  const bet = db.bets?.[raceKey]?.[name];
  const res = db.results?.[raceKey];
  const noBet = !bet;
  if (noBet) {
    const hasResults = !!res;
    return { points: hasResults ? -3 : 0, hits: 0, exact: 0, pen: hasResults ? 1 : 0, gotPole: false, gotAllPodium: false, gotAllQuestions: false, fullHouse: false, submittedAt: null, missed: hasResults, late: false };
  }
  let pts = 0, hits = 0, pen = 0, exact = 0;
  if (res?.pole && bet.pole === res.pole) { pts++; hits++; }
  if (res?.podium) { bet.podium?.forEach((p, i) => { if (p === res.podium[i]) { pts++; hits++; } }); }
  if (res?.qAnswers) { bet.q?.forEach((a, i) => { if ((a || "").toLowerCase().trim() === (res.qAnswers[i] || "").toLowerCase().trim()) { pts++; hits++; } }); }
  const gotPole = res?.pole && bet.pole === res.pole;
  const gotAllPod = res?.podium && bet.podium?.every((p, i) => p === res.podium[i]);
  const gotAllQ = res?.qAnswers && bet.q?.every((a, i) => (a || "").toLowerCase().trim() === (res.qAnswers[i] || "").toLowerCase().trim());
  if (gotPole && gotAllPod) pts += 2;
  if (gotPole && gotAllPod && gotAllQ) pts += 2;
  if (!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length < 3)) { pts -= 1; pen++; }
  if (bet.late) { pts -= 2; pen++; }
  if (gotAllPod) exact = 1;
  const fullHouse = !!(gotPole && gotAllPod && gotAllQ);
  const manualAdj = Number(db.scoreAdjustments?.[raceKey]?.[name] || 0) || 0;
  const finalPoints = pts + manualAdj;
  return { points: finalPoints, hits, exact, pen, gotPole: !!gotPole, gotAllPodium: !!gotAllPod, gotAllQuestions: !!gotAllQ, fullHouse, manualAdj, submittedAt: bet.submittedAt || null, missed: false, late: !!bet.late };
}
