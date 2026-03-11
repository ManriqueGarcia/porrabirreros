import { useState, useEffect, useRef } from "react";
import { processF1Query, processFutbolQuery, F1_SUGG, FUTBOL_SUGG } from "../f1-data.js";

function AIAssistant({open,onClose,races,mode="f1"}){
  const [input,setInput]=useState("");
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);
  const isFutbol=mode==="futbol";
  const suggestions=isFutbol?FUTBOL_SUGG:F1_SUGG;
  useEffect(()=>{if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight;},[messages,loading]);
  const ask=async(text)=>{
    const q=(text||input||"").trim();if(!q||loading) return;
    setInput("");setMessages(prev=>[...prev,{role:"user",text:q}]);setLoading(true);
    try{
      const answer=isFutbol?await processFutbolQuery(q):await processF1Query(q);
      setMessages(prev=>[...prev,{role:"assistant",text:answer}]);
    }
    catch(err){setMessages(prev=>[...prev,{role:"assistant",text:"Error al consultar datos. Inténtalo de nuevo."}]);}
    finally{setLoading(false);}
  };
  if(!open) return null;
  const loadingText=isFutbol?"Consultando sobre fútbol...":"Consultando datos de F1...";
  const welcomeText=isFutbol
    ?"¡Biip boop! Soy ManriBot ⚽, tu experto futbolero con más datos que cromos. Pregúntame sobre cualquier cosa del mundo del fútbol: historia, equipos, jugadores, tácticas..."
    :"¡Biip boop! Soy ManriBot 🏎️, tu enciclopedia F1 con más datos que memoria. Pregúntame lo que quieras: resultados, campeonatos, pilotos, circuitos...";
  const subtitleText=isFutbol?"Powered by Gemma 3 27B · Todo sobre fútbol":"Datos desde 1950 hasta hoy · Jolpica/Ergast API";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:justify-end p-0 md:p-6" role="dialog" aria-modal="true" aria-labelledby="manribot-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative w-full md:max-w-lg max-h-[100vh] md:max-h-[85vh] flex flex-col bg-[#12141b] border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        <div className={`flex items-center justify-between p-4 border-b ${isFutbol?"border-emerald-500/20":"border-white/10"}`}>
          <h2 id="manribot-title" className="font-semibold flex items-center gap-2"><img src="./assets/manribot.svg" alt="" className="w-7 h-7 inline-block"/> ManriBot {isFutbol?"⚽":"🏎️"}</h2>
          <div className="flex items-center gap-2">
            <button className="text-xs text-slate-500 hover:text-slate-300" onClick={()=>setMessages([])}>Limpiar</button>
            <button className="text-slate-400 hover:text-white p-1" onClick={onClose}>✕</button>
          </div>
        </div>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length===0 && (
            <div>
              <p className="text-sm text-slate-300 mb-3">{welcomeText}</p>
              <p className="text-xs text-slate-500 mb-3">{subtitleText}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0,8).map((s,i)=>(
                  <button key={i} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors" onClick={()=>ask(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m,i)=>(
            <div key={i} className={`rounded-xl p-3 ${m.role==="user"?"bg-slate-800/80 ml-4 md:ml-8":"bg-emerald-900/20 border border-emerald-500/10 mr-2 md:mr-4"}`}>
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
            </div>
          ))}
          {loading && <div className="rounded-xl p-3 bg-emerald-900/20 border border-emerald-500/10 mr-4"><p className="text-sm text-slate-300 animate-pulse">{loadingText}</p></div>}
        </div>
        {messages.length>0 && (
          <div className="px-4 pb-1">
            <div className="flex flex-wrap gap-1">
              {suggestions.slice(0,4).map((s,i)=>(
                <button key={i} className="text-xs px-2.5 py-1 rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors" onClick={()=>ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input className="flex-1 border border-white/20 rounded-xl px-3 py-2 bg-neutral-900 text-white text-sm placeholder:text-slate-500" style={{color:"#f0f0f5"}} placeholder={isFutbol?"Pregunta sobre fútbol...":"Pregunta a ManriBot..."} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask();}}}/>
            <button className={`px-4 py-2 rounded-xl ${isFutbol?"bg-emerald-600":"bg-emerald-600"} text-white font-medium text-sm disabled:opacity-50`} onClick={()=>ask()} disabled={loading||!input.trim()}>Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AIAssistant };
