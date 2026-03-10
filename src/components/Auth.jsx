import { useState, useRef } from "react";
import { toast } from "../toast.jsx";
import { hashPassword, passwordMatches, nowISO, checkLoginRateLimit, recordLoginFailure, resetLoginAttempts, readFileAsDataUrl, resizeImageToDataUrl, MAX_AVATAR_BASE64 } from "../utils.js";
import { DEFAULT_PASSWORD_HASH, RECOVERY_CODE_HASH } from "../config.js";
import { updateUser, saveMeta, verifyPassword } from "../api.js";
import { Avatar } from "./Avatar.jsx";

export function ChangeAvatarModal({ open, onClose, db, setDb, user }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  if (!open) return null;
  const handleFile = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const ok = /\.(jpe?g|png|gif|webp)$/i.test(file.name) || ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type);
    if (!ok) { toast.error("Formato no válido. Usa JPG, PNG, GIF o WebP."); return; }
    setBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setDb(prev => ({ ...prev, meta: { ...(prev.meta || {}), avatars: { ...(prev.meta?.avatars || {}), [user]: dataUrl } } }));
      toast.success("Avatar actualizado");
      onClose();
    } catch (err) { toast.error(err?.message || "Error al subir"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const removeAvatar = () => {
    setDb(prev => {
      const avatars = { ...(prev.meta?.avatars || {}) };
      delete avatars[user];
      return { ...prev, meta: { ...(prev.meta || {}), avatars } };
    });
    toast.success("Avatar eliminado");
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white text-slate-900 rounded-xl p-5 w-full max-w-sm">
        <div id="avatar-modal-title" className="font-semibold mb-3">Cambiar avatar</div>
        <label htmlFor="avatar-file" className="text-sm text-slate-600 mb-3 block">JPG, PNG o SVG. Máx. ~100KB.</label>
        <input id="avatar-file" ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml" onChange={handleFile} className="block w-full text-sm mb-3" disabled={busy} />
        <div className="flex gap-2 justify-end">
          <button type="button" className="px-3 py-2 rounded bg-slate-200" onClick={onClose}>Cancelar</button>
          {db.meta?.avatars?.[user] && <button type="button" className="px-3 py-2 rounded bg-red-100 text-red-700" onClick={removeAvatar}>Quitar avatar</button>}
        </div>
      </div>
    </div>
  );
}

export function ChangePasswordModal({ open, onClose, db, setDb, user, forceChange = false }) {
  const [curr, setCurr] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try {
      const u = db.users?.[user]; if (!u) return toast.error("Usuario no válido");
      if (!forceChange) {
        const currHash = await hashPassword(curr);
        const ok = await verifyPassword(user, currHash);
        if (!ok) return toast.error("Contraseña actual incorrecta");
      }
      if (n1.length < 6) return toast.error("Mínimo 6 caracteres");
      if (n1 !== n2) return toast.error("Las contraseñas no coinciden");
      const hash = await hashPassword(n1);
      try {
        await updateUser(user, user, { passwordHash: hash, mustChange: false });
      } catch (err) {
        console.error("Error sync password:", err);
        toast.error("Error al guardar en el servidor. Inténtalo de nuevo.");
        return;
      }
      setDb(prev => { const users = { ...(prev.users || {}) }; users[user] = { ...users[user], passwordHash: hash, mustChange: false, changedAt: new Date().toISOString() }; delete users[user].password; return { ...prev, users }; });
      toast.success("Contraseña actualizada"); onClose();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="pwd-modal-title" onClick={e => { if (!forceChange && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white text-slate-900 rounded-xl p-5 w-full max-w-sm">
        <div id="pwd-modal-title" className="font-semibold mb-2">{forceChange ? "Cambia tu contraseña" : "Cambiar contraseña"}</div>
        {forceChange && <div className="text-sm text-amber-600 mb-3">Es tu primer acceso. Debes cambiar tu contraseña.</div>}
        <form onSubmit={submit} className="grid gap-2">
          {!forceChange && <><label htmlFor="pwd-curr" className="text-sm">Actual</label><input id="pwd-curr" type="password" autoComplete="current-password" className="border rounded px-3 py-2" value={curr} onChange={e => setCurr(e.target.value)} /></>}
          <label htmlFor="pwd-new" className="text-sm">Nueva</label><input id="pwd-new" type="password" autoComplete="new-password" className="border rounded px-3 py-2" value={n1} onChange={e => setN1(e.target.value)} />
          <label htmlFor="pwd-repeat" className="text-sm">Repetir nueva</label><input id="pwd-repeat" type="password" autoComplete="new-password" className="border rounded px-3 py-2" value={n2} onChange={e => setN2(e.target.value)} />
          <div className="flex gap-2 mt-2 justify-end">{!forceChange && <button type="button" className="px-3 py-2 rounded bg-slate-200" onClick={onClose}>Cancelar</button>}<button disabled={busy} className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50">{busy ? "Guardando..." : "Guardar"}</button></div>
        </form>
      </div>
    </div>
  );
}

function findUser(users, input) {
  if (!users || !input) return null;
  const key = Object.keys(users).find(k => k.toLowerCase() === input.trim().toLowerCase());
  return key || null;
}

export function Login({ db, setDb, onLogged }) {
  const [name, setName] = useState(""); const [pass, setPass] = useState("");
  const [needsChange, setNeedsChange] = useState(false); const [n1, setN1] = useState(""); const [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [recoverUser, setRecoverUser] = useState("");
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverN1, setRecoverN1] = useState("");
  const [recoverN2, setRecoverN2] = useState("");
  const [recoverStep, setRecoverStep] = useState(1);
  const [resolvedRecoverUser, setResolvedRecoverUser] = useState("");

  const tryLogin = async (e) => { e && e.preventDefault(); if (busy) return; const rl = checkLoginRateLimit(); if (!rl.allowed) return toast.error(rl.msg); setBusy(true); try { const realName = findUser(db.users, name); if (!realName) { recordLoginFailure(); return toast.error("Credenciales incorrectas"); } const u = db.users[realName]; const ok = await passwordMatches(u, pass); if (!ok) { recordLoginFailure(); return toast.error("Credenciales incorrectas"); } if (u.blocked) return toast.error("Usuario bloqueado temporalmente"); resetLoginAttempts(); setName(realName); if (u.mustChange) { setNeedsChange(true); return; } if (u.password && !u.passwordHash) { const hash = await hashPassword(pass); setDb(prev => { const users = { ...(prev.users || {}) }; users[realName] = { ...users[realName], passwordHash: hash }; delete users[realName].password; return { ...prev, users }; }); } onLogged(realName); } finally { setBusy(false); } };
  const doChange = async (e) => { e.preventDefault(); if (busy) return; setBusy(true); try { const realName = findUser(db.users, name) || name; if (n1.length < 6) return toast.error("Mínimo 6 caracteres"); if (n1 !== n2) return toast.error("Las contraseñas no coinciden"); const hash = await hashPassword(n1); try { await updateUser(realName, realName, { passwordHash: hash, mustChange: false }); } catch (err) { console.error("Error sync password:", err); toast.error("Error al guardar en el servidor. Inténtalo de nuevo."); return; } setDb(prev => { const users = { ...(prev.users || {}) }; users[realName] = { ...users[realName], passwordHash: hash, mustChange: false, changedAt: nowISO() }; delete users[realName].password; return { ...prev, users }; }); onLogged(realName); } finally { setBusy(false); } };

  const verifyRecoverCode = async (e) => {
    e.preventDefault();
    if (!recoverUser) return toast.error("Escribe tu nombre de usuario");
    const realName = findUser(db.users, recoverUser);
    if (!realName) return toast.error("Credenciales incorrectas");
    setResolvedRecoverUser(realName);
    const inputHash = await hashPassword(recoverCode);
    if (inputHash !== RECOVERY_CODE_HASH) return toast.error("Código de recuperación incorrecto");
    setRecoverStep(2);
  };

  const doRecover = async (e) => {
    e.preventDefault();
    if (busy) return; setBusy(true);
    const targetUser = resolvedRecoverUser;
    try {
      if (recoverN1.length < 6) return toast.error("Mínimo 6 caracteres");
      if (recoverN1 !== recoverN2) return toast.error("Las contraseñas no coinciden");
      const hash = await hashPassword(recoverN1);
      try {
        await updateUser(targetUser, targetUser, { passwordHash: hash, mustChange: false, blocked: false });
      } catch (err) {
        console.error("Error sync recover:", err);
        toast.error("Error al guardar en el servidor. Inténtalo de nuevo.");
        return;
      }
      setDb(prev => {
        const users = { ...(prev.users || {}) };
        users[targetUser] = { ...users[targetUser], passwordHash: hash, mustChange: false, blocked: false, changedAt: nowISO() };
        delete users[targetUser].password;
        return { ...prev, users };
      });
      toast.success("Contraseña actualizada. Ya puedes entrar.");
      setShowRecover(false); setRecoverStep(1); setRecoverUser(""); setRecoverCode(""); setRecoverN1(""); setRecoverN2("");
    } finally { setBusy(false); }
  };

  const resetRecover = () => { setShowRecover(false); setRecoverStep(1); setRecoverUser(""); setResolvedRecoverUser(""); setRecoverCode(""); setRecoverN1(""); setRecoverN2(""); };

  if (showRecover) {
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-2 mb-1">
          <button type="button" onClick={resetRecover} className="text-white/40 hover:text-white/70 transition-colors text-lg" aria-label="Volver">←</button>
          <span className="text-sm font-semibold text-white/70">Recuperar contraseña</span>
        </div>
        {recoverStep === 1 ? (
          <form onSubmit={verifyRecoverCode} className="grid gap-3">
            <div className="text-xs text-amber-300/70 bg-amber-500/10 border border-amber-400/20 rounded-lg p-2.5">
              🔑 Pide el código de recuperación al administrador de la porra.
            </div>
            <div>
              <label htmlFor="recover-user" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Tu usuario</label>
              <input id="recover-user" type="text" autoComplete="username" className="select border rounded px-3 py-2.5 w-full" placeholder="Escribe tu nombre de usuario" value={recoverUser} onChange={e => setRecoverUser(e.target.value)} />
            </div>
            <div>
              <label htmlFor="recover-code" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Código de recuperación</label>
              <input id="recover-code" type="password" autoComplete="off" className="select border rounded px-3 py-2.5 w-full" placeholder="Código que te dio el admin" value={recoverCode} onChange={e => setRecoverCode(e.target.value)} />
            </div>
            <button className="mt-1 px-4 py-2.5 rounded-xl bg-amber-600/80 border border-amber-500/30 text-white font-medium hover:bg-amber-600 transition-all">Verificar código</button>
          </form>
        ) : (
          <form onSubmit={doRecover} className="grid gap-3">
            <div className="text-sm text-emerald-300/80">✅ Código correcto. Elige tu nueva contraseña, <b>{resolvedRecoverUser}</b>.</div>
            <div>
              <label htmlFor="recover-n1" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Nueva contraseña</label>
              <input id="recover-n1" type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={recoverN1} onChange={e => setRecoverN1(e.target.value)} />
            </div>
            <div>
              <label htmlFor="recover-n2" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Repite contraseña</label>
              <input id="recover-n2" type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={recoverN2} onChange={e => setRecoverN2(e.target.value)} />
            </div>
            <button disabled={busy} className="mt-1 px-4 py-2.5 rounded-xl bg-emerald-600/80 border border-emerald-500/30 text-white font-medium hover:bg-emerald-600 transition-all disabled:opacity-50">{busy ? "Guardando..." : "Guardar nueva contraseña"}</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {!needsChange ? (
        <form onSubmit={tryLogin} className="grid gap-3">
          <div>
            <label htmlFor="login-user" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Usuario</label>
            <input id="login-user" type="text" autoComplete="username" className="select border rounded px-3 py-2.5 w-full" placeholder="Escribe tu nombre de usuario" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="login-pass" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Contraseña</label>
            <input id="login-pass" type="password" autoComplete="current-password" className="select border rounded px-3 py-2.5 w-full" value={pass} onChange={e => setPass(e.target.value)} />
          </div>
          <button disabled={busy} className="mt-1 px-4 py-2.5 rounded-xl border text-white font-bold tracking-wide shadow-lg transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg,rgba(225,6,0,.8),rgba(217,119,6,.7))", borderColor: "rgba(245,158,11,.3)", boxShadow: "0 4px 20px rgba(225,6,0,.15),0 2px 10px rgba(245,158,11,.1)" }} onClick={tryLogin}>{busy ? "Entrando..." : "🍺 ENTRAR"}</button>
          <button type="button" onClick={() => setShowRecover(true)} className="text-xs text-white/40 hover:text-amber-300/70 transition-colors mt-0.5">🔑 ¿Olvidaste tu contraseña?</button>
        </form>
      ) : (
        <form onSubmit={doChange} className="grid gap-3">
          <div className="text-sm text-amber-300/80">Es tu primer acceso. Cambia tu contraseña.</div>
          <div><label htmlFor="change-n1" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Nueva contraseña</label><input id="change-n1" type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={n1} onChange={e => setN1(e.target.value)} /></div>
          <div><label htmlFor="change-n2" className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Repite contraseña</label><input id="change-n2" type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={n2} onChange={e => setN2(e.target.value)} /></div>
          <button disabled={busy} className="mt-1 px-4 py-2.5 rounded-xl bg-emerald-600/80 border border-emerald-500/30 text-white font-medium hover:bg-emerald-600 transition-all disabled:opacity-50">{busy ? "Guardando..." : "Guardar y entrar"}</button>
        </form>
      )}
    </div>
  );
}
