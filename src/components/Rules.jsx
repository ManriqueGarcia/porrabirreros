import React from "react";

const RuleCard=React.memo(function RuleCard({icon,text}){
  return (
    <div className="flex gap-3 items-start p-3.5 rounded-xl bg-white/[.025] border border-white/[.06] hover:bg-white/[.05] hover:border-white/[.1] transition-all group">
      <span className="text-xl flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-sm text-white/65 leading-relaxed">{text}</span>
    </div>
  );
});

function F1Rules(){
  const scoring=[
    {icon:"🏁",text:"Antes de cada GP, apuestas: pole position, podio (P1, P2, P3) y 3 preguntas del autor de turno."},
    {icon:"⏰",text:"Cierre de apuestas: antes de la clasificación (Q1). Hora exacta indicada en cada carrera. Se puede apostar fuera de plazo, pero conlleva penalización."},
    {icon:"🎯",text:"Pole acertada: +1 punto. Cada posición de podio exacta: +1 punto (máx 3). Cada pregunta acertada: +1 punto (máx 3)."},
    {icon:"🔥",text:"Bonus combo: pole + podio completo → +2 puntos extra. Pleno total (pole + podio + 3 preguntas) → +2 puntos extra más. Máximo por carrera: 11 puntos."},
    {icon:"⚠️",text:"Apuesta incompleta (sin pole o sin podio): -1 punto. Apuesta fuera de plazo: -2 puntos. No apostar en un GP: -3 puntos. Las penalizaciones se aplican automáticamente."},
    {icon:"❓",text:"Las 3 preguntas las pone un participante distinto en cada GP, por turno rotatorio."},
  ];
  const tiebreakers=[
    {icon:"1️⃣",text:"Puntos totales: más puntos gana."},
    {icon:"2️⃣",text:"Victorias de GP: quien haya sido el mejor puntuado en más carreras individuales (sin compartir)."},
    {icon:"3️⃣",text:"Podios exactos: más veces que acertó el podio completo."},
    {icon:"4️⃣",text:"Aciertos totales: suma de todos los elementos acertados (pole, posiciones, preguntas)."},
    {icon:"5️⃣",text:"Menos penalizaciones: menos apuestas incompletas, tardías o no realizadas."},
    {icon:"6️⃣",text:"Apuesta más temprana: si persiste el empate, gana quien tenga un promedio de envío de apuesta más temprano (incentiva no esperar al último segundo)."},
  ];
  return (
    <div className="space-y-4">
      <div className="card card-racing p-5 space-y-4">
        <h2 className="section-title text-lg">🏎️ Normas Porra F1 2026 <span className="text-sm opacity-50">🍺</span></h2>
        <h3 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Puntuación</h3>
        <div className="grid gap-2">{scoring.map((r,i)=><RuleCard key={i} {...r}/>)}</div>
      </div>
      <div className="card p-5 space-y-4">
        <h3 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Criterios de desempate (en orden)</h3>
        <div className="grid gap-2">{tiebreakers.map((r,i)=><RuleCard key={i} {...r}/>)}</div>
        <p className="text-[11px] text-white/40">Si tras todos los criterios persiste el empate, se comparte posición.</p>
      </div>
    </div>
  );
}

function FutbolRules(){
  const scoring=[
    {icon:"🏟️",text:"4 partidos por jornada: Madrid, Barça, Real Sociedad y Sporting. Si se enfrentan entre ellos, se meten partidos de reserva hasta llegar a 4."},
    {icon:"⏰",text:"Límite para apostar: viernes 21:00 (hora España). Se puede apostar fuera de plazo, pero conlleva penalización."},
    {icon:"🎯",text:"Resultado exacto: 3 puntos. Acertar el signo (1X2): 1 punto. Fallo total: 0 puntos. Máximo por jornada: 12 puntos."},
    {icon:"⚠️",text:"Fuera de plazo: -2 puntos. No apostar: -3 puntos. Con 3 jornadas sin apostar → eliminado."},
    {icon:"💥",text:"Apuesta catastrófica (0 puntos en todo, dentro de plazo): -1 punto extra."},
    {icon:"🍺",text:"El primero en la clasificación general recibe birras gratis: los demás le invitan. ¡A por la cima!"},
  ];
  const tiebreakers=[
    {icon:"1️⃣",text:"Más puntos totales."},
    {icon:"2️⃣",text:"Más jornadas ganadas (mejor puntuado sin compartir)."},
    {icon:"3️⃣",text:"Más resultados exactos acumulados."},
    {icon:"4️⃣",text:"Más signos (1X2) acertados."},
    {icon:"5️⃣",text:"Menos jornadas sin apostar o fuera de plazo."},
    {icon:"6️⃣",text:"Menor diferencia de goles acumulada (más cerca del resultado real)."},
  ];
  return (
    <div className="space-y-4">
      <div className="card card-racing p-5 space-y-4">
        <h2 className="section-title text-lg">⚽ Normas Porra Fútbol <span className="text-sm opacity-50">🍺</span></h2>
        <h3 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Cómo se juega</h3>
        <div className="grid gap-2">{scoring.map((r,i)=><RuleCard key={i} {...r}/>)}</div>
      </div>
      <div className="card p-5 space-y-4">
        <h3 className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Desempates (en orden)</h3>
        <div className="grid gap-2">{tiebreakers.map((r,i)=><RuleCard key={i} {...r}/>)}</div>
        <p className="text-[11px] text-white/40">Si tras todos los criterios persiste el empate, se comparte posición.</p>
      </div>
    </div>
  );
}

function MundialRules() {
  const scoring = [
    { icon: "🏆", text: "Por jornada: partido de España + el partido estrella de cada otro grupo (MD1–3), luego todos los partidos de dieciseisavos, octavos, cuartos, semifinal, tercer puesto y final." },
    { icon: "⏰", text: "Cierre: 1 minuto antes del primer kickoff de la jornada (hora España). Fuera de plazo: -2 pts. No apostar: -3 pts." },
    { icon: "🎯", text: "Marcador a 90′: exacto +3, signo 1X2 +1. Sin preguntas extra." },
    { icon: "⚔️", text: "Eliminatorias: prórroga sí/no (+1), penaltis sí/no (+1), ganador en penaltis (+2 si hubo penaltis). No hace falta acertar el marcador exacto a 90′: basta con el signo 1X2 (local, empate o visitante) para que sumen los bonos KO. Si fallas el signo, esos bonos no cuentan." },
    { icon: "💥", text: "Apuesta catastrófica (0 pts en plazo): -1 extra (mismas excepciones que fútbol)." },
    { icon: "🥪", text: "Premio solo al final del torneo: el primero de la clasificación general se lleva una cena de bocata; el resto de participantes le invitan. Sin birra por jornada." },
  ];
  return (
    <div className="card card-racing p-5 space-y-4">
      <h2 className="section-title text-lg">🏆 Normas Porra Mundial 2026</h2>
      <div className="grid gap-2">{scoring.map((r, i) => <RuleCard key={i} {...r} />)}</div>
    </div>
  );
}

export { RuleCard, F1Rules, FutbolRules, MundialRules };
