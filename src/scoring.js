export function scoreForRace(db, raceKey, name) {
  const bet = db.bets?.[raceKey]?.[name]; const res = db.results?.[raceKey];
  const noBet = !bet;
  if (noBet) {
    const hasResults = !!res;
    return { points: hasResults ? -3 : 0, hits: 0, exact: 0, pen: hasResults ? 1 : 0, gotPole: false, gotAllPodium: false, gotAllQuestions: false, fullHouse: false, submittedAt: null, missed: hasResults, late: false };
  }
  let pts = 0, hits = 0, pen = 0, exact = 0;
  if (res?.pole && bet.pole === res.pole) { pts++; hits++; }
  if (res?.podium) { bet.podium?.forEach((p, i) => { if (p === res.podium[i]) { pts++; hits++; } }); }
  if (res?.qAnswers) { bet.q?.forEach((a, i) => { if ((a || '').toLowerCase().trim() === (res.qAnswers[i] || '').toLowerCase().trim()) { pts++; hits++; } }); }
  const gotPole = res?.pole && bet.pole === res.pole;
  const gotAllPod = res?.podium && bet.podium?.every((p, i) => p === res.podium[i]);
  const gotAllQ = res?.qAnswers && bet.q?.every((a, i) => (a || '').toLowerCase().trim() === (res.qAnswers[i] || '').toLowerCase().trim());
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

export function computeGPWins(db, races, participants) {
  const wins = {};
  participants.forEach(n => { wins[n] = 0; });
  (races || []).forEach(race => {
    const res = db.results?.[race.key];
    if (!res) return;
    let best = -Infinity; let winners = [];
    participants.forEach(name => {
      const s = scoreForRace(db, race.key, name);
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
    const bet = db.bets?.[race.key]?.[name];
    if (bet?.submittedAt) { total += new Date(bet.submittedAt).getTime(); count++; }
  });
  return count > 0 ? total / count : Infinity;
}

export function computeGlobalStandings(db, races) {
  const participants = Object.keys(db.participants || {});
  const keys = (races || []).map(r => r.key);
  const gpWins = computeGPWins(db, races, participants);
  return participants.map(name => {
    const acc = keys.reduce((a, k) => {
      const s = scoreForRace(db, k, name);
      a.points += s.points; a.hits += s.hits; a.exact += s.exact; a.pen += s.pen; return a;
    }, { points: 0, hits: 0, exact: 0, pen: 0 });
    return { ...acc, name, wins: gpWins[name] || 0, avgSubmit: computeAvgSubmitTime(db, races, name) };
  }).sort((A, B) => B.points - A.points || B.wins - A.wins || B.exact - A.exact || B.hits - A.hits || A.pen - B.pen || A.avgSubmit - B.avgSubmit);
}

export function topList(obj, limit = 5) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, value]) => ({ name, value }));
}

export function buildStats(db, races) {
  const participants = Object.keys(db.participants || {});
  const wins = {}; const fulls = {}; const hitsTotals = {};
  const best = []; const worst = [];
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
    if (!db.results?.[race.key]) return;
    const standings = participants.map(name => {
      const s = scoreForRace(db, race.key, name);
      hitsTotals[name] = (hitsTotals[name] || 0) + s.hits;
      return { ...s, name };
    });
    if (!standings.length) return;
    const points = standings.map(s => s.points);
    const maxPts = Math.max(...points); const minPts = Math.min(...points);
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

export function describeBetAgainstResult(bet, res, manualAdj = 0) {
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
  const gotAllQ = res?.qAnswers && bet.q?.every((a, i) => (a || "").trim().toLowerCase() === (res.qAnswers[i] || "").trim().toLowerCase());
  if (gotPole && gotAllPod) push("Bonus pole + podio", 2);
  if (gotPole && gotAllPod && gotAllQ) push("Bonus pleno (pole+podio+preguntas)", 2);
  if (!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length < 3)) push("Penalización por apuesta incompleta", -1);
  if (bet.late) push("Penalización por fuera de plazo", -2);
  if (manualAdj !== 0) push("Ajuste manual", manualAdj);
  return { points: pts, items };
}
