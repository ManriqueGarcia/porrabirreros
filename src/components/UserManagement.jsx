import { useState, useMemo, useEffect } from "react";
import { nowISO, hashPassword } from "../utils.js";
import { DEFAULT_PASSWORD_HASH } from "../config.js";
import { toast } from "../toast.jsx";
import { Avatar } from "./Avatar.jsx";
import { getAdminRoles, hasAnyAdminRole } from "../admin-roles.js";
import { updateUser, fetchUserGroups, fetchGroupsList, getActiveGroupId, API_BASE_URL, API_HEADERS } from "../api.js";

export function UserManagement({ db, setDb, currentUser }) {
  const [newUserName, setNewUserName] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserPorras, setNewUserPorras] = useState({ f1: true, futbol: true });
  const [filter, setFilter] = useState("all");
  const [expandedUser, setExpandedUser] = useState(null);
  const [userGroupsMap, setUserGroupsMap] = useState({});
  const [allGroups, setAllGroups] = useState(null);
  const [addingToGroup, setAddingToGroup] = useState(false);
  const currentGroupId = getActiveGroupId();

  const userList = useMemo(() => {
    const all = Object.values(db.users || {}).sort((a, b) => a.name.localeCompare(b.name));
    if (filter === "all") return all;
    return all.filter((u) => {
      const porras = u.porras || { f1: true, futbol: true };
      return !!porras[filter];
    });
  }, [db.users, filter]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    const name = newUserName.trim();
    if (!name) return toast.error("Introduce un nombre");
    if (db.users?.[name]) return toast.error("Ese usuario ya existe");
    const passValue = newUserPass.trim();
    const hash = passValue ? await hashPassword(passValue) : DEFAULT_PASSWORD_HASH;
    setDb((prev) => {
      const users = { ...(prev.users || {}) };
      users[name] = {
        name,
        passwordHash: hash,
        mustChange: true,
        isAdmin: false,
        blocked: false,
        createdAt: nowISO(),
        porras: { f1: !!newUserPorras.f1, futbol: !!newUserPorras.futbol },
      };
      const participants = { ...(prev.participants || {}) };
      if (!participants[name]) participants[name] = { name, createdAt: nowISO() };
      return { ...prev, users, participants };
    });
    setNewUserName("");
    setNewUserPass("");
    setNewUserPorras({ f1: true, futbol: true });
    toast.success(`Usuario ${name} creado`);
  };

  const resetPasswordFor = (name) => {
    if (!window.confirm(`¿Resetear la contraseña de ${name}?`)) return;
    setDb((prev) => {
      const users = { ...(prev.users || {}) };
      if (users[name]) {
        users[name] = { ...users[name], passwordHash: DEFAULT_PASSWORD_HASH, mustChange: true, blocked: false, changedAt: null };
        delete users[name].password;
      }
      return { ...prev, users };
    });
    updateUser(name, currentUser, { passwordHash: DEFAULT_PASSWORD_HASH, mustChange: true, blocked: false })
      .catch(err => console.error("Error sync reset password:", err));
    toast.success("Contraseña reseteada");
  };

  const toggleBlockUser = (name) => {
    if (name === currentUser) return;
    setDb((prev) => {
      const users = { ...(prev.users || {}) };
      if (users[name]) users[name] = { ...users[name], blocked: !users[name].blocked };
      return { ...prev, users };
    });
  };

  const removeUser = (name) => {
    if (db.users?.[name]?.isAdmin) return toast.error("No puedes borrar un admin");
    if (name === currentUser) return toast.error("No puedes borrarte a ti mismo");
    if (!window.confirm(`¿Eliminar a ${name}?`)) return;
    setDb((prev) => {
      const users = { ...(prev.users || {}) };
      delete users[name];
      const participants = { ...(prev.participants || {}) };
      delete participants[name];
      const nextBets = {};
      Object.entries(prev.bets || {}).forEach(([raceKey, raceBets]) => {
        const copy = { ...(raceBets || {}) };
        delete copy[name];
        if (Object.keys(copy).length) nextBets[raceKey] = copy;
      });
      const questionOwner = { ...(prev.questionOwner || {}) };
      Object.keys(questionOwner).forEach((raceKey) => {
        if (questionOwner[raceKey] === name) delete questionOwner[raceKey];
      });
      const futbol = { ...(prev.futbol || {}) };
      if (futbol.bets) {
        const fBets = { ...futbol.bets };
        Object.keys(fBets).forEach((jId) => {
          const jBets = { ...(fBets[jId] || {}) };
          delete jBets[name];
          fBets[jId] = jBets;
        });
        futbol.bets = fBets;
      }
      return { ...prev, users, participants, bets: nextBets, questionOwner, futbol };
    });
    toast.success("Usuario eliminado");
  };

  const toggleAdminRole = (name, role) => {
    if (name === currentUser && role === "general") {
      toast.error("No puedes quitarte el rol general a ti mismo");
      return;
    }
    setDb((prev) => {
      const users = { ...(prev.users || {}) };
      if (!users[name]) return prev;
      const u = users[name];
      const current = getAdminRoles(u);
      const next = { ...current, [role]: !current[role] };
      const anyRole = next.general || next.f1 || next.futbol;
      users[name] = { ...u, adminRoles: next, isAdmin: anyRole };
      return { ...prev, users };
    });
  };

  const togglePorra = (name, porra) => {
    const current = (db.users?.[name]?.porras) || { f1: true, futbol: true };
    const next = { ...current, [porra]: !current[porra] };
    if (!next.f1 && !next.futbol) {
      toast.error("El usuario debe estar al menos en una porra");
      return;
    }
    setDb((prev) => {
      const users = { ...(prev.users || {}) };
      if (!users[name]) return prev;
      users[name] = { ...users[name], porras: next };
      return { ...prev, users };
    });
  };

  const loadUserGroups = async (name) => {
    if (expandedUser === name) { setExpandedUser(null); return; }
    setExpandedUser(name);
    try {
      const groups = await fetchUserGroups(name, currentUser);
      setUserGroupsMap(prev => ({ ...prev, [name]: groups }));
      if (!allGroups) {
        const gl = await fetchGroupsList(currentUser);
        setAllGroups(gl);
      }
    } catch { toast.error("Error cargando grupos"); }
  };

  const addUserToGroup = async (userName, targetGroupId) => {
    setAddingToGroup(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/g/${targetGroupId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...API_HEADERS, "x-porra-user": currentUser },
        body: JSON.stringify({ name: userName, passwordHash: DEFAULT_PASSWORD_HASH, mustChange: true, porras: db.users?.[userName]?.porras || { f1: true, futbol: true } }),
      });
      if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.error || "Error"); }
      toast.success(`${userName} añadido al grupo`);
      const groups = await fetchUserGroups(userName, currentUser);
      setUserGroupsMap(prev => ({ ...prev, [userName]: groups }));
    } catch (err) { toast.error(err.message); }
    finally { setAddingToGroup(false); }
  };

  const removeUserFromGroup = async (userName, targetGroupId) => {
    if (!window.confirm(`¿Quitar a ${userName} de este grupo?`)) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/g/${targetGroupId}/users/${encodeURIComponent(userName)}`, {
        method: "DELETE",
        headers: { ...API_HEADERS, "x-porra-user": currentUser },
      });
      if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(d.error || "Error"); }
      toast.success(`${userName} quitado del grupo`);
      const groups = await fetchUserGroups(userName, currentUser);
      setUserGroupsMap(prev => ({ ...prev, [userName]: groups }));
    } catch (err) { toast.error(err.message); }
  };

  const totalUsers = Object.keys(db.users || {}).length;
  const f1Count = Object.values(db.users || {}).filter((u) => (u.porras || { f1: true }).f1).length;
  const futCount = Object.values(db.users || {}).filter((u) => (u.porras || { futbol: true }).futbol).length;

  return (
    <div className="border border-white/10 rounded p-3">
      <h3 className="font-semibold mb-2">Gestión de usuarios</h3>
      <div className="flex gap-2 mb-3">
        <button type="button" className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${filter === "all" ? "bg-white/15 text-white border border-white/30" : "bg-neutral-800 text-white/40 border border-white/10 hover:text-white/60"}`} onClick={() => setFilter("all")}>Todos ({totalUsers})</button>
        <button type="button" className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${filter === "f1" ? "bg-red-600/30 text-red-200 border border-red-500/40" : "bg-neutral-800 text-white/40 border border-white/10 hover:text-white/60"}`} onClick={() => setFilter("f1")}>F1 ({f1Count})</button>
        <button type="button" className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${filter === "futbol" ? "bg-emerald-600/30 text-emerald-200 border border-emerald-500/40" : "bg-neutral-800 text-white/40 border border-white/10 hover:text-white/60"}`} onClick={() => setFilter("futbol")}>Fútbol ({futCount})</button>
      </div>
      <form onSubmit={handleAddUser} className="space-y-2">
        <div className="grid gap-2 md:grid-cols-[2fr,2fr,auto]">
          <input className="select border rounded px-3 py-2" placeholder="Nombre" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
          <input className="select border rounded px-3 py-2" placeholder="Contraseña inicial (vacío = defecto)" value={newUserPass} onChange={(e) => setNewUserPass(e.target.value)} />
          <button className="px-3 py-2 rounded bg-slate-900 text-white">Añadir</button>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={newUserPorras.f1} onChange={() => setNewUserPorras((p) => ({ ...p, f1: !p.f1 }))} />
            <span>F1</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={newUserPorras.futbol} onChange={() => setNewUserPorras((p) => ({ ...p, futbol: !p.futbol }))} />
            <span>Fútbol</span>
          </label>
        </div>
      </form>
      <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
        {userList.map((u) => {
          const isSelf = u.name === currentUser;
          const porras = u.porras || { f1: true, futbol: true };
          const roles = getAdminRoles(u);
          const isAnyAdmin = hasAnyAdminRole(u);
          return (
            <div key={u.name} className="flex flex-col gap-2 border border-white/10 rounded px-3 py-2 bg-neutral-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} avatar={db.meta?.avatars?.[u.name]} avatarFutbol={db.meta?.avatarsFutbol?.[u.name]} size="sm" />
                  <div>
                    <div className="font-medium flex flex-wrap items-center gap-2">
                      {u.name}
                      {u.blocked && <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600/20 text-amber-200 border border-amber-400/40">Bloqueado</span>}
                    </div>
                    <div className="text-xs text-slate-400">
                      {u.blocked ? "Bloqueado" : "Activo"}
                      {u.mustChange ? " · debe cambiar contraseña" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button type="button" className="px-3 py-1.5 rounded bg-slate-800 text-white text-xs" onClick={() => resetPasswordFor(u.name)}>Reset pass</button>
                  <button type="button" className={`px-3 py-1.5 rounded text-xs ${u.blocked ? "bg-emerald-700" : "bg-amber-600"} text-white`} disabled={isSelf} onClick={() => toggleBlockUser(u.name)}>
                    {u.blocked ? "Desbloquear" : "Bloquear"}
                  </button>
                  {!isAnyAdmin && !isSelf && (
                    <button type="button" className="px-3 py-1.5 rounded bg-red-700 text-white text-xs" onClick={() => removeUser(u.name)}>Borrar</button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-t border-white/5 pt-2">
                <span className="text-white/40 w-14">Porras:</span>
                <button type="button" className={`px-2 py-0.5 rounded font-semibold transition-all ${porras.f1 ? "bg-red-600/30 text-red-200 border border-red-500/40" : "bg-neutral-800 text-white/30 border border-white/10"}`} onClick={() => togglePorra(u.name, "f1")}>F1</button>
                <button type="button" className={`px-2 py-0.5 rounded font-semibold transition-all ${porras.futbol ? "bg-emerald-600/30 text-emerald-200 border border-emerald-500/40" : "bg-neutral-800 text-white/30 border border-white/10"}`} onClick={() => togglePorra(u.name, "futbol")}>FUT</button>
                <span className="text-white/20 mx-1">|</span>
                <span className="text-white/40 w-14">Admin:</span>
                <button type="button" className={`px-2 py-0.5 rounded font-semibold transition-all ${roles.general ? "bg-purple-600/30 text-purple-200 border border-purple-500/40" : "bg-neutral-800 text-white/30 border border-white/10"}`} onClick={() => toggleAdminRole(u.name, "general")} title="Gestión de usuarios">GEN</button>
                <button type="button" className={`px-2 py-0.5 rounded font-semibold transition-all ${roles.f1 ? "bg-red-600/30 text-red-200 border border-red-500/40" : "bg-neutral-800 text-white/30 border border-white/10"}`} onClick={() => toggleAdminRole(u.name, "f1")} title="Admin F1">F1</button>
                <button type="button" className={`px-2 py-0.5 rounded font-semibold transition-all ${roles.futbol ? "bg-emerald-600/30 text-emerald-200 border border-emerald-500/40" : "bg-neutral-800 text-white/30 border border-white/10"}`} onClick={() => toggleAdminRole(u.name, "futbol")} title="Admin Fútbol">FUT</button>
                <span className="text-white/20 mx-1">|</span>
                <button type="button" className={`px-2 py-0.5 rounded font-semibold transition-all ${expandedUser === u.name ? "bg-blue-600/30 text-blue-200 border border-blue-500/40" : "bg-neutral-800 text-white/30 border border-white/10"}`} onClick={() => loadUserGroups(u.name)}>Grupos</button>
              </div>
              {expandedUser === u.name && (
                <div className="text-xs border-t border-white/5 pt-2 space-y-1.5">
                  <div className="text-white/40 font-semibold mb-1">Grupos del usuario:</div>
                  {(userGroupsMap[u.name] || []).length === 0 && <div className="text-white/30 italic">Cargando...</div>}
                  {(userGroupsMap[u.name] || []).map(g => (
                    <div key={g.groupId} className="flex items-center justify-between gap-2 bg-neutral-800/50 rounded px-2 py-1">
                      <span className="text-white/70">{g.groupName || g.groupId} {g.groupId === currentGroupId && <span className="text-amber-400/60">(actual)</span>}</span>
                      {g.groupId !== currentGroupId && (
                        <button type="button" className="text-red-400/70 hover:text-red-300 text-[10px]" onClick={() => removeUserFromGroup(u.name, g.groupId)}>Quitar</button>
                      )}
                    </div>
                  ))}
                  {allGroups && (() => {
                    const userGroupIds = (userGroupsMap[u.name] || []).map(g => g.groupId);
                    const available = allGroups.filter(g => !userGroupIds.includes(g.groupId));
                    if (!available.length) return null;
                    return (
                      <div className="flex items-center gap-2 mt-1">
                        <select id={`add-group-${u.name}`} className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 py-1 text-white/70">
                          {available.map(g => <option key={g.groupId} value={g.groupId}>{g.name || g.groupId}</option>)}
                        </select>
                        <button type="button" disabled={addingToGroup} className="px-2 py-1 rounded bg-blue-700/60 text-white text-[10px] hover:bg-blue-600/80 disabled:opacity-40"
                          onClick={() => { const sel = document.getElementById(`add-group-${u.name}`); if (sel) addUserToGroup(u.name, sel.value); }}>Añadir</button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getParticipantsForPorra(db, porra) {
  const users = db.users || {};
  return Object.keys(db.participants || {})
    .filter((name) => {
      const u = users[name];
      if (!u) return true;
      const porras = u.porras || { f1: true, futbol: true };
      return !!porras[porra];
    })
    .sort((a, b) => a.localeCompare(b));
}
