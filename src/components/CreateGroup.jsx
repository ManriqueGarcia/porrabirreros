import { useState } from "react";
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

export function CreateGroup({ onCreated, onBack }) {
  const [name, setName] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sports, setSports] = useState({ f1: false, futbol: false });
  const [loading, setLoading] = useState(false);

  const toggleSport = (key) => {
    setSports((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Validación
    if (!name.trim()) {
      toast.error("El nombre del grupo es obligatorio");
      return;
    }
    if (!adminUser.trim()) {
      toast.error("El usuario administrador es obligatorio");
      return;
    }
    if (adminPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (adminPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    const selectedSports = Object.entries(sports)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selectedSports.length === 0) {
      toast.error("Selecciona al menos un deporte (F1 o Fútbol)");
      return;
    }

    setLoading(true);
    try {
      const adminPasswordHash = await hashPassword(adminPassword);
      const res = await fetch(
        `${API_BASE_URL}/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...API_HEADERS },
          body: JSON.stringify({
            name: name.trim(),
            adminUser: adminUser.trim(),
            adminPasswordHash,
            sports: selectedSports,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Error ${res.status}`);
      }

      const response = await res.json();
      onCreated(response);
    } catch (err) {
      toast.error(err?.message || "Error al crear el grupo");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none";

  return (
    <div className="min-h-screen bg-neutral-950 p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6">Crear nuevo grupo</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="group-name" className="block text-sm font-medium text-white/70 mb-2">
                Nombre del grupo
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Porra de la oficina"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="admin-user" className="block text-sm font-medium text-white/70 mb-2">
                Usuario administrador
              </label>
              <input
                id="admin-user"
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="Tu nombre de usuario"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-white/70 mb-2">
                Contraseña (mín. 6 caracteres)
              </label>
              <input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-white/70 mb-2">
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
                required
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-white/70 mb-2">Deportes</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-white/80 hover:text-white">
                  <input
                    type="checkbox"
                    checked={sports.f1}
                    onChange={() => toggleSport("f1")}
                    className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  F1
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-white/80 hover:text-white">
                  <input
                    type="checkbox"
                    checked={sports.futbol}
                    onChange={() => toggleSport("futbol")}
                    className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  Fútbol
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Creando..." : "Crear grupo"}
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
        </div>
      </div>
    </div>
  );
}
