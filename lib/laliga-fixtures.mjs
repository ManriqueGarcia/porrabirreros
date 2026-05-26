/**
 * Empareja partidos locales (home/away) con datos de football-data.org v4.
 * Documentación: https://www.football-data.org/documentation/api
 * Competición por defecto: PD (Primera División España).
 */

const API_BASE = "https://api.football-data.org/v4";

export function normalizeTeamToken(s) {
  if (s == null || typeof s !== "string") return "";
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|cd|ud|sd|rc|ad|ac)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Clave débil para grandes clubes (evita Barça vs FC Barcelona). */
export function canonicalFootballClubName(s) {
  const t = normalizeTeamToken(s);
  if (!t) return "";
  if (/\bbarcelon/.test(t) || /\bbarca\b/.test(t) || t === "barsa") return "__barcelona__";
  if (/\breal\b/.test(t) && /\bmadrid\b/.test(t)) return "__real_madrid__";
  if (/\batletico\b/.test(t) && /\bmadrid\b/.test(t)) return "__atletico_madrid__";
  if (/\bathletic\b/.test(t)) return "__athletic__";
  return t;
}

export function teamNamesMatch(a, b) {
  const ca = canonicalFootballClubName(a);
  const cb = canonicalFootballClubName(b);
  if (ca && cb && ca.startsWith("__") && ca === cb) return true;
  const na = normalizeTeamToken(a);
  const nb = normalizeTeamToken(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

/**
 * @param {string} home
 * @param {string} away
 * @param {Array<{ utcDate?: string, homeTeam?: { name?: string, shortName?: string }, awayTeam?: { name?: string, shortName?: string } }>} apiMatches
 * @returns {string|null} ISO UTC
 */
export function findKickoffForPair(home, away, apiMatches) {
  if (!home || !away || !apiMatches?.length) return null;
  let best = null;
  for (const m of apiMatches) {
    const h = m.homeTeam?.shortName || m.homeTeam?.name || "";
    const aw = m.awayTeam?.shortName || m.awayTeam?.name || "";
    const ok = (teamNamesMatch(h, home) && teamNamesMatch(aw, away))
      || (teamNamesMatch(h, away) && teamNamesMatch(aw, home));
    if (!ok || !m.utcDate) continue;
    const t = new Date(m.utcDate).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t < best.t) best = { t, iso: new Date(m.utcDate).toISOString() };
  }
  return best?.iso || null;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} token X-Auth-Token
 * @param {string} competitionId ej. PD
 * @param {number|undefined|null} matchday Jornada oficial La Liga (opcional)
 * @param {number} futureDays ventana si no hay matchday
 */
export async function fetchCompetitionMatches(token, competitionId, matchday, futureDays = 21) {
  if (!token || typeof token !== "string") {
    return { matches: [], httpStatus: 0, error: "missing_token" };
  }
  const comp = competitionId || "PD";
  let url;
  if (matchday != null && String(matchday).trim() !== "" && Number.isFinite(Number(matchday))) {
    url = `${API_BASE}/competitions/${encodeURIComponent(comp)}/matches?matchday=${encodeURIComponent(String(Number(matchday)))}`;
  } else {
    const now = new Date();
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(now);
    to.setUTCDate(to.getUTCDate() + futureDays);
    url = `${API_BASE}/competitions/${encodeURIComponent(comp)}/matches?dateFrom=${ymd(from)}&dateTo=${ymd(to)}`;
  }

  const r = await fetch(url, { headers: { "X-Auth-Token": token } });
  const text = await r.text();
  if (!r.ok) {
    return { matches: [], httpStatus: r.status, error: text.slice(0, 500) || `http_${r.status}` };
  }
  try {
    const j = JSON.parse(text);
    return { matches: j.matches || [], httpStatus: r.status, error: null };
  } catch {
    return { matches: [], httpStatus: r.status, error: "invalid_json" };
  }
}

/**
 * Rellena kickoff ISO donde falte, usando apiMatches.
 * @returns {{ matches: Array, filled: number }}
 */
export function mergeKickoffsFromApiMatches(matches, apiMatches) {
  const out = [];
  let filled = 0;
  for (const m of matches || []) {
    if (!m || typeof m !== "object") {
      out.push(m);
      continue;
    }
    if (m.kickoff) {
      out.push({ ...m, kickoff: typeof m.kickoff === "string" ? m.kickoff : new Date(m.kickoff).toISOString() });
      continue;
    }
    const ko = findKickoffForPair(String(m.home || ""), String(m.away || ""), apiMatches);
    if (ko) filled++;
    out.push(ko ? { ...m, kickoff: ko } : { ...m });
  }
  return { matches: out, filled };
}

/**
 * @param {object} jornadaPayload body type "jornada" (id, name, deadline, matches, laligaMatchday?, …)
 * @param {{ token: string, competitionId?: string, futureDays?: number }} opts
 */
export async function enrichFutbolJornadaMatchesFromApi(jornadaPayload, opts) {
  const token = opts?.token || "";
  const competitionId = opts?.competitionId || process.env.FOOTBALL_DATA_COMPETITION_ID || "PD";
  const futureDays = Number(opts?.futureDays) > 0 ? Number(opts.futureDays) : 21;

  const matches = jornadaPayload?.matches;
  if (!Array.isArray(matches) || matches.length === 0) {
    return { data: jornadaPayload, meta: { attempted: false, reason: "no_matches" } };
  }
  const needsKickoff = matches.some((m) => m && !m.kickoff && m.home && m.away);
  if (!needsKickoff) {
    return { data: jornadaPayload, meta: { attempted: false, reason: "all_have_kickoff" } };
  }
  if (!token) {
    return { data: jornadaPayload, meta: { attempted: false, reason: "no_token" } };
  }

  const md = jornadaPayload.laligaMatchday;
  const { matches: apiMatches, httpStatus, error } = await fetchCompetitionMatches(
    token,
    competitionId,
    md,
    futureDays,
  );
  if (error && !apiMatches.length) {
    return {
      data: jornadaPayload,
      meta: { attempted: true, filled: 0, httpStatus, apiError: error },
    };
  }
  const { matches: merged, filled } = mergeKickoffsFromApiMatches(matches, apiMatches);
  const data = { ...jornadaPayload, matches: merged };
  return {
    data,
    meta: {
      attempted: true,
      filled,
      httpStatus,
      apiMatchCount: apiMatches.length,
      apiError: filled === 0 && apiMatches.length === 0 ? "no_api_matches_in_window" : null,
    },
  };
}
