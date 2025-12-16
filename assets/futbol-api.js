// API para obtener partidos de La Liga y Segunda División
// Usa Football-Data.org (gratuita, requiere registro para API key)

const FUTBOL_API_BASE = "https://api.football-data.org/v4";
// Nota: Necesitarás una API key gratuita de https://www.football-data.org/
// Por defecto usamos un modo sin autenticación (limitado)

// Intentar usar proxy CORS si está disponible (para desarrollo local)
// El proxy debe estar en http://localhost:8888
const CORS_PROXY_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:8888' 
  : (window.PORRA_API_BASE ? `${window.PORRA_API_BASE}/proxy` : null);

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
    // Intentar usar proxy CORS si está disponible (evita problemas de puerto)
    if (CORS_PROXY_BASE) {
      try {
        const proxyUrl = `${CORS_PROXY_BASE}?url=${encodeURIComponent(url)}`;
        const proxyHeaders = { "Accept": "application/json" };
        if (apiKey) {
          proxyHeaders["X-Football-API-Key"] = apiKey;
        }
        const response = await fetch(proxyUrl, { 
          headers: proxyHeaders,
          // Timeout corto para detectar si el proxy no está disponible
          signal: AbortSignal.timeout(2000)
        });
        if (response.ok) {
          console.info("[FutbolAPI] Usando proxy CORS para evitar problemas de puerto");
          return await response.json();
        }
        // Si el proxy falla, continuar con intento directo
        console.warn("[FutbolAPI] Proxy falló, intentando conexión directa...");
      } catch (proxyError) {
        // Si el proxy no está disponible (timeout o error), intentar directo
        if (proxyError.name === 'TimeoutError' || proxyError.message.includes('Failed to fetch')) {
          console.info("[FutbolAPI] Proxy no disponible, usando conexión directa. Para evitar CORS, ejecuta: python3 cors-proxy.py");
        } else {
          console.warn("[FutbolAPI] Error en proxy:", proxyError.message);
        }
      }
    }
    
    // Verificar si estamos en localhost (necesario para CORS de Football-Data.org)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isLocalhostWithoutPort = window.location.port === '' || window.location.port === '80';
    
    // La API solo acepta localhost sin puerto o con puerto 80
    if (isLocalhost && !isLocalhostWithoutPort && window.location.protocol === 'http:') {
      console.warn("[FutbolAPI] Usando puerto no estándar. La API puede fallar por CORS.");
      console.warn("[FutbolAPI] Solución: Usa 'python3 -m http.server 80' (requiere sudo) o accede desde producción (HTTPS)");
    }
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Límite de peticiones alcanzado. Necesitas una API key.");
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (error.message.includes("CORS") || error.message.includes("Failed to fetch")) {
      console.error("Error CORS:", error);
      const currentOrigin = window.location.origin;
      throw new Error(`Error de CORS. La API de Football-Data.org solo acepta 'http://localhost' (sin puerto). Estás usando '${currentOrigin}'. Solución: Usa 'python3 -m http.server 80' (requiere sudo) o crea un proxy en el backend.`);
    }
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

  // Mapeo de nombres posibles de la API a nuestros nombres estándar
  const teamNameVariations = {
    "Real Madrid": ["Real Madrid CF", "Real Madrid", "Real Madrid Club de Fútbol"],
    "FC Barcelona": ["FC Barcelona", "Barcelona"],
    "Real Sociedad": ["Real Sociedad de Fútbol", "Real Sociedad"],
    "Real Sporting de Gijón": ["Real Sporting de Gijón", "Sporting Gijón", "Sporting de Gijón", "Real Sporting", "Sporting"]
  };

  try {
    // Obtener partidos de Primera División (Real Madrid, Barcelona, Real Sociedad)
    const primeraMatches = await getLeagueFixtures(LEAGUE_IDS.PD, apiKey);
    console.log(`[FutbolAPI] Primera División: ${primeraMatches.length} partidos obtenidos`);
    
    // Obtener partidos de Segunda División (Sporting)
    const segundaMatches = await getLeagueFixtures(LEAGUE_IDS.SD, apiKey);
    console.log(`[FutbolAPI] Segunda División: ${segundaMatches.length} partidos obtenidos`);

    // Función auxiliar para verificar si un nombre de equipo coincide
    // IMPORTANTE: Debe ser una coincidencia exacta o muy específica para evitar falsos positivos
    const matchesTeam = (teamName, targetTeam) => {
      if (!teamName) return false;
      const normalized = teamName.trim();
      const variations = teamNameVariations[targetTeam] || [targetTeam];
      
      // Para cada variación, verificar coincidencia exacta o que el nombre completo contenga la variación
      return variations.some(v => {
        const vNormalized = v.trim();
        // Coincidencia exacta
        if (normalized === vNormalized) return true;
        
        // Para evitar falsos positivos (ej: "RCD Espanyol de Barcelona" no debe coincidir con "FC Barcelona")
        // Solo permitir coincidencia por inclusión si el nombre es suficientemente específico
        if (targetTeam === "FC Barcelona") {
          // Para Barcelona, solo aceptar "FC Barcelona" o "Barcelona" como palabra completa
          return normalized === "FC Barcelona" || normalized === "Barcelona";
        }
        
        // Para otros equipos, permitir coincidencia por inclusión solo si la variación es suficientemente única
        if (vNormalized.length >= 8) { // Variaciones largas son más específicas
          return normalized.includes(vNormalized) || vNormalized.includes(normalized);
        }
        
        // Para variaciones cortas, solo coincidencia exacta
        return false;
      });
    };

    // Filtrar partidos de nuestros equipos en Primera División
    primeraMatches.forEach(match => {
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      
      // Log para depuración (solo los primeros 5)
      if (primeraMatches.indexOf(match) < 5) {
        console.log(`[FutbolAPI] Partido: ${homeTeam} vs ${awayTeam}`);
      }
      
      if (matchesTeam(homeTeam, "Real Madrid") || matchesTeam(awayTeam, "Real Madrid")) {
        results["Real Madrid"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
      if (matchesTeam(homeTeam, "FC Barcelona") || matchesTeam(awayTeam, "FC Barcelona")) {
        results["FC Barcelona"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
      if (matchesTeam(homeTeam, "Real Sociedad") || matchesTeam(awayTeam, "Real Sociedad")) {
        results["Real Sociedad"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
      }
    });

    // Filtrar partidos de Sporting en Segunda División
    console.log(`[FutbolAPI] Buscando Sporting en Segunda División...`);
    if (segundaMatches.length > 0) {
      console.log(`[FutbolAPI] Primeros equipos en Segunda División:`, 
        segundaMatches.slice(0, 5).map(m => `${m.homeTeam?.name} vs ${m.awayTeam?.name}`));
    }
    
    segundaMatches.forEach(match => {
      const homeTeam = match.homeTeam?.name;
      const awayTeam = match.awayTeam?.name;
      
      // Buscar variaciones de Sporting
      if (matchesTeam(homeTeam, "Real Sporting de Gijón") || matchesTeam(awayTeam, "Real Sporting de Gijón")) {
        results["Real Sporting de Gijón"].push({
          home: homeTeam,
          away: awayTeam,
          date: match.utcDate,
          matchday: match.matchday,
          id: match.id
        });
        console.log(`[FutbolAPI] Encontrado partido de Sporting: ${homeTeam} vs ${awayTeam}`);
      }
    });
    
    // Si no encontramos Sporting en Segunda División, intentar buscar en Primera si hay algún error
    if (results["Real Sporting de Gijón"].length === 0 && segundaMatches.length === 0) {
      console.warn("[FutbolAPI] No se encontraron partidos de Segunda División. La API puede no tener datos o requerir API key.");
    }

    // Ordenar por fecha
    Object.keys(results).forEach(team => {
      results[team].sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    // Log detallado de resultados
    console.log("[FutbolAPI] Resumen de partidos encontrados:");
    Object.keys(results).forEach(team => {
      console.log(`[FutbolAPI] ${team}: ${results[team].length} partidos`);
      if (results[team].length > 0 && results[team].length <= 3) {
        results[team].forEach(m => {
          console.log(`[FutbolAPI]   - ${m.home} vs ${m.away} (${m.date})`);
        });
      }
    });

    return results;
  } catch (error) {
    console.error("Error obteniendo partidos:", error);
    throw error;
  }
}

// Función principal para obtener jornadas listas para usar
// Nueva estrategia: tomar el próximo partido de cada equipo y agruparlos por fecha
async function getJornadasFromAPI(apiKey = null, numJornadas = 5) {
  try {
    const matches = await getUpcomingMatchesForTeams(apiKey);
    
    const teamsNeeded = ["Real Madrid", "FC Barcelona", "Real Sociedad", "Real Sporting de Gijón"];
    
    // Verificar que tenemos partidos para cada equipo
    console.log("[FutbolAPI] Partidos disponibles por equipo:");
    teamsNeeded.forEach(team => {
      const teamMatches = matches[team] || [];
      console.log(`[FutbolAPI] ${team}: ${teamMatches.length} partidos`);
      if (teamMatches.length > 0) {
        console.log(`[FutbolAPI]   Próximo: ${teamMatches[0].home} vs ${teamMatches[0].away} (${teamMatches[0].date})`);
      }
    });
    
    const jornadas = [];
    const usedMatchIds = new Set();
    
    // Crear jornadas tomando el próximo partido disponible de cada equipo
    for (let jornadaIndex = 0; jornadaIndex < numJornadas; jornadaIndex++) {
      const selectedMatches = [];
      const jornadaDates = [];
      
      // Para cada equipo, tomar el siguiente partido no usado
      teamsNeeded.forEach(team => {
        const teamMatches = matches[team] || [];
        // Buscar el primer partido que no hayamos usado
        const nextMatch = teamMatches.find(m => !usedMatchIds.has(m.id));
        
        if (nextMatch) {
          selectedMatches.push({
            home: nextMatch.home,
            away: nextMatch.away,
            date: nextMatch.date,
            matchday: nextMatch.matchday
          });
          usedMatchIds.add(nextMatch.id);
          jornadaDates.push(new Date(nextMatch.date));
          console.log(`[FutbolAPI] Jornada ${jornadaIndex + 1}: Añadido ${team} - ${nextMatch.home} vs ${nextMatch.away}`);
        } else {
          console.warn(`[FutbolAPI] Jornada ${jornadaIndex + 1}: No hay más partidos disponibles para ${team}`);
        }
      });
      
      // Si no tenemos al menos 1 partido, no podemos crear más jornadas
      if (selectedMatches.length === 0) {
        console.log(`[FutbolAPI] No hay más partidos disponibles. Se crearon ${jornadas.length} jornadas.`);
        break;
      }
      
      // Calcular fecha de la jornada (usar la fecha más temprana)
      const earliestDate = jornadaDates.length > 0 
        ? new Date(Math.min(...jornadaDates.map(d => d.getTime())))
        : new Date();
      
      const friday = getNextFriday(earliestDate);
      friday.setHours(15, 0, 0, 0);
      
      // Si faltan partidos, rellenar con placeholders (no debería pasar si hay suficientes partidos)
      while (selectedMatches.length < 4) {
        selectedMatches.push({
          home: `Equipo ${selectedMatches.length + 1}`,
          away: `Equipo ${selectedMatches.length + 2}`,
          date: earliestDate.toISOString()
        });
        console.warn(`[FutbolAPI] Jornada ${jornadaIndex + 1}: Rellenando con placeholder (faltan ${4 - selectedMatches.length} partidos)`);
      }
      
      const jornadaId = `J${jornadaIndex + 1}`;
      const finalMatches = selectedMatches.slice(0, 4).map(m => ({
        home: m.home || "",
        away: m.away || ""
      }));
      
      console.log(`[FutbolAPI] Jornada ${jornadaId} - Partidos finales:`, finalMatches.map(m => `${m.home} vs ${m.away}`));
      
      jornadas.push({
        id: jornadaId,
        name: `Jornada ${jornadaIndex + 1}`,
        deadline: friday.toISOString(),
        matches: finalMatches,
        source: "api"
      });
      
      console.log(`[FutbolAPI] Jornada ${jornadaId} creada con ${finalMatches.length} partidos`);
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

