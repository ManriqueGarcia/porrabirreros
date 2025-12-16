// API para obtener partidos de La Liga y Segunda División
// Usa Football-Data.org (gratuita, requiere registro para API key)

const FUTBOL_API_BASE = "https://api.football-data.org/v4";
// Nota: Necesitarás una API key gratuita de https://www.football-data.org/
// Por defecto usamos un modo sin autenticación (limitado)

const TEAMS = {
  "Real Madrid": { id: 86, league: "PD" }, // Primera División
  "FC Barcelona": { id: 81, league: "PD" },
  "Real Sociedad": { id: 94, league: "PD" },
  "Real Sporting de Gijón": { id: 90, league: "SD" } // Segunda División
};

const LEAGUE_IDS = {
  "PD": 2014, // La Liga (Primera División)
  "SD": 2015  // Segunda División (Hypermotion)
};

async function fetchWithAuth(url, apiKey = null) {
  const headers = {
    "Accept": "application/json"
  };
  if (apiKey) {
    headers["X-Auth-Token"] = apiKey;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Límite de peticiones alcanzado. Necesitas una API key.");
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching from API:", error);
    throw error;
  }
}

async function getTeamFixtures(teamId, apiKey = null, limit = 10) {
  const url = `${FUTBOL_API_BASE}/teams/${teamId}/matches?status=SCHEDULED&limit=${limit}`;
  const data = await fetchWithAuth(url, apiKey);
  return data.matches || [];
}

async function getLeagueFixtures(leagueId, apiKey = null, matchday = null) {
  let url = `${FUTBOL_API_BASE}/competitions/${leagueId}/matches?status=SCHEDULED`;
  if (matchday) {
    url += `&matchday=${matchday}`;
  }
  const data = await fetchWithAuth(url, apiKey);
  return data.matches || [];
}

async function getUpcomingMatchesForTeams(apiKey = null) {
  const results = {
    "Real Madrid": [],
    "FC Barcelona": [],
    "Real Sociedad": [],
    "Real Sporting de Gijón": []
  };

  try {
    // Obtener partidos de Primera División (Real Madrid, Barcelona, Real Sociedad)
    const primeraMatches = await getLeagueFixtures(LEAGUE_IDS.PD, apiKey);
    
    // Obtener partidos de Segunda División (Sporting)
    const segundaMatches = await getLeagueFixtures(LEAGUE_IDS.SD, apiKey);

    // Filtrar partidos de nuestros equipos
    primeraMatches.forEach(match => {
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      
      if (homeTeam === "Real Madrid" || awayTeam === "Real Madrid") {
        results["Real Madrid"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
      if (homeTeam === "FC Barcelona" || awayTeam === "FC Barcelona") {
        results["FC Barcelona"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
      if (homeTeam === "Real Sociedad" || awayTeam === "Real Sociedad") {
        results["Real Sociedad"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
    });

    segundaMatches.forEach(match => {
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      
      if (homeTeam === "Real Sporting de Gijón" || awayTeam === "Real Sporting de Gijón") {
        results["Real Sporting de Gijón"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
    });

    // Ordenar por fecha
    Object.keys(results).forEach(team => {
      results[team].sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    return results;
  } catch (error) {
    console.error("Error obteniendo partidos:", error);
    throw error;
  }
}

// Función para agrupar partidos por jornada/matchday
function groupMatchesByMatchday(matches) {
  const byMatchday = {};
  
  Object.keys(matches).forEach(team => {
    matches[team].forEach(match => {
      const md = match.matchday || "unknown";
      if (!byMatchday[md]) {
        byMatchday[md] = [];
      }
      // Evitar duplicados
      const exists = byMatchday[md].some(m => m.id === match.id);
      if (!exists) {
        byMatchday[md].push(match);
      }
    });
  });
  
  return byMatchday;
}

// Función principal para obtener jornadas listas para usar
async function getJornadasFromAPI(apiKey = null, numJornadas = 5) {
  try {
    const matches = await getUpcomingMatchesForTeams(apiKey);
    const byMatchday = groupMatchesByMatchday(matches);
    
    const jornadas = [];
    const matchdays = Object.keys(byMatchday).sort((a, b) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return Number(a) - Number(b);
    });

    for (let i = 0; i < Math.min(numJornadas, matchdays.length); i++) {
      const md = matchdays[i];
      const mdMatches = byMatchday[md];
      
      // Seleccionar los 4 partidos que necesitamos
      const selectedMatches = [];
      const teamsNeeded = ["Real Madrid", "FC Barcelona", "Real Sociedad", "Real Sporting de Gijón"];
      
      teamsNeeded.forEach(team => {
        const teamMatch = mdMatches.find(m => 
          m.home === team || m.away === team
        );
        if (teamMatch) {
          selectedMatches.push({
            home: teamMatch.home,
            away: teamMatch.away
          });
        }
      });
      
      // Si faltan partidos, añadir partidos de reserva
      while (selectedMatches.length < 4 && mdMatches.length > selectedMatches.length) {
        const remaining = mdMatches.filter(m => 
          !selectedMatches.some(sm => sm.home === m.home && sm.away === m.away)
        );
        if (remaining.length > 0) {
          selectedMatches.push({
            home: remaining[0].home,
            away: remaining[0].away
          });
        } else {
          break;
        }
      }
      
      if (selectedMatches.length > 0) {
        const firstMatch = mdMatches[0];
        const matchDate = new Date(firstMatch.date);
        const friday = getNextFriday(matchDate);
        friday.setHours(15, 0, 0, 0);
        
        jornadas.push({
          id: `J${md}`,
          name: `Jornada ${md}`,
          deadline: friday.toISOString(),
          matches: selectedMatches.slice(0, 4), // Asegurar máximo 4
          source: "api",
          matchday: md
        });
      }
    }
    
    return jornadas;
  } catch (error) {
    console.error("Error creando jornadas desde API:", error);
    throw error;
  }
}

function getNextFriday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7; // Días hasta el próximo viernes
  d.setDate(d.getDate() + diff);
  return d;
}

// Exportar funciones para uso global en el navegador
if (typeof window !== 'undefined') {
  window.getJornadasFromAPI = getJornadasFromAPI;
  window.getUpcomingMatchesForTeams = getUpcomingMatchesForTeams;
  window.FUTBOL_API_TEAMS = TEAMS;
  window.FUTBOL_API_LEAGUES = LEAGUE_IDS;
}

// Exportar para Node.js si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getUpcomingMatchesForTeams,
    getJornadasFromAPI,
    TEAMS,
    LEAGUE_IDS
  };
}

