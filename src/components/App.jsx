import { useState, useEffect, useMemo, useRef, useCallback, Component } from "react";
import { CACHE_BUST, CONFIG, DEFAULT_PASSWORD_HASH, ADMIN_SECRET_HASH, QUESTION_AUTHORS_ORDER, MADRID_TZ, SESSION_TIMEOUT_MS } from "../config.js";
import { nowISO, hashPassword, getSession, createSession, clearSession, toZonedDate, formatDateTime, formatTime, checkLoginRateLimit, recordLoginFailure, resetLoginAttempts } from "../utils.js";
import { fetchRemoteState, saveRemoteDebounced, loadCalendar, loadDrivers, loadTeams, loadCircuits, setActiveGroupId, authLogin, setSaveRemoteUser, setSessionToken, setOnSessionExpired } from "../api.js";
import { LangCtx } from "../i18n.jsx";
import { toast, ToastContainer } from "../toast.jsx";
import { defaultFutbolState } from "../futbol-utils.js";
import { Avatar } from "./Avatar.jsx";
import { CircuitCard } from "./CircuitCard.jsx";
import { ChangePasswordModal, ChangeAvatarModal } from "./Auth.jsx";
import { Ranking } from "./Ranking.jsx";
import { QuestionsHistory } from "./Ranking.jsx";
import { Stats } from "./Stats.jsx";
import { Historico } from "./Historico.jsx";
import { AIAssistant } from "./AIAssistant.jsx";
import { F1Rules, FutbolRules } from "./Rules.jsx";
import { Participante } from "./Participante.jsx";
import { WelcomeBanner } from "./WelcomeBanner.jsx";
import { FutbolParticipante } from "./FutbolParticipante.jsx";
import { FutbolRanking, FutbolEvolutionChart } from "./FutbolRanking.jsx";
import { AdminPanel } from "./AdminPanel.jsx";
import { hasAnyAdminRole } from "../admin-roles.js";
import { CreateGroup } from "./CreateGroup.jsx";
import { JoinGroup } from "./JoinGroup.jsx";

console.info("[PorraF1] Versión carga", CACHE_BUST);

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error("React crash:", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
          <div className="card p-6 max-w-md text-center space-y-4">
            <h2 className="text-xl font-bold text-red-400">Algo ha ido mal</h2>
            <p className="text-sm text-white/60">{this.state.error?.message || "Error desconocido"}</p>
            <button className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-sm hover:bg-white/15" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash;
}

function parseRoute(hash) {
  const h = hash.replace(/^#\/?/, "");
  if (!h || h === "/") return { page: "root" };
  if (h === "create") return { page: "create" };
  if (h.startsWith("join/")) return { page: "join", inviteCode: h.replace("join/", "") };
  if (h.startsWith("g/")) {
    const groupId = h.replace("g/", "").split("/")[0];
    if (groupId) return { page: "app", groupId };
  }
  return { page: "root" };
}

function getSavedGroupId() {
  return sessionStorage.getItem("porra_group_id") || "";
}

function GlobalLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState(null);
  const [authUser, setAuthUser] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading || !username.trim() || !password) return;
    const rl = checkLoginRateLimit();
    if (!rl.allowed) return toast.error(rl.msg);
    setLoading(true);
    try {
      const pwdHash = await hashPassword(password);
      const data = await authLogin(username.trim(), pwdHash);
      setAuthUser(data.username);
      resetLoginAttempts();
      if (data.groups?.length === 1) {
        createSession(data.username, data.groups, data.sessionToken);
        sessionStorage.setItem("porra_group_id", data.groups[0].groupId);
        window.location.hash = `#/g/${data.groups[0].groupId}`;
      } else {
        setGroups(data.groups);
      }
    } catch (err) {
      recordLoginFailure();
      toast.error(err.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const selectGroup = (g) => {
    const existingSession = getSession();
    createSession(authUser, groups, existingSession?.serverToken);
    sessionStorage.setItem("porra_group_id", g.groupId);
    window.location.hash = `#/g/${g.groupId}`;
  };

  if (groups && groups.length > 1) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-white mb-1">PORRA BIRREROS <span>🍺</span></h1>
            <p className="text-white/50 text-sm">Hola <b className="text-white/70">{authUser}</b>, elige un grupo</p>
          </div>
          <div className="space-y-3">
            {groups.map(g => (
              <button key={g.groupId} onClick={() => selectGroup(g)}
                className="w-full p-4 text-left hover:bg-white/10 transition-all border border-white/10 rounded-xl bg-neutral-900/50">
                <div className="font-semibold text-white">{g.groupName || g.groupId}</div>
                <div className="text-xs text-white/40 mt-1">Unido el {new Date(g.joinedAt).toLocaleDateString("es")}</div>
              </button>
            ))}
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="card card-racing beer-glow p-6 w-full max-w-sm">
        <h2 className="section-title text-center mb-1">Entra en la porra</h2>
        <p className="text-center text-xs text-white/30 mb-4">🍺 Que empiecen las apuestas — y las birras</p>
        <form onSubmit={handleLogin} className="grid gap-3">
          <div>
            <label htmlFor="login-user" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Usuario</label>
            <input id="login-user" type="text" autoComplete="username" className="select border rounded px-3 py-2.5 w-full" placeholder="Tu nombre de usuario" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="login-pass" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Contraseña</label>
            <input id="login-pass" type="password" autoComplete="current-password" className="select border rounded px-3 py-2.5 w-full" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button disabled={loading} className="mt-1 px-4 py-2.5 rounded-xl border text-white font-bold tracking-wide shadow-lg transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg,rgba(225,6,0,.8),rgba(217,119,6,.7))", borderColor: "rgba(245,158,11,.3)", boxShadow: "0 4px 20px rgba(225,6,0,.15),0 2px 10px rgba(245,158,11,.1)" }}>{loading ? "Entrando..." : "🍺 ENTRAR"}</button>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}

export function App() {
  const hash = useHashRoute();
  const route = parseRoute(hash);

  if (route.page === "root") {
    const session = getSession();
    if (session?.user && session?.groups?.length) {
      const saved = getSavedGroupId();
      const target = saved || session.groups[0].groupId;
      if (!saved) sessionStorage.setItem("porra_group_id", target);
      window.location.hash = `#/g/${target}`;
      return null;
    }
    return <GlobalLogin />;
  }
  if (route.page === "create") {
    return <><CreateGroup
      onCreated={(data) => {
        sessionStorage.setItem("porra_group_id", data.groupId);
        toast.success(`Grupo "${data.name}" creado. Código de invitación: ${data.inviteCode}`);
        window.location.hash = `#/g/${data.groupId}`;
      }}
      onBack={() => { window.location.hash = "#/"; }}
    /><ToastContainer /></>;
  }
  if (route.page === "join") {
    return <><JoinGroup
      inviteCode={route.inviteCode || ""}
      onJoined={(data) => {
        sessionStorage.setItem("porra_group_id", data.groupId);
        toast.success(`Te has unido al grupo como ${data.userName}`);
        window.location.hash = `#/g/${data.groupId}`;
      }}
      onBack={() => { window.location.hash = "#/"; }}
    /><ToastContainer /></>;
  }

  const session = getSession();
  if (!session?.user) {
    window.location.hash = "#/";
    return null;
  }

  return <GroupApp key={route.groupId} groupId={route.groupId} />;
}

function GroupApp({ groupId }) {
  useEffect(() => {
    setActiveGroupId(groupId);
    const s = getSession();
    if (s?.serverToken) setSessionToken(s.serverToken);
    return () => setActiveGroupId(null);
  }, [groupId]);

  const [lang, setLang] = useState(() => sessionStorage.getItem("porra_lang") || "es");
  useEffect(() => { sessionStorage.setItem("porra_lang", lang); }, [lang]);
  const [theme, setTheme] = useState(() => sessionStorage.getItem("porra_theme") || "dark");
  useEffect(() => { sessionStorage.setItem("porra_theme", theme); document.documentElement.dataset.theme = theme; }, [theme]);
  const [db, setDb] = useState({}); const [cal, setCal] = useState([]); const [drivers, setDrivers] = useState([]); const [teams, setTeams] = useState([]); const [circuits, setCircuits] = useState({}); const [selectedRaceKey, setSelectedRaceKey] = useState(() => sessionStorage.getItem("porra_selected_race") || ""); useEffect(() => { if (selectedRaceKey && !cal?.find(r => r.key === selectedRaceKey) && cal?.length) { const nowMs=Date.now(); const upcoming=cal.find(r=>r.cutoff && r.cutoff.getTime()>nowMs); setSelectedRaceKey(upcoming?.key || cal[cal.length-1].key); } }, [cal, selectedRaceKey]); useEffect(() => { if (selectedRaceKey) sessionStorage.setItem("porra_selected_race", selectedRaceKey); }, [selectedRaceKey]); const [user, setUser] = useState(() => { const s = getSession(); return s?.user || sessionStorage.getItem("porra_session_user") || ""; }); const [view, setView] = useState("participante"); const [mode, setMode] = useState(() => sessionStorage.getItem("porra_mode") || "f1"); const [showPass, setShowPass] = useState(false); const [showAvatar, setShowAvatar] = useState(false); const [showAI, setShowAI] = useState(false); const [hydrated, setHydrated] = useState(false); const [defaultPwdHash, setDefaultPwdHash] = useState("");
  const [showBanner, setShowBanner] = useState(false);
  useEffect(() => { setSaveRemoteUser(user); }, [user]);
  const setDbUser = useCallback((updater) => { setDb(prev => typeof updater === "function" ? updater(prev) : updater); }, []);
  const userGroups = useMemo(() => getSession()?.groups || [], [user]);
  const currentGroupName = useMemo(() => userGroups.find(g => g.groupId === groupId)?.groupName || "", [userGroups, groupId]);
  const [forcePwdChange, setForcePwdChange] = useState(false);
  const logout = useCallback((reason) => {
    clearSession();
    setSessionToken(null);
    setUser("");
    setView("participante");
    setShowPass(false);
    if (reason) toast(reason);
    window.location.hash = "#/";
  }, []);
  useEffect(() => { setOnSessionExpired(() => logout("Sesión expirada. Vuelve a iniciar sesión.")); return () => setOnSessionExpired(null); }, [logout]);
  const skipRemoteSaveRef = useRef(false);
  const refreshRemoteState = useCallback(async () => {
    try {
      const remote = await fetchRemoteState();
      if (remote) {
        skipRemoteSaveRef.current = true;
        setDb(remote);
      }
    } catch (err) { console.warn("No se pudo refrescar estado remoto", err); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchRemoteState();
        if (remote && !cancelled) {
          skipRemoteSaveRef.current = true;
          setDb(remote);
        }
      } catch (err) { console.warn("No se pudo cargar estado remoto", err); }
      finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const REFRESH_INTERVAL = 60_000;
    const id = setInterval(refreshRemoteState, REFRESH_INTERVAL);
    const onVisibility = () => { if (document.visibilityState === "visible") refreshRemoteState(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisibility); };
  }, [hydrated, refreshRemoteState]);
  useEffect(() => {
    if (!hydrated) return;
    if (skipRemoteSaveRef.current) {
      skipRemoteSaveRef.current = false;
      return;
    }
    saveRemoteDebounced(db);
  }, [db, hydrated]);
  const [loadError, setLoadError] = useState(null);
  useEffect(() => {
    const safe = (fn, label) => fn().catch(err => { console.error(`Error cargando ${label}:`, err); setLoadError(prev => prev || `No se pudo cargar ${label}`); return null; });
    Promise.all([
      safe(loadCalendar, "calendario"),
      safe(loadDrivers, "pilotos"),
      safe(loadTeams, "equipos"),
      safe(loadCircuits, "circuitos"),
    ]).then(([d1, d2, d3, d4]) => {
      if (d1) setCal(d1);
      if (d2) setDrivers(d2);
      if (d3) setTeams(d3);
      if (d4) setCircuits(d4);
      if (d1 && d2 && d3 && d4) setLoadError("");
    });
    setDefaultPwdHash(DEFAULT_PASSWORD_HASH);
  }, []);
  useEffect(() => {
    const stored = Number(sessionStorage.getItem("porra_last_active") || 0);
    if (user && stored && Date.now() - stored > SESSION_TIMEOUT_MS) {
      logout("Sesión caducada por inactividad (30 min). Vuelve a introducir la contraseña.");
      return;
    }
    if (!getSession()?.user && user) {
      logout();
      return;
    }
    const mark = () => { const ts = Date.now(); sessionStorage.setItem("porra_last_active", String(ts)); };
    mark();
    const onFocus = () => mark();
    window.addEventListener("click", mark);
    window.addEventListener("keydown", mark);
    window.addEventListener("focus", onFocus);
    const id = setInterval(() => {
      const last = Number(sessionStorage.getItem("porra_last_active") || 0);
      if (user && last && Date.now() - last > SESSION_TIMEOUT_MS) {
        logout("Sesión caducada por inactividad (30 min). Vuelve a introducir la contraseña.");
      }
    }, 60000);
    return () => { window.removeEventListener("click", mark); window.removeEventListener("keydown", mark); window.removeEventListener("focus", onFocus); clearInterval(id); };
  }, [user, logout]);
  const migrationRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    const entries = Object.entries(db.users || {}).filter(([_, u]) => u?.password && !u.passwordHash);
    if (!entries.length) return;
    if (migrationRef.current) return;
    migrationRef.current = true;
    (async () => {
      try {
        const users = { ...(db.users || {}) };
        for (const [name, u] of entries) {
          try {
            const hash = await hashPassword(u.password);
            users[name] = { ...u, passwordHash: hash };
            delete users[name].password;
          } catch (err) { console.warn("No se pudo migrar pass de", name, err); }
        }
        setDbUser(prev => ({ ...prev, users }));
      } finally {
        migrationRef.current = false;
      }
    })();
  }, [hydrated, db.users, setDbUser]);
  useEffect(() => {
    if (db.meta?.seeded || !defaultPwdHash) return;
    const initial = CONFIG.participants;
    const adminUser = initial[initial.length - 1];
    skipRemoteSaveRef.current = true;
    setDb(prev => {
      const baseUsers = { ...(prev.users || {}) }; initial.forEach(n => { if (!baseUsers[n]) baseUsers[n] = { name: n, passwordHash: defaultPwdHash, mustChange: true, isAdmin: n === adminUser, blocked: false }; else if (baseUsers[n].password && !baseUsers[n].passwordHash) { baseUsers[n] = { ...baseUsers[n], passwordHash: defaultPwdHash }; delete baseUsers[n].password; } });
      const baseParticipants = { ...(prev.participants || {}) }; initial.forEach(n => { if (!baseParticipants[n]) baseParticipants[n] = { name: n, createdAt: nowISO() }; });
      const prevMeta = prev.meta || {};
      const championships = prevMeta.championships || {};
      const nextDrivers = drivers && drivers.length ? drivers : (prevMeta.drivers || []);
      const nextTeams = teams && teams.length ? teams : (prevMeta.teams || []);
      const basePoints = prevMeta.basePoints || {};
      return { ...prev, users: baseUsers, participants: baseParticipants, meta: { ...prevMeta, adminSecretHash: prevMeta.adminSecretHash || ADMIN_SECRET_HASH, drivers: nextDrivers, teams: nextTeams, championships, basePoints, seeded: true } };
    });
  }, [drivers, teams, db.meta, defaultPwdHash]);
  useEffect(() => {
    if (!hydrated) return;
    const needsMigration = Object.entries(db.users || {}).filter(([_, u]) => !u.porras || (u.isAdmin && !u.adminRoles));
    if (!needsMigration.length) return;
    skipRemoteSaveRef.current = true;
    setDb(prev => {
      const users = { ...(prev.users || {}) };
      needsMigration.forEach(([name]) => {
        if (!users[name]) return;
        if (!users[name].porras) users[name] = { ...users[name], porras: { f1: true, futbol: true } };
        if (users[name].isAdmin && !users[name].adminRoles) users[name] = { ...users[name], adminRoles: { general: true, f1: true, futbol: true } };
      });
      return { ...prev, users };
    });
  }, [hydrated, db.users]);
  useEffect(() => {
    if (user && hydrated && db.users?.[user]?.mustChange) setForcePwdChange(true);
  }, [user, hydrated, db.users]);
  useEffect(() => {
    if (!hydrated) return;
    if (db.meta?.futbolJornadasV3) return;
    skipRemoteSaveRef.current = true;
    const defaultJornadas = [
      { id: "J27", name: "Jornada 27 (6-9 Mar)", deadline: new Date(2026, 2, 6, 21, 0).toISOString(), matches: [{ home: "Celta de Vigo", away: "Real Madrid" }, { home: "Athletic Club", away: "FC Barcelona" }, { home: "Atlético de Madrid", away: "Real Sociedad" }, { home: "FC Andorra", away: "Real Sporting de Gijón" }] },
      { id: "J28", name: "Jornada 28 (13-16 Mar)", deadline: new Date(2026, 2, 13, 21, 0).toISOString(), matches: [{ home: "Real Madrid", away: "Elche" }, { home: "FC Barcelona", away: "Sevilla" }, { home: "Real Sociedad", away: "Osasuna" }, { home: "Real Sporting de Gijón", away: "Castellón" }] },
      { id: "J29", name: "Jornada 29 (20-22 Mar)", deadline: new Date(2026, 2, 20, 21, 0).toISOString(), matches: [{ home: "Villarreal", away: "Real Sociedad" }, { home: "FC Barcelona", away: "Rayo Vallecano" }, { home: "Real Madrid", away: "Atlético de Madrid" }, { home: "Las Palmas", away: "Real Sporting de Gijón" }] },
      { id: "J30", name: "Jornada 30 (5 Abr)", deadline: new Date(2026, 3, 3, 21, 0).toISOString(), matches: [{ home: "Mallorca", away: "Real Madrid" }, { home: "Atlético de Madrid", away: "FC Barcelona" }, { home: "Real Sociedad", away: "Levante" }, { home: "Real Sporting de Gijón", away: "Real Sociedad B" }] },
      { id: "J31", name: "Jornada 31 (12 Abr)", deadline: new Date(2026, 3, 10, 21, 0).toISOString(), matches: [{ home: "Real Madrid", away: "Girona" }, { home: "FC Barcelona", away: "Espanyol" }, { home: "Real Sociedad", away: "Alavés" }, { home: "Burgos CF", away: "Real Sporting de Gijón" }] },
      { id: "J33", name: "Jornada 33 (22 Abr)", deadline: new Date(2026, 3, 17, 21, 0).toISOString(), matches: [{ home: "Real Madrid", away: "Alavés" }, { home: "FC Barcelona", away: "Celta de Vigo" }, { home: "Real Sociedad", away: "Getafe" }, { home: "Real Sporting de Gijón", away: "Cádiz" }] },
      { id: "J32", name: "Jornada 32 (26 Abr)", deadline: new Date(2026, 3, 24, 21, 0).toISOString(), matches: [{ home: "Betis", away: "Real Madrid" }, { home: "Getafe", away: "FC Barcelona" }, { home: "Rayo Vallecano", away: "Real Sociedad" }, { home: "Córdoba CF", away: "Real Sporting de Gijón" }] },
      { id: "J34", name: "Jornada 34 (3 May)", deadline: new Date(2026, 4, 1, 21, 0).toISOString(), matches: [{ home: "Espanyol", away: "Real Madrid" }, { home: "Osasuna", away: "FC Barcelona" }, { home: "Sevilla", away: "Real Sociedad" }, { home: "Real Sporting de Gijón", away: "A.D. Ceuta" }] },
      { id: "J35", name: "Jornada 35 (10 May)", deadline: new Date(2026, 4, 8, 21, 0).toISOString(), matches: [{ home: "FC Barcelona", away: "Real Madrid" }, { home: "Real Sociedad", away: "Betis" }, { home: "Málaga", away: "Real Sporting de Gijón" }] },
      { id: "J36", name: "Jornada 36 (13 May)", deadline: new Date(2026, 4, 11, 21, 0).toISOString(), matches: [{ home: "Real Madrid", away: "Oviedo" }, { home: "Alavés", away: "FC Barcelona" }, { home: "Girona", away: "Real Sociedad" }] },
      { id: "J37", name: "Jornada 37 (17 May)", deadline: new Date(2026, 4, 15, 21, 0).toISOString(), matches: [{ home: "Sevilla", away: "Real Madrid" }, { home: "FC Barcelona", away: "Betis" }, { home: "Real Sociedad", away: "Valencia" }, { home: "Real Zaragoza", away: "Real Sporting de Gijón" }] },
      { id: "J38", name: "Jornada 38 (24 May)", deadline: new Date(2026, 4, 22, 21, 0).toISOString(), matches: [{ home: "Real Madrid", away: "Athletic Club" }, { home: "Valencia", away: "FC Barcelona" }, { home: "Espanyol", away: "Real Sociedad" }, { home: "Real Sporting de Gijón", away: "Almería" }] }
    ];
    setDb(prev => {
      const f = prev.futbol || defaultFutbolState();
      let jornadas = { ...f.jornadas };
      let newOrder = [...f.order || []];
      ["J1", "J2", "J3", "J27", "J28", "J29", "J30", "J31", "J32", "J33", "J34", "J35", "J36", "J37", "J38"].forEach(id => { delete jornadas[id]; newOrder = newOrder.filter(x => x !== id); });
      defaultJornadas.forEach(j => {
        jornadas[j.id] = j;
        if (!newOrder.includes(j.id)) newOrder.push(j.id);
      });
      newOrder.sort((a, b) => { const ja = jornadas[a], jb = jornadas[b]; if (ja?.deadline && jb?.deadline) return new Date(ja.deadline) - new Date(jb.deadline); const na = parseInt(a.replace(/\D/g, ""), 10); const nb = parseInt(b.replace(/\D/g, ""), 10); return (na || 0) - (nb || 0) || a.localeCompare(b); });
      return { ...prev, futbol: { ...f, jornadas, order: newOrder }, meta: { ...(prev.meta || {}), futbolJornadasV3: true } };
    });
  }, [hydrated, db.futbol, db.meta]);
  const raceOverrides = db.meta?.raceOverrides || {};
  const races = useMemo(() => (Array.isArray(cal) ? cal : []).map(item => {
    const override = raceOverrides[item.key] || {};
    const timeZone = override.timezone || item.timezone || MADRID_TZ;
    const qDate = override.qDate || item.q_date_local || item.date_local;
    const qTime = override.qTime || item.qualifying_time_local;
    const raceDate = override.raceDate || item.race_date_local || item.date_local;
    const raceTime = override.raceTime || item.race_time_local;
    const qStart = toZonedDate(qDate, qTime, timeZone);
    const raceStart = raceTime ? toZonedDate(raceDate, raceTime, timeZone) : null;
    const cutoff = qStart ? new Date(qStart.getTime() - 60 * 1000) : null;
    const showBetsAt = qStart ? new Date(qStart.getTime() + 60 * 1000) : null;
    const authorCutoff = qStart ? new Date(qStart.getTime() - 24 * 60 * 60 * 1000) : null;
    const labels = qStart ? { qLocal: formatDateTime(qStart, timeZone), qMadrid: formatDateTime(qStart, MADRID_TZ), raceLocal: raceStart ? formatDateTime(raceStart, timeZone) : null, raceMadrid: raceStart ? formatDateTime(raceStart, MADRID_TZ) : null } : { qLocal: "—", qMadrid: "—", raceLocal: raceStart ? formatDateTime(raceStart, timeZone) : null, raceMadrid: raceStart ? formatDateTime(raceStart, MADRID_TZ) : null };
    return { ...item, q_date_local: qDate, race_date_local: raceDate, timeZone, qStart, raceStart, cutoff, showBetsAt, authorCutoff, labels };
  }).filter(r => r.qStart), [cal, raceOverrides]);
  useEffect(() => {
    if (!races?.length || !hydrated) return;
    const participants = Object.keys(db.participants || {});
    if (!participants.length) return;
    const needsUpdate = races.some(r => !db.questionOwner?.[r.key]);
    if (!needsUpdate) return;
    skipRemoteSaveRef.current = true;
    setDb(prev => {
      const next = { ...prev, questionOwner: { ...(prev.questionOwner || {}) } };
      races.forEach(r => {
        if (!next.questionOwner[r.key]) {
          const idx = (r.round - 1) % QUESTION_AUTHORS_ORDER.length;
          const author = QUESTION_AUTHORS_ORDER[idx];
          if (participants.includes(author)) next.questionOwner[r.key] = author;
        }
      });
      return next;
    });
  }, [hydrated, races, db.participants, db.questionOwner]);
  useEffect(() => { document.body.dataset.porraMode = mode || "f1"; }, [mode]);
  const sidebarRace = mode === "f1" && view === "participante" && selectedRaceKey ? races?.find(r => r.key === selectedRaceKey) : null;
  const handleModeChange = (newMode) => {
    setMode(newMode);
    sessionStorage.setItem("porra_mode", newMode);
    if (newMode === "f1" && !["participante", "ranking", "stats", "questions", "historico", "rules", "admin"].includes(view)) {
      setView("participante");
    } else if (newMode === "futbol" && !["participante", "ranking", "rules", "admin"].includes(view)) {
      setView("participante");
    }
  };
  return (<LangCtx.Provider value={lang}><div className="w-full max-w-4xl lg:max-w-5xl mx-auto p-3 md:p-4 space-y-4">
    <header className="hero speed-lines p-4 md:p-6">
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0" style={mode === "futbol" ? { background: "linear-gradient(135deg,#16a34a,#d97706)", boxShadow: "0 4px 20px rgba(34,197,94,.2)" } : { background: "linear-gradient(135deg,#e10600,#d97706)", boxShadow: "0 4px 20px rgba(225,6,0,.2)" }}>
            <span className="text-lg md:text-xl">{mode === "f1" ? "🏎️" : "⚽"}</span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black tracking-tighter text-white" style={{ fontStyle: "italic" }}>PORRA {(currentGroupName || "BIRREROS").toUpperCase()} <span className="text-base md:text-lg" style={{ verticalAlign: "middle" }}>🍺</span></div>
            <div className="text-[11px] text-white/50 font-semibold tracking-[.15em] uppercase">{mode === "f1" ? "Formula 1 · 2026 · Las birras en juego" : "Liga · Fútbol · Las birras en juego"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={`px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all ${mode === "f1" ? "bg-red-600/25 text-white border border-red-500/30 shadow-lg shadow-red-600/10" : "bg-white/5 text-white/40 border border-white/8 hover:bg-white/10 hover:text-white/70"}`} onClick={() => handleModeChange("f1")}>F1</button>
          <button className={`px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all ${mode === "futbol" ? "bg-emerald-600/25 text-white border border-emerald-500/30 shadow-lg shadow-emerald-600/10" : "bg-white/5 text-white/40 border border-white/8 hover:bg-white/10 hover:text-white/70"}`} onClick={() => handleModeChange("futbol")}>FUT</button>
          <button className="px-2 py-2 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors border border-white/5 hover:border-white/15" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button className="px-2 py-2 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors border border-white/5 hover:border-white/15" onClick={() => setLang(lang === "es" ? "en" : "es")} title="Cambiar idioma">{lang === "es" ? "EN" : "ES"}</button>
          {user && <div className="hidden md:flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
            {userGroups.length > 1 && <select value={groupId} onChange={e => { sessionStorage.setItem("porra_group_id", e.target.value); window.location.hash = `#/g/${e.target.value}`; }} className="bg-transparent text-white/60 text-xs border border-white/10 rounded-lg px-2 py-1 cursor-pointer">{userGroups.map(g => <option key={g.groupId} value={g.groupId} className="bg-neutral-900">{g.groupName || g.groupId}</option>)}</select>}
            <Avatar name={user} avatar={db.meta?.avatars?.[user]} avatarFutbol={db.meta?.avatarsFutbol?.[user]} size="sm" mode={mode} />
            <span className="text-sm font-semibold text-white/80">{user}</span>
            <button className="text-white/40 hover:text-white/70 text-xs ml-1 transition-colors" onClick={() => setShowPass(true)}>🔑</button>
            <button className="text-white/40 hover:text-white/70 text-xs transition-colors" onClick={() => logout()}>Salir</button>
          </div>}
        </div>
        {user && <div className="flex md:hidden items-center justify-center gap-3 text-xs pt-2 mt-1 border-t border-white/8">
          <div className="flex items-center gap-1.5"><Avatar name={user} avatar={db.meta?.avatars?.[user]} avatarFutbol={db.meta?.avatarsFutbol?.[user]} size="sm" mode={mode} /><span className="font-semibold text-white/70">{user}</span></div>
          {userGroups.length > 1 && <select value={groupId} onChange={e => { sessionStorage.setItem("porra_group_id", e.target.value); window.location.hash = `#/g/${e.target.value}`; }} className="bg-transparent text-white/60 text-xs border border-white/10 rounded px-1 py-0.5">{userGroups.map(g => <option key={g.groupId} value={g.groupId} className="bg-neutral-900">{g.groupName || g.groupId}</option>)}</select>}
          <button className="text-white/35 hover:text-white/70 transition-colors" onClick={() => setShowPass(true)}>Contraseña</button>
          <button className="text-white/40 hover:text-white/65 transition-colors" onClick={() => logout()}>Salir</button>
        </div>}
      </div>
    </header>
    {user && <nav className="porra-nav justify-center" role="tablist" aria-label="Navegación principal">
      <button role="tab" aria-selected={view === "participante"} className={view === "participante" ? "nav-active" : ""} onClick={() => setView("participante")}>Mi apuesta</button>
      <button role="tab" aria-selected={view === "ranking"} className={view === "ranking" ? "nav-active" : ""} onClick={() => setView("ranking")}>Ranking</button>
      {mode === "f1" && <button role="tab" aria-selected={view === "stats"} className={view === "stats" ? "nav-active" : ""} onClick={() => setView("stats")}>Estadísticas</button>}
      {mode === "f1" && <button role="tab" aria-selected={view === "questions"} className={view === "questions" ? "nav-active" : ""} onClick={() => setView("questions")}>Preguntas</button>}
      {mode === "f1" && <button role="tab" aria-selected={view === "historico"} className={view === "historico" ? "nav-active" : ""} onClick={() => setView("historico")}>Histórico</button>}
      <button role="tab" aria-selected={view === "rules"} className={view === "rules" ? "nav-active" : ""} onClick={() => setView("rules")}>Normas</button>
      <button className="nav-special flex items-center gap-1.5" onClick={() => setShowAI(true)} aria-label="Abrir ManriBot"><img src="./assets/manribot.svg" alt="ManriBot" className="w-4 h-4" /> ManriBot</button>
      {hasAnyAdminRole(db.users?.[user]) && <button role="tab" aria-selected={view === "admin"} className={view === "admin" ? "nav-active" : ""} onClick={() => setView("admin")}>⚙ Admin</button>}
    </nav>}
    {!hydrated ? (<div className="card p-6 max-w-sm mx-auto text-center"><div className="text-sm text-white/40 animate-pulse">Conectando con el servidor...</div></div>) : (<>
      {loadError && <div className="card p-4 mb-3 border border-red-500/30 bg-red-900/20 text-sm text-red-300">⚠️ {loadError}. Recarga la página para reintentar.</div>}
      {showBanner && <WelcomeBanner user={user} db={db} races={races} mode={mode} onDismiss={() => setShowBanner(false)} />}
      <div className="md:flex md:gap-4"><aside className="sidebar p-4 w-52 shrink-0 hidden md:flex md:flex-col md:items-center gap-2"><Avatar name={user} avatar={db.meta?.avatars?.[user]} avatarFutbol={db.meta?.avatarsFutbol?.[user]} mode={mode} /><button type="button" className="text-[11px] text-white/40 hover:text-white/60 transition-colors mt-1" onClick={() => setShowAvatar(true)}>Cambiar avatar</button><div className="text-[10px] text-amber-400/40 mt-1 tracking-wider uppercase">{currentGroupName || "birreros club"}</div>{sidebarRace && <div className="mt-2 w-full"><CircuitCard race={sidebarRace} circuits={circuits} compact /></div>}</aside><main className="flex-1 space-y-4 min-w-0">
        {view === "admin" && <AdminPanel db={db} setDb={setDbUser} races={races} drivers={drivers} teams={teams} calendar={cal} currentUser={user} />}
        {view !== "admin" && mode === "f1" && (
          <>
            {view === "participante" && <Participante user={user} races={races} db={db} setDb={setDbUser} drivers={drivers} circuits={circuits} selectedRaceKey={mode === "f1" ? selectedRaceKey : ""} setSelectedRaceKey={mode === "f1" ? setSelectedRaceKey : () => { }} />}
            {view === "ranking" && <Ranking db={db} setDb={setDbUser} races={races} currentUser={user} />}
            {view === "stats" && <Stats db={db} races={races} />}
            {view === "questions" && <QuestionsHistory db={db} races={races} />}
            {view === "historico" && <Historico />}
            {view === "rules" && <F1Rules />}
          </>
        )}
        {view !== "admin" && mode === "futbol" && (
          <>
            {view === "participante" && <FutbolParticipante user={user} db={db} setDb={setDbUser} />}
            {view === "ranking" && <><FutbolRanking db={db} /><FutbolEvolutionChart db={db} /></>}
            {view === "rules" && <FutbolRules />}
          </>
        )}
      </main></div>
    </>)}
    <footer className="text-[12px] text-amber-200 pt-8 pb-6 text-center tracking-widest uppercase font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"><span className="beer-icon">🍺</span> Porra Birreros · Quien gana, se lleva las birras <span className="beer-icon">🍻</span> {mode === "f1" ? "A todo gas" : "Gol y cerveza"} <span className="beer-icon">🍺</span></footer>
    <ChangePasswordModal open={showPass} onClose={() => setShowPass(false)} db={db} setDb={setDbUser} user={user} />
    <ChangePasswordModal open={forcePwdChange} onClose={() => setForcePwdChange(false)} db={db} setDb={setDbUser} user={user} forceChange />
    <ChangeAvatarModal open={showAvatar} onClose={() => setShowAvatar(false)} db={db} setDb={setDbUser} user={user} />
    <AIAssistant open={showAI} onClose={() => setShowAI(false)} races={races} mode={mode} />
    <ToastContainer />
  </div></LangCtx.Provider>);
}
