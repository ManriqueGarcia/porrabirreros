import { useState, useEffect } from "react";
import { toast } from "../toast.jsx";
import { API_BASE_URL, API_HEADERS } from "../api.js";

async function hashPassword(password) {
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
    )
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash;
}

export function JoinGroup({ inviteCode: inviteCodeProp, onJoined, onBack }) {
  const [inviteCode, setInviteCode] = useState(inviteCodeProp || "");
  const [validated, setValidated] = useState(null); // { groupId, name } o null
  const [validateLoading, setValidateLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    if (!inviteCodeProp || !inviteCodeProp.trim()) return;
    setInviteCode(inviteCodeProp);
    let cancelled = false;
    setValidateLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/invite/${encodeURIComponent(inviteCodeProp.trim())}`,
          { headers: { ...API_HEADERS } }
        );
        if (cancelled) return;
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Código inválido (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        setValidated({ groupId: data.groupId, name: data.name || data.groupName || "Grupo" });
      } catch (err) {
        if (!cancelled) toast.error(err?.message || "Código de invitación no válido");
      } finally {
        if (!cancelled) setValidateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteCodeProp]);

  const validateInvite = async (code) => {
    const c = (code || inviteCode).trim();
    if (!c) {
      toast.error("Introduce el código de invitación");
      return;
    }
    setValidateLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/invite/${encodeURIComponent(c)}`,
        { headers: { ...API_HEADERS } }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Código inválido (${res.status})`);
      }
      const data = await res.json();
      setValidated({ groupId: data.groupId, name: data.name || data.groupName || "Grupo" });
    } catch (err) {
      toast.error(err?.message || "Código de invitación no válido");
      setValidated(null);
    } finally {
      setValidateLoading(false);
    }
  };

  const handleValidate = (e) => {
    e?.preventDefault();
    validateInvite();
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!validated || joinLoading) return;

    if (!userName.trim()) {
      toast.error("El nombre de usuario es obligatorio");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setJoinLoading(true);
    try {
      const passwordHash = await hashPassword(password);
      const res = await fetch(
        `${API_BASE_URL}/groups/${validated.groupId}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...API_HEADERS },
          body: JSON.stringify({
            name: userName.trim(),
            passwordHash,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      onJoined({ groupId: validated.groupId, userName: userName.trim() });
    } catch (err) {
      toast.error(err?.message || "Error al unirse al grupo");
    } finally {
      setJoinLoading(false);
    }
  };

  const inputClass =
    "w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none";

  return (
    <div className="min-h-screen bg-neutral-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6">Unirse a un grupo</h2>

          {!validated ? (
            <form onSubmit={handleValidate} className="space-y-4">
              <div>
                <label htmlFor="invite-code" className="block text-sm font-medium text-white/70 mb-2">
                  Código de invitación
                </label>
                <input
                  id="invite-code"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Ej: ABC123"
                  className={inputClass}
                  disabled={!!inviteCodeProp}
                />
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={validateLoading}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {validateLoading ? "Validando..." : "Validar"}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  ← Volver
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="mb-4 p-3 bg-neutral-800/50 rounded-lg border border-white/10">
                <p className="text-sm text-white/60">Te unes a</p>
                <p className="font-semibold text-white">{validated.name}</p>
              </div>

              <div>
                <label htmlFor="join-username" className="block text-sm font-medium text-white/70 mb-2">
                  Nombre de usuario
                </label>
                <input
                  id="join-username"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Tu nombre de usuario"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="join-password" className="block text-sm font-medium text-white/70 mb-2">
                  Contraseña (mín. 6 caracteres)
                </label>
                <input
                  id="join-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="join-confirm" className="block text-sm font-medium text-white/70 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  id="join-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  required
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {joinLoading ? "Uniendo..." : "Unirse"}
                </button>
                <button
                  type="button"
                  onClick={() => setValidated(null)}
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  ← Usar otro código
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  ← Volver
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
