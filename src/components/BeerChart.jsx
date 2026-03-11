import { memo } from "react";

export const BeerChart = memo(function BeerChart({ data, maxBeers }) {
  if (!data?.length) return null;
  const max = maxBeers || Math.max(...data.map(d => d.count), 1);
  const mugW = 28, mugH = 44, gap = 8;
  const padL = 6, padR = 6, padT = 14, padB = 22;
  const totalW = padL + data.length * (mugW + gap) - gap + padR;
  const totalH = padT + mugH + padB;

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ width: `${Math.min(100, data.length * 18)}%`, maxWidth: "100%", height: "auto" }} className="block mx-auto">
        {data.map(({ name, count }, i) => {
          const x = padL + i * (mugW + gap);
          const fillPct = max > 0 ? count / max : 0;
          const bodyX = x + 3, bodyY = padT + 3, bodyW = mugW - 6, bodyH = mugH - 6;
          const fillH = bodyH * fillPct;
          const fillY = bodyY + bodyH - fillH;
          const foamH = Math.min(4, fillH * 0.15 + 1.5);

          return (
            <g key={name}>
              {/* Mug body */}
              <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx="3" ry="3"
                fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
              {/* Handle */}
              <path d={`M${bodyX + bodyW} ${bodyY + 6} C${bodyX + bodyW + 7} ${bodyY + 6} ${bodyX + bodyW + 7} ${bodyY + bodyH - 6} ${bodyX + bodyW} ${bodyY + bodyH - 6}`}
                fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.5" strokeLinecap="round" />

              {/* Beer fill */}
              {count > 0 && (
                <>
                  <defs>
                    <clipPath id={`mug-${i}`}>
                      <rect x={bodyX + 1} y={bodyY + 1} width={bodyW - 2} height={bodyH - 2} rx="2" ry="2" />
                    </clipPath>
                    <linearGradient id={`beer-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                  </defs>
                  <g clipPath={`url(#mug-${i})`}>
                    {/* Beer liquid */}
                    <rect x={bodyX + 1} y={fillY} width={bodyW - 2} height={fillH}
                      fill={`url(#beer-${i})`} opacity=".85" />
                    {/* Foam */}
                    {fillPct > 0.05 && (
                      <ellipse cx={bodyX + bodyW / 2} cy={fillY} rx={bodyW / 2 - 1} ry={foamH}
                        fill="#fef3c7" opacity=".9" />
                    )}
                    {fillPct > 0.3 && (
                      <circle cx={bodyX + bodyW * 0.4} cy={fillY + fillH * 0.4}
                        r={0.8} fill="#fef9c3" opacity=".3" />
                    )}
                  </g>
                </>
              )}

              <text x={bodyX + bodyW / 2} y={padT - 2} textAnchor="middle"
                fill={count > 0 ? "#fbbf24" : "rgba(255,255,255,.2)"} fontSize="8" fontWeight="800">
                {count}
              </text>
              <text x={bodyX + bodyW / 2} y={padT + mugH + 8} textAnchor="middle"
                fill="rgba(255,255,255,.5)" fontSize="6" fontWeight="600">
                {name.length > 9 ? name.substring(0, 8) + "…" : name}
              </text>
              {count === max && count > 0 && (
                <text x={bodyX + bodyW / 2} y={padT + mugH + 17} textAnchor="middle" fontSize="7">🍺</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
