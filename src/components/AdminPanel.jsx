import { useState, useMemo } from "react";
import { Admin } from "./Admin.jsx";
import { FutbolAdmin } from "./FutbolAdmin.jsx";
import { MundialAdmin } from "./MundialAdmin.jsx";
import { UserManagement } from "./UserManagement.jsx";
import { isAdminFor, hasAnyAdminRole } from "../admin-roles.js";

export function AdminPanel({ db, setDb, races, drivers, teams, calendar, currentUser }) {
  const userData = db.users?.[currentUser];
  const visibleTabs = useMemo(() => {
    const tabs = [];
    if (isAdminFor(userData, "general")) tabs.push({ id: "general", label: "General", icon: "👥" });
    if (isAdminFor(userData, "f1")) tabs.push({ id: "f1", label: "F1", icon: "🏎️" });
    if (isAdminFor(userData, "futbol")) tabs.push({ id: "futbol", label: "Fútbol", icon: "⚽" });
    if (isAdminFor(userData, "mundial")) tabs.push({ id: "mundial", label: "Mundial", icon: "🏆" });
    return tabs;
  }, [userData]);

  const [tab, setTab] = useState(() => visibleTabs[0]?.id || "general");
  const activeTab = visibleTabs.find(t => t.id === tab) ? tab : visibleTabs[0]?.id;

  if (!hasAnyAdminRole(userData)) return null;

  return (
    <div className="space-y-4">
      <div className="card p-4 md:p-5">
        <h2 className="section-title mb-4">⚙ Panel de administración</h2>
        <div className="flex gap-2">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.id
                  ? "bg-white/15 text-white border border-white/20 shadow-lg"
                  : "bg-white/5 text-white/50 border border-white/8 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "general" && isAdminFor(userData, "general") && (
        <UserManagement db={db} setDb={setDb} currentUser={currentUser} />
      )}
      {activeTab === "f1" && isAdminFor(userData, "f1") && (
        <Admin db={db} setDb={setDb} races={races} drivers={drivers} teams={teams} calendar={calendar} currentUser={currentUser} />
      )}
      {activeTab === "futbol" && isAdminFor(userData, "futbol") && (
        <FutbolAdmin db={db} setDb={setDb} currentUser={currentUser} />
      )}
      {activeTab === "mundial" && isAdminFor(userData, "mundial") && (
        <MundialAdmin db={db} setDb={setDb} currentUser={currentUser} />
      )}
    </div>
  );
}
