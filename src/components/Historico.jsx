import { useState, useEffect } from "react";
import { REAL_HISTORICAL_2025_KEYS, REAL_HISTORICAL_2025_ROUNDS } from "../config.js";
import { loadHistorical } from "../api.js";

function Historico(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [year,setYear]=useState(2025);
  useEffect(()=>{ setLoading(true); setError(null); loadHistorical(year).then(setData).catch(e=>{ setError(e.status===404||e.message?.includes("404")?`No hay datos históricos para ${year}`:`Error al cargar: ${e.message}`); setData(null); }).finally(()=>setLoading(false)); },[year]);
  const yearSelector=<select className="select border rounded px-3 py-2 text-sm" value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:new Date().getFullYear()-2024},(_,i)=>2025+i).map(y=><option key={y} value={y}>{y}</option>)}</select>;
  if(loading) return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><h2 className="section-title text-lg">Histórico</h2>{yearSelector}</div><div className="card p-4"><p className="text-slate-300">Cargando histórico...</p></div></div>;
  if(error) return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><h2 className="section-title text-lg">Histórico</h2>{yearSelector}</div><div className="card p-4"><p className="text-amber-300">{error}</p></div></div>;
  if(!data) return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><h2 className="section-title text-lg">Histórico</h2>{yearSelector}</div><div className="card p-4"><p className="text-slate-300">No hay datos históricos disponibles.</p></div></div>;
  const races=data.races||[];
  const hasStandings=!!data?.standings?.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="section-title text-lg">{data.title||`Porra F1 ${data.year}`}</h2>
        {yearSelector}
      </div>
      {hasStandings && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Clasificación final</h3>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Participante</th><th className="p-2 text-left">Puntos</th></tr></thead>
              <tbody>
                {data.standings.map((row,i)=>(<tr key={row.name} className="border-t border-white/10"><td className="p-2">{row.rank??(i+1)}</td><td className="p-2 font-medium">{row.name}{row.rank===1?" 🏆":""}</td><td className="p-2">{row.points}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {races.length>0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Preguntas por Gran Premio</h3>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {races.map(r=>{
              const hasRealData = REAL_HISTORICAL_2025_ROUNDS.includes(r.round);
              return (
              <div key={r.round} className="border border-white/10 rounded p-3 bg-neutral-900">
                <div className="font-medium text-sm mb-2">{r.round}. {r.grand_prix}</div>
                {hasRealData && (r.questions||[]).length>0 ? (
                  <ol className="list-decimal pl-5 text-sm text-slate-200 space-y-1">
                    {(r.questions||[]).map((q,i)=><li key={i}>{q||"—"}</li>)}
                  </ol>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}

export { Historico };
