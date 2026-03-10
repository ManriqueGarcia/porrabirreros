import { useState, useEffect } from "react";

export function CountdownBadge({ target }) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return;
    const totalMin = Math.floor(diff / 60000);
    const delay = totalMin < 120 ? 1000 : totalMin < 720 ? 10_000 : 60_000;
    const id = setTimeout(() => setTick(Date.now()), delay);
    return () => clearTimeout(id);
  }, [target, tick]);

  if (!target) return null;
  const diff = target.getTime() - tick;
  if (diff <= 0) return (
    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
      <div className="text-red-400 text-lg font-bold">🔒 Apuestas cerradas</div>
      <div className="text-xs text-red-300/60 mt-1">El plazo de apuestas ha finalizado</div>
    </div>
  );
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const urgent = totalMin < 120;
  const warn = totalMin < 720 && !urgent;
  const bgCls = urgent ? "bg-red-500/10 border-red-500/25" : "bg-amber-500/8 border-amber-500/20";
  const timeCls = urgent ? "text-red-300" : warn ? "text-amber-300" : "text-emerald-300";
  const labelCls = urgent ? "text-red-400/60" : warn ? "text-amber-400/50" : "text-emerald-400/50";
  const msgCls = urgent ? "text-red-300/70" : warn ? "text-amber-300/60" : "text-white/40";
  const msg = urgent ? "¡Queda poco! Date prisa para apostar" : (warn ? "Todavía tienes tiempo, pero no te duermas" : "Tienes tiempo de sobra para apostar");
  const p2 = n => String(n).padStart(2, "0");
  return (
    <div className={`mt-3 p-3 rounded-xl border ${bgCls}`}>
      <div className={`text-[10px] uppercase tracking-widest font-semibold mb-1.5 text-center ${labelCls}`}>⏱ Tiempo restante para apostar</div>
      <div className="flex items-baseline gap-1 justify-center">
        {days > 0 && <><span className={`text-2xl font-black tabular-nums ${timeCls}`}>{days}</span><span className={`text-[10px] font-medium mr-1.5 ${labelCls}`}>d</span></>}
        <span className={`text-2xl font-black tabular-nums ${timeCls}`}>{p2(hours)}</span><span className={`text-[10px] font-medium ${labelCls}`}>h</span>
        <span className={`text-lg ${timeCls} opacity-40 mx-0.5`}>:</span>
        <span className={`text-2xl font-black tabular-nums ${timeCls}`}>{p2(mins)}</span><span className={`text-[10px] font-medium ${labelCls}`}>m</span>
        <span className={`text-lg ${timeCls} opacity-40 mx-0.5`}>:</span>
        <span className={`text-2xl font-black tabular-nums ${timeCls} ${urgent ? "animate-pulse" : ""}`}>{p2(secs)}</span><span className={`text-[10px] font-medium ${labelCls}`}>s</span>
      </div>
      <div className={`text-xs mt-1.5 text-center ${msgCls}`}>{msg}</div>
    </div>
  );
}
