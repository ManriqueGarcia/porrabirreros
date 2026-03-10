import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { exportCSV, exportPDF } from "../utils.js";
import { PILOT_COLORS, FALLBACK_COLORS, BEER_EXCLUDED_USERS } from "../config.js";
import { scoreFutbolJornada, listFutbolJornadas, computeFutbolStandings, defaultFutbolState } from "../futbol-utils.js";
import { Avatar } from "./Avatar.jsx";
import { getParticipantsForPorra } from "./UserManagement.jsx";

export function FutbolRanking({db}){
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const participants=useMemo(()=>getParticipantsForPorra(db,"futbol"),[db.participants,db.users]);
  const [scope,setScope]=useState("all");
  const [expandedRow,setExpandedRow]=useState(null);
  useEffect(()=>{ if(scope!=="all" && !jornadas.find(j=>j.id===scope)) setScope("all"); },[scope,jornadas]);
  const standings=useMemo(()=>computeFutbolStandings(futbol,participants,jornadas),[futbol,participants,jornadas]);
  const rows=useMemo(()=>{
    if(scope==="all") return standings;
    if(!futbol.results?.[scope]) return [];
    return participants.map(name=>{
      const s=scoreFutbolJornada(db,scope,name);
      return {...s,name};
    }).sort((A,B)=>B.points-A.points||B.exact-A.exact||B.signs-A.signs||A.goalDiff-B.goalDiff);
  },[scope,standings,participants,futbol.results,db]);
  const selectedJornada=scope==="all"?null:jornadas.find(j=>j.id===scope);
  const res=scope==="all"?null:futbol.results?.[scope];
  const completedJornadas=jornadas.filter(j=>futbol.results?.[j.id]);
  return (
    <div className="space-y-4">
      <div className="card card-racing p-4 md:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="section-title text-lg">⚽ Ranking fútbol <span className="text-sm opacity-60">🍺</span></h2>
          <select className="select border rounded-xl px-3 py-2 text-sm" value={scope} onChange={e=>{setScope(e.target.value);setExpandedRow(null);}}>
            <option value="all">🏆 Global ({completedJornadas.length} jornada{completedJornadas.length!==1?"s":""})</option>
            {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id}{futbol.results?.[j.id]?" ✓":""}</option>)}
          </select>
        </div>

        {rows.length>0 && (
          <div className="space-y-2">
            {rows.map((r,idx)=>{
              const penTotal=(r.missed||0)+(r.late||0);
              const hasResults=completedJornadas.length>0;
              const allTied=rows.length>1&&rows.every(x=>x.points===rows[0].points);
              const isFirst=hasResults&&idx===0&&rows.length>1&&!allTied;
              const canReceiveBeer=!BEER_EXCLUDED_USERS.has(r.name);
              const isExpanded=expandedRow===r.name;
              const detail=isExpanded && scope!=="all" && res ? scoreFutbolJornada(db,scope,r.name) : null;
              const showPodium=hasResults&&!allTied;
              const medal=showPodium?(idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":null):null;
              const posClass=showPodium&&idx===0?"border-l-[3px] border-l-yellow-400/70 bg-gradient-to-r from-yellow-400/[.06] to-transparent":showPodium&&idx===1?"border-l-[3px] border-l-slate-300/40 bg-gradient-to-r from-slate-300/[.03] to-transparent":showPodium&&idx===2?"border-l-[3px] border-l-amber-600/40 bg-gradient-to-r from-amber-600/[.03] to-transparent":"border-l-[3px] border-l-transparent";
              return (
                <div key={r.name} className={`rounded-xl p-3 md:p-4 bg-white/[.02] border border-white/[.06] hover:border-emerald-500/15 transition-all cursor-pointer ${posClass}`} onClick={()=>scope!=="all"&&setExpandedRow(isExpanded?null:r.name)}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 text-center flex-shrink-0">
                      {medal ? <span className="text-lg">{medal}</span> : <span className="text-sm text-white/40 font-bold">{idx+1}</span>}
                    </div>
                    <Avatar name={r.name} avatar={db.meta?.avatars?.[r.name]} avatarFutbol={db.meta?.avatarsFutbol?.[r.name]} size="sm" mode="futbol"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold ${idx===0?"text-white":"text-white/80"}`}>{r.name}</span>
                        {r.missed>=3 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20">eliminado</span>}
                        {isFirst&&canReceiveBeer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">🍺 le invitan</span>}
                        {hasResults&&allTied&&idx===0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/15">🍺 todos invitamos</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-white/35">
                        {scope==="all" && <span>Vict: <b className="text-white/50">{r.wins}</b></span>}
                        <span>Exact: <b className="text-white/50">{r.exact}</b></span>
                        <span>Sign: <b className="text-white/50">{r.signs}</b></span>
                        <span>Pen: <b className="text-white/50">{penTotal}</b></span>
                        {scope==="all" && <span>Dif: <b className="text-white/50">{r.goalDiff}</b></span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="pts-cell text-lg">{r.points}</div>
                      <div className="text-[10px] text-emerald-400/40 font-semibold">pts</div>
                    </div>
                  </div>
                  {detail && (
                    <div className="mt-3 pt-3 border-t border-white/[.06] space-y-1">
                      {detail.items.map((item,i)=>(
                        <div key={i} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-white/[.02]">
                          <span className="text-white/40 truncate">{item.label}</span>
                          <span className={`font-bold flex-shrink-0 ${item.delta>0?"text-emerald-300":item.delta<0?"text-red-400":"text-white/20"}`}>{item.delta>0?`+${item.delta}`:item.delta}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {rows.length===0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">⚽</div>
            <p className="text-sm text-white/40">Sin datos todavía. El ranking se actualiza cuando el admin introduce resultados.</p>
          </div>
        )}
        <p className="text-[11px] text-white/30">Desempates: puntos → victorias → exactos → signos → menos pen. → menor dif. goles → apuesta más temprana.</p>
        <button className="mt-3 text-xs text-white/30 hover:text-white/60 transition-colors" onClick={()=>{
          exportCSV("ranking_futbol.csv",["Pos","Nombre","Puntos","Victorias","Exactos","Signos","Pen."],standings.map((r,i)=>[i+1,r.name,r.points,r.wins,r.exact,r.signs,r.penCount]));
        }}>📥 Exportar CSV</button>
        <button className="mt-3 ml-2 text-xs text-white/30 hover:text-white/60 transition-colors" onClick={()=>{
          exportPDF("Ranking Fútbol — Porra Birreros",["Pos","Nombre","Puntos","Victorias","Exactos","Signos","Pen."],standings.map((r,i)=>[i+1,r.name,r.points,r.wins,r.exact,r.signs,r.penCount]));
        }}>📄 Exportar PDF</button>
      </div>
    </div>
  );
}

export const FutbolEvolutionChart = memo(function FutbolEvolutionChart({db}){
  const futbol=db.futbol||defaultFutbolState();
  const participants=useMemo(()=>getParticipantsForPorra(db,"futbol"),[db.participants,db.users]);
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const chartData=useMemo(()=>{
    if(participants.length<2) return null;
    const withRes=jornadas.filter(j=>futbol.results?.[j.id]);
    if(!withRes.length) return null;
    const sorted=[...participants].sort();
    const startPos={}; sorted.forEach((n,i)=>{startPos[n]=i+1;});
    const evol=[{label:"🏁",positions:startPos}];
    withRes.forEach((j,ji)=>{
      const keysUpTo=withRes.slice(0,ji+1).map(x=>x.id);
      const st=participants.map(name=>{
        let pts=0,exact=0,signs=0;
        keysUpTo.forEach(id=>{const s=scoreFutbolJornada(db,id,name);pts+=s.points;exact+=s.exact;signs+=s.signs;});
        return{name,points:pts,exact,signs};
      }).sort((a,b)=>b.points-a.points||b.exact-a.exact||b.signs-a.signs);
      const pos={}; st.forEach((s,i)=>{pos[s.name]=i+1;});
      evol.push({label:j.name||`J${ji+1}`,positions:pos});
    });
    return evol;
  },[futbol,participants,jornadas,db]);
  if(!chartData||chartData.length<2) return null;
  const sorted=useMemo(()=>[...participants].sort(),[participants]);
  const colorOf=useCallback(n=>PILOT_COLORS[n]||FALLBACK_COLORS[sorted.indexOf(n)%FALLBACK_COLORS.length],[sorted]);
  const nR=chartData.length; const nP=participants.length;
  const padL=28,padR=82,padT=22,padB=32;
  const colW=Math.max(48,280/nR); const rowH=Math.max(26,160/nP);
  const chartW=nR>1?(nR-1)*colW:colW; const chartH=nP>1?(nP-1)*rowH:rowH;
  const W=padL+chartW+padR,H=padT+chartH+padB;
  const xOf=i=>padL+(nR>1?(i/(nR-1))*chartW:chartW/2);
  const yOf=p=>padT+((p-1)/(nP-1))*chartH;
  return (
    <div className="card p-4 md:p-5">
      <h2 className="section-title text-base mb-3">📈 Evolución por jornada</h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{minWidth:Math.max(400,nR*50)}}>
          {Array.from({length:nP},(_,i)=><line key={i} x1={padL} x2={padL+chartW} y1={yOf(i+1)} y2={yOf(i+1)} stroke="rgba(255,255,255,.06)" strokeWidth=".5"/>)}
          {sorted.map(name=>{
            const pts=chartData.map((d,i)=>({x:xOf(i),y:yOf(d.positions[name]||nP)}));
            const path=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
            return <g key={name}>
              <path d={path} fill="none" stroke={colorOf(name)} strokeWidth="2" strokeLinejoin="round" opacity=".9"/>
              {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill={colorOf(name)}/>)}
              <text x={pts[pts.length-1].x+6} y={pts[pts.length-1].y+4} fill={colorOf(name)} fontSize="10" fontWeight="600">{name}</text>
            </g>;
          })}
          {chartData.map((d,i)=><text key={i} x={xOf(i)} y={H-6} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="8">{d.label}</text>)}
        </svg>
      </div>
    </div>
  );
});
