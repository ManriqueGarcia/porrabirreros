import React, { useState, useEffect, useRef } from "react";

const CircuitCard = React.memo(function CircuitCard({ race, circuits, compact }) {
  if (!race || !circuits) return null;
  const c = circuits[race.key] || {};
  const trackSrc = `./assets/circuit_tracks/${race.key}.svg`;
  const history = c.history || [];
  if (compact)
    return (
      <div className="mt-4 w-full p-3 rounded-xl bg-white/[.03] border border-red-500/10">
        <h3 className="text-xs font-bold text-white/80 mb-1 tracking-wide">🏁 {c.name || race.grand_prix}</h3>
        {c.city && <div className="text-[10px] text-white/40 mb-2">{c.city}</div>}
        <div className="flex gap-3">
          <div className="w-20 h-14 flex-shrink-0 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden border border-white/5">
            <img
              src={trackSrc}
              alt=""
              className="w-full h-full object-contain p-1.5"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "./assets/circuit_tracks/default.svg";
              }}
            />
          </div>
          <div className="text-[11px] text-white/40 space-y-0.5 min-w-0">
            <div>{c.length || "—"} km · {c.laps || "—"} v.</div>
            <div className="text-white/30">⏱ {c.fastestLap || "—"}</div>
            {c.driver && <div className="text-white/40 truncate">{c.driver} ({c.year})</div>}
          </div>
        </div>
        {history.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <div className="text-[10px] text-white/35 mb-1 uppercase tracking-wider font-semibold">Últimos ganadores</div>
            {history.slice(0, 2).map((h) => (
              <div key={h.season} className="text-[10px] text-white/35 flex justify-between">
                <span>{h.season}</span>
                <span className="text-white/50 font-medium truncate ml-2">{h.winner}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  return (
    <div className="mb-4 p-4 rounded-xl bg-white/[.03] border border-red-500/10 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/25 to-transparent"></div>
      <h3 className="text-sm font-bold text-white/90 mb-1 flex items-center gap-2">🏁 {c.name || race.grand_prix}</h3>
      {c.city && <div className="text-[11px] text-white/30 mb-3">{c.city}</div>}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-48 h-32 flex-shrink-0 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center border border-white/5">
          <img
            src={trackSrc}
            alt=""
            className="w-full h-full object-contain p-3"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "./assets/circuit_tracks/default.svg";
            }}
          />
        </div>
        <div className="text-sm space-y-2 flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <span className="text-white/35">Longitud</span>
              <div className="text-white/70 font-semibold">{c.length || "—"} km</div>
            </div>
            <div>
              <span className="text-white/35">Vueltas</span>
              <div className="text-white/70 font-semibold">{c.laps || "—"}</div>
            </div>
          </div>
          <div className="mt-2 p-2 rounded-lg bg-white/[.02] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">⏱ Vuelta rápida</div>
            <div className="text-white/80 font-bold text-sm">{c.fastestLap || "—"}</div>
            {c.driver && <div className="text-white/40 text-xs">{c.driver} ({c.year})</div>}
          </div>
        </div>
      </div>
      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="text-[11px] text-white/40 uppercase tracking-wider font-bold mb-2">📊 Resultados recientes</div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="text-left text-white/40 font-semibold pb-1.5 pr-3">Año</th>
                  <th className="text-left text-white/40 font-semibold pb-1.5 pr-3">Ganador</th>
                  <th className="text-left text-white/40 font-semibold pb-1.5 pr-3">Vuelta rápida</th>
                  <th className="text-right text-white/40 font-semibold pb-1.5">Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.season} className="border-t border-white/[.03]">
                    <td className="py-1.5 pr-3 text-white/40 font-medium">{h.season}</td>
                    <td className="py-1.5 pr-3 text-white/70 font-semibold">{h.winner}</td>
                    <td className="py-1.5 pr-3 text-white/40">{h.fl}</td>
                    <td className="py-1.5 text-right text-white/30 font-mono text-[11px]">{h.flTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

export { CircuitCard };
