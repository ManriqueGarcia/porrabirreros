import { memo } from "react";
import { PILOT_COLORS, FALLBACK_COLORS } from "../config.js";

export const Rivalries = memo(function Rivalries({ rivalries, mode }) {
  if (!rivalries?.length) return null;
  return (
    <div className="card card-racing p-4 md:p-5">
      <h3 className="section-title mb-3">⚔️ Rivalidades</h3>
      <p className="text-xs text-white/40 mb-3">Pares que compiten cabeza a cabeza según cercanía en puntos, equilibrio de victorias y similitud de apuestas.</p>
      <div className="space-y-3">
        {rivalries.map((r, i) => (
          <RivalryCard key={i} rivalry={r} rank={i} mode={mode} />
        ))}
      </div>
    </div>
  );
});

const INTENSITY_LABELS = [
  { min: 80, label: "Máxima", color: "text-red-400" },
  { min: 60, label: "Alta", color: "text-amber-400" },
  { min: 40, label: "Media", color: "text-yellow-300/70" },
  { min: 0, label: "Baja", color: "text-white/40" },
];

function RivalryCard({ rivalry, rank, mode }) {
  const { a, b, h2h, pointDiff, similarity, intensity } = rivalry;
  const totalPts = Math.max(a.points + b.points, 1);
  const aPct = (a.points / totalPts) * 100;
  const total = h2h.aWins + h2h.bWins + h2h.ties;
  const intLabel = INTENSITY_LABELS.find(l => intensity >= l.min) || INTENSITY_LABELS[3];
  const isF1 = mode === "f1";
  const accent = isF1 ? "from-red-500/10 to-amber-500/5" : "from-emerald-500/10 to-teal-500/5";
  const barA = isF1 ? "bg-red-500/70" : "bg-emerald-500/70";
  const barB = "bg-blue-400/70";

  return (
    <div className={`rounded-xl p-3 bg-gradient-to-r ${accent} border border-white/[.06] space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-white/90">{a.name}</span>
        <div className="flex flex-col items-center">
          {rank === 0 && <span className="text-[10px] text-red-400/80 font-bold uppercase tracking-wider mb-0.5">Rival #1</span>}
          <span className="text-xs text-white/25 font-bold">VS</span>
        </div>
        <span className="font-bold text-sm text-white/90">{b.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/50 w-14 text-right font-semibold">{a.points} pts</span>
        <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden flex">
          <div className={`h-full ${barA} transition-all duration-500`} style={{ width: `${aPct}%` }} />
          <div className={`h-full ${barB} transition-all duration-500`} style={{ width: `${100 - aPct}%` }} />
        </div>
        <span className="text-[11px] text-white/50 w-14 font-semibold">{b.points} pts</span>
      </div>

      <div className="grid grid-cols-3 text-center text-[11px]">
        <div>
          <div className="font-bold text-lg text-white/80">{h2h.aWins}</div>
          <div className="text-white/30">victorias</div>
        </div>
        <div>
          <div className="font-bold text-lg text-white/40">{h2h.ties}</div>
          <div className="text-white/30">empates</div>
        </div>
        <div>
          <div className="font-bold text-lg text-white/80">{h2h.bWins}</div>
          <div className="text-white/30">victorias</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/30 pt-1 border-t border-white/5">
        <span>Diferencia: {pointDiff} pts</span>
        {similarity > 0 && <span>Apuestas similares: {similarity}%</span>}
        <span className={intLabel.color}>Intensidad: {intLabel.label}</span>
      </div>
    </div>
  );
}
