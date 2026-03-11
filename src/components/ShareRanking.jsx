import { useState, useCallback } from "react";
import { toast } from "../toast.jsx";

const W = 1080, H = 1920;
const BG1 = "#0f0f17", BG2 = "#1a1a2e";
const GOLD = "#fbbf24", SILVER = "#94a3b8", BRONZE = "#d97706";
const GREEN = "#34d399", RED = "#f87171", WHITE = "#f1f5f9", MUTED = "#64748b";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShareImage({ mode, title, rows, subtitle, highlights, prevPositions }) {
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, BG1);
  grad.addColorStop(0.5, BG2);
  grad.addColorStop(1, BG1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const accentColor = mode === "futbol" ? "#10b981" : "#e10600";
  const glow = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 600);
  glow.addColorStop(0, accentColor + "15");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 800);

  let y = 80;

  ctx.fillStyle = MUTED;
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PORRA BIRREROS", W / 2, y);
  y += 20;

  ctx.fillStyle = accentColor;
  ctx.fillRect(W / 2 - 60, y, 120, 3);
  y += 50;

  ctx.fillStyle = WHITE;
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.fillText(title, W / 2, y);
  y += 40;

  if (subtitle) {
    ctx.fillStyle = MUTED;
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText(subtitle, W / 2, y);
  }
  y += 60;

  const px = 60, rowH = 120, cardW = W - px * 2;
  rows.forEach((r, i) => {
    const ry = y + i * (rowH + 12);
    const isTop3 = i < 3;
    const medalColors = [GOLD + "18", SILVER + "10", BRONZE + "10"];
    const borderColors = [GOLD + "40", SILVER + "25", BRONZE + "25"];

    roundRect(ctx, px, ry, cardW, rowH, 16);
    ctx.fillStyle = isTop3 ? medalColors[i] : "#ffffff08";
    ctx.fill();
    ctx.strokeStyle = isTop3 ? borderColors[i] : "#ffffff10";
    ctx.lineWidth = isTop3 ? 2 : 1;
    ctx.stroke();

    ctx.textAlign = "left";
    const medals = ["🥇", "🥈", "🥉"];
    if (isTop3) {
      ctx.font = "40px system-ui, sans-serif";
      ctx.fillText(medals[i], px + 20, ry + 68);
    } else {
      ctx.fillStyle = MUTED;
      ctx.font = "bold 32px system-ui, sans-serif";
      ctx.fillText(`${i + 1}`, px + 28, ry + 65);
    }

    ctx.fillStyle = i === 0 ? WHITE : "#cbd5e1";
    ctx.font = `bold 36px system-ui, sans-serif`;
    ctx.fillText(r.name, px + 90, ry + 52);

    if (prevPositions && prevPositions[r.name] != null) {
      const prev = prevPositions[r.name];
      const curr = i + 1;
      const diff = prev - curr;
      const labelX = px + 90 + ctx.measureText(r.name).width + 16;
      ctx.font = "bold 24px system-ui, sans-serif";
      if (diff > 0) {
        ctx.fillStyle = GREEN;
        ctx.fillText(`▲${diff}`, labelX, ry + 50);
      } else if (diff < 0) {
        ctx.fillStyle = RED;
        ctx.fillText(`▼${Math.abs(diff)}`, labelX, ry + 50);
      } else {
        ctx.fillStyle = GOLD + "90";
        ctx.fillText("=", labelX, ry + 50);
      }
    }

    const statsText = r.statsLine || "";
    if (statsText) {
      ctx.fillStyle = MUTED;
      ctx.font = "22px system-ui, sans-serif";
      ctx.fillText(statsText, px + 90, ry + 85);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = i === 0 ? GOLD : WHITE;
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillText(`${r.points}`, px + cardW - 24, ry + 58);
    ctx.fillStyle = MUTED;
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("pts", px + cardW - 24, ry + 86);
  });

  y += rows.length * (rowH + 12) + 30;

  if (highlights && highlights.length > 0 && y < H - 300) {
    ctx.fillStyle = accentColor + "30";
    ctx.fillRect(px, y, cardW, 2);
    y += 30;

    ctx.textAlign = "left";
    ctx.fillStyle = WHITE;
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText("🏆 Destacados", px, y);
    y += 40;

    highlights.forEach(h => {
      if (y > H - 160) return;
      ctx.fillStyle = MUTED;
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillText(h, px + 10, y);
      y += 40;
    });
  }

  ctx.textAlign = "center";
  ctx.fillStyle = MUTED + "80";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText("porra.manriquegarcia.com", W / 2, H - 60);
  ctx.fillStyle = accentColor + "60";
  ctx.fillRect(W / 2 - 40, H - 45, 80, 2);

  return canvas;
}

export function ShareRankingButton({ mode, title, rows, subtitle, highlights, prevPositions }) {
  const [generating, setGenerating] = useState(false);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const canvas = drawShareImage({ mode, title, rows, subtitle, highlights, prevPositions });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) { toast.error("No se pudo generar la imagen"); return; }

      const file = new File([blob], "ranking-porra-birreros.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Porra Birreros — Ranking", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Imagen descargada");
      }
    } catch (e) {
      if (e.name !== "AbortError") toast.error("Error al compartir");
    } finally {
      setGenerating(false);
    }
  }, [mode, title, rows, subtitle, highlights, prevPositions]);

  return (
    <button
      className="mt-3 ml-2 text-xs text-white/30 hover:text-white/60 transition-colors inline-flex items-center gap-1"
      onClick={handleShare}
      disabled={generating}
    >
      {generating ? "⏳ Generando..." : "📸 Compartir imagen"}
    </button>
  );
}
