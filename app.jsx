
/* global React, ReactDOM */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const CACHE_BUST = "v20260301";
console.info("[PorraF1] Versión carga", CACHE_BUST);

const LS_KEY = "porra_f1_clean_v3";
const DEFAULT_PASSWORD = "B1rr3r0s";
const QUESTION_AUTHORS_ORDER = ["Pere","Antonio","Manrique","Toni","Carlos"];
const MADRID_TZ = "Europe/Madrid";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const nowISO = ()=>new Date().toISOString();
const loadDB = ()=>{ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }catch{return {};} };
const saveDB = (db)=>localStorage.setItem(LS_KEY, JSON.stringify(db));
const API_BASE_URL = (window.PORRA_API_BASE || "").replace(/\/$/, "");
const API_SECRET = window.PORRA_API_SECRET || "";
const API_HEADERS = API_SECRET ? {"x-porra-secret":API_SECRET} : {};

async function fetchRemoteState(){
  if(!API_BASE_URL) return null;
  const res = await fetch(`${API_BASE_URL}/state`, { headers:{"Accept":"application/json", ...API_HEADERS} });
  if(res.status===404) return null;
  if(!res.ok) throw new Error("Fetch remoto fallido");
  return res.json();
}

async function saveRemoteState(payload){
  if(!API_BASE_URL) return;
  await fetch(`${API_BASE_URL}/state`, { method:"PUT", headers:{"Content-Type":"application/json", ...API_HEADERS}, body:JSON.stringify(payload) });
}

async function loadCalendar(){ const r = await fetch(`./assets/calendar_2026.json?${CACHE_BUST}`); return r.json(); }
async function loadDrivers(){ const r = await fetch(`./assets/drivers_2026.json?${CACHE_BUST}`); return r.json(); }
async function loadTeams(){ const r = await fetch(`./assets/teams_2026.json?${CACHE_BUST}`); return r.json(); }
async function loadCircuits(){ const r = await fetch(`./assets/circuits_2026.json?${CACHE_BUST}`); return r.json(); }
async function loadHistorical(year){ const r = await fetch(`./assets/historical_${year}.json?${CACHE_BUST}`); return r.json(); }
async function hashPassword(pwd){
  const data=new TextEncoder().encode(pwd||"");
  const digest=await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function passwordMatches(user,pwd){
  if(!user) return false;
  const h=await hashPassword(pwd);
  if(user.passwordHash) return h===user.passwordHash;
  if(user.password) return h===await hashPassword(user.password);
  return false;
}
function getOffsetInMinutes(date, timeZone){
  const dtf=new Intl.DateTimeFormat("en-US",{timeZone, hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"});
  const parts=dtf.formatToParts(date).reduce((acc,p)=>{acc[p.type]=p.value; return acc;}, {});
  const asUTC=Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return (asUTC - date.getTime())/60000;
}
function toZonedDate(dateStr, timeStr, timeZone){
  if(!dateStr || !timeStr) return null;
  const [y,m,d]=dateStr.split("-").map(Number); const [hh,mm]=timeStr.split(":").map(Number);
  const tz=timeZone||MADRID_TZ;
  const utcGuess=Date.UTC(y,m-1,d,hh,mm,0,0);
  const offsetMinutes=getOffsetInMinutes(new Date(utcGuess), tz);
  return new Date(utcGuess - offsetMinutes*60000);
}
function formatDateTime(date, timeZone){
  return date.toLocaleString("es-ES",{timeZone:timeZone||MADRID_TZ, weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false});
}
function formatTime(date, timeZone){
  return date.toLocaleTimeString([], {timeZone:timeZone||MADRID_TZ, hour:"2-digit", minute:"2-digit"});
}
/* === TOAST SYSTEM (global) === */
const _toastListeners=[];
function toast(msg,type="info",duration=3500){_toastListeners.forEach(fn=>fn(msg,type,duration));}
toast.success=(m,d)=>toast(m,"success",d);
toast.error=(m,d)=>toast(m,"error",d);
toast.warn=(m,d)=>toast(m,"warning",d);
function ToastContainer(){
  const [toasts,setToasts]=useState([]);
  useEffect(()=>{
    const handler=(msg,type,duration)=>{
      const id=Date.now()+Math.random();
      setToasts(prev=>[...prev,{id,msg,type}]);
      setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),duration||3500);
    };
    _toastListeners.push(handler);
    return ()=>{const i=_toastListeners.indexOf(handler);if(i>=0)_toastListeners.splice(i,1);};
  },[]);
  const colors={success:"from-emerald-600/90 to-emerald-700/90 border-emerald-400/30",error:"from-red-600/90 to-red-700/90 border-red-400/30",info:"from-slate-600/90 to-slate-700/90 border-slate-400/30",warning:"from-amber-600/90 to-amber-700/90 border-amber-400/30"};
  if(!toasts.length) return null;
  return <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs" style={{pointerEvents:"none"}}>
    {toasts.map(t=><div key={t.id} className={`bg-gradient-to-r ${colors[t.type]||colors.info} text-white text-sm px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm`} style={{pointerEvents:"auto",animation:"fadeInUp .3s ease"}}>{t.msg}</div>)}
  </div>;
}

const FUTBOL_BASE_TEAMS=["Real Madrid","FC Barcelona","Real Sociedad","Real Sporting de Gijón"];
const FUTBOL_DEFAULT_DEADLINE_HOUR="15:00";
function defaultFutbolState(){
  return {order:[], jornadas:{}, bets:{}, results:{}, betsWindow:{}, betsReveal:{}, betHistory:{}, questions:{}, questionsStatus:{}};
}
function parseLocalDateTime(input){
  if(!input) return null;
  const parsed=new Date(input);
  if(Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
function toLocalDateTimeInput(date){
  if(!date) return "";
  const pad=(n)=>String(n).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function nextFridayAt1500(){
  const now=new Date();
  const day=now.getDay(); // 0 domingo ... 5 viernes
  const diff=(5-day+7)%7 || 7;
  const target=new Date(now);
  target.setDate(now.getDate()+diff);
  target.setHours(15,0,0,0);
  return target;
}
function futbolSign(score){
  if(!score || score.home==null || score.away==null || Number.isNaN(score.home) || Number.isNaN(score.away)) return null;
  if(score.home>score.away) return "1";
  if(score.home<score.away) return "2";
  return "X";
}
function futbolMatchPoints(pred,res){
  if(!res || res.home==null || res.away==null) return {points:0,exact:false,sign:false};
  if(!pred || pred.home==null || pred.away==null) return {points:0,exact:false,sign:false};
  const exact=Number(pred.home)===Number(res.home) && Number(pred.away)===Number(res.away);
  const signOk=futbolSign(pred)===futbolSign(res);
  const points=exact?3:(signOk?1:0);
  return {points, exact, sign:signOk};
}
function scoreFutbolJornada(db,jornadaId,name){
  const futbol=db.futbol||{};
  const jornada=futbol.jornadas?.[jornadaId];
  const bet=futbol.bets?.[jornadaId]?.[name];
  const res=futbol.results?.[jornadaId];
  if(!res) return {pending:true,points:0,exact:0,signs:0,qHits:0,missed:false,catPenalty:0,missingPenalty:0,latePenalty:0,late:!!bet?.late,goalDiff:0,items:[]};
  const hasBet=!!bet;
  const predictions=hasBet?(bet.matches||[]):[];
  const questions=hasBet?(bet.questions||[]):[];
  const late=!!bet?.late;
  let points=0; let exact=0; let signs=0; let qHits=0; let goalDiff=0; const items=[];
  const official=res.matches||[];
  official.forEach((m,idx)=>{
    const pred=predictions[idx];
    const {points:p,exact:ex,sign}=futbolMatchPoints(pred,m);
    points+=p; if(ex) exact++; if(sign) signs++;
    if(pred && pred.home!=null && pred.away!=null && m.home!=null && m.away!=null){
      goalDiff+=Math.abs(Number(pred.home)-Number(m.home))+Math.abs(Number(pred.away)-Number(m.away));
    } else {
      goalDiff+=10;
    }
    items.push({label:`${jornada?.matches?.[idx]?.home||"Local"} ${pred?.home??"?"}-${pred?.away??"?"} vs ${m?.home??"?"}-${m?.away??"?"}`, delta:p});
  });
  const answers=res.qAnswers||[];
  answers.forEach((ans,idx)=>{
    const sel=(questions[idx]||"").trim();
    const ok=ans && sel && sel.toLowerCase()===ans.trim().toLowerCase();
    if(ok){ points+=2; qHits++; }
    items.push({label:`Pregunta ${idx+1}: ${sel||"—"} vs ${ans||"—"}`, delta:ok?2:0});
  });
  const missed=!bet;
  let missingPenalty=0;
  let latePenalty=0;
  if(missed){ missingPenalty=-3; points+=missingPenalty; items.push({label:"No participó en la apuesta", delta:missingPenalty}); goalDiff+=40; }
  else if(late){ latePenalty=-2; points+=latePenalty; items.push({label:"Apuesta fuera de plazo", delta:latePenalty}); }
  let catPenalty=0;
  if(!missed && !late && points===0){ catPenalty=-1; points+=catPenalty; items.push({label:"Apuesta catastrófica", delta:catPenalty}); }
  return {pending:false,points,exact,signs,qHits,missed,late,catPenalty,missingPenalty,latePenalty,goalDiff,items};
}

function computeFutbolJornadaWins(dbFutbol, participants, jornadas){
  const wins={};
  participants.forEach(n=>{ wins[n]=0; });
  const completed=(jornadas||[]).filter(j=>dbFutbol.results?.[j.id]);
  completed.forEach(j=>{
    let best=-Infinity; let winners=[];
    participants.forEach(name=>{
      const s=scoreFutbolJornada({futbol:dbFutbol},j.id,name);
      if(s.points>best){ best=s.points; winners=[name]; }
      else if(s.points===best) winners.push(name);
    });
    if(winners.length===1) wins[winners[0]]++;
  });
  return wins;
}

function computeFutbolStandings(dbFutbol,participants,jornadas){
  const completed=(jornadas||[]).filter(j=>dbFutbol.results?.[j.id]);
  const jornadaWins=computeFutbolJornadaWins(dbFutbol, participants, jornadas);
  return participants.map(name=>{
    const acc=completed.reduce((a,j)=>{
      const s=scoreFutbolJornada({futbol:dbFutbol},j.id,name);
      a.points+=s.points; a.exact+=s.exact; a.qHits+=s.qHits; a.signs+=s.signs; a.missed+=s.missed?1:0; a.late+=s.late?1:0; a.cat+=s.catPenalty?1:0; a.goalDiff+=s.goalDiff; return a;
    },{points:0,exact:0,signs:0,qHits:0,missed:0,late:0,cat:0,goalDiff:0});
    return {name,...acc, wins:jornadaWins[name]||0, penCount:acc.missed+acc.late};
  }).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.exact-a.exact||b.qHits-a.qHits||b.signs-a.signs||a.penCount-b.penCount||a.goalDiff-b.goalDiff);
}
function listFutbolJornadas(futbol){
  const entries=Object.values(futbol?.jornadas||{});
  const order=futbol?.order||[];
  if(order.length){
    return order.map(id=>entries.find(j=>j.id===id)).filter(Boolean);
  }
  return entries.sort((a,b)=>{
    const da=a.deadline?new Date(a.deadline).getTime():Infinity;
    const db=b.deadline?new Date(b.deadline).getTime():Infinity;
    return da-db||a.name.localeCompare(b.name);
  });
}

function Avatar({name,avatar:customAvatar,size="md"}){
  const base=`./assets/avatars/${(name||"").toLowerCase().replace(/\s+/g,"")}.svg`;
  const [imgSrc,setImgSrc]=React.useState(customAvatar||base);
  React.useEffect(()=>{ setImgSrc(customAvatar||base); },[customAvatar,base]);
  const fallback=()=>setImgSrc("./assets/avatars/default.svg");
  const sizeCls=size==="sm"?"w-8 h-8":size==="xs"?"w-6 h-6":"w-28 h-32";
  return <img src={imgSrc} alt={name} onError={fallback} className={`${sizeCls} rounded-xl object-contain`} />;
}

const MAX_AVATAR_BASE64=120000;
function resizeImageToDataUrl(file,maxW=128,maxH=128,quality=0.85){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const c=document.createElement("canvas");
      let w=img.width,h=img.height;
      if(w>maxW||h>maxH){ const r=Math.min(maxW/w,maxH/h); w=Math.round(w*r); h=Math.round(h*r); }
      c.width=w; c.height=h;
      const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,w,h);
      let dataUrl=c.toDataURL("image/jpeg",quality);
      while(dataUrl.length>MAX_AVATAR_BASE64&&quality>0.3){ quality-=0.1; dataUrl=c.toDataURL("image/jpeg",quality); }
      resolve(dataUrl);
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("Error cargando imagen")); };
    img.src=url;
  });
}
function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(new Error("Error leyendo archivo"));
    if(file.type==="image/svg+xml") r.readAsDataURL(file);
    else r.readAsDataURL(file);
  });
}
function CircuitCard({race,circuits,compact}){
  if(!race||!circuits) return null;
  const c=circuits[race.key]||{};
  const trackSrc=`./assets/circuit_tracks/${race.key}.svg`;
  const history=c.history||[];
  if(compact) return (
    <div className="mt-4 w-full p-3 rounded-xl bg-white/[.03] border border-red-500/10">
      <h3 className="text-xs font-bold text-white/80 mb-1 tracking-wide">🏁 {c.name||race.grand_prix}</h3>
      {c.city&&<div className="text-[10px] text-white/40 mb-2">{c.city}</div>}
      <div className="flex gap-3">
        <div className="w-20 h-14 flex-shrink-0 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden border border-white/5">
          <img src={trackSrc} alt="" className="w-full h-full object-contain p-1.5" onError={e=>{ e.target.onerror=null; e.target.src="./assets/circuit_tracks/default.svg"; }} />
        </div>
        <div className="text-[11px] text-white/40 space-y-0.5 min-w-0">
          <div>{c.length||"—"} km · {c.laps||"—"} v.</div>
          <div className="text-white/30">⏱ {c.fastestLap||"—"}</div>
          {c.driver&&<div className="text-white/40 truncate">{c.driver} ({c.year})</div>}
        </div>
      </div>
      {history.length>0&&<div className="mt-2 pt-2 border-t border-white/5">
        <div className="text-[10px] text-white/35 mb-1 uppercase tracking-wider font-semibold">Últimos ganadores</div>
        {history.slice(0,2).map(h=><div key={h.season} className="text-[10px] text-white/35 flex justify-between"><span>{h.season}</span><span className="text-white/50 font-medium truncate ml-2">{h.winner}</span></div>)}
      </div>}
    </div>
  );
  return (
    <div className="mb-4 p-4 rounded-xl bg-white/[.03] border border-red-500/10 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/25 to-transparent"></div>
      <h3 className="text-sm font-bold text-white/90 mb-1 flex items-center gap-2">🏁 {c.name||race.grand_prix}</h3>
      {c.city&&<div className="text-[11px] text-white/30 mb-3">{c.city}</div>}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-48 h-32 flex-shrink-0 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center border border-white/5">
          <img src={trackSrc} alt="" className="w-full h-full object-contain p-3" onError={e=>{ e.target.onerror=null; e.target.src="./assets/circuit_tracks/default.svg"; }} />
        </div>
        <div className="text-sm space-y-2 flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div><span className="text-white/35">Longitud</span><div className="text-white/70 font-semibold">{c.length||"—"} km</div></div>
            <div><span className="text-white/35">Vueltas</span><div className="text-white/70 font-semibold">{c.laps||"—"}</div></div>
          </div>
          <div className="mt-2 p-2 rounded-lg bg-white/[.02] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">⏱ Vuelta rápida</div>
            <div className="text-white/80 font-bold text-sm">{c.fastestLap||"—"}</div>
            {c.driver&&<div className="text-white/40 text-xs">{c.driver} ({c.year})</div>}
          </div>
        </div>
      </div>
      {history.length>0&&<div className="mt-4 pt-3 border-t border-white/5">
        <div className="text-[11px] text-white/40 uppercase tracking-wider font-bold mb-2">📊 Resultados recientes</div>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead><tr>
              <th className="text-left text-white/40 font-semibold pb-1.5 pr-3">Año</th>
              <th className="text-left text-white/40 font-semibold pb-1.5 pr-3">Ganador</th>
              <th className="text-left text-white/40 font-semibold pb-1.5 pr-3">Vuelta rápida</th>
              <th className="text-right text-white/40 font-semibold pb-1.5">Tiempo</th>
            </tr></thead>
            <tbody>{history.map(h=><tr key={h.season} className="border-t border-white/[.03]">
              <td className="py-1.5 pr-3 text-white/40 font-medium">{h.season}</td>
              <td className="py-1.5 pr-3 text-white/70 font-semibold">{h.winner}</td>
              <td className="py-1.5 pr-3 text-white/40">{h.fl}</td>
              <td className="py-1.5 text-right text-white/30 font-mono text-[11px]">{h.flTime}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}
function ChangeAvatarModal({open,onClose,db,setDb,user}){
  const [busy,setBusy]=React.useState(false);
  const inputRef=React.useRef(null);
  if(!open) return null;
  const handleFile=async(e)=>{
    const file=e?.target?.files?.[0];
    if(!file) return;
    const ok=/\.(jpe?g|png|svg)$/i.test(file.name)||["image/jpeg","image/png","image/svg+xml"].includes(file.type);
    if(!ok){ toast.error("Formato no válido. Usa JPG, PNG o SVG."); return; }
    setBusy(true);
    try{
      let dataUrl;
      if(file.type==="image/svg+xml"){
        dataUrl=await readFileAsDataUrl(file);
        if(dataUrl.length>MAX_AVATAR_BASE64){ toast.error("El SVG es demasiado grande. Usa uno más simple o JPG/PNG."); setBusy(false); return; }
      }else{
        dataUrl=await resizeImageToDataUrl(file);
      }
      setDb(prev=>({...prev,meta:{...(prev.meta||{}),avatars:{...(prev.meta?.avatars||{}),[user]:dataUrl}}}));
      toast.success("Avatar actualizado");
      onClose();
    }catch(err){ toast.error(err?.message||"Error al subir"); }
    finally{ setBusy(false); if(inputRef.current) inputRef.current.value=""; }
  };
  const removeAvatar=()=>{
    setDb(prev=>{
      const avatars={...(prev.meta?.avatars||{})};
      delete avatars[user];
      return {...prev,meta:{...(prev.meta||{}),avatars}};
    });
    toast.success("Avatar eliminado");
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white text-slate-900 rounded-xl p-5 w-full max-w-sm">
        <div className="font-semibold mb-3">Cambiar avatar</div>
        <p className="text-sm text-slate-600 mb-3">JPG, PNG o SVG. Máx. ~100KB.</p>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml" onChange={handleFile} className="block w-full text-sm mb-3" disabled={busy} />
        <div className="flex gap-2 justify-end">
          <button type="button" className="px-3 py-2 rounded bg-slate-200" onClick={onClose}>Cancelar</button>
          {db.meta?.avatars?.[user]&&<button type="button" className="px-3 py-2 rounded bg-red-100 text-red-700" onClick={removeAvatar}>Quitar avatar</button>}
        </div>
      </div>
    </div>
  );
}
function ChangePasswordModal({open,onClose,db,setDb,user}){
  const [curr,setCurr]=React.useState("");
  const [n1,setN1]=React.useState("");
  const [n2,setN2]=React.useState("");
  const [busy,setBusy]=React.useState(false);
  if(!open) return null;
  const submit=async (e)=>{
    e.preventDefault(); if(busy) return; setBusy(true);
    try{
      const u=db.users?.[user]; if(!u) return toast.error("Usuario no válido");
      const ok=await passwordMatches(u,curr);
      if(!ok) return toast.error("Contraseña actual incorrecta");
      if(n1.length<6) return toast.error("Mínimo 6 caracteres");
      if(n1!==n2) return toast.error("Las contraseñas no coinciden");
      const hash=await hashPassword(n1);
      setDb(prev=>{ const users={...(prev.users||{})}; users[user]={...users[user],passwordHash:hash,mustChange:false,changedAt:new Date().toISOString()}; delete users[user].password; return {...prev,users}; });
      toast.success("Contraseña actualizada"); onClose();
    }finally{setBusy(false);}
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white text-slate-900 rounded-xl p-5 w-full max-w-sm">
        <div className="font-semibold mb-2">Cambiar contraseña</div>
        <form onSubmit={submit} className="grid gap-2">
          <label className="text-sm">Actual</label><input type="password" autoComplete="current-password" className="border rounded px-3 py-2" value={curr} onChange={e=>setCurr(e.target.value)} />
          <label className="text-sm">Nueva</label><input type="password" autoComplete="new-password" className="border rounded px-3 py-2" value={n1} onChange={e=>setN1(e.target.value)} />
          <label className="text-sm">Repetir nueva</label><input type="password" autoComplete="new-password" className="border rounded px-3 py-2" value={n2} onChange={e=>setN2(e.target.value)} />
          <div className="flex gap-2 mt-2 justify-end"><button type="button" className="px-3 py-2 rounded bg-slate-200" onClick={onClose}>Cancelar</button><button disabled={busy} className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50">{busy?"Guardando...":"Guardar"}</button></div>
        </form>
      </div>
    </div>
  );
}

function Login({db,setDb,onLogged}){
  const [name,setName]=useState(""); const [pass,setPass]=useState("");
  const [needsChange,setNeedsChange]=useState(false); const [n1,setN1]=useState(""); const [n2,setN2]=useState("");
  const [busy,setBusy]=useState(false);
  const [showRecover,setShowRecover]=useState(false);
  const [recoverUser,setRecoverUser]=useState("");
  const [recoverCode,setRecoverCode]=useState("");
  const [recoverN1,setRecoverN1]=useState("");
  const [recoverN2,setRecoverN2]=useState("");
  const [recoverStep,setRecoverStep]=useState(1);

  const tryLogin=async (e)=>{ e&&e.preventDefault(); if(busy) return; setBusy(true); try{ const u=db.users?.[name]; if(!u) return toast.error("Usuario no encontrado"); const ok=await passwordMatches(u,pass); if(!ok) return toast.error("Contraseña incorrecta"); if(u.blocked) return toast.error("Usuario bloqueado temporalmente"); if(u.mustChange){ setNeedsChange(true); return; } if(u.password && !u.passwordHash){ const hash=await hashPassword(pass); setDb(prev=>{ const users={...(prev.users||{})}; users[name]={...users[name],passwordHash:hash}; delete users[name].password; return {...prev,users}; }); } onLogged(name); }finally{setBusy(false);} };
  const doChange=async (e)=>{ e.preventDefault(); if(busy) return; setBusy(true); try{ if(n1.length<6) return toast.error("Mínimo 6 caracteres"); if(n1!==n2) return toast.error("Las contraseñas no coinciden"); const hash=await hashPassword(n1); setDb(prev=>{ const users={...(prev.users||{})}; users[name]={...users[name],passwordHash:hash,mustChange:false,changedAt:nowISO()}; delete users[name].password; return {...prev,users}; }); onLogged(name); }finally{setBusy(false);} };

  const verifyRecoverCode=(e)=>{
    e.preventDefault();
    if(!recoverUser) return toast.error("Selecciona tu usuario");
    if(!db.users?.[recoverUser]) return toast.error("Usuario no encontrado");
    const secret=db.meta?.adminSecret||atob("bWFucmlxdWU=");
    if(recoverCode!==secret) return toast.error("Código de recuperación incorrecto");
    setRecoverStep(2);
  };

  const doRecover=async (e)=>{
    e.preventDefault();
    if(busy) return; setBusy(true);
    try{
      if(recoverN1.length<6) return toast.error("Mínimo 6 caracteres");
      if(recoverN1!==recoverN2) return toast.error("Las contraseñas no coinciden");
      const hash=await hashPassword(recoverN1);
      setDb(prev=>{
        const users={...(prev.users||{})};
        users[recoverUser]={...users[recoverUser],passwordHash:hash,mustChange:false,blocked:false,changedAt:nowISO()};
        delete users[recoverUser].password;
        return {...prev,users};
      });
      toast.success("Contraseña actualizada. Ya puedes entrar.");
      setShowRecover(false); setRecoverStep(1); setRecoverUser(""); setRecoverCode(""); setRecoverN1(""); setRecoverN2("");
    }finally{setBusy(false);}
  };

  const resetRecover=()=>{ setShowRecover(false); setRecoverStep(1); setRecoverUser(""); setRecoverCode(""); setRecoverN1(""); setRecoverN2(""); };

  if(showRecover){
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-2 mb-1">
          <button type="button" onClick={resetRecover} className="text-white/40 hover:text-white/70 transition-colors text-lg" aria-label="Volver">←</button>
          <span className="text-sm font-semibold text-white/70">Recuperar contraseña</span>
        </div>
        {recoverStep===1 ? (
          <form onSubmit={verifyRecoverCode} className="grid gap-3">
            <div className="text-xs text-amber-300/70 bg-amber-500/10 border border-amber-400/20 rounded-lg p-2.5">
              🔑 Pide el código de recuperación al administrador de la porra.
            </div>
            <div>
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Tu usuario</label>
              <select className="select border rounded px-3 py-2.5 text-base w-full" value={recoverUser} onChange={e=>setRecoverUser(e.target.value)}>
                <option value="">— elige —</option>
                {Object.keys(db.users||{}).sort().map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Código de recuperación</label>
              <input type="password" autoComplete="off" className="select border rounded px-3 py-2.5 w-full" placeholder="Código que te dio el admin" value={recoverCode} onChange={e=>setRecoverCode(e.target.value)} />
            </div>
            <button className="mt-1 px-4 py-2.5 rounded-xl bg-amber-600/80 border border-amber-500/30 text-white font-medium hover:bg-amber-600 transition-all">Verificar código</button>
          </form>
        ) : (
          <form onSubmit={doRecover} className="grid gap-3">
            <div className="text-sm text-emerald-300/80">✅ Código correcto. Elige tu nueva contraseña, <b>{recoverUser}</b>.</div>
            <div>
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Nueva contraseña</label>
              <input type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={recoverN1} onChange={e=>setRecoverN1(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Repite contraseña</label>
              <input type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={recoverN2} onChange={e=>setRecoverN2(e.target.value)} />
            </div>
            <button disabled={busy} className="mt-1 px-4 py-2.5 rounded-xl bg-emerald-600/80 border border-emerald-500/30 text-white font-medium hover:bg-emerald-600 transition-all disabled:opacity-50">{busy?"Guardando...":"Guardar nueva contraseña"}</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {!needsChange ? (
        <form onSubmit={tryLogin} className="grid gap-3">
          <div>
            <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Usuario</label>
            <select className="select border rounded px-3 py-2.5 text-base w-full" value={name} onChange={e=>setName(e.target.value)}>
              <option value="">— elige —</option>
              {Object.keys(db.users||{}).sort().map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Contraseña</label>
            <input type="password" autoComplete="current-password" className="select border rounded px-3 py-2.5 w-full" value={pass} onChange={e=>setPass(e.target.value)} />
          </div>
          <button disabled={busy} className="mt-1 px-4 py-2.5 rounded-xl border text-white font-bold tracking-wide shadow-lg transition-all disabled:opacity-50" style={{background:"linear-gradient(135deg,rgba(225,6,0,.8),rgba(217,119,6,.7))",borderColor:"rgba(245,158,11,.3)",boxShadow:"0 4px 20px rgba(225,6,0,.15),0 2px 10px rgba(245,158,11,.1)"}} onClick={tryLogin}>{busy?"Entrando...":"🍺 ENTRAR"}</button>
          <button type="button" onClick={()=>setShowRecover(true)} className="text-xs text-white/40 hover:text-amber-300/70 transition-colors mt-0.5">🔑 ¿Olvidaste tu contraseña?</button>
        </form>
      ) : (
        <form onSubmit={doChange} className="grid gap-3">
          <div className="text-sm text-amber-300/80">Es tu primer acceso. Cambia tu contraseña.</div>
          <div><label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Nueva contraseña</label><input type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={n1} onChange={e=>setN1(e.target.value)} /></div>
          <div><label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 block">Repite contraseña</label><input type="password" autoComplete="new-password" className="select border rounded px-3 py-2.5 w-full" value={n2} onChange={e=>setN2(e.target.value)} /></div>
          <button disabled={busy} className="mt-1 px-4 py-2.5 rounded-xl bg-emerald-600/80 border border-emerald-500/30 text-white font-medium hover:bg-emerald-600 transition-all disabled:opacity-50">{busy?"Guardando...":"Guardar y entrar"}</button>
        </form>
      )}
    </div>
  );
}

const DRIVER_TEAMS={
  "Lando Norris":"McLaren","Oscar Piastri":"McLaren",
  "Lewis Hamilton":"Ferrari","Charles Leclerc":"Ferrari",
  "Max Verstappen":"Red Bull","Liam Lawson":"Red Bull",
  "George Russell":"Mercedes","Kimi Antonelli":"Mercedes",
  "Fernando Alonso":"Aston Martin","Lance Stroll":"Aston Martin",
  "Pierre Gasly":"Alpine","Franco Colapinto":"Alpine",
  "Esteban Ocon":"Haas","Oliver Bearman":"Haas",
  "Isack Hadjar":"Racing Bulls","Arvid Lindblad":"Racing Bulls",
  "Carlos Sainz":"Williams","Alexander Albon":"Williams",
  "Nico Hülkenberg":"Audi","Gabriel Bortoleto":"Audi",
  "Valtteri Bottas":"Cadillac","Sergio Perez":"Cadillac",
};
const TEAMS_ORDER_2025=["McLaren","Ferrari","Red Bull","Mercedes","Aston Martin","Alpine","Haas","Racing Bulls","Williams","Audi","Cadillac"];

function SelectDriver({value,onChange,drivers,placeholder}){
  const grouped=useMemo(()=>{
    const byTeam={};
    TEAMS_ORDER_2025.forEach(t=>{byTeam[t]=[];});
    const ungrouped=[];
    (drivers||[]).forEach(d=>{
      const team=DRIVER_TEAMS[d];
      if(team && byTeam[team]) byTeam[team].push(d);
      else ungrouped.push(d);
    });
    return {byTeam,ungrouped};
  },[drivers]);
  return (
    <select className="select border rounded px-3 py-2 w-full min-w-0" value={value||""} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {TEAMS_ORDER_2025.map(team=>{
        const tDrivers=grouped.byTeam[team];
        if(!tDrivers||!tDrivers.length) return null;
        return <optgroup key={team} label={team}>{tDrivers.map(d=><option key={d} value={d}>{d}</option>)}</optgroup>;
      })}
      {grouped.ungrouped.length>0 && <optgroup label="Otros">{grouped.ungrouped.map(d=><option key={d} value={d}>{d}</option>)}</optgroup>}
    </select>
  );
}

function BetForm({bet,disabled,onSubmit,questions,drivers,late}){
  const [pole,setPole]=useState(bet.pole||""); const [p1,setP1]=useState(bet.podium?.[0]||""); const [p2,setP2]=useState(bet.podium?.[1]||""); const [p3,setP3]=useState(bet.podium?.[2]||"");
  const [q1,setQ1]=useState(bet.q?.[0]||""); const [q2,setQ2]=useState(bet.q?.[1]||""); const [q3,setQ3]=useState(bet.q?.[2]||"");
  useEffect(()=>{
    setPole(bet.pole||"");
    setP1(bet.podium?.[0]||""); setP2(bet.podium?.[1]||""); setP3(bet.podium?.[2]||"");
    setQ1(bet.q?.[0]||""); setQ2(bet.q?.[1]||""); setQ3(bet.q?.[2]||"");
  },[bet]);
  return (
    <form className="grid gap-2" onSubmit={(e)=>{e.preventDefault();onSubmit({pole,podium:[p1,p2,p3],q:[q1,q2,q3]});}}>
      <label className="text-sm">Pole</label><SelectDriver value={pole} onChange={setPole} drivers={drivers} placeholder="Selecciona piloto" />
      <label className="text-sm mt-2">Podio</label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <SelectDriver value={p1} onChange={setP1} drivers={drivers} placeholder="1º" />
        <SelectDriver value={p2} onChange={setP2} drivers={drivers} placeholder="2º" />
        <SelectDriver value={p3} onChange={setP3} drivers={drivers} placeholder="3º" />
      </div>
      <label className="text-sm mt-2">Preguntas adicionales</label>
      <div className="grid gap-2">
        <input disabled={disabled} className="select border rounded px-3 py-2 w-full" value={q1} onChange={e=>setQ1(e.target.value)} placeholder="Respuesta 1"/>
        <input disabled={disabled} className="select border rounded px-3 py-2 w-full" value={q2} onChange={e=>setQ2(e.target.value)} placeholder="Respuesta 2"/>
        <input disabled={disabled} className="select border rounded px-3 py-2 w-full" value={q3} onChange={e=>setQ3(e.target.value)} placeholder="Respuesta 3"/>
      </div>
      <button disabled={disabled} className={`mt-3 px-4 py-2 rounded ${disabled?"bg-slate-200 text-slate-500":late?"bg-amber-600 text-white":"bg-emerald-600 text-white"}`}>{disabled?"Cerrado por admin":late?"Guardar apuesta (fuera de plazo, -2 pts)":"Guardar apuesta"}</button>
    </form>
  );
}

function betsAreEqual(prev,next){
  if(!prev || !next) return false;
  const samePole=(prev.pole||"")===(next.pole||"");
  const samePodium=(prev.podium||[]).join("|")===(next.podium||[]).join("|");
  const sameQ=(prev.q||[]).join("|")===(next.q||[]).join("|");
  return samePole && samePodium && sameQ;
}

function scoreForRace(db, raceKey, name){
  const bet=db.bets?.[raceKey]?.[name]; const res=db.results?.[raceKey];
  const noBet=!bet;
  if(noBet){
    const hasResults=!!res;
    return {points:hasResults?-3:0,hits:0,exact:0,pen:hasResults?1:0,gotPole:false,gotAllPodium:false,gotAllQuestions:false,fullHouse:false,submittedAt:null,missed:hasResults,late:false};
  }
  let pts=0,hits=0,pen=0,exact=0;
  if(res?.pole && bet.pole===res.pole){pts++;hits++;}
  if(res?.podium){ bet.podium?.forEach((p,i)=>{ if(p===res.podium[i]){pts++;hits++;} }); }
  if(res?.qAnswers){ bet.q?.forEach((a,i)=>{ if((a||'').toLowerCase().trim()===(res.qAnswers[i]||'').toLowerCase().trim()){pts++;hits++;} }); }
  const gotPole=res?.pole && bet.pole===res.pole; const gotAllPod=res?.podium && bet.podium?.every((p,i)=>p===res.podium[i]); const gotAllQ=res?.qAnswers && bet.q?.every((a,i)=>(a||'').toLowerCase().trim()===(res.qAnswers[i]||'').toLowerCase().trim());
  if(gotPole && gotAllPod) pts+=2; if(gotPole && gotAllPod && gotAllQ) pts+=2;
  if(!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length<3)){pts-=1;pen++;}
  if(bet.late){pts-=2;pen++;}
  if(gotAllPod) exact=1; const fullHouse=!!(gotPole && gotAllPod && gotAllQ);
  const manualAdj=Number(db.scoreAdjustments?.[raceKey]?.[name]||0) || 0;
  const finalPoints=pts+manualAdj;
  return {points:finalPoints,hits,exact,pen,gotPole:!!gotPole,gotAllPodium:!!gotAllPod,gotAllQuestions:!!gotAllQ,fullHouse,manualAdj,submittedAt:bet.submittedAt||null,missed:false,late:!!bet.late};
}

function computeGPWins(db, races, participants){
  const wins={};
  participants.forEach(n=>{ wins[n]=0; });
  (races||[]).forEach(race=>{
    const res=db.results?.[race.key];
    if(!res) return;
    let best=-Infinity; let winners=[];
    participants.forEach(name=>{
      const s=scoreForRace(db,race.key,name);
      if(s.points>best){ best=s.points; winners=[name]; }
      else if(s.points===best) winners.push(name);
    });
    if(winners.length===1) wins[winners[0]]++;
  });
  return wins;
}

function computeAvgSubmitTime(db, races, name){
  let total=0, count=0;
  (races||[]).forEach(race=>{
    const bet=db.bets?.[race.key]?.[name];
    if(bet?.submittedAt){ total+=new Date(bet.submittedAt).getTime(); count++; }
  });
  return count>0 ? total/count : Infinity;
}

function computeGlobalStandings(db,races){
  const participants=Object.keys(db.participants||{});
  const keys=(races||[]).map(r=>r.key);
  const gpWins=computeGPWins(db, races, participants);
  return participants.map(name=>{
    const acc=keys.reduce((a,k)=>{
      const s=scoreForRace(db,k,name);
      a.points+=s.points; a.hits+=s.hits; a.exact+=s.exact; a.pen+=s.pen; return a;
    },{points:0,hits:0,exact:0,pen:0});
    return {...acc, name, wins:gpWins[name]||0, avgSubmit:computeAvgSubmitTime(db,races,name)};
  }).sort((A,B)=>B.points-A.points||B.wins-A.wins||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen||A.avgSubmit-B.avgSubmit);
}
function topList(obj, limit=5){ return Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([name,value])=>({name,value})); }
function buildStats(db,races){
  const participants=Object.keys(db.participants||{});
  const wins={}; const fulls={}; const hitsTotals={};
  const best=[]; const worst=[];
  const votes={pole:{},p1:{},p2:{},p3:{}};
  (races||[]).forEach(race=>{
    const bets=db.bets?.[race.key]||{};
    Object.values(bets).forEach(b=>{
      if(b.pole) votes.pole[b.pole]=(votes.pole[b.pole]||0)+1;
      if(Array.isArray(b.podium)){
        if(b.podium[0]) votes.p1[b.podium[0]]=(votes.p1[b.podium[0]]||0)+1;
        if(b.podium[1]) votes.p2[b.podium[1]]=(votes.p2[b.podium[1]]||0)+1;
        if(b.podium[2]) votes.p3[b.podium[2]]=(votes.p3[b.podium[2]]||0)+1;
      }
    });
    if(!db.results?.[race.key]) return;
    const standings=participants.map(name=>{
      const s=scoreForRace(db,race.key,name);
      hitsTotals[name]=(hitsTotals[name]||0)+s.hits;
      return {...s,name};
    });
    if(!standings.length) return;
    const points=standings.map(s=>s.points);
    const maxPts=Math.max(...points); const minPts=Math.min(...points);
    standings.forEach(s=>{
      if(s.points===maxPts){ wins[s.name]=(wins[s.name]||0)+1; best.push({name:s.name,points:s.points,race:race.grand_prix}); }
      if(s.points===minPts){ worst.push({name:s.name,points:s.points,race:race.grand_prix}); }
      if(s.fullHouse) fulls[s.name]=(fulls[s.name]||0)+1;
    });
  });
  const bestScores=[...best].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).slice(0,5);
  const worstScores=[...worst].sort((a,b)=>a.points-b.points||a.name.localeCompare(b.name)).slice(0,5);
  return {
    winners: topList(wins,5),
    fulls: topList(fulls,5),
    hitsLeaders: topList(hitsTotals,5),
    votePole: topList(votes.pole,5),
    voteP1: topList(votes.p1,5),
    voteP2: topList(votes.p2,5),
    voteP3: topList(votes.p3,5),
    bestScores,
    worstScores,
  };
}
function describeBetAgainstResult(bet,res,manualAdj=0){
  if(!bet) return {points:res?-3:0, items:[{label:"No participó en la apuesta", delta:res?-3:0}]};
  let pts=0;
  const items=[];
  const push=(label,delta)=>{ pts+=delta; items.push({label,delta}); };
  if(res?.pole){
    const ok=bet.pole===res.pole;
    push(`Pole: ${bet.pole||"—"} vs ${res.pole||"—"}`, ok?1:0);
  }
  if(Array.isArray(res?.podium)){
    res.podium.forEach((p,i)=>{
      const sel=bet.podium?.[i]||"";
      const ok=sel===p;
      push(`P${i+1}: ${sel||"—"} vs ${p||"—"}`, ok?1:0);
    });
  }
  if(Array.isArray(res?.qAnswers)){
    res.qAnswers.forEach((ans,i)=>{
      const sel=(bet.q?.[i]||"").trim();
      const ok=sel.toLowerCase()===(ans||"").trim().toLowerCase();
      push(`Pregunta ${i+1}: ${sel||"—"} vs ${ans||"—"}`, ok?1:0);
    });
  }
  const gotPole=res?.pole && bet.pole===res.pole;
  const gotAllPod=res?.podium && bet.podium?.every((p,i)=>p===res.podium[i]);
  const gotAllQ=res?.qAnswers && bet.q?.every((a,i)=>(a||"").trim().toLowerCase()===(res.qAnswers[i]||"").trim().toLowerCase());
  if(gotPole && gotAllPod) push("Bonus pole + podio",2);
  if(gotPole && gotAllPod && gotAllQ) push("Bonus pleno (pole+podio+preguntas)",2);
  if(!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length<3)) push("Penalización por apuesta incompleta",-1);
  if(bet.late) push("Penalización por fuera de plazo",-2);
  if(manualAdj!==0) push("Ajuste manual", manualAdj);
  return {points:pts, items};
}

const PILOT_COLORS={"Antonio":"#c4544e","Carlos":"#5a9abf","Pere":"#5fb8a8","Toni":"#c9874a","Manrique":"#9078b0"};
const FALLBACK_COLORS=["#c4544e","#5a9abf","#5fb8a8","#c9874a","#9078b0","#b8a84e","#b86b8a","#6aad6a","#5a9eb8","#8eb85a"];

function PositionEvolutionChart({db,races,scope,participants}){
  const chartData=useMemo(()=>{
    if(participants.length<2) return null;
    const withRes=(races||[]).filter(r=>db.results?.[r.key]);
    let target;
    if(scope==="all"){ target=withRes; }
    else{
      const allIdx=(races||[]).findIndex(r=>r.key===scope);
      target=withRes.filter(r=>{const ri=(races||[]).findIndex(rx=>rx.key===r.key); return ri<=allIdx;});
    }
    const bp=db.meta?.basePoints||{};
    const startPos={};
    const sorted=[...participants].sort();
    sorted.forEach((name,i)=>{startPos[name]=i+1;});
    const startEntry={race:{round:0,grand_prix:"Inicio"},positions:startPos,label:"🏁"};
    const evol=[startEntry];
    target.forEach((_race,ri)=>{
      const keysUpTo=target.slice(0,ri+1).map(r=>r.key);
      const racesUpTo=target.slice(0,ri+1);
      const gw=computeGPWins(db,racesUpTo,participants);
      const st=participants.map(name=>{
        const acc=keysUpTo.reduce((a,k)=>{const s=scoreForRace(db,k,name);a.points+=s.points;a.hits+=s.hits;a.exact+=s.exact;a.pen+=s.pen;return a;},{points:Number(bp[name]||0),hits:0,exact:0,pen:0});
        return{name,...acc,wins:gw[name]||0,avgSubmit:computeAvgSubmitTime(db,racesUpTo,name)};
      }).sort((A,B)=>B.points-A.points||B.wins-A.wins||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen||A.avgSubmit-B.avgSubmit);
      const pos={};st.forEach((s,i)=>{pos[s.name]=i+1;});
      evol.push({race:_race,positions:pos});
    });
    return evol;
  },[db,races,scope,participants]);

  if(!chartData||chartData.length<1) return null;
  const sorted=[...participants].sort();
  const colorOf=n=>PILOT_COLORS[n]||FALLBACK_COLORS[sorted.indexOf(n)%FALLBACK_COLORS.length];
  const nR=chartData.length;
  const nP=participants.length;
  const padL=28,padR=82,padT=22,padB=32;
  const colW=Math.max(48,280/nR);
  const chartW=nR>1?(nR-1)*colW:colW;
  const rowH=Math.max(26,160/nP);
  const chartH=nP>1?(nP-1)*rowH:rowH;
  const W=padL+chartW+padR,H=padT+chartH+padB;
  const xOf=i=>padL+(nR>1?(i/(nR-1))*chartW:chartW/2);
  const yOf=p=>padT+(nP>1?((p-1)/(nP-1))*chartH:chartH/2);

  const smooth=pts=>{
    if(pts.length<2) return `M${pts[0].x} ${pts[0].y}`;
    let d=`M${pts[0].x} ${pts[0].y}`;
    for(let i=1;i<pts.length;i++){
      const dx=(pts[i].x-pts[i-1].x)/3;
      d+=` C${pts[i-1].x+dx} ${pts[i-1].y} ${pts[i].x-dx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const lastEvol=chartData[nR-1];
  const endPositions=sorted.map(n=>({name:n,y:yOf(lastEvol.positions[n]||nP)}));
  endPositions.sort((a,b)=>a.y-b.y);
  const minGap=11;
  for(let i=1;i<endPositions.length;i++){
    if(endPositions[i].y-endPositions[i-1].y<minGap) endPositions[i].y=endPositions[i-1].y+minGap;
  }
  const labelY={};endPositions.forEach(e=>{labelY[e.name]=e.y;});

  return (
    <div className="card card-racing p-4 md:p-5">
      <h3 className="section-title mb-3">🏎️ Evolución de posiciones</h3>
      <div className="overflow-x-auto -mx-2 px-2">
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",minWidth:nR>6?`${nR*52}px`:"100%",height:"auto"}} className="block">
          {Array.from({length:nP},(_,i)=><line key={`g${i}`} x1={padL} y1={yOf(i+1)} x2={padL+chartW} y2={yOf(i+1)} stroke="rgba(255,255,255,.04)" strokeDasharray="2,4"/>)}
          {Array.from({length:nP},(_,i)=><text key={`yl${i}`} x={padL-5} y={yOf(i+1)+3} fill="rgba(255,255,255,.22)" fontSize="8" textAnchor="end" fontWeight="700">{i+1}º</text>)}
          {chartData.map((e,i)=><text key={`xl${i}`} x={xOf(i)} y={H-6} fill="rgba(255,255,255,.22)" fontSize="7" textAnchor="middle" fontWeight="600">{e.label||`R${e.race.round}`}</text>)}
          {sorted.map(name=>{
            const c=colorOf(name);
            const pts=chartData.map((e,i)=>({x:xOf(i),y:yOf(e.positions[name]||nP)}));
            return <path key={`l-${name}`} d={smooth(pts)} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" opacity=".6"/>;
          })}
          {sorted.map(name=>{
            const c=colorOf(name);
            const pts=chartData.map((e,i)=>({x:xOf(i),y:yOf(e.positions[name]||nP)}));
            return pts.map((p,i)=><circle key={`d-${name}-${i}`} cx={p.x} cy={p.y} r={i===nR-1?4:2.2} fill={c} opacity=".7" stroke="rgba(255,255,255,.15)" strokeWidth=".5"/>);
          })}
          {sorted.map(name=>{
            const c=colorOf(name);
            const lx=xOf(nR-1);
            const ly=yOf(lastEvol.positions[name]||nP);
            return <g key={`car-${name}`} transform={`translate(${lx+8},${ly})`}>
              <rect x="-1" y="-3" width="13" height="6" rx="2" fill={c} opacity=".7" stroke="rgba(255,255,255,.25)" strokeWidth=".5"/>
              <rect x="7" y="-4.5" width="4.5" height="2" rx=".6" fill={c} opacity=".5" stroke="rgba(255,255,255,.2)" strokeWidth=".4"/>
              <rect x="7" y="2.5" width="4.5" height="2" rx=".6" fill={c} opacity=".5" stroke="rgba(255,255,255,.2)" strokeWidth=".4"/>
              <rect x="1" y="-1.5" width="4" height="3" rx=".8" fill="rgba(255,255,255,.15)"/>
              <circle cx="1.5" cy="-4" r="1.3" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
              <circle cx="1.5" cy="4" r="1.3" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
              <circle cx="8.5" cy="-4" r="1.1" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
              <circle cx="8.5" cy="4" r="1.1" fill="#1a1a1a" stroke="rgba(255,255,255,.15)" strokeWidth=".3"/>
            </g>;
          })}
          {sorted.map(name=>{
            const c=colorOf(name);
            return <text key={`n-${name}`} x={padL+chartW+26} y={labelY[name]+3} fill={c} fontSize="8.5" fontWeight="600" opacity=".8">{name}</text>;
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-white/5">
        {sorted.map(name=><div key={name} className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:colorOf(name)}}></div><span className="text-white/50">{name}</span></div>)}
      </div>
    </div>
  );
}

function Ranking({db,races,setDb,currentUser}){
  const [scope,setScope]=useState("all"); const participants=Object.keys(db.participants||{});
  const isAdmin=!!db.users?.[currentUser]?.isAdmin;
  const forceAuto=!!db.meta?.forceAutoStandings;
  const backupDefaults={Antonio:0,Carlos:0,Manrique:0,Pere:0,Toni:0};
  const basePoints=db.meta?.basePoints||{};
  const baseEntries=Object.entries(basePoints).filter(([_,v])=>Number(v)>0);
  const manualStandings=useMemo(()=>{
    const entries=Object.entries(db.standings||{});
    if(!entries.length) return [];
    return entries.map(([name,info])=>({name,points:Number(info?.points||0),rank:info?.rank!=null?Number(info.rank):null}))
      .sort((a,b)=>{
        const rankA=a.rank??Infinity; const rankB=b.rank??Infinity;
        if(rankA!==rankB) return rankA-rankB;
        if(b.points!==a.points) return b.points-a.points;
        return a.name.localeCompare(b.name);
      });
  },[db.standings]);
  const computedData=useMemo(()=>{
    if(scope==="all"){
      const keys=(races||[]).map(r=>r.key);
      const gpWins=computeGPWins(db, races, participants);
      return participants.map(n=>{
        const acc=keys.reduce((a,k)=>{
          const s=scoreForRace(db,k,n);
          a.points+=s.points; a.hits+=s.hits; a.exact+=s.exact; a.pen+=s.pen; return a;
        },{points:Number(basePoints[n]||0),hits:0,exact:0,pen:0});
        return {name:n,...acc, wins:gpWins[n]||0, avgSubmit:computeAvgSubmitTime(db,races,n)};
      }).sort((A,B)=>B.points-A.points||B.wins-A.wins||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen||A.avgSubmit-B.avgSubmit);
    } else {
      const k=scope;
      return participants.map(n=>{const s=scoreForRace(db,k,n); return {name:n,points:s.points,hits:s.hits,exact:s.exact,pen:s.pen,wins:0};})
        .sort((A,B)=>B.points-A.points||B.exact-A.exact||B.hits-A.hits||A.pen-B.pen);
    }
  },[db,races,scope,participants,basePoints]);
  const manualActive=scope==="all" && manualStandings.length>0 && !forceAuto;
  const data=manualActive?manualStandings.map((item,idx)=>({name:item.name,points:item.points,wins:"—",hits:"—",exact:"—",pen:"—",manualRank:item.rank??(idx+1)})):computedData;
  const championships=db.meta?.championships||{};
  const champData=participants.map(name=>({name,titles:Number(championships[name]||0)})).sort((A,B)=>B.titles-A.titles||A.name.localeCompare(B.name));
  const resetManual=()=>{
    if(!setDb) return;
    if(!window.confirm("Volver a clasificación automática y sumar estos puntos como base?")) return;
    const baseFromManual=manualStandings.reduce((acc,item)=>{ acc[item.name]=Number(item.points||0); return acc; },{});
    setDb(prev=>{ const next={...prev, meta:{...(prev.meta||{}), basePoints:baseFromManual, forceAutoStandings:true}}; delete next.standings; return next; });
  };
  const updateBasePoint=(name,value)=>{
    if(!setDb) return;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const base={...(meta.basePoints||{})};
      base[name]=Number.isNaN(value)?0:value;
      return {...prev, meta:{...meta, basePoints:base}};
    });
  };
  const podiumIcon=i=>i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1;
  return (<div className="space-y-4">
    <div className="card card-racing p-4 md:p-5"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4"><h2 className="section-title text-lg">🏎️ Ranking F1 <span className="text-sm opacity-60">🍺</span></h2><select className="select select-strong border rounded-xl px-3 py-2" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Global</option>{(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix}</option>)}</select></div><div className="overflow-x-auto rounded-xl border border-white/5"><table className="text-sm w-full"><thead><tr><th className="text-left w-10"></th><th className="text-left">Piloto</th><th className="text-right">PTS</th>{scope==="all"&&<th className="text-right hidden sm:table-cell">Vict.</th>}<th className="text-right hidden sm:table-cell">Pod.</th><th className="text-right hidden sm:table-cell">Aciert.</th><th className="text-right hidden sm:table-cell">Pen.</th></tr></thead><tbody>{data.map((r,i)=>{const pos=manualActive?(r.manualRank||i+1):i+1;const isLast=i===data.length-1&&data.length>1;const pCls=i===0?"podium-1":i===1?"podium-2":i===2?"podium-3":isLast?"border-l-2 border-l-amber-600/30 bg-gradient-to-r from-amber-900/[.04] to-transparent":"";return(<tr key={r.name} className={pCls} style={i<3?{animationDelay:`${i*0.08}s`}:{}}><td className="text-white/50">{podiumIcon(i)}</td><td><div className="flex items-center gap-2.5"><Avatar name={r.name} avatar={db.meta?.avatars?.[r.name]} size="sm"/><div><span className={`font-semibold ${i===0?"text-white":""}`}>{r.name}</span>{isLast&&<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/15">🍺 paga las birras</span>}<div className="sm:hidden text-[11px] text-white/35 mt-0.5">{scope==="all"?`Vict:${r.wins} `:``}Pod:${r.exact} Aciert:${r.hits} Pen:${r.pen}</div></div></div></td><td className="text-right pts-cell">{r.points}</td>{scope==="all"&&<td className="text-right text-white/45 hidden sm:table-cell">{r.wins}</td>}<td className="text-right text-white/45 hidden sm:table-cell">{r.exact}</td><td className="text-right text-white/45 hidden sm:table-cell">{r.hits}</td><td className="text-right text-white/30 hidden sm:table-cell">{r.pen}</td></tr>)})}</tbody></table></div>{manualActive?<div className="text-xs text-amber-300 mt-3 flex flex-wrap items-center gap-2">Clasificación importada.<button className="px-2 py-1 rounded bg-slate-800 text-white" onClick={resetManual}>Usar automática</button></div>:<p className="text-[11px] text-white/35 mt-3">Desempates: puntos → victorias → podios exactos → aciertos → menos pen. → apuesta más temprana.</p>}{!manualActive && baseEntries.length>0 && <p className="text-[11px] text-emerald-300/50 mt-1">Incluye puntos base: {baseEntries.map(([n,v])=>`${n} ${v}`).join(" · ")}</p>}</div>
    <PositionEvolutionChart db={db} races={races} scope={scope} participants={participants}/>
    <RaceBreakdown db={db} races={races} raceKey={scope} rows={data} />
    <div className="card card-racing p-4 md:p-5"><h3 className="section-title mb-3">🏆 Campeonatos mundiales <span className="text-sm opacity-50">🍻</span></h3>{champData.length?(<ul className="space-y-2">{champData.map((item,idx)=>(<li key={item.name} className="flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900"><div className="flex items-center gap-2"><Avatar name={item.name} avatar={db.meta?.avatars?.[item.name]} size="sm"/><span className="font-medium">{idx+1}. {item.name}</span></div><span className="text-sm">{item.titles} 🏆</span></li>))}</ul>):(<p className="text-sm text-slate-300">No hay participantes registrados.</p>)}<p className="text-xs text-slate-400 mt-2">Se edita desde Admin &gt; Campeonatos mundiales.</p></div>
  </div>);
}
function RaceBreakdown({db,races,raceKey,rows}){
  if(!raceKey || raceKey==="all"){
    const latest=(races||[]).find(r=>db.results?.[r.key]);
    return <div className="card p-4 md:p-5"><h3 className="section-title">Detalle puntos</h3><p className="text-sm text-white/40 mt-2">{latest?"Selecciona un GP en el selector de arriba para ver su desglose.":"No hay resultados publicados aún."}</p></div>;
  }
  const race=(races||[]).find(r=>r.key===raceKey);
  const res=db.results?.[raceKey];
  if(!res) return <div className="card p-4 md:p-5"><h3 className="section-title">Detalle puntos — {race?.grand_prix||raceKey}</h3><p className="text-sm text-slate-300">Añade resultados oficiales para ver el desglose.</p></div>;
  const podium=res.podium||["","",""]; const questions=res.qAnswers||["","",""];
  return (
    <div className="card card-racing p-4 space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="section-title">Detalle — {race?.grand_prix||raceKey}</h3>
        <div className="text-sm text-slate-300">Oficial: Pole {res.pole||"—"} · Podio {podium.join(" · ")} · Preguntas {questions.join(" · ")}</div>
        <div className="text-xs text-slate-400">Desempates: puntos → victorias GP → podios exactos → aciertos → menos penalizaciones → apuesta más temprana.</div>
      </div>
      <div className="grid gap-3">
        {rows.map(row=>{
          const bet=db.bets?.[raceKey]?.[row.name];
          const manualAdj=db.scoreAdjustments?.[raceKey]?.[row.name]||0;
          const detail=describeBetAgainstResult(bet,res,manualAdj);
          return (
            <div key={row.name} className="border border-white/10 rounded p-3 bg-neutral-900">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Avatar name={row.name} avatar={db.meta?.avatars?.[row.name]} size="sm"/><span className="font-medium">{row.name}</span></div>
                <div className="text-sm">{row.points} pts {!bet && <span className="text-xs text-red-300 ml-2">(sin apuesta)</span>}{bet?.late && <span className="text-xs text-amber-300 ml-2">(fuera de plazo)</span>}</div>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {detail.items.map((item,idx)=>(<li key={idx} className="flex items-center justify-between border border-white/5 rounded px-2 py-1"><span>{item.label}</span><span className={`ml-2 ${item.delta>0?"text-emerald-300":item.delta<0?"text-amber-300":"text-slate-400"}`}>{item.delta>0?`+${item.delta}`:item.delta}</span></li>))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionsHistory({db,races}){
  return (<div className="card card-racing p-4 md:p-5 space-y-3"><h2 className="section-title">❓ Histórico de preguntas</h2>{(races||[]).map(r=>{ const qs=db.questions?.[r.key]||["","",""]; const st=db.questionsStatus?.[r.key]; const owner=db.questionOwner?.[r.key]||""; return (<div key={r.key} className="border border-white/10 rounded p-3 bg-neutral-900"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium min-w-0"><span className="break-words">{r.round}. {r.grand_prix}</span> <span className="text-slate-300 text-sm">— {r.date_local}</span></div><div className="flex-shrink-0">{st?.published?<span className="badge badge-green">Publicado</span>:<span className="badge badge-amber">Pendiente</span>}</div></div><div className="text-xs text-slate-300">Autor: {owner||"—"}</div>{st?.published?<ol className="list-decimal pl-5 text-sm">{qs.map((q,i)=><li key={i}>{q||"—"}</li>)}</ol>:<div className="text-sm text-slate-400">Aún no publicadas.</div>}</div>); })}</div>);
}

function Historico(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [year,setYear]=useState(2025);
  useEffect(()=>{ loadHistorical(year).then(setData).catch(e=>{ setError(e.message); setData(null); }).finally(()=>setLoading(false)); },[year]);
  useEffect(()=>{ setLoading(true); },[year]);
  if(loading) return <div className="card p-4"><p className="text-slate-300">Cargando histórico...</p></div>;
  if(error) return <div className="card p-4"><p className="text-amber-300">Error al cargar: {error}</p></div>;
  if(!data) return <div className="card p-4"><p className="text-slate-300">No hay datos históricos disponibles.</p></div>;
  const races=data.races||[];
  const hasStandings=!!data?.standings?.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="section-title text-lg">{data.title||`Porra F1 ${data.year}`}</h2>
        <select className="select border rounded px-3 py-2 text-sm" value={year} onChange={e=>setYear(Number(e.target.value))}>
          <option value={2025}>2025</option>
        </select>
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

// ===== F1 DATA ASSISTANT (Jolpica/Ergast API — datos desde 1950) =====
const JOLPICA="https://api.jolpi.ca/ergast/f1";
const _f1c={};
async function f1get(path){
  if(_f1c[path]) return _f1c[path];
  try{ const r=await fetch(`${JOLPICA}${path}`); if(!r.ok) return null; const d=await r.json(); _f1c[path]=d.MRData; return d.MRData; }catch{ return null; }
}
function nrm(s){return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function xYear(q){const m=q.match(/\b(19[5-9]\d|20[0-3]\d)\b/);return m?parseInt(m[1]):null;}

const DRV={
  "hamilton":"hamilton","lewis hamilton":"hamilton","lewis":"hamilton",
  "verstappen":"max_verstappen","max verstappen":"max_verstappen",
  "alonso":"alonso","fernando alonso":"alonso","fernando":"alonso","nano":"alonso",
  "leclerc":"leclerc","charles leclerc":"leclerc","charles":"leclerc",
  "sainz":"sainz","carlos sainz":"sainz",
  "norris":"norris","lando norris":"norris","lando":"norris",
  "piastri":"piastri","oscar piastri":"piastri",
  "russell":"russell","george russell":"russell",
  "perez":"perez","checo":"perez","sergio perez":"perez",
  "ricciardo":"ricciardo","daniel ricciardo":"ricciardo",
  "stroll":"stroll","lance stroll":"stroll",
  "gasly":"gasly","pierre gasly":"gasly",
  "ocon":"ocon","esteban ocon":"ocon",
  "bottas":"bottas","valtteri bottas":"bottas",
  "tsunoda":"tsunoda","yuki tsunoda":"tsunoda",
  "hulkenberg":"hulkenberg","hulk":"hulkenberg",
  "magnussen":"kevin_magnussen","kevin magnussen":"kevin_magnussen",
  "lawson":"lawson","liam lawson":"lawson",
  "bearman":"bearman","oliver bearman":"bearman",
  "colapinto":"colapinto","franco colapinto":"colapinto",
  "antonelli":"antonelli","kimi antonelli":"antonelli",
  "hadjar":"hadjar","isack hadjar":"hadjar",
  "doohan":"doohan","jack doohan":"doohan",
  "bortoleto":"bortoleto","gabriel bortoleto":"bortoleto",
  "albon":"albon","alex albon":"albon",
  "zhou":"zhou","guanyu zhou":"zhou",
  "vettel":"vettel","sebastian vettel":"vettel",
  "schumacher":"michael_schumacher","michael schumacher":"michael_schumacher",
  "raikkonen":"raikkonen","kimi raikkonen":"raikkonen",
  "prost":"prost","alain prost":"prost",
  "senna":"senna","ayrton senna":"senna",
  "lauda":"lauda","niki lauda":"lauda",
  "fangio":"fangio","juan manuel fangio":"fangio",
  "piquet":"piquet","nelson piquet":"piquet",
  "mansell":"mansell","nigel mansell":"mansell",
  "hakkinen":"hakkinen","mika hakkinen":"hakkinen",
  "damon hill":"damon_hill",
  "villeneuve":"jacques_villeneuve","jacques villeneuve":"jacques_villeneuve",
  "rosberg":"rosberg","nico rosberg":"rosberg",
  "button":"button","jenson button":"button",
  "massa":"massa","felipe massa":"massa",
  "webber":"webber","mark webber":"webber",
  "barrichello":"barrichello","rubens barrichello":"barrichello",
  "montoya":"montoya","juan pablo montoya":"montoya",
  "clark":"clark","jim clark":"clark",
  "stewart":"stewart","jackie stewart":"stewart",
  "hunt":"hunt","james hunt":"hunt",
  "kubica":"kubica","robert kubica":"kubica",
  "mick schumacher":"mick_schumacher",
  "grosjean":"grosjean","romain grosjean":"grosjean",
};
function mDrv(q){const e=Object.entries(DRV).sort((a,b)=>b[0].length-a[0].length);for(const[n,id] of e){if(q.includes(nrm(n))) return id;}return null;}

const CMAP={
  "espana":"spain","belgica":"belgium","hungria":"hungary","paises bajos":"netherlands","holanda":"netherlands",
  "japon":"japan","bahrein":"bahrain","gran bretana":"great britain","reino unido":"great britain",
  "alemania":"germany","francia":"france","italia":"italy","brasil":"brazil","canada":"canada","mexico":"mexico",
  "china":"china","australia":"australia","austria":"austria","turquia":"turkey","singapur":"singapore",
  "catar":"qatar","arabia saudi":"saudi arabia","arabia saudita":"saudi arabia",
  "azerbaiyan":"azerbaijan","abu dhabi":"abu dhabi","abu dabi":"abu dhabi",
  "estados unidos":"united states","eeuu":"united states","malasia":"malaysia",
  "corea":"korea","india":"india","sudafrica":"south africa",
};

async function fRace(year,gpText){
  const data=await f1get(`/${year}.json?limit=30`);
  if(!data?.RaceTable?.Races) return null;
  const races=data.RaceTable.Races, q=nrm(gpText);
  const terms=[q];
  for(const[es,en] of Object.entries(CMAP)){if(q.includes(nrm(es))) terms.push(nrm(en));}
  let best=null,bs=0;
  for(const race of races){
    const fs=[nrm(race.raceName),nrm(race.Circuit?.circuitName||""),nrm(race.Circuit?.Location?.country||""),nrm(race.Circuit?.Location?.locality||""),nrm(race.Circuit?.circuitId||"").replace(/_/g," ")];
    for(const t of terms){if(t.length<2) continue;for(const f of fs){
      if(f===t) return race;
      if(f.includes(t)&&t.length>=3){const s=t.length*2;if(s>bs){best=race;bs=s;}}
      if(t.includes(f)&&f.length>=3){const s=f.length;if(s>bs){best=race;bs=s;}}
    }}
  }
  return bs>=4?best:null;
}

function xGP(q){
  let m,c;
  const TAIL=/(?:\s+(?:en\s+)?(?:los\s+)?ultimos?\b|\s+desde\s|\s+entre\s|\s+durante\s|\s+historicamente\b|\s+a\s+lo\s+largo\b|\s+en\s+los\s+(?:ultimos|anos)|\s+\d{4}|\s*\?|$)/;
  const clean=s=>(s||"").replace(/\s+(en|de|del)\s*$/,"").trim();
  if(/\bcalendario\b|\btemporada\b/.test(q)&&!/\bgp\b|gran\s*premio/.test(q)) return null;
  m=q.match(new RegExp("(?:gp|gran\\s*premio)\\s+(?:de\\s+)?(?:la\\s+)?(.+?)"+TAIL.source));
  if(m&&(c=clean(m[1]))&&c.length>1) return c;
  m=q.match(new RegExp("\\ben\\s+(?:el\\s+)?(?:circuito\\s+(?:de\\s+)?)?(.+?)"+TAIL.source));
  if(m&&(c=clean(m[1]))&&c.length>2&&!mDrv(c)) return c;
  if(/resultado|podio|acabaron|terminaron|abandonos|vuelta\s*rapida|ganado.*mas|clasificacion|pole|qualy|coches/.test(q)){
    m=q.match(new RegExp("\\bde\\s+(.+?)"+TAIL.source));
    if(m&&(c=clean(m[1]))&&c.length>2&&!mDrv(c)) return c;
  }
  return null;
}

async function hResults(year,gpQ){
  if(!year) year=new Date().getFullYear();
  if(year>new Date().getFullYear()) return `La temporada ${year} aún no ha comenzado o no tiene resultados disponibles.`;
  const race=await fRace(year,gpQ);
  if(!race) return `No encontré "${gpQ}" en ${year}. Usa el nombre del país o ciudad.`;
  const d=await f1get(`/${year}/${race.round}/results.json?limit=30`);
  const res=d?.RaceTable?.Races?.[0]?.Results;
  if(!res?.length) return `No hay resultados para ${race.raceName} ${year}. Quizás aún no se ha corrido.`;
  const med={"1":"🥇","2":"🥈","3":"🥉"};
  let t=`🏁 ${race.raceName} ${year}\n📍 ${race.Circuit?.circuitName}, ${race.Circuit?.Location?.locality}\n\n`;
  res.slice(0,10).forEach(r=>{t+=`${med[r.position]||"  "} ${r.position}. ${r.Driver.givenName} ${r.Driver.familyName} (${r.Constructor.name}) — ${r.Time?.time||r.status}\n`;});
  const dnfs=res.filter(r=>r.status!=="Finished"&&!r.status.startsWith("+"));
  if(dnfs.length) t+=`\n❌ Abandonos (${dnfs.length}): ${dnfs.map(r=>`${r.Driver.familyName} (${r.status})`).join(", ")}`;
  const fl=res.find(r=>r.FastestLap?.rank==="1");
  if(fl) t+=`\n\n🟣 Vuelta rápida: ${fl.Driver.familyName} (${fl.FastestLap.Time?.time||"—"})`;
  return t;
}

async function hChampion(year,constr){
  if(!year) return "¿De qué año? Ej: '¿Quién fue campeón en 2023?'";
  const path=constr?`/${year}/constructorStandings.json?limit=30`:`/${year}/driverStandings.json?limit=30`;
  const d=await f1get(path);
  const list=constr?d?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings:d?.StandingsTable?.StandingsLists?.[0]?.DriverStandings;
  if(!list?.length) return `No hay datos del campeonato ${year}.`;
  const type=constr?"constructores":"pilotos";
  const med={"1":"🥇","2":"🥈","3":"🥉"};
  let t=`🏆 Campeonato de ${type} ${year}\n\n`;
  list.forEach(s=>{
    const n=constr?s.Constructor.name:`${s.Driver.givenName} ${s.Driver.familyName}`;
    const team=constr?"":` (${(s.Constructors||[]).map(c=>c.name).join(", ")})`;
    t+=`${med[s.position]||"  "} ${s.position}. ${n}${team} — ${s.points} pts`;
    if(s.wins!=="0") t+=` (${s.wins} victorias)`;
    t+="\n";
  });
  return t;
}

async function hCalendar(year){
  if(!year) year=new Date().getFullYear();
  const d=await f1get(`/${year}.json?limit=30`);
  const races=d?.RaceTable?.Races;
  if(!races?.length) return `No hay calendario para ${year}.`;
  let t=`📅 Calendario F1 ${year} (${races.length} carreras)\n\n`;
  races.forEach(r=>{t+=`${r.round}. ${r.raceName} — ${r.date}\n   📍 ${r.Circuit?.circuitName}, ${r.Circuit?.Location?.country}\n`;});
  return t;
}

async function hDriverStats(driverId){
  const info=await f1get(`/drivers/${driverId}.json`);
  const driver=info?.DriverTable?.Drivers?.[0];
  if(!driver) return "No encontré ese piloto en la base de datos.";
  const [wD,cD,sD,pD]=await Promise.all([
    f1get(`/drivers/${driverId}/results/1.json?limit=500`),
    f1get(`/drivers/${driverId}/driverStandings/1.json?limit=50`),
    f1get(`/drivers/${driverId}/seasons.json?limit=50`),
    f1get(`/drivers/${driverId}/qualifying/1.json?limit=500`),
  ]);
  const wins=wD?.RaceTable?.Races||[],champs=cD?.StandingsTable?.StandingsLists||[],seasons=sD?.SeasonTable?.Seasons||[],poles=pD?.RaceTable?.Races||[];
  let t=`🏎️ ${driver.givenName} ${driver.familyName}\n🌍 ${driver.nationality||"—"} | 🗓️ ${driver.dateOfBirth||"—"}`;
  if(driver.permanentNumber) t+=` | #${driver.permanentNumber}`;
  t+=`\n\n📊 Estadísticas:\n• Temporadas: ${seasons.length}`;
  if(seasons.length) t+=` (${seasons[0].season}–${seasons[seasons.length-1].season})`;
  t+=`\n• Victorias: ${wins.length}\n• Poles: ${poles.length}\n• Campeonatos: ${champs.length}`;
  if(champs.length) t+=` (${champs.map(s=>s.season).join(", ")})`;
  t+="\n";
  if(wins.length>0){t+=`\n🏆 Últimas 5 victorias:\n`;wins.slice(-5).reverse().forEach(r=>{t+=`• ${r.season} — ${r.raceName}\n`;});}
  return t;
}

async function hDriverSeason(year,driverId){
  if(!year) return "¿De qué año?";
  const d=await f1get(`/${year}/drivers/${driverId}/results.json?limit=30`);
  const races=d?.RaceTable?.Races||[];
  if(!races.length) return `No hay datos de este piloto en ${year}.`;
  const wins=races.filter(r=>r.Results?.[0]?.position==="1");
  const podiums=races.filter(r=>parseInt(r.Results?.[0]?.position)<=3);
  const drv=races[0].Results[0].Driver, team=races[0].Results[0].Constructor?.name||"—";
  let t=`🏎️ ${drv.givenName} ${drv.familyName} — Temporada ${year}\n🏁 Equipo: ${team}\n\n`;
  t+=`📊 ${races.length} carreras disputadas\n🏆 Victorias: ${wins.length}\n🥇🥈🥉 Podios: ${podiums.length}\n`;
  if(wins.length){t+=`\nVictorias:\n`;wins.forEach(r=>t+=`• ${r.raceName}\n`);}
  const st=await f1get(`/${year}/drivers/${driverId}/driverStandings.json`);
  const standing=st?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0];
  if(standing) t+=`\n📊 Clasificación final: ${standing.position}º — ${standing.points} pts`;
  return t;
}

async function hFinishers(year,gpQ){
  if(!year) year=new Date().getFullYear();
  if(year>new Date().getFullYear()) return `La temporada ${year} aún no ha comenzado o no tiene resultados.`;
  const race=await fRace(year,gpQ);
  if(!race) return `No encontré "${gpQ}" en ${year}.`;
  const d=await f1get(`/${year}/${race.round}/results.json?limit=30`);
  const res=d?.RaceTable?.Races?.[0]?.Results;
  if(!res?.length) return `No hay resultados para ${race.raceName} ${year}. Quizás aún no se ha corrido.`;
  const fin=res.filter(r=>r.status==="Finished"||r.status.startsWith("+")),dnfs=res.filter(r=>r.status!=="Finished"&&!r.status.startsWith("+"));
  let t=`🏁 ${race.raceName} ${year}\n\n✅ Acabaron: ${fin.length} de ${res.length}\n❌ No acabaron: ${dnfs.length}\n`;
  if(dnfs.length){t+=`\nAbandonos:\n`;dnfs.forEach(r=>t+=`• ${r.Driver.givenName} ${r.Driver.familyName} (${r.Constructor.name}) — ${r.status}\n`);}
  return t;
}

async function hFinishersMulti(gpQ,numYears){
  const cy=new Date().getFullYear();
  let circuitId=null,raceName=gpQ;
  for(let y=cy;y>=cy-10;y--){const race=await fRace(y,gpQ);if(race){circuitId=race.Circuit.circuitId;raceName=race.raceName;break;}}
  if(!circuitId) return `No encontré el circuito "${gpQ}".`;
  let t=`🏁 ${raceName} — Últimos ${numYears} años\n\n`;
  let found=0;
  for(let y=cy;y>=1950&&found<numYears;y--){
    const race=await fRace(y,gpQ);
    if(!race) continue;
    const d=await f1get(`/${y}/${race.round}/results.json?limit=30`);
    const res=d?.RaceTable?.Races?.[0]?.Results;
    if(!res?.length) continue;
    found++;
    const fin=res.filter(r=>r.status==="Finished"||r.status.startsWith("+"));
    const dnfs=res.filter(r=>r.status!=="Finished"&&!r.status.startsWith("+"));
    const winner=res[0];
    t+=`${y}: ✅ ${fin.length}/${res.length} acabaron, ❌ ${dnfs.length} abandonos`;
    if(winner) t+=` | 🏆 ${winner.Driver.familyName}`;
    t+="\n";
  }
  if(!found) return `No hay resultados históricos para "${gpQ}".`;
  return t;
}

async function hResultsMulti(gpQ,numYears){
  const cy=new Date().getFullYear();
  let circuitId=null,raceName=gpQ;
  for(let y=cy;y>=cy-10;y--){const race=await fRace(y,gpQ);if(race){circuitId=race.Circuit.circuitId;raceName=race.raceName;break;}}
  if(!circuitId) return `No encontré el circuito "${gpQ}".`;
  let t=`🏁 ${raceName} — Últimos ${numYears} años\n\n`;
  let found=0;
  for(let y=cy;y>=1950&&found<numYears;y--){
    const race=await fRace(y,gpQ);
    if(!race) continue;
    const d=await f1get(`/${y}/${race.round}/results.json?limit=30`);
    const res=d?.RaceTable?.Races?.[0]?.Results;
    if(!res?.length) continue;
    found++;
    const top3=res.slice(0,3);
    t+=`${y}: ${top3.map((r,i)=>["🥇","🥈","🥉"][i]+` ${r.Driver.familyName}`).join(" ")}`;
    const fl=res.find(r=>r.FastestLap?.rank==="1");
    if(fl) t+=` | 🟣 ${fl.Driver.familyName}`;
    t+="\n";
  }
  if(!found) return `No hay resultados históricos para "${gpQ}".`;
  return t;
}

async function hQualifying(year,gpQ){
  if(!year) year=new Date().getFullYear();
  const race=await fRace(year,gpQ);
  if(!race) return `No encontré "${gpQ}" en ${year}.`;
  const d=await f1get(`/${year}/${race.round}/qualifying.json?limit=30`);
  const res=d?.RaceTable?.Races?.[0]?.QualifyingResults;
  if(!res?.length) return `No hay datos de clasificación para ${race.raceName} ${year}.`;
  let t=`⏱️ Clasificación — ${race.raceName} ${year}\n\n`;
  res.slice(0,20).forEach(r=>{t+=`${r.position}. ${r.Driver.givenName} ${r.Driver.familyName} (${r.Constructor.name}) — ${r.Q3||r.Q2||r.Q1||"—"}\n`;});
  t+=`\n🟡 Pole: ${res[0].Driver.givenName} ${res[0].Driver.familyName}`;
  return t;
}

async function hFastestLap(year,gpQ){
  if(!year) year=new Date().getFullYear();
  const race=await fRace(year,gpQ);
  if(!race) return `No encontré "${gpQ}" en ${year}.`;
  const d=await f1get(`/${year}/${race.round}/results.json?limit=30`);
  const res=d?.RaceTable?.Races?.[0]?.Results;
  if(!res?.length) return `No hay datos para ${race.raceName} ${year}.`;
  const fl=res.find(r=>r.FastestLap?.rank==="1");
  if(!fl?.FastestLap) return `No hay datos de vuelta rápida para ${race.raceName} ${year}.`;
  let t=`🟣 Vuelta rápida — ${race.raceName} ${year}\n\n`;
  t+=`Piloto: ${fl.Driver.givenName} ${fl.Driver.familyName} (${fl.Constructor.name})\n`;
  t+=`Tiempo: ${fl.FastestLap.Time?.time||"—"}\nVuelta: ${fl.FastestLap.lap||"—"}\n`;
  if(fl.FastestLap.AverageSpeed) t+=`Velocidad media: ${fl.FastestLap.AverageSpeed.speed} ${fl.FastestLap.AverageSpeed.units}`;
  return t;
}

async function hGPHistory(gpQ){
  const cy=new Date().getFullYear();let circuitId=null;
  for(let y=cy;y>=cy-10;y--){const race=await fRace(y,gpQ);if(race){circuitId=race.Circuit.circuitId;break;}}
  if(!circuitId) return `No encontré el circuito "${gpQ}".`;
  const d=await f1get(`/circuits/${circuitId}/results/1.json?limit=200`);
  const races=d?.RaceTable?.Races;
  if(!races?.length) return `No hay historial para "${gpQ}".`;
  const wbd={};races.forEach(r=>{const w=r.Results?.[0];if(w){const n=`${w.Driver.givenName} ${w.Driver.familyName}`;wbd[n]=(wbd[n]||0)+1;}});
  const sorted=Object.entries(wbd).sort((a,b)=>b[1]-a[1]);
  let t=`🏆 Historial — ${races[0]?.raceName||gpQ}\n📊 ${races.length} ediciones (${races[0]?.season}–${races[races.length-1]?.season})\n\n`;
  t+=`Más victorias:\n`;sorted.slice(0,10).forEach(([n,c],i)=>t+=`${i+1}. ${n} — ${c} victoria${c>1?"s":""}\n`);
  t+=`\n📋 Últimos 5 ganadores:\n`;races.slice(-5).reverse().forEach(r=>{const w=r.Results?.[0];t+=`• ${r.season}: ${w?`${w.Driver.givenName} ${w.Driver.familyName}`:"—"}\n`;});
  return t;
}

async function hDriverAtGP(driverId,gpQ){
  const cy=new Date().getFullYear();let circuitId=null;
  for(let y=cy;y>=cy-10;y--){const race=await fRace(y,gpQ);if(race){circuitId=race.Circuit.circuitId;break;}}
  if(!circuitId) return `No encontré "${gpQ}".`;
  const d=await f1get(`/drivers/${driverId}/circuits/${circuitId}/results.json?limit=50`);
  const races=d?.RaceTable?.Races||[];
  if(!races.length) return `No hay resultados de este piloto en ${gpQ}.`;
  const info=await f1get(`/drivers/${driverId}.json`);
  const drv=info?.DriverTable?.Drivers?.[0];
  const name=drv?`${drv.givenName} ${drv.familyName}`:driverId;
  const wins=races.filter(r=>r.Results?.[0]?.position==="1").length;
  const pods=races.filter(r=>parseInt(r.Results?.[0]?.position)<=3).length;
  let t=`🏎️ ${name} en ${races[0]?.raceName||gpQ}\n📊 ${races.length} participaciones | 🏆 ${wins} victorias | 🥇🥈🥉 ${pods} podios\n\n`;
  t+=`Últimas 5:\n`;
  races.slice(-5).reverse().forEach(r=>{const rs=r.Results?.[0];t+=`• ${r.season}: P${rs?.position||"—"} (${rs?.Constructor?.name||"—"}) — ${rs?.Time?.time||rs?.status||"—"}\n`;});
  return t;
}

async function hTeammates(year,driverId){
  if(!year) year=new Date().getFullYear();
  const d=await f1get(`/${year}/drivers/${driverId}/results.json?limit=30`);
  const races=d?.RaceTable?.Races||[];
  if(!races.length) return `No hay datos de este piloto en ${year}.`;
  const team=races[0].Results[0].Constructor;
  const td=await f1get(`/${year}/constructors/${team.constructorId}/drivers.json`);
  const drivers=td?.DriverTable?.Drivers||[];
  const drv=races[0].Results[0].Driver;
  const teammates=drivers.filter(d=>d.driverId!==driverId);
  let t=`🏎️ ${drv.givenName} ${drv.familyName} — ${team.name} ${year}\n\n`;
  if(teammates.length){t+=`Compañero${teammates.length>1?"s":""} de equipo:\n`;teammates.forEach(tm=>t+=`• ${tm.givenName} ${tm.familyName}\n`);}
  else t+=`No se encontraron compañeros de equipo.`;
  return t;
}

const F1_HELP=`¡Biip! No he pillado esa. Prueba algo así:\n\n🏆 "¿Quién fue campeón en 2023?"\n🏁 "Resultados GP Mónaco 2024"\n📊 "Clasificación mundial 2024"\n🏎️ "Victorias de Alonso"\n📅 "Calendario 2025"\n❓ "Coches que acabaron en Australia últimos 5 años"\n⏱️ "Clasificación GP Bahréin 2024"\n🟣 "Vuelta rápida Monza 2023"\n🏆 "¿Quién ha ganado más en Silverstone?"\n👥 "Compañero de Hamilton en 2019"\n🗓️ "Hamilton en 2020"\n📍 "Alonso en Mónaco"\n📊 "Resultados en Mónaco últimos 10 años"`;

function xMultiYear(q){
  let m;
  m=q.match(/ultimos?\s+(\d+)\s+anos/);if(m) return parseInt(m[1]);
  m=q.match(/(\d+)\s+ultimos?\s+anos/);if(m) return parseInt(m[1]);
  if(/ultimos?\s+anos|los\s+anos|historicamente|a\s+lo\s+largo/.test(q)) return 10;
  m=q.match(/desde\s+(19[5-9]\d|20[0-2]\d)/);if(m) return new Date().getFullYear()-parseInt(m[1])+1;
  m=q.match(/entre\s+(19[5-9]\d|20[0-2]\d)\s+y\s+(19[5-9]\d|20[0-2]\d)/);if(m) return parseInt(m[2])-parseInt(m[1])+1;
  return 0;
}

async function processF1Query(question){
  const q=nrm(question),year=xYear(q),drv=mDrv(q),gp=xGP(q),multi=xMultiYear(q);

  if(/\bcalendario\b/.test(q)||(/\btemporada\b/.test(q)&&!drv&&!gp)) return hCalendar(year);

  if(/\bproxim[ao]\b.*\bcarrera\b|\bsiguiente\b.*\bcarrera\b|\bnext\b.*\brace\b/.test(q)){
    const cy=year||new Date().getFullYear();const d=await f1get(`/${cy}.json?limit=30`);
    const races=d?.RaceTable?.Races||[],today=new Date().toISOString().split("T")[0];
    const next=races.find(r=>r.date>=today);
    if(!next) return `No quedan carreras en ${cy}.`;
    return `📅 Próxima carrera:\n\n${next.round}. ${next.raceName}\n📍 ${next.Circuit?.circuitName}, ${next.Circuit?.Location?.country}\n🗓️ ${next.date}`;
  }

  if(/\bultim[ao]\b.*\bcarrera\b|\blast\b.*\brace\b/.test(q)){
    const cy=year||new Date().getFullYear();const d=await f1get(`/${cy}.json?limit=30`);
    const races=d?.RaceTable?.Races||[],today=new Date().toISOString().split("T")[0];
    const past=races.filter(r=>r.date<today);
    if(!past.length) return `Aún no hay carreras en ${cy}.`;
    return hResults(cy,nrm(past[past.length-1].raceName));
  }

  if(/\bconstructor/.test(q)&&/\bcampeon|\bmundial|\bclasificacion|\branking|\bstanding/.test(q)) return hChampion(year,true);
  if(!drv&&/\bcampeon|\bmundial\b|\bwdc\b|\btitulo\b/.test(q)) return hChampion(year,false);
  if(/\bclasificacion\b.*\b(mundial|general|piloto)|\branking\b.*\b(mundial|general)\b/.test(q)&&!gp) return hChampion(year,false);

  if(gp&&multi>1&&/\bcuantos\b.*\bcoches\b|\bacabaron\b|\bterminaron\b|\babandonos?\b|\bdnf\b|\bretir/.test(q)) return hFinishersMulti(gp,multi);
  if(gp&&multi>1&&/\bquien\b.*\bgano\b|\bganador|\bresultado|\bpodio/.test(q)) return hResultsMulti(gp,multi);
  if(gp&&multi>1) return hFinishersMulti(gp,multi);

  if(gp&&/\bcuantos\b.*\bcoches\b|\bacabaron\b|\bterminaron\b|\babandonos?\b|\bdnf\b|\bretir/.test(q)) return hFinishers(year,gp);
  if(gp&&(/\bqualy\b|\bqualifying\b/.test(q)||(/\bclasificacion\b/.test(q)&&!/\bmundial|\bgeneral|\bpiloto|\bconstructor/.test(q)))) return hQualifying(year,gp);
  if(gp&&/\bpole\b/.test(q)) return hQualifying(year,gp);
  if(gp&&/\bvuelta\b.*\brapida\b|\bfastest\b.*\blap\b/.test(q)) return hFastestLap(year,gp);
  if(gp&&(/\bhistoria|\bhistorial|\bmas\s+veces|\bganadores/.test(q)||/\bquien\b.*\bha\b.*\bganado\b.*\bmas\b/.test(q))) return hGPHistory(gp);
  if(gp&&/\bquien\b.*\bgano\b|\bganador|\bresultado|\bpodio/.test(q)) return hResults(year,gp);

  if(drv&&/\bcompaner|\bteammate/.test(q)) return hTeammates(year,drv);
  if(drv&&gp) return hDriverAtGP(drv,gp);
  if(drv&&year&&/\bvictoria|\bganado|\bganar|\bwin|\bcarrera|\btemporada/.test(q)) return hDriverSeason(year,drv);
  if(drv&&/\bvictoria|\bganado|\bganar|\bwin|\bpalmares|\bstats|\bestadistic/.test(q)) return hDriverStats(drv);
  if(drv&&/\bcampeon|\bmundial|\btitulo/.test(q)) return hDriverStats(drv);
  if(drv&&year) return hDriverSeason(year,drv);
  if(drv) return hDriverStats(drv);

  if(gp&&year) return hResults(year,gp);
  if(gp) return hGPHistory(gp);

  return F1_HELP;
}

const F1_SUGG=[
  "¿Quién fue campeón en 2024?","Resultados GP Mónaco 2024","Clasificación mundial 2023",
  "Victorias de Alonso","Calendario 2026","Coches que acabaron en Australia últimos 5 años",
  "Clasificación GP Bahréin 2024","Vuelta rápida Monza 2023","¿Quién ha ganado más en Silverstone?",
  "Hamilton temporada 2020","Constructores 2023","Próxima carrera",
  "Alonso en Mónaco","Compañero de Leclerc en 2024",
];

function AIAssistant({open,onClose,races}){
  const [input,setInput]=useState("");
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);
  useEffect(()=>{if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight;},[messages,loading]);
  const ask=async(text)=>{
    const q=(text||input||"").trim();if(!q||loading) return;
    setInput("");setMessages(prev=>[...prev,{role:"user",text:q}]);setLoading(true);
    try{const answer=await processF1Query(q);setMessages(prev=>[...prev,{role:"assistant",text:answer}]);}
    catch(err){setMessages(prev=>[...prev,{role:"assistant",text:"Error al consultar datos. Inténtalo de nuevo."}]);}
    finally{setLoading(false);}
  };
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:justify-end p-0 md:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}/>
      <div className="relative w-full md:max-w-lg max-h-[100vh] md:max-h-[85vh] flex flex-col bg-[#12141b] border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-semibold flex items-center gap-2"><img src="./assets/manribot.svg" alt="" className="w-7 h-7 inline-block"/> ManriBot</h2>
          <div className="flex items-center gap-2">
            <button className="text-xs text-slate-500 hover:text-slate-300" onClick={()=>setMessages([])}>Limpiar</button>
            <button className="text-slate-400 hover:text-white p-1" onClick={onClose}>✕</button>
          </div>
        </div>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.length===0 && (
            <div>
              <p className="text-sm text-slate-300 mb-3">¡Biip boop! Soy <b>ManriBot</b>, tu enciclopedia F1 con tanto dato inútil como Manrique. Pregúntame lo que quieras: resultados, campeonatos, pilotos, circuitos...</p>
              <p className="text-xs text-slate-500 mb-3">Datos desde 1950 hasta hoy · Jolpica/Ergast API</p>
              <div className="flex flex-wrap gap-1.5">
                {F1_SUGG.slice(0,8).map((s,i)=>(
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
          {loading && <div className="rounded-xl p-3 bg-emerald-900/20 border border-emerald-500/10 mr-4"><p className="text-sm text-slate-300 animate-pulse">Consultando datos de F1...</p></div>}
        </div>
        {messages.length>0 && (
          <div className="px-4 pb-1">
            <div className="flex flex-wrap gap-1">
              {F1_SUGG.slice(0,4).map((s,i)=>(
                <button key={i} className="text-xs px-2.5 py-1 rounded bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors" onClick={()=>ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input className="flex-1 border border-white/20 rounded-xl px-3 py-2 bg-neutral-900 text-white text-sm placeholder:text-slate-500" style={{color:"#f0f0f5"}} placeholder="Pregunta a ManriBot..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask();}}}/>
            <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm disabled:opacity-50" onClick={()=>ask()} disabled={loading||!input.trim()}>Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stats({db,races}){
  const stats=useMemo(()=>buildStats(db,races),[db,races]);
  const renderList=(items,emptyLabel,formatter)=> items?.length ? (
    <ul className="space-y-1 text-sm mt-1">{items.map((item,idx)=><li key={idx} className="flex items-center justify-between border border-white/10 rounded px-2 py-1 bg-neutral-900"><span>{idx+1}. {formatter?formatter(item):item.name}</span><span className="text-xs text-slate-300">{item.value!=null?item.value:""}</span></li>)}</ul>
  ) : (<p className="text-sm text-slate-400">{emptyLabel}</p>);
  return (
    <div className="space-y-4">
      <div className="card card-racing p-4 md:p-5 space-y-3">
        <h2 className="section-title">📊 Estadísticas <span className="text-xs opacity-40">· el que pierda, invita</span></h2>
        <p className="text-[11px] text-white/30">Solo carreras con resultados publicados.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
            <h3 className="font-semibold mb-1">Más carreras ganadas</h3>
            {renderList(stats.winners,"Aún no hay ganadores registrados.",(item)=>`${item.name}`)} 
            <h3 className="font-semibold mt-3 mb-1">Plenos (pole+podio+preguntas)</h3>
            {renderList(stats.fulls,"Nadie ha hecho pleno todavía.",(item)=>`${item.name}`)}
            <h3 className="font-semibold mt-3 mb-1">Más aciertos totales</h3>
            {renderList(stats.hitsLeaders,"Sin aciertos calculados.",(item)=>`${item.name}`)}
          </div>
          <div className="rounded-xl p-3 bg-white/[.02] border border-white/[.06]">
            <h3 className="font-semibold mb-1">Mejores jornadas</h3>
            {stats.bestScores?.length ? (<ul className="space-y-1 text-sm mt-1">{stats.bestScores.map((row,idx)=>(<li key={idx} className="border border-white/10 rounded px-2 py-1 bg-neutral-900 flex items-center justify-between"><span>{row.name} — {row.race}</span><span className="text-xs text-emerald-300">{row.points} pts</span></li>))}</ul>) : (<p className="text-sm text-slate-400">Todavía no hay resultados.</p>)}
            <h3 className="font-semibold mt-3 mb-1">Peores jornadas</h3>
            {stats.worstScores?.length ? (<ul className="space-y-1 text-sm mt-1">{stats.worstScores.map((row,idx)=>(<li key={idx} className="border border-white/10 rounded px-2 py-1 bg-neutral-900 flex items-center justify-between"><span>{row.name} — {row.race}</span><span className="text-xs text-amber-300">{row.points} pts</span></li>))}</ul>) : (<p className="text-sm text-slate-400">Sin resultados negativos registrados.</p>)}
          </div>
        </div>
        <div className="border border-white/10 rounded p-3 bg-neutral-900">
          <h3 className="font-semibold mb-2">Pilotos más votados</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-slate-400">Pole</div>
              {renderList(stats.votePole,"Sin votos en pole.",(item)=>item.name)}
            </div>
            <div>
              <div className="text-xs text-slate-400">Ganador (P1)</div>
              {renderList(stats.voteP1,"Sin apuestas en P1.",(item)=>item.name)}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            <div>
              <div className="text-xs text-slate-400">Segundo (P2)</div>
              {renderList(stats.voteP2,"Sin apuestas en P2.",(item)=>item.name)}
            </div>
            <div>
              <div className="text-xs text-slate-400">Tercero (P3)</div>
              {renderList(stats.voteP3,"Sin apuestas en P3.",(item)=>item.name)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleCard({icon,text}){
  return (
    <div className="flex gap-3 items-start p-3.5 rounded-xl bg-white/[.025] border border-white/[.06] hover:bg-white/[.05] hover:border-white/[.1] transition-all group">
      <span className="text-xl flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-sm text-white/65 leading-relaxed">{text}</span>
    </div>
  );
}

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
    {icon:"⚽",text:"4 partidos por jornada: Madrid, Barça, Real Sociedad y Sporting. Si se enfrentan entre ellos, mete partido(s) de reserva hasta llegar a 4."},
    {icon:"⏰",text:"Límite para apostar: viernes 15:00 (marcadores + respuestas a 3 preguntas). Se puede apostar fuera de plazo, pero conlleva penalización."},
    {icon:"🎯",text:"Puntos partidos: 3 por resultado exacto, 1 por acertar el signo (1X2), 0 si fallas."},
    {icon:"❓",text:"Preguntas extra: 3 por jornada, cada acierto vale 2 puntos. Máximo jornada = 18 puntos."},
    {icon:"⚠️",text:"Apuesta fuera de plazo: -2 puntos. No apostar en una jornada: -3 puntos. Con 3 jornadas sin apostar → eliminado. Las penalizaciones se aplican automáticamente."},
    {icon:"💥",text:"Apuestas catastróficas (0 puntos en todo, dentro de plazo): -1 punto extra en la general."},
  ];
  const tiebreakers=[
    {icon:"1️⃣",text:"Puntos totales: más puntos gana."},
    {icon:"2️⃣",text:"Jornadas ganadas: quien haya sido el mejor puntuado en más jornadas individuales (sin compartir)."},
    {icon:"3️⃣",text:"Más resultados exactos acumulados."},
    {icon:"4️⃣",text:"Más preguntas acertadas."},
    {icon:"5️⃣",text:"Más signos (1X2) acertados."},
    {icon:"6️⃣",text:"Menos jornadas sin apostar o fuera de plazo."},
    {icon:"7️⃣",text:"Menor diferencia de goles acumulada: suma de |predicción - resultado| en todos los partidos. Premia al que estuvo más cerca incluso sin acertar exacto."},
  ];
  return (
    <div className="space-y-4">
      <div className="card card-racing p-5 space-y-4">
        <h2 className="section-title text-lg">📋 Normas Porra Fútbol <span className="text-sm opacity-50">🍺</span></h2>
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

function FutbolBetForm({jornada,bet,disabled,onSubmit,late}){
  const matches=jornada?.matches||[];
  const initialScores=()=>matches.map((_,idx)=>({home:bet?.matches?.[idx]?.home??"", away:bet?.matches?.[idx]?.away??""}));
  const [scores,setScores]=useState(initialScores);
  const [qs,setQs]=useState(()=>[...(bet?.questions||["","",""])]);
  useEffect(()=>{ setScores(initialScores()); setQs([...(bet?.questions||["","",""])]); },[bet,jornada?.id,matches.length]);
  const handleScoreChange=(idx,field,val)=>{
    setScores(prev=>prev.map((s,i)=> i===idx ? {...s, [field]: val===""?"" : val} : s));
  };
  const submit=(e)=>{
    e.preventDefault();
    const parsedScores=scores.map(s=>({home:s.home===""||s.home==null?null:Number(s.home), away:s.away===""||s.away==null?null:Number(s.away)}));
    onSubmit({matches:parsedScores, questions:qs});
  };
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="space-y-2">
        {matches.map((m,idx)=>(
          <div key={idx} className="border border-emerald-500/10 rounded-xl p-3 bg-white/[.02] hover:bg-white/[.04] transition-colors">
            <div className="text-sm font-semibold mb-2 text-white/80">⚽ Partido {idx+1}: <span className="text-emerald-300/80">{m.home||"Local"}</span> vs <span className="text-emerald-300/80">{m.away||"Visitante"}</span></div>
            <div className="grid grid-cols-2 gap-3">
              <input disabled={disabled} type="number" min="0" className="select border rounded-xl px-3 py-2" placeholder="Goles local" value={scores[idx]?.home} onChange={e=>handleScoreChange(idx,"home",e.target.value)} />
              <input disabled={disabled} type="number" min="0" className="select border rounded-xl px-3 py-2" placeholder="Goles visitante" value={scores[idx]?.away} onChange={e=>handleScoreChange(idx,"away",e.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold text-white/60 uppercase tracking-wider">Preguntas</div>
        <div className="grid gap-2 md:grid-cols-3">
          {[0,1,2].map(i=>(
            <input key={i} disabled={disabled} className="select border rounded-xl px-3 py-2" placeholder={`Respuesta ${i+1}`} value={qs[i]||""} onChange={e=>setQs(prev=>{ const next=[...(prev||["","",""])]; next[i]=e.target.value; return next; })} />
          ))}
        </div>
      </div>
      <button disabled={disabled} className={`mt-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${disabled?"bg-white/5 text-white/30 border border-white/5":late?"bg-amber-600/20 text-amber-100 border border-amber-500/30 hover:bg-amber-600/30 shadow-lg shadow-amber-500/10":"bg-emerald-600/20 text-emerald-100 border border-emerald-500/30 hover:bg-emerald-600/30 shadow-lg shadow-emerald-500/10"}`}>{disabled?"⏳ Cerrado por admin":late?"⚠️ Guardar apuesta (fuera de plazo, -2 pts)":"✅ Guardar apuesta"}</button>
    </form>
  );
}

function FutbolParticipante({user,db,setDb}){
  const [now,setNow]=useState(()=>new Date());
  const [showOthers,setShowOthers]=useState(false);
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),30000); return ()=>clearInterval(id); },[]);
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const [selected,setSelected]=useState(()=>jornadas[0]?.id||"");
  useEffect(()=>{ if(!selected && jornadas.length) setSelected(jornadas[0].id); },[selected,jornadas]);
  const jornada=jornadas.find(j=>j.id===selected);
  const deadline=jornada?.deadline?new Date(jornada.deadline):null;
  const manualWindow=futbol.betsWindow?.[selected];
  const manualReveal=futbol.betsReveal?.[selected];
  const isBeforeDeadline=deadline ? now<deadline : true;
  const isFutbolLate=deadline ? now>=deadline : false;
  const canEdit=manualWindow?.forceClosed?false:true;
  const revealAt=deadline?new Date(deadline.getTime()+60*1000):null;
  const canViewFull=manualReveal?.forceShow || (!!revealAt && now>revealAt);
  const bet=jornada ? (futbol.bets?.[selected]?.[user]||{matches:[],questions:["","",""],submittedAt:null,late:false}) : null;
  const res=jornada ? futbol.results?.[selected] : null;
  const others=Object.keys(db.participants||{}).filter(n=>n!==user).map(name=>({name,bet:jornada?futbol.bets?.[selected]?.[name]:null}));
  const myScore=jornada && res ? scoreFutbolJornada(db,selected,user) : null;
  const betsStatus=jornada ? (manualWindow?.forceClosed?"Cerrado por admin":(isFutbolLate?`Fuera de plazo (penalización -2 pts)`:(deadline?`Cierre: ${formatDateTime(deadline,MADRID_TZ)}`:"Abierto"))) : "—";
  const saveBet=(payload)=>{
    if(!jornada) return;
    const ts=nowISO();
    const late=deadline ? new Date()>=deadline : false;
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const raceBets={...(futbolPrev.bets?.[selected]||{})};
      const prevBet=raceBets[user];
      const nextBet={...prevBet, matches:payload.matches, questions:payload.questions, submittedAt:ts, late};
      const nextBets={...(futbolPrev.bets||{}), [selected]:{...raceBets, [user]:nextBet}};
      let betHistory=futbolPrev.betHistory||{};
      const sameMatch=JSON.stringify(prevBet?.matches||[])===JSON.stringify(payload.matches||[]);
      const sameQ=(prevBet?.questions||[]).join("|")===(payload.questions||[]).join("|");
      if(!prevBet || !sameMatch || !sameQ || (!!prevBet?.late)!==late){
        const raceHistory={...(betHistory[selected]||{})};
        const logs=[...(raceHistory[user]||[])];
        logs.push({ts:ts,matches:payload.matches,questions:payload.questions,late});
        betHistory={...betHistory,[selected]:{...raceHistory,[user]:logs}};
      }
      return {...prev, futbol:{...futbolPrev, bets:nextBets, betHistory}};
    });
    late?toast.warn("Apuesta registrada (fuera de plazo: penalización -2 pts)"):toast.success("Apuesta guardada correctamente");
  };
  const showOthersPanel=showOthers && !!jornada;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]":"";
  return (
    <div className={`grid gap-4 ${layoutCols}`}>
      <div className="card card-racing p-4 md:p-5 min-w-0">
        <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title">⚽ Tu apuesta <span className="text-xs opacity-40">· por las birras</span></h2>
          {jornada && (<button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar":"Ver otras apuestas"}</button>)}
        </div>
        <select className="select select-strong border rounded px-3 py-2 mb-3 w-full" value={selected} onChange={e=>setSelected(e.target.value)}>
          {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id} {j.deadline?`— ${new Date(j.deadline).toLocaleDateString("es-ES")}`:""}</option>)}
        </select>
        {jornada ? (
          <div className="text-sm mb-4 space-y-1.5 p-3 rounded-xl bg-white/[.02] border border-white/[.06]">
            <div className="text-white/50"><span className="text-white/70 font-medium">Partidos:</span> {jornada.matches?.length||0} (Madrid · Barça · Real Sociedad · Sporting)</div>
            <div className="text-white/50"><span className="text-white/70 font-medium">Cierre:</span> {deadline?formatDateTime(deadline,MADRID_TZ):"Sin límite (define en Admin)"}</div>
            <div className="text-white/50"><span className="text-white/70 font-medium">Estado:</span> {betsStatus}</div>
            <div className="text-white/50"><span className="text-white/70 font-medium">Visibilidad:</span> {manualReveal?.forceShow?"Publicadas por admin":"Se verán tras el cierre (o si se publican antes)"}</div>
          </div>
        ) : (
          <p className="text-sm text-white/40 mb-3 p-3 rounded-xl bg-white/[.02] border border-white/[.06]">No hay jornadas creadas. Pide al admin que añada una.</p>
        )}
        {jornada && isFutbolLate && canEdit && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30">
            <div className="font-semibold text-amber-200">⚠️ Apuesta fuera de plazo</div>
            <div className="text-sm text-amber-300/80 mt-1">El plazo de apuestas ha cerrado. Puedes apostar igualmente, pero se aplicará una <b>penalización de -2 puntos</b>. No apostar supone <b>-3 puntos</b>.</div>
          </div>
        )}
        {jornada && (
          <FutbolBetForm jornada={jornada} bet={bet} disabled={!canEdit} late={isFutbolLate} onSubmit={saveBet} />
        )}
        {myScore && (
          <div className="mt-4 border border-emerald-500/10 rounded-xl p-4 bg-white/[.02]">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white/90">🏆 Puntos jornada</h3>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-300 to-white bg-clip-text text-transparent">{myScore.points} pts</span>
            </div>
            <div className="text-xs text-white/40 mt-2 flex flex-wrap gap-3">
              <span className="px-2 py-1 rounded-lg bg-white/[.04]">Exactos: {myScore.exact}</span>
              <span className="px-2 py-1 rounded-lg bg-white/[.04]">Signos: {myScore.signs}</span>
              <span className="px-2 py-1 rounded-lg bg-white/[.04]">Preguntas: {myScore.qHits}</span>
              {myScore.missed && <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300">Sin apuesta a tiempo (-2)</span>}
              {myScore.catPenalty<0 && <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300">Catastrófica (-1)</span>}
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {myScore.items.map((item,idx)=>(<li key={idx} className="flex items-center justify-between border border-white/[.04] rounded-lg px-3 py-1.5 bg-white/[.01]"><span className="text-white/50">{item.label}</span><span className={`font-semibold ${item.delta>0?"text-emerald-300":item.delta<0?"text-amber-300":"text-white/30"}`}>{item.delta>0?`+${item.delta}`:item.delta}</span></li>))}
            </ul>
          </div>
        )}
        {res && (
          <div className="mt-4 border border-white/10 rounded p-3 bg-neutral-900">
            <h3 className="font-semibold mb-2">Oficial</h3>
            <ul className="text-sm space-y-1">
              {(res.matches||[]).map((m,idx)=><li key={idx} className="flex items-center justify-between"><span>{jornada?.matches?.[idx]?.home||"Local"} vs {jornada?.matches?.[idx]?.away||"Visitante"}</span><span className="text-xs">{m?.home??"—"} - {m?.away??"—"}</span></li>)}
            </ul>
            <div className="text-xs text-slate-300 mt-2">Preguntas: {(res.qAnswers||["","",""]).join(" · ")}</div>
          </div>
        )}
      </div>
      {showOthersPanel && (
        <div className="card p-4 md:min-w-[220px] md:max-w-[320px] self-start">
          <h2 className="section-title mb-4">Apuestas de otros</h2>
          {!jornada && <p className="text-sm text-slate-300">Selecciona una jornada.</p>}
          {jornada && !canViewFull && <p className="text-sm text-slate-300">Se publicarán tras el cierre o si el admin las muestra antes.</p>}
          {jornada && canViewFull && (
            <ul className="space-y-2">
              {others.map(({name,bet:other})=>(
                <li key={name} className="border border-white/10 rounded p-3 bg-neutral-900 flex items-center gap-3">
                  <Avatar name={name} avatar={db.meta?.avatars?.[name]} size="sm"/>
                  <div className="flex-1 min-w-0"><div className="font-medium">{name}</div>
                  {other ? (
                    <div className="text-xs space-y-1 mt-1">
                      {(jornada.matches||[]).map((m,idx)=><div key={idx}><b>{m.home||"Local"}-{m.away||"Visitante"}:</b> {other.matches?.[idx]?.home??"—"}-{other.matches?.[idx]?.away??"—"}</div>)}
                      <div><b>P.Adic.:</b> {(other.questions||["","",""]).join(" · ")}</div>
                      {other.late && <div className="text-amber-300">Fuera de plazo</div>}
                    </div>
                  ) : (<div className="text-xs text-slate-400">Sin apuesta</div>)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FutbolAdmin({db,setDb,currentUser}){
  const isAdmin=!!db.users?.[currentUser]?.isAdmin;
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const [selected,setSelected]=useState(()=>jornadas[0]?.id||"");
  const [jId,setJId]=useState("");
  const [jName,setJName]=useState("");
  const [deadlineInput,setDeadlineInput]=useState(()=>toLocalDateTimeInput(nextFridayAt1500()));
  const [matches,setMatches]=useState(()=>FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
  const [questions,setQuestions]=useState(["","",""]);
  const [scores,setScores]=useState(()=>matches.map(()=>({home:"",away:""})));
  const [answers,setAnswers]=useState(["","",""]);
  const [editUser,setEditUser]=useState("");
  const [editLate,setEditLate]=useState(false);
  const [editingMode,setEditingMode]=useState("results"); // "results" or "bet"
  useEffect(()=>{
    const j=selected?futbol.jornadas?.[selected]:null;
    if(j){
      setJId(j.id);
      setJName(j.name||j.id);
      setDeadlineInput(toLocalDateTimeInput(j.deadline?new Date(j.deadline):nextFridayAt1500()));
      const baseMatches=(j.matches?.length?j.matches:FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
      setMatches(baseMatches);
      setQuestions(futbol.questions?.[j.id]||["","",""]);
      if(editingMode==="results"){
        const res=futbol.results?.[j.id];
        setScores((res?.matches?.length?res.matches:baseMatches.map(()=>({home:"",away:""}))).map(m=>({home:m.home==null?"":m.home, away:m.away==null?"":m.away})));
        setAnswers(res?.qAnswers||["","",""]);
      }
    } else {
      setJId("");
      setJName("");
      setDeadlineInput(toLocalDateTimeInput(nextFridayAt1500()));
      setMatches(FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
      setQuestions(["","",""]);
      setScores(FUTBOL_BASE_TEAMS.map(()=>({home:"",away:""})));
      setAnswers(["","",""]);
    }
  },[selected,futbol,editingMode]);
  useEffect(()=>{
    if(editUser && selected && editingMode==="bet"){
      const bet=futbol.bets?.[selected]?.[editUser];
      const baseMatches=matches;
      setEditLate(!!bet?.late);
      if(bet){
        const betMatches=(bet.matches||[]).map(m=>({home:m.home==null?"":String(m.home), away:m.away==null?"":String(m.away)}));
        while(betMatches.length<baseMatches.length) betMatches.push({home:"",away:""});
        setScores(betMatches);
        setAnswers(bet.questions||["","",""]);
      } else {
        setScores(baseMatches.map(()=>({home:"",away:""})));
        setAnswers(["","",""]);
      }
    } else if(editingMode==="results" && selected){
      const j=futbol.jornadas?.[selected];
      const baseMatches=(j?.matches?.length?j.matches:FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})));
      const res=futbol.results?.[selected];
      setScores((res?.matches?.length?res.matches:baseMatches.map(()=>({home:"",away:""}))).map(m=>({home:m.home==null?"":String(m.home), away:m.away==null?"":String(m.away)})));
      setAnswers(res?.qAnswers||["","",""]);
    }
  },[editUser,selected,editingMode,futbol,matches]);
  const participants=useMemo(()=>Object.keys(db.participants||{}).sort((a,b)=>a.localeCompare(b)),[db.participants]);
  if(!isAdmin) return <div className="card p-4 md:p-5"><h2 className="section-title">Admin fútbol</h2><p className="text-sm text-white/40">Inicia sesión como admin para editar.</p></div>;
  const ensureId=()=>{
    const id=(jId||jName||"").trim();
    return id || "";
  };
  const saveJornada=()=>{
    const id=ensureId();
    if(!id) return toast.error("Define ID o nombre de jornada");
    const parsedDeadline=parseLocalDateTime(deadlineInput)||nextFridayAt1500();
    const fixedMatches=(matches.length?matches:FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""}))).slice(0,4).map((m,idx)=>({home:m.home||FUTBOL_BASE_TEAMS[idx]||`Local ${idx+1}`, away:m.away||`Visitante ${idx+1}`}));
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const jornadasMap={...(futbolPrev.jornadas||{})};
      jornadasMap[id]={id,name:jName||id,deadline:parsedDeadline?parsedDeadline.toISOString():null,matches:fixedMatches};
      const order=[...(futbolPrev.order||[])];
      if(!order.includes(id)) order.push(id);
      const questionsMap={...(futbolPrev.questions||{})};
      questionsMap[id]=questions;
      return {...prev, futbol:{...futbolPrev, jornadas:jornadasMap, order, questions:questionsMap}};
    });
    setSelected(id);
    toast.success("Jornada guardada");
  };
  const deleteJornada=()=>{
    if(!selected) return;
    if(!window.confirm(`Eliminar jornada ${selected}?`)) return;
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const jornadasMap={...(futbolPrev.jornadas||{})};
      delete jornadasMap[selected];
      const order=(futbolPrev.order||[]).filter(id=>id!==selected);
      const questionsMap={...(futbolPrev.questions||{})}; delete questionsMap[selected];
      const resultsMap={...(futbolPrev.results||{})}; delete resultsMap[selected];
      const betsMap={...(futbolPrev.bets||{})}; delete betsMap[selected];
      const windowMap={...(futbolPrev.betsWindow||{})}; delete windowMap[selected];
      const revealMap={...(futbolPrev.betsReveal||{})}; delete revealMap[selected];
      return {...prev, futbol:{...futbolPrev, jornadas:jornadasMap, order, questions:questionsMap, results:resultsMap, bets:betsMap, betsWindow:windowMap, betsReveal:revealMap}};
    });
    setSelected("");
  };
  const saveResults=()=>{
    const id=ensureId()||selected;
    if(!id) return toast.error("Guarda la jornada primero");
    const parsedScores=scores.slice(0,matches.length).map(s=>({home:s.home===""||s.home==null?null:Number(s.home), away:s.away===""||s.away==null?null:Number(s.away)}));
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const resultsMap={...(futbolPrev.results||{})};
      resultsMap[id]={matches:parsedScores,qAnswers:[...answers]};
      return {...prev, futbol:{...futbolPrev, results:resultsMap}};
    });
    toast.success("Resultados guardados");
  };
  const setBetsOverride=(mode)=>{
    const id=ensureId()||selected;
    if(!id) return;
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const map={...(futbolPrev.betsWindow||{})};
      if(mode==="auto"){ delete map[id]; }
      else map[id]={forceOpen:mode==="open", forceClosed:mode==="close"};
      return {...prev, futbol:{...futbolPrev, betsWindow:map}};
    });
  };
  const setReveal=(mode)=>{
    const id=ensureId()||selected;
    if(!id) return;
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const map={...(futbolPrev.betsReveal||{})};
      if(mode==="auto"){ delete map[id]; }
      else map[id]={forceShow:true};
      return {...prev, futbol:{...futbolPrev, betsReveal:map}};
    });
  };
  const saveAdminBet=()=>{
    const id=ensureId()||selected;
    if(!id) return toast.error("Selecciona jornada");
    if(!editUser) return toast.error("Selecciona participante");
    const ts=nowISO();
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const raceBets={...(futbolPrev.bets?.[id]||{})};
      const prevBet=raceBets[editUser];
      const payload={matches:scores.map(s=>({home:s.home===""?null:Number(s.home), away:s.away===""?null:Number(s.away)})), questions:[...answers]};
      const nextBet={...prevBet, ...payload, submittedAt:ts, late:editLate, adminEdited:true};
      const nextBets={...(futbolPrev.bets||{}), [id]:{...raceBets, [editUser]:nextBet}};
      return {...prev, futbol:{...futbolPrev, bets:nextBets}};
    });
    toast.success("Apuesta guardada para el usuario");
  };
  const manualStatus=selected ? (futbol.betsWindow?.[selected]?.forceOpen?"Abierto manualmente":futbol.betsWindow?.[selected]?.forceClosed?"Cerrado manualmente":"Automático (viernes 15:00)") : "—";
  const revealStatus=selected ? (futbol.betsReveal?.[selected]?.forceShow?"Publicadas manualmente":"Automático tras cierre") : "—";
  return (
    <div className="card p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Admin fútbol</h2>
        <div className="flex gap-2">
          <select className="select border rounded px-3 py-2" value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="">— Nueva jornada —</option>
            {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id}</option>)}
          </select>
          <button className="px-3 py-2 rounded bg-neutral-900 text-white" onClick={()=>{setSelected("");}}>Nueva</button>
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm">ID jornada</label>
          <input className="select border rounded px-3 py-2" placeholder="J1" value={jId} onChange={e=>setJId(e.target.value)} />
          <label className="text-sm">Nombre visible</label>
          <input className="select border rounded px-3 py-2" placeholder="Jornada 1" value={jName} onChange={e=>setJName(e.target.value)} />
          <label className="text-sm">Cierre (España)</label>
          <input type="datetime-local" className="select border rounded px-3 py-2" value={deadlineInput} onChange={e=>setDeadlineInput(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>setMatches(FUTBOL_BASE_TEAMS.map(team=>({home:team,away:""})))}>Cargar equipos base</button>
          <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm" onClick={saveJornada}>Guardar jornada</button>
          {selected && <button className="px-3 py-2 rounded bg-red-700 text-white text-sm" onClick={deleteJornada}>Eliminar</button>}
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Partidos (4)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((m,idx)=>(
            <div key={idx} className="border border-white/10 rounded p-2 bg-neutral-900 space-y-2">
              <div className="text-xs text-slate-300">Partido {idx+1}</div>
              <input className="select border rounded px-3 py-2" placeholder="Local" value={m.home} onChange={e=>setMatches(prev=>prev.map((p,i)=>i===idx?{...p,home:e.target.value}:p))} />
              <input className="select border rounded px-3 py-2" placeholder="Visitante" value={m.away} onChange={e=>setMatches(prev=>prev.map((p,i)=>i===idx?{...p,away:e.target.value}:p))} />
            </div>
          ))}
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Preguntas de la jornada</h3>
        <div className="grid gap-2 md:grid-cols-3">
          {[0,1,2].map(i=>(
            <input key={i} className="select border rounded px-3 py-2" placeholder={`Pregunta ${i+1}`} value={questions[i]||""} onChange={e=>setQuestions(prev=>{ const next=[...(prev||["","",""])]; next[i]=e.target.value; return next; })} />
          ))}
        </div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Resultados oficiales</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((m,idx)=>(
            <div key={idx} className="border border-white/10 rounded p-2 bg-neutral-900 space-y-2">
              <div className="text-xs text-slate-300">{m.home||"Local"} vs {m.away||"Visitante"}</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" className="select border rounded px-3 py-2" placeholder="Goles local" value={scores[idx]?.home} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,home:e.target.value}:p))} />
                <input type="number" min="0" className="select border rounded px-3 py-2" placeholder="Goles visitante" value={scores[idx]?.away} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,away:e.target.value}:p))} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {[0,1,2].map(i=>(
            <input key={i} className="select border rounded px-3 py-2" placeholder={`Respuesta ${i+1}`} value={answers[i]||""} onChange={e=>setAnswers(prev=>{ const next=[...(prev||["","",""])]; next[i]=e.target.value; return next; })} />
          ))}
        </div>
        <button className="px-3 py-2 rounded bg-slate-900 text-white" onClick={saveResults}>Guardar resultados</button>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Control de apuestas</h3>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>setBetsOverride("open")}>Abrir</button>
          <button className="px-3 py-2 rounded bg-red-700 text-white text-sm" onClick={()=>setBetsOverride("close")}>Cerrar</button>
          <button className="px-3 py-2 rounded bg-slate-800 text-white text-sm" onClick={()=>setBetsOverride("auto")}>Automático</button>
        </div>
        <div className="text-xs text-slate-300">Estado actual: {manualStatus}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>setReveal("show")}>Publicar apuestas ya</button>
          <button className="px-3 py-2 rounded bg-slate-800 text-white text-sm" onClick={()=>setReveal("auto")}>Automático</button>
        </div>
        <div className="text-xs text-slate-300">Visibilidad: {revealStatus}</div>
      </div>
      <div className="border border-white/10 rounded p-3 space-y-2">
        <h3 className="font-semibold">Editar apuesta de participante</h3>
        <div className="flex gap-2 mb-2">
          <button className={`px-3 py-1.5 rounded text-sm ${editingMode==="results"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>{setEditingMode("results"); setEditUser("");}}>Editar resultados</button>
          <button className={`px-3 py-1.5 rounded text-sm ${editingMode==="bet"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>{setEditingMode("bet");}}>Editar apuesta usuario</button>
        </div>
        {editingMode==="bet" && (
          <>
            <div className="grid gap-2 md:grid-cols-[2fr,1fr] md:items-center">
              <select className="select border rounded px-3 py-2" value={editUser} onChange={e=>{setEditUser(e.target.value);}}>
                <option value="">— Elige participante —</option>
                {participants.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editLate} onChange={e=>setEditLate(e.target.checked)} />
                <span>Marcar como fuera de plazo</span>
              </label>
            </div>
            {editUser && (
              <div className="border border-white/10 rounded p-2 bg-neutral-900 mt-2">
                <div className="text-xs text-slate-300 mb-2">Marcadores del usuario:</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {matches.map((m,idx)=>(
                    <div key={idx} className="text-xs">
                      <div className="text-slate-400">{m.home||"Local"} vs {m.away||"Visitante"}</div>
                      <div className="grid grid-cols-2 gap-1">
                        <input type="number" min="0" className="select border rounded px-2 py-1 text-xs" placeholder="Local" value={scores[idx]?.home} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,home:e.target.value}:p))} />
                        <input type="number" min="0" className="select border rounded px-2 py-1 text-xs" placeholder="Visitante" value={scores[idx]?.away} onChange={e=>setScores(prev=>prev.map((p,i)=>i===idx?{...p,away:e.target.value}:p))} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-3 mt-2">
                  {[0,1,2].map(i=>(
                    <input key={i} className="select border rounded px-2 py-1 text-xs" placeholder={`Respuesta ${i+1}`} value={answers[i]||""} onChange={e=>setAnswers(prev=>{ const next=[...(prev||["","",""])]; next[i]=e.target.value; return next; })} />
                  ))}
                </div>
              </div>
            )}
            <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm mt-2" onClick={saveAdminBet} disabled={!editUser}>Guardar apuesta del usuario</button>
          </>
        )}
        {editingMode==="results" && (
          <div className="text-xs text-slate-400">Usa la sección de resultados oficiales arriba para editar resultados.</div>
        )}
      </div>
    </div>
  );
}

function FutbolRanking({db}){
  const futbol=db.futbol||defaultFutbolState();
  const jornadas=useMemo(()=>listFutbolJornadas(futbol),[futbol]);
  const participants=useMemo(()=>Object.keys(db.participants||{}),[db.participants]);
  const [scope,setScope]=useState("all");
  useEffect(()=>{ if(scope!=="all" && !jornadas.find(j=>j.id===scope)) setScope("all"); },[scope,jornadas]);
  const standings=useMemo(()=>computeFutbolStandings(futbol,participants,jornadas),[futbol,participants,jornadas]);
  const rows=useMemo(()=>{
    if(scope==="all") return standings;
    if(!futbol.results?.[scope]) return [];
    return participants.map(name=>{
      const s=scoreFutbolJornada(db,scope,name);
      return {...s,name};
    }).sort((A,B)=>B.points-A.points||B.exact-A.exact||B.qHits-A.qHits||B.signs-A.signs||A.goalDiff-B.goalDiff);
  },[scope,standings,participants,futbol.results,db]);
  const selectedJornada=scope==="all"?null:jornadas.find(j=>j.id===scope);
  const res=scope==="all"?null:futbol.results?.[scope];
  return (
    <div className="space-y-4">
      <div className="card card-racing p-4 md:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="section-title text-lg">⚽ Ranking fútbol <span className="text-sm opacity-60">🍺</span></h2>
          <select className="select border rounded-xl px-3 py-2" value={scope} onChange={e=>setScope(e.target.value)}>
            <option value="all">Global</option>
            {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="text-sm w-full">
            <thead>
              <tr><th className="text-left w-10"></th><th className="text-left">Jugador</th><th className="text-right">PTS</th>{scope==="all"&&<th className="text-right hidden sm:table-cell">Vict.</th>}<th className="text-right hidden sm:table-cell">Exact.</th><th className="text-right hidden sm:table-cell">Preg.</th><th className="text-right hidden sm:table-cell">Sign.</th><th className="text-right hidden sm:table-cell">Pen.</th>{scope==="all"&&<th className="text-right hidden sm:table-cell">Dif.</th>}</tr>
            </thead>
            <tbody>
              {rows.map((r,idx)=>{const penTotal=(r.missed||0)+(r.late||0);const isLast=idx===rows.length-1&&rows.length>1;return(
                <tr key={r.name} className={idx===0?"podium-1":idx===1?"podium-2":idx===2?"podium-3":isLast?"border-l-2 border-l-amber-600/30 bg-gradient-to-r from-amber-900/[.04] to-transparent":""}>
                  <td className="text-white/50">{idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":idx+1}</td>
                  <td><div className="flex items-center gap-2.5"><Avatar name={r.name} avatar={db.meta?.avatars?.[r.name]} size="sm"/><div><span className={`font-semibold ${idx===0?"text-white":""}`}>{r.name}{r.missed>=3 && <span className="text-xs text-amber-300 ml-1">(elim.)</span>}{isLast&&<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/15">🍺 paga las birras</span>}</span><div className="sm:hidden text-[11px] text-white/35 mt-0.5">{scope==="all"?`Vict:${r.wins} `:""}Exact:${r.exact} Preg:${r.qHits} Sign:${r.signs} Pen:${penTotal}{scope==="all"?` Dif:${r.goalDiff}`:""}</div></div></div></td>
                  <td className="text-right pts-cell">{r.points}</td>
                  {scope==="all"&&<td className="text-right text-white/45 hidden sm:table-cell">{r.wins}</td>}
                  <td className="text-right text-white/45 hidden sm:table-cell">{r.exact}</td>
                  <td className="text-right text-white/45 hidden sm:table-cell">{r.qHits}</td>
                  <td className="text-right text-white/45 hidden sm:table-cell">{r.signs}</td>
                  <td className="text-right text-white/30 hidden sm:table-cell" title={`Sin apuesta: ${r.missed||0} / Fuera de plazo: ${r.late||0}`}>{penTotal}</td>
                  {scope==="all"&&<td className="text-right text-white/45 hidden sm:table-cell">{r.goalDiff}</td>}
                </tr>)})}
              {rows.length===0 && <tr><td className="text-sm text-slate-300" colSpan={scope==="all"?9:7}>Sin datos.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-white/40">Desempates: puntos → victorias → exactos → preguntas → signos → menos pen. → menor dif. goles.</p>
      </div>
      {scope!=="all" && (
        <div className="card p-4 space-y-2">
          <h3 className="font-semibold">Detalle — {selectedJornada?.name||scope}</h3>
          {!res && <p className="text-sm text-slate-300">Resultados pendientes.</p>}
          {res && (
            <div className="grid gap-2">
              {rows.map(row=>{
                const detail=scoreFutbolJornada(db,scope,row.name);
                return (
                  <div key={row.name} className="border border-white/10 rounded p-3 bg-neutral-900">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-sm">{detail.points} pts {detail.missed && <span className="text-xs text-amber-300 ml-2">(sin apostar)</span>}</div>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {detail.items.map((item,idx)=>(<li key={idx} className="flex items-center justify-between border border-white/5 rounded px-2 py-1"><span>{item.label}</span><span className={item.delta>0?"text-emerald-300":item.delta<0?"text-amber-300":"text-slate-400"}>{item.delta>0?`+${item.delta}`:item.delta}</span></li>))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Admin({db,setDb,races,drivers,teams,calendar}){
  const [pass,setPass]=useState("");
  const [ok,setOk]=useState(false);
  const [selected,setSelected]=useState(()=> (races&&races[0]?.key)||"");
  const [newUserName,setNewUserName]=useState("");
  const [newUserPass,setNewUserPass]=useState("");
  const [importText,setImportText]=useState("");
  const [now,setNow]=useState(()=>new Date());
  const [editName,setEditName]=useState("");
  const [editBet,setEditBet]=useState({pole:"",podium:["","",""],q:["","",""],late:false});
  const [qDateInput,setQDateInput]=useState("");
  const [qTimeInput,setQTimeInput]=useState("");
const [raceDateInput,setRaceDateInput]=useState("");
const [raceTimeInput,setRaceTimeInput]=useState("");
const [tzInput,setTzInput]=useState("");
const selectedRace=useMemo(()=>races?.find(r=>r.key===selected),[selected,races]);
const baseCal=useMemo(()=>calendar?.find(r=>r.key===selected),[calendar,selected]);
// Compat: algunos navegadores podían tener código cacheado que refería a baseCalendar.
const baseCalendar=baseCal;
  useEffect(()=>{ setOk(sessionStorage.getItem("admin_ok")==="1"); },[]);
  useEffect(()=>{
    if(!selected && Array.isArray(races) && races.length){ setSelected(races[0].key); }
  },[selected,races]);
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),30000); return ()=>clearInterval(id); },[]);
  useEffect(()=>{
    const baseBet=(selected && editName)?(db.bets?.[selected]?.[editName]||{}):{};
    setEditBet({
      pole:baseBet.pole||"",
      podium:[...(baseBet.podium||["","",""])],
      q:[...(baseBet.q||["","",""])],
      late:!!baseBet.late,
    });
  },[selected,editName,db.bets]);
  useEffect(()=>{
    const override=db.meta?.raceOverrides?.[selected]||{};
    const base=baseCal||{};
    const qDate=override.qDate || base.q_date_local || base.date_local || "";
    const qTime=override.qTime || base.qualifying_time_local || "";
    const raceDate=override.raceDate || base.race_date_local || base.date_local || "";
    const raceTime=override.raceTime || base.race_time_local || "";
    const tz=override.timezone || base.timezone || "";
    setQDateInput(qDate);
    setQTimeInput(qTime);
    setRaceDateInput(raceDate);
    setRaceTimeInput(raceTime);
    setTzInput(tz);
  },[selected,db.meta?.raceOverrides,baseCal]);
  const user=sessionStorage.getItem("porra_session_user")||"";
  const userList=useMemo(()=>Object.values(db.users||{}).sort((a,b)=>a.name.localeCompare(b.name)),[db.users]);
  const participantNames=useMemo(()=>Object.keys(db.participants||{}).sort((a,b)=>a.localeCompare(b)),[db.participants]);
  const computedStandings=useMemo(()=>computeGlobalStandings(db,races).map((row,idx)=>({name:row.name,points:row.points,rank:idx+1})),[db,races]);
  const manualStandingsExists=Object.keys(db.standings||{}).length>0;
  const standingsObject=useMemo(()=>{
    if(manualStandingsExists) return db.standings;
    return computedStandings.reduce((acc,item)=>{acc[item.name]={points:item.points,rank:item.rank}; return acc;},{});
  },[manualStandingsExists,db.standings,computedStandings]);
  const exportPayload=useMemo(()=>({...db, standings:standingsObject}),[db,standingsObject]);
  const exportJson=useMemo(()=>JSON.stringify(exportPayload,null,2),[exportPayload]);
  if(!db.users?.[user]?.isAdmin) return <div className="card p-4 md:p-5"><h2 className="section-title">Admin</h2><p className="text-sm text-white/40">Inicia sesión como admin.</p></div>;
  if(!ok){ return (<div className="card p-4 md:p-5 max-w-md mx-auto"><h2 className="section-title mb-3">Admin</h2><form className="flex gap-2" onSubmit={(e)=>{e.preventDefault(); if(pass===(db.meta?.adminSecret||atob("bWFucmlxdWU="))){setOk(true);sessionStorage.setItem("admin_ok","1");} else toast.error("Contraseña admin incorrecta");}}><input type="password" autoComplete="off" className="flex-1 select border rounded px-3 py-2" placeholder="Contraseña admin" value={pass} onChange={e=>setPass(e.target.value)} /><button className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white font-medium text-sm hover:bg-white/15 transition-all">Entrar</button></form></div>); }
  const driversText=(db.meta?.drivers||[]).join("\n");
  const teamsText=(db.meta?.teams||[]).join("\n");
  const driverList=(db.meta?.drivers?.length?db.meta.drivers:drivers)||[];
  const teamList=(db.meta?.teams?.length?db.meta.teams:teams)||[];
  const manualBets=db.betsWindow?.[selected];
  const manualReveal=db.betsReveal?.[selected];
  const historyLocked=selectedRace ? now < selectedRace.qStart : true;
  const historyForRace=historyLocked ? {} : (db.betHistory?.[selected]||{});
  const scoreAdjustments=db.scoreAdjustments?.[selected]||{};
  const currentRes=db.results?.[selected]||{pole:"",podium:["","",""],qAnswers:["","",""]};
  const updateRes=(updater)=>{ setDb(prev=>{ const base=prev.results?.[selected]||{pole:"",podium:["","",""],qAnswers:["","",""]}; const next=updater({...base, podium:[...(base.podium||["","",""])], qAnswers:[...(base.qAnswers||["","",""])]}); return {...prev, results:{...(prev.results||{}), [selected]:next}}; }); };
  const setBetsOverride=(mode)=>{ setDb(prev=>{ const map={...(prev.betsWindow||{})}; if(mode==="auto"){ delete map[selected]; return {...prev, betsWindow:map}; } map[selected]={forceOpen:mode==="open", forceClosed:mode==="close"}; return {...prev, betsWindow:map}; }); };
  const betsStatusLabel=manualBets?.forceOpen?"Abierto manualmente":manualBets?.forceClosed?"Cerrado manualmente":"Automático por horario";
  const setBetsReveal=(mode)=>{ if(!selected) return; setDb(prev=>{ const map={...(prev.betsReveal||{})}; if(mode==="auto"){ delete map[selected]; return {...prev, betsReveal:map}; } map[selected]={forceShow:true}; return {...prev, betsReveal:map}; }); };
  const betsRevealLabel=manualReveal?.forceShow?"Publicadas manualmente":"Automático 1 min tras quali";
  const updateScoreAdjustment=(name,value)=>{ if(!selected) return; setDb(prev=>{ const adjustments={...(prev.scoreAdjustments||{})}; const raceMap={...(adjustments[selected]||{})}; if(!Number.isFinite(value) || value===0){ delete raceMap[name]; } else { raceMap[name]=value; } if(Object.keys(raceMap).length){ adjustments[selected]=raceMap; } else { delete adjustments[selected]; } return {...prev, scoreAdjustments:adjustments}; }); };
  const saveSchedule=()=>{
    if(!selected) return toast.error("Selecciona un GP");
    if(!qDateInput || !qTimeInput) return toast.error("Completa fecha y hora de quali");
    if(!raceDateInput || !raceTimeInput) return toast.error("Completa fecha y hora de carrera");
    const tzValue=tzInput || baseCal?.timezone || MADRID_TZ;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const overrides={...(meta.raceOverrides||{})};
      overrides[selected]={qDate:qDateInput,qTime:qTimeInput,raceDate:raceDateInput,raceTime:raceTimeInput,timezone:tzValue};
      return {...prev, meta:{...meta, raceOverrides:overrides}};
    });
    toast.success("Horario actualizado");
  };
  const resetSchedule=()=>{
    if(!selected) return;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const overrides={...(meta.raceOverrides||{})};
      delete overrides[selected];
      if(Object.keys(overrides).length===0) delete meta.raceOverrides;
      else meta.raceOverrides=overrides;
      return {...prev, meta};
    });
    const base=baseCal||{};
    setQDateInput(base.q_date_local||base.date_local||"");
    setQTimeInput(base.qualifying_time_local||"");
    setRaceDateInput(base.race_date_local||base.date_local||"");
    setRaceTimeInput(base.race_time_local||"");
    setTzInput(base.timezone||"");
    toast("Horario restablecido al calendario");
  };
  const handleAddUser=async (e)=>{
    e.preventDefault();
    const name=newUserName.trim();
    if(!name) return toast.error("Introduce un nombre");
    if(db.users?.[name]) return toast.error("Ese usuario ya existe");
    const passValue=newUserPass.trim()||DEFAULT_PASSWORD;
    const hash=await hashPassword(passValue);
    setDb(prev=>{
      const users={...(prev.users||{})};
      users[name]={name,passwordHash:hash,mustChange:true,isAdmin:false,blocked:false,createdAt:nowISO()};
      const participants={...(prev.participants||{})};
      if(!participants[name]) participants[name]={name,createdAt:nowISO()};
      return {...prev, users, participants};
    });
    setNewUserName("");
    setNewUserPass("");
    toast.success(`Usuario ${name} creado`);
  };
  const resetPasswordFor=(name)=>{
    if(!window.confirm(`¿Resetear la contraseña de ${name}?`)) return;
    hashPassword(DEFAULT_PASSWORD).then(hash=>{
      setDb(prev=>{
        const users={...(prev.users||{})};
        if(users[name]){ users[name]={...users[name],passwordHash:hash,mustChange:true,blocked:false,changedAt:null}; delete users[name].password; }
        return {...prev,users};
      });
      toast.success("Contraseña reseteada");
    }).catch(()=>toast.error("No se pudo resetear"));
  };
  const toggleBlockUser=(name)=>{
    if(name===user) return;
    setDb(prev=>{
      const users={...(prev.users||{})};
      if(users[name]) users[name]={...users[name],blocked:!users[name].blocked};
      return {...prev,users};
    });
  };
  const removeUser=(name)=>{
    if(db.users?.[name]?.isAdmin) return toast.error("No puedes borrar un admin");
    if(name===user) return toast.error("No puedes borrarte a ti mismo");
    if(!window.confirm(`¿Eliminar a ${name}?`)) return;
    setDb(prev=>{
      const users={...(prev.users||{})};
      delete users[name];
      const participants={...(prev.participants||{})};
      delete participants[name];
      const nextBets={};
      Object.entries(prev.bets||{}).forEach(([raceKey,raceBets])=>{
        const copy={...(raceBets||{})};
        delete copy[name];
        if(Object.keys(copy).length) nextBets[raceKey]=copy;
      });
      const questionOwner={...(prev.questionOwner||{})};
      Object.keys(questionOwner).forEach((raceKey)=>{ if(questionOwner[raceKey]===name) delete questionOwner[raceKey]; });
      return {...prev, users, participants, bets:nextBets, questionOwner};
    });
    toast.success("Usuario eliminado");
  };
  const updateChampionship=(name,value)=>{
    const parsed=Math.max(0,Number.isNaN(value)?0:value);
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const champs={...(meta.championships||{})};
      champs[name]=parsed;
      return {...prev, meta:{...meta, championships:champs}};
    });
  };
  const saveAdminBet=()=>{
    if(!selected) return toast.error("Selecciona un GP");
    if(!editName) return toast.error("Elige un participante");
    const ts=nowISO();
    setDb(prev=>{
      const raceBets={...(prev.bets?.[selected]||{})};
      const prevBet=raceBets[editName];
      const nextBet={...prevBet, pole:editBet.pole||"", podium:[...(editBet.podium||["","",""])], q:[...(editBet.q||["","",""])], submittedAt:ts, late:!!editBet.late, adminEdited:true};
      const nextBets={...(prev.bets||{}), [selected]:{...raceBets, [editName]:nextBet}};
      let betHistory=prev.betHistory||{};
      if(!prevBet || !betsAreEqual(prevBet,nextBet) || !!prevBet?.late!==!!nextBet.late){
        const raceHistory={...(betHistory[selected]||{})};
        const userLog=[...(raceHistory[editName]||[])];
        userLog.push({ts:ts,pole:nextBet.pole||"",podium:[...nextBet.podium],q:[...nextBet.q],late:nextBet.late,editedByAdmin:true});
        betHistory={...betHistory,[selected]:{...raceHistory,[editName]:userLog}};
      }
      return {...prev, bets:nextBets, betHistory};
    });
    toast.success("Apuesta actualizada por admin");
  };
  const downloadBackup=()=>{
    const blob=new Blob([exportJson],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=`porra_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyBackup=()=>{
    if(typeof navigator!=="undefined" && navigator.clipboard?.writeText){
      navigator.clipboard.writeText(exportJson).then(()=>toast.success("JSON copiado al portapapeles"))
        .catch(()=>toast.error("No se pudo copiar automáticamente"));
    } else {
      if(typeof window!=="undefined") window.prompt("Copia manualmente el JSON", exportJson);
    }
  };
  const importFromText=()=>{
    if(!importText.trim()) return toast.error("Pega un JSON para importarlo");
    try{
      const parsed=JSON.parse(importText);
      if(typeof parsed!=="object" || parsed===null) throw new Error("Formato no válido");
      setDb(parsed);
      setImportText("");
      toast.success("Backup importado. Revisa y exporta antes del próximo sync.");
    }catch(err){
      toast.error("JSON inválido: "+err.message);
    }
  };
  const handleBackupFile=(event)=>{
    const file=event.target.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const text=reader.result;
      if(typeof text==="string") setImportText(text);
    };
    reader.readAsText(file);
    event.target.value="";
  };
  return (<div className="card p-4 md:p-5 space-y-4">
    <div className="flex items-center justify-between"><h2 className="section-title">⚙ Admin</h2><button onClick={()=>{sessionStorage.removeItem("admin_ok"); setOk(false); setPass("");}} className="text-xs text-white/40 hover:text-white/70 transition-colors">Cerrar sesión admin</button></div>
    <div className="border border-white/10 rounded p-3">
      <h3 className="font-semibold mb-2">Gran Premio seleccionado</h3>
      <div className="grid gap-2 md:grid-cols-[2fr,1fr] md:items-center">
        <select className="select border rounded px-3 py-2" value={selected} onChange={e=>setSelected(e.target.value)}>
          {(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix}</option>)}
        </select>
        {selectedRace && (
          <div className="text-xs text-slate-300 space-y-1">
            <div>Quali: {selectedRace.q_date_local} · {selectedRace.labels?.qLocal||"—"} (Local) · {selectedRace.labels?.qMadrid||"—"} (España)</div>
            {selectedRace.labels?.raceLocal && <div>Carrera: {selectedRace.race_date_local} · {selectedRace.labels.raceLocal} (Local) · {selectedRace.labels.raceMadrid||"—"} (España)</div>}
          </div>
        )}
      </div>
    </div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Parrilla (pilotos) — desplegables</h3><textarea className="w-full h-40 select border rounded px-3 py-2" defaultValue={driversText} onBlur={(e)=>{ const lines=e.target.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); setDb(prev=>({...prev, meta:{...prev.meta, drivers:lines}})); toast.success("Lista de pilotos actualizada"); }}></textarea></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Escuderías (F1 2026)</h3><textarea className="w-full h-40 select border rounded px-3 py-2" defaultValue={teamsText} onBlur={(e)=>{ const lines=e.target.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); setDb(prev=>({...prev, meta:{...prev.meta, teams:lines}})); toast.success("Lista de escuderías actualizada"); }}></textarea><p className="text-xs text-slate-400 mt-2">Una por línea. Usada para preguntas adicionales (ej. ¿Qué escudería ganará?).</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Horario del GP</h3>{selectedRace ? (<div className="text-sm text-slate-200 space-y-1 mb-3"><div>Quali local: {selectedRace.q_date_local} {selectedRace.labels?.qLocal||"—"} · España: {selectedRace.labels?.qMadrid||"—"}</div>{selectedRace.labels?.raceLocal && <div>Carrera local: {selectedRace.race_date_local} {selectedRace.labels.raceLocal} · España: {selectedRace.labels.raceMadrid||"—"}</div>}<div className="text-xs text-slate-400">Usa hora local del circuito; las horas de España se recalculan.</div></div>):(<p className="text-sm text-slate-300 mb-2">Selecciona un GP para editar su horario.</p>)}<div className="grid gap-2 md:grid-cols-2"><label className="text-sm">Fecha quali (local)</label><label className="text-sm">Hora quali (local)</label><input type="date" className="select border rounded px-3 py-2" value={qDateInput} onChange={e=>setQDateInput(e.target.value)} /><input type="time" className="select border rounded px-3 py-2" value={qTimeInput} onChange={e=>setQTimeInput(e.target.value)} /><label className="text-sm">Fecha carrera (local)</label><label className="text-sm">Hora carrera (local)</label><input type="date" className="select border rounded px-3 py-2" value={raceDateInput} onChange={e=>setRaceDateInput(e.target.value)} /><input type="time" className="select border rounded px-3 py-2" value={raceTimeInput} onChange={e=>setRaceTimeInput(e.target.value)} /></div><label className="text-sm mt-2 block">Zona horaria (IANA, ej. Europe/Madrid)</label><input className="select border rounded px-3 py-2 mb-2" placeholder={baseCal?.timezone||"Asia/Dubai"} value={tzInput} onChange={e=>setTzInput(e.target.value)} /><div className="flex flex-wrap gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={saveSchedule}>Guardar horario</button><button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={resetSchedule}>Volver al calendario</button></div><p className="text-xs text-slate-400 mt-2">El horario ajusta el cierre de apuestas y la publicación automática.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Resultados oficiales</h3><div className="grid gap-2"><label className="text-sm">Pole</label><SelectDriver value={currentRes.pole||""} onChange={(val)=>updateRes(prev=>({...prev, pole:val}))} drivers={driverList} placeholder="Selecciona piloto" /><label className="text-sm">Podio</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><SelectDriver key={i} value={currentRes.podium?.[i]||""} onChange={(val)=>updateRes(prev=>{ const next=[...(prev.podium||["","",""])]; next[i]=val; return {...prev, podium:next}; })} drivers={driverList} placeholder={`P${i+1}`} />)}</div><label className="text-sm">Respuestas a preguntas</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" value={currentRes.qAnswers?.[i]||""} onChange={e=>updateRes(prev=>{ const next=[...(prev.qAnswers||["","",""])]; next[i]=e.target.value; return {...prev, qAnswers:next}; })}/>)}</div><button className="mt-2 px-3 py-2 rounded bg-slate-900 text-white" onClick={()=>{ setDb(prev=>({...prev, results:{...(prev.results||{}), [selected]:currentRes}})); toast.success("Resultados guardados (puedes guardar parciales)"); }}>Guardar</button></div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Control de apuestas</h3><p className="text-xs text-slate-400">Fuerza apertura o cierre sin depender del horario.</p><div className="flex flex-wrap gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={()=>setBetsOverride("open")}>Abrir</button><button className="px-3 py-2 rounded bg-red-700 text-white" onClick={()=>setBetsOverride("close")}>Cerrar</button><button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={()=>setBetsOverride("auto")}>Automático</button></div><div className="text-xs text-slate-300 mt-2">Estado actual: {betsStatusLabel}</div>{selectedRace && (<div className="text-xs text-slate-400 mt-1">Quedará automático 1 minuto antes de la quali ({selectedRace.labels?.qLocal||"—"} · España: {selectedRace.labels?.qMadrid||"—"})</div>)}<div className="mt-3 border border-white/5 rounded p-3 bg-neutral-900"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium text-sm">Publicar apuestas</div><div className="text-xs text-slate-400">Enséñalas antes de la hora de quali.</div></div><div className="flex flex-wrap gap-2"><button className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm" onClick={()=>setBetsReveal("show")}>Publicar ya</button><button className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm" onClick={()=>setBetsReveal("auto")}>Volver a automático</button></div></div><div className="text-xs text-slate-300 mt-2">Visibilidad: {betsRevealLabel}</div>{selectedRace && <div className="text-[11px] text-slate-500">Automático: 1 minuto después del inicio de quali ({selectedRace.labels?.qMadrid||"—"}).</div>}</div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Editar apuestas de participantes</h3><div className="grid gap-2 md:grid-cols-[2fr,1fr]"><select className="select border rounded px-3 py-2" value={editName} onChange={e=>setEditName(e.target.value)}><option value="">— Elige participante —</option>{participantNames.map(n=><option key={n} value={n}>{n}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editBet.late} onChange={e=>setEditBet(prev=>({...prev, late:e.target.checked}))} /><span>Marcar como fuera de plazo</span></label></div><div className="grid gap-2 mt-3"><label className="text-sm">Pole</label><SelectDriver value={editBet.pole} onChange={(val)=>setEditBet(prev=>({...prev, pole:val}))} drivers={driverList} placeholder="Selecciona piloto" /><label className="text-sm">Podio</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><SelectDriver key={i} value={editBet.podium?.[i]||""} onChange={(val)=>setEditBet(prev=>{ const next=[...(prev.podium||["","",""])]; next[i]=val; return {...prev, podium:next}; })} drivers={driverList} placeholder={`P${i+1}`} />)}</div><label className="text-sm">Preguntas adicionales</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" value={editBet.q?.[i]||""} onChange={e=>setEditBet(prev=>{ const next=[...(prev.q||["","",""])]; next[i]=e.target.value; return {...prev, q:next}; })} placeholder={`Respuesta ${i+1}`}/>)}</div><button className="mt-2 px-3 py-2 rounded bg-emerald-700 text-white" onClick={saveAdminBet}>Guardar apuesta</button></div><p className="text-xs text-slate-400 mt-2">Guarda una apuesta tal cual la haría el usuario y decide si computa como tarde.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Ajustes manuales de puntuación ({selected||"—"})</h3><p className="text-xs text-slate-400 mb-2">Suma o resta puntos de esta carrera. Afecta ranking, detalle y estadísticas.</p><div className="grid gap-2 md:grid-cols-2">{participantNames.map(name=>{ const val=Number(scoreAdjustments[name]||0); return (<label key={name} className="flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900 text-sm"><span>{name}</span><input type="number" className="w-24 text-right select border rounded px-2 py-1" value={val} onChange={e=>{ const parsed=parseInt(e.target.value,10); updateScoreAdjustment(name, Number.isNaN(parsed)?0:parsed); }} /></label>); })}</div><p className="text-[11px] text-slate-500 mt-2">Deja en 0 para eliminar ajustes.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Autor y publicación de preguntas</h3><p className="text-xs text-slate-400 mb-2">Orden por clasificación 2025: Pere → Antonio → Manrique → Toni → Carlos (cíclico)</p><div className="flex gap-2 items-center"><span className="text-sm">Autor asignado:</span><select className="select border rounded px-3 py-2" value={db.questionOwner?.[selected]||""} onChange={e=>setDb(prev=>({...prev, questionOwner:{...(prev.questionOwner||{}), [selected]:e.target.value}}))}><option value="">— Sin asignar —</option>{Object.keys(db.participants||{}).map(n=><option key={n} value={n}>{n}</option>)}</select></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" placeholder={`Pregunta ${i+1}`} value={(db.questions?.[selected]?.[i]||"")} onChange={e=>{const next=[...(db.questions?.[selected]||["","",""])]; next[i]=e.target.value; setDb(prev=>({...prev, questions:{...(prev.questions||{}), [selected]: next}}));}}/>)}</div><div className="flex flex-wrap items-center gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={()=>{ setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), published:true, force:true}}})); toast.success("Publicación forzada"); }}>Forzar publicar</button><button className="px-3 py-2 rounded bg-gray-700 text-white" onClick={()=>{ setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), published:false, force:false}}})); toast("Despublicado"); }}>Despublicar</button><button className="px-3 py-2 rounded bg-red-700 text-white" onClick={()=>{ const v=!(db.questionsStatus?.[selected]?.locked); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), locked:v}}})); toast(v?"Edición bloqueada":"Edición desbloqueada"); }}>{db.questionsStatus?.[selected]?.locked ? "Desbloquear edición" : "Bloquear edición"}</button><button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>{ if(!confirm("¿Borrar preguntas de Las Vegas, Qatar y Abu Dhabi (GP 22–24)? Son datos de 2025 que no deberían mostrarse en 2026.")) return; const keys=["las_vegas","qatar","abu_dhabi"]; setDb(prev=>{ const q={...(prev.questions||{})}; const qs={...(prev.questionsStatus||{})}; const qo={...(prev.questionOwner||{})}; keys.forEach(k=>{ delete q[k]; delete qs[k]; delete qo[k]; }); return {...prev, questions:q, questionsStatus:qs, questionOwner:qo}; }); toast.success("Preguntas de GP 22–24 borradas"); }}>Limpiar GP 22–24 (legacy)</button></div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Gestión de usuarios</h3>
      <form onSubmit={handleAddUser} className="grid gap-2 md:grid-cols-[2fr,2fr,auto]">
        <input className="select border rounded px-3 py-2" placeholder="Nombre" value={newUserName} onChange={e=>setNewUserName(e.target.value)} />
        <input className="select border rounded px-3 py-2" placeholder={`Contraseña inicial (${DEFAULT_PASSWORD})`} value={newUserPass} onChange={e=>setNewUserPass(e.target.value)} />
        <button className="px-3 py-2 rounded bg-slate-900 text-white">Añadir</button>
      </form>
      <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
        {userList.map(u=>{
          const isSelf=u.name===user;
          return (<div key={u.name} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-white/10 rounded px-3 py-2 bg-neutral-900">
            <div>
              <div className="font-medium flex flex-wrap items-center gap-2">{u.name}{u.isAdmin && <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-200">Admin</span>}{u.blocked && <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600/20 text-amber-200 border border-amber-400/40">Bloqueado</span>}</div>
              <div className="text-xs text-slate-400">{u.blocked?"Bloqueado temporalmente":"Activo"}{u.mustChange?" · debe cambiar contraseña":""}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" className="px-3 py-1.5 rounded bg-slate-800 text-white" onClick={()=>resetPasswordFor(u.name)}>Reset pass</button>
              <button type="button" className={`px-3 py-1.5 rounded ${u.blocked?"bg-emerald-700":"bg-amber-600"} text-white`} disabled={isSelf} onClick={()=>toggleBlockUser(u.name)}>{u.blocked?"Desbloquear":"Bloquear"}</button>
              {!u.isAdmin && !isSelf && <button type="button" className="px-3 py-1.5 rounded bg-red-700 text-white" onClick={()=>removeUser(u.name)}>Borrar</button>}
            </div>
          </div>);
        })}
      </div>
    </div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Historial de apuestas ({selected||"—"})</h3>{historyLocked ? (
      <p className="text-sm text-slate-300">Disponible al inicio de la quali ({selectedRace?.labels?.qMadrid||"hora España"}).</p>
    ) : Object.keys(historyForRace).length ? (
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {Object.entries(historyForRace).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,logs])=>{
          const list=Array.isArray(logs)?logs:[];
          const ordered=[...list].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
          return (
            <div key={name} className="border border-white/10 rounded px-3 py-2 bg-neutral-900">
              <div className="font-medium mb-1">{name}</div>
              <ul className="text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto pr-2">
                {ordered.map((entry,idx)=>{ const timeLabel=entry?.ts?new Date(entry.ts).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—"; return (<li key={idx} className="border border-white/5 rounded px-2 py-1">
                  <div className="flex items-center justify-between"><span>{timeLabel}</span>{entry?.late && <span className="text-xs uppercase text-amber-300">Tarde</span>}</div>
                  <div>Pole: {entry.pole||"—"}</div>
                  <div>Podio: {(entry.podium||["","",""]).join(" · ")}</div>
                  <div>P.Adic.: {(entry.q||["","",""]).join(" · ")}</div>
                </li>); })}
              </ul>
            </div>
          );
        })}
      </div>
    ) : (<p className="text-sm text-slate-300">Sin movimientos registrados para este GP.</p>)}<p className="text-xs text-slate-400 mt-2">Se guarda cada vez que alguien actualiza su apuesta.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Campeonatos mundiales</h3><p className="text-xs text-slate-400 mb-3">Estos valores alimentan el ranking extra de títulos.</p>{participantNames.length?(<div className="space-y-2 max-h-64 overflow-y-auto">{participantNames.map(name=>{ const value=db.meta?.championships?.[name]??0; return (<div key={name} className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2 bg-neutral-900"><span className="font-medium">{name}</span><input type="number" min="0" className="w-20 text-center select border rounded px-2 py-1" value={value} onChange={e=>{ const next=parseInt(e.target.value,10); updateChampionship(name, Number.isNaN(next)?0:next); }} /></div>); })}</div>):(<p className="text-sm text-slate-300">No hay participantes para mostrar.</p>)}</div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Puntos base (backup inicial)</h3><p className="text-xs text-slate-400 mb-3">Se suman al cálculo automático del ranking global. Úsalos si vienes de un backup.</p><div className="flex flex-wrap gap-2 mb-3"><button type="button" className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm" onClick={()=>{ setDb(prev=>({...prev, meta:{...(prev.meta||{}), basePoints:Object.fromEntries(participantNames.map(n=>[n,0])), forceAutoStandings:true}})); }}>Poner todos a 0</button></div><div className="grid gap-2 md:grid-cols-2 max-h-64 overflow-y-auto">{participantNames.map(name=>{ const val=Number(db.meta?.basePoints?.[name]||0); return (<div key={name} className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2 bg-neutral-900 text-sm"><span className="font-medium">{name}</span><input type="number" className="w-20 text-right select border rounded px-2 py-1" value={val} onChange={e=>{ const parsed=parseInt(e.target.value,10); const v=Number.isNaN(parsed)?0:parsed; setDb(prev=>{ const meta=prev.meta||{}; const base={...(meta.basePoints||{})}; base[name]=v; return {...prev, meta:{...meta, basePoints:base}}; }); }} /></div>); })}</div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Backup antes del sync</h3><p className="text-xs text-slate-400">Descarga o copia el JSON antes de sincronizar con S3 y vuélvelo a importar después.</p><div className="flex flex-wrap gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={downloadBackup}>Descargar JSON</button><button type="button" className="px-3 py-2 rounded bg-slate-800 text-white" onClick={copyBackup}>Copiar JSON</button></div><textarea className="w-full h-32 select border rounded px-3 py-2 mt-3" placeholder="Pega aquí el JSON que quieres importar" value={importText} onChange={e=>setImportText(e.target.value)}></textarea><div className="flex flex-wrap items-center gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-slate-900 text-white" onClick={importFromText}>Importar JSON</button><label className="cursor-pointer text-sm text-slate-200"><span className="inline-block px-3 py-2 rounded bg-slate-800 text-white">Cargar archivo</span><input type="file" accept="application/json" className="hidden" onChange={handleBackupFile} /></label></div></div>
  </div>);
}

const CURRENT_SEASON_YEAR = 2026;
const REAL_HISTORICAL_2025_KEYS = ["las_vegas","qatar","abu_dhabi"];
const REAL_HISTORICAL_2025_ROUNDS = [22,23,24];

function Participante({user,races,db,setDb,drivers,circuits,selectedRaceKey,setSelectedRaceKey}){
  const [now,setNow]=useState(()=>new Date());
  const selected=selectedRaceKey||"";
  const setSelected=setSelectedRaceKey||(()=>{});
  const race=races?.find(r=>r.key===selected);
  const [showOthers,setShowOthers]=useState(false);
  const [historicalPrev,setHistoricalPrev]=useState(null);
  useEffect(()=>{
    if(races?.length){
      const valid=races.some(r=>r.key===selected);
      const next=!selected||!valid?races[0].key:selected;
      if(next!==selected) setSelected(next);
    }
  },[races,selected]);
  useEffect(()=>{ if(selected) sessionStorage.setItem("porra_selected_race",selected); },[selected]);
  useEffect(()=>{ loadHistorical(CURRENT_SEASON_YEAR-1).then(setHistoricalPrev).catch(()=>setHistoricalPrev(null)); },[]);
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),30000); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ if(!race) setShowOthers(false); },[race]);
  const prevYearResult=race && historicalPrev?.resultsByKey?.[race.key];
  const prevYearPoints=race && historicalPrev?.pointsByKey?.[race.key]?.[user];
  const last3WithResults=useMemo(()=>{
    const nowMs=Date.now();
    const withRes=(races||[]).filter(r=>db.results?.[r.key] && r.raceStart && r.raceStart.getTime()<nowMs).sort((a,b)=>b.round-a.round).slice(0,3);
    return withRes;
  },[races,db.results]);
  const bet=race?(db.bets?.[race.key]?.[user]||{pole:"",podium:["","",""],q:["","",""],submittedAt:null,late:false}):null;
  const owner=race?(db.questionOwner?.[race.key]||""):""; const questions=race?(db.questions?.[race.key]||["","",""]):["","",""];
  const manualWindow=race ? db.betsWindow?.[race.key] : null;
  const manualReveal=race ? db.betsReveal?.[race.key] : null;
  const isBeforeCutoff=race && now<race.cutoff;
  const isLate=race && !isBeforeCutoff;
  const canEdit=race ? (manualWindow?.forceClosed?false:true) : false;
  const isAdmin=!!db.users?.[user]?.isAdmin;
  const canViewFull=race && (manualReveal?.forceShow || now>race.showBetsAt);
  const showStatusOnly=isAdmin && race && !canViewFull;
  const others=Object.keys(db.participants||{}).filter(n=>n!==user).map(name=>({name,bet:race?db.bets?.[race.key]?.[name]:null}));
  const driverList=(db.meta?.drivers&&db.meta.drivers.length)?db.meta.drivers:drivers; const authorDeadline = race ? race.authorCutoff : null;
  const betsStatus=race ? (manualWindow?.forceClosed?"Cerrado por admin":(isLate?`Fuera de plazo (penalización -2 pts)`:(manualWindow?.forceOpen?"Abierto por admin":"Abierto"))) : "—";
  const last3RacesDisplay=useMemo(()=>{
    const nowMs=Date.now();
    const withResults=(races||[]).filter(r=>db.results?.[r.key] && r.raceStart && r.raceStart.getTime()<nowMs).sort((a,b)=>b.round-a.round).slice(0,3).map(r=>({race:r,score:scoreForRace(db,r.key,user),hasData:true}));
    if(withResults.length>0) return withResults;
    return (races||[]).slice(0,3).map(r=>({race:r,score:null,hasData:false}));
  },[races,db.results,db.bets,user]);
  const showOthersPanel=showOthers && !!race;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]":"";
  return (<div className={`grid gap-4 ${layoutCols}`}>
    <div className="card card-racing p-4 md:p-5 min-w-0">
      <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title">🏁 Tu apuesta <span className="text-xs opacity-40">· por las birras</span></h2>
        {race && (<button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar":"👀 Ver otras apuestas"}</button>)}
      </div>
      <select className="select select-strong border rounded px-3 py-2 mb-3 w-full" value={selected} onChange={e=>setSelected(e.target.value)}>{(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix} — {r.date_local}</option>)}</select>
      {race && <div className="md:hidden"><CircuitCard race={race} circuits={circuits}/></div>}
      {race && (
        <div className="mb-4 p-3 rounded-xl bg-white/[.025] border border-white/[.06] relative overflow-hidden"><div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
          <h3 className="text-sm font-bold text-white/85 mb-2 flex items-center gap-2">🕐 Horarios del GP</h3>
          <div className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-slate-400">Quali:</span>
              <span className="text-slate-300">{race.labels?.qLocal||"—"} (local)</span>
              <span className="text-emerald-300 font-semibold">→ {race.labels?.qMadrid||"—"} España</span>
            </div>
            {race.labels?.raceLocal && (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-slate-400">Carrera:</span>
                <span className="text-slate-300">{race.labels.raceLocal} (local)</span>
                <span className="text-emerald-300 font-semibold">→ {race.labels.raceMadrid} España</span>
              </div>
            )}
            {authorDeadline && (
              <div className="flex flex-wrap items-baseline gap-2 text-slate-300">
                <span className="text-slate-400">Cierre preguntas (autor):</span>
                <span className="text-amber-200 font-medium">{formatDateTime(authorDeadline,MADRID_TZ)} España</span>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-slate-600/50">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-slate-400">Cierre apuestas:</span>
                <span className="text-amber-300 font-bold text-base">{formatTime(race.cutoff,MADRID_TZ)}</span>
                <span className="text-amber-100 text-xs">(España)</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-xs">
                <span><span className="text-slate-400">Estado:</span> <span className={betsStatus.includes("Abierto")?"text-emerald-300":"text-slate-300"}>{betsStatus}</span></span>
                <span><span className="text-slate-400">Visibilidad:</span> <span className="text-slate-300">{manualReveal?.forceShow?"Publicadas por admin":"Ocultas hasta quali"}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}
      {race && (<div className="mb-3"><div className="flex items-start justify-between bg-amber-500/10 border border-amber-400/30 rounded p-2"><div><div className="font-medium text-amber-200">Preguntas de este GP</div><div className="text-xs text-amber-300">{owner?<>Autor: <b>{owner}</b> — {db.questionsStatus?.[race.key]?.published?"Publicadas":"Pendiente"}</>:"Sin autor asignado"}</div></div></div>{(owner===user && authorDeadline && now<authorDeadline && !(db.questionsStatus?.[race.key]?.locked)) && (<div id="owner-questions-editor" className="mt-2 space-y-2 bg-neutral-900 border border-white/10 rounded p-3"><div className="text-xs text-slate-300">Editor de preguntas (hasta 24h antes de quali)</div><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=>(<input key={i} className="select border rounded px-3 py-2 w-full" placeholder={"Pregunta "+(i+1)} value={(db.questions?.[race.key]?.[i]||"")} onChange={e=>{const curr=db.questions?.[race.key]||["","",""]; const next=[...curr]; next[i]=e.target.value; setDb(prev=>({...prev, questions:{...(prev.questions||{}), [race.key]: next}})); }}/>))}</div><div className="flex gap-2">{!db.questionsStatus?.[race.key]?.published ? (<button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={()=>{ const list=(db.questions?.[race.key]||["","",""]); if(list.some(q=>!q||!q.trim())) return toast.error("Rellena las 3 preguntas"); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [race.key]:{published:true, author:user, publishedAt:new Date().toISOString()}}})); toast.success("Publicado"); }}>Publicar</button>):(<button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>{ const list=(db.questions?.[race.key]||["","",""]); if(list.some(q=>!q||!q.trim())) return toast.error("Rellena las 3 preguntas"); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [race.key]:{...prev.questionsStatus[race.key], updatedAt:new Date().toISOString()}}})); toast.success("Actualizado"); }}>Actualizar</button>)}</div></div>)}</div>)}
      {race && isLate && canEdit && (
        <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30">
          <div className="font-semibold text-amber-200">⚠️ Apuesta fuera de plazo</div>
          <div className="text-sm text-amber-300/80 mt-1">El plazo de apuestas ha cerrado. Puedes apostar igualmente, pero se aplicará una <b>penalización de -2 puntos</b>. No apostar supone <b>-3 puntos</b>.</div>
        </div>
      )}
      {race && <BetForm key={race.key} bet={bet} disabled={!canEdit} late={isLate} questions={((db.questionsStatus?.[race.key]?.published||db.questionsStatus?.[race.key]?.force)?(questions||["","",""]):["","",""])} drivers={driverList} onSubmit={(b)=>{ const late=new Date()>=race.cutoff; setDb(prev=>{
        const timestamp=nowISO();
        const prevRaceBets={...(prev.bets?.[race.key]||{})};
        const prevBet=prevRaceBets[user];
        const nextBet={...prevBet,...b,submittedAt:timestamp,late};
        const nextBets={...(prev.bets||{}), [race.key]:{...prevRaceBets, [user]:nextBet}};
        let betHistory=prev.betHistory||{};
        if(!prevBet || !betsAreEqual(prevBet,b)){
          const raceHistory={...(betHistory[race.key]||{})};
          const userLog=[...(raceHistory[user]||[])];
          userLog.push({ts:timestamp,pole:b.pole||"",podium:[...(b.podium||["","",""])],q:[...(b.q||["","",""])],late});
          betHistory={...betHistory,[race.key]:{...raceHistory,[user]:userLog}};
        }
        return {...prev, bets:nextBets, betHistory};
      }); late?toast.warn("Apuesta registrada (fuera de plazo: penalización -2 pts)"):toast.success("Apuesta guardada correctamente"); }}/>}      
      {race && prevYearResult && REAL_HISTORICAL_2025_KEYS.includes(race.key) && (
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">📋 Resultado año anterior ({race.grand_prix} {CURRENT_SEASON_YEAR-1})</h3>
          <div className="text-sm text-slate-300 space-y-1">
            <div>Pole: <span className="text-emerald-300">{prevYearResult.pole||"—"}</span></div>
            <div>Podio: <span className="text-emerald-300">{(prevYearResult.podium||[]).join(" · ")}</span></div>
            {(prevYearResult.qAnswers||[]).length>0 && <div>Preguntas: <span className="text-amber-200">{(prevYearResult.qAnswers||[]).join(" · ")}</span></div>}
          </div>
        </div>
      )}
      {last3WithResults.length>0 && (
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">🏁 Últimos 3 GP de esta temporada</h3>
          <div className="space-y-2">
            {last3WithResults.map(r=>{
              const res=db.results?.[r.key];
              if(!res) return null;
              return (
                <div key={r.key} className="text-sm border-b border-slate-600/40 pb-2 last:border-0 last:pb-0">
                  <div className="font-medium text-slate-200">{r.round}. {r.grand_prix}</div>
                  <div className="text-xs text-slate-400">Pole: {res.pole||"—"} · Podio: {(res.podium||[]).join(" · ")} · Preg: {(res.qAnswers||[]).join(" · ")}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {race && prevYearPoints!=null && REAL_HISTORICAL_2025_KEYS.includes(race.key) && (
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-600/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">🏆 Tus puntos en este circuito ({CURRENT_SEASON_YEAR-1})</h3>
          <div className="text-lg font-bold text-emerald-300">{prevYearPoints} pts</div>
          <p className="text-xs text-slate-400 mt-1">Puntos que conseguiste en {race.grand_prix} la temporada pasada</p>
        </div>
      )}
      {last3RacesDisplay.length>0 && (
        <div className="mt-4 border border-white/10 rounded p-3 bg-neutral-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Puntos por carrera</h3>
            <span className="text-xs text-slate-400">Incluye bonus/penalizaciones</span>
          </div>
          <div className="space-y-2">
            {last3RacesDisplay.map(({race:rc,score,hasData})=>(
              <div key={rc.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-white/5 rounded px-2 py-2">
                <div className="text-sm font-medium">{rc.round}. {rc.grand_prix}</div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold">{hasData ? `${score.points} pts` : '—'}</span>
                  <span className="text-xs text-slate-300">TB1: {hasData ? score.tb1 : '—'}</span>
                  <span className="text-xs text-slate-300">Aciertos: {hasData ? score.hits : '—'}</span>
                  <span className="text-xs text-slate-300">Exactos: {hasData ? score.exact : '—'}</span>
                  {hasData && score.pen>0 && <span className="text-xs text-amber-300">Pen: {score.pen}</span>}
                  {hasData && score.manualAdj!==0 && <span className="text-xs text-emerald-300">Ajuste: {score.manualAdj>0?`+${score.manualAdj}`:score.manualAdj}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    {showOthersPanel && (<div className="card p-4 md:min-w-[220px] md:max-w-[320px] self-start"><h2 className="section-title mb-4">Apuestas de otros {showStatusOnly && <span className="text-xs text-emerald-300">(estado admin)</span>}</h2>
      {!race && <p className="text-sm text-slate-300">Selecciona un GP para ver apuestas.</p>}
      {race && showStatusOnly && (
        <ul className="space-y-2">
          {others.map(({name,bet})=>(<li key={name} className="border border-white/10 rounded p-3 bg-neutral-900 flex items-center gap-3">
            <Avatar name={name} avatar={db.meta?.avatars?.[name]} size="sm"/>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-slate-400">{bet?(bet.submittedAt?`Enviada ${new Date(bet.submittedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"Enviada"):"Sin apuesta"}</div>
            </div>
            {bet?.late && <span className="text-xs text-amber-300">Fuera de plazo</span>}
          </li>))}
        </ul>
      )}
      {race && !showStatusOnly && !canViewFull && <p className="text-sm text-slate-300">Se verán 1 minuto después del inicio de la quali (o si el admin las publica antes).</p>}
      {race && canViewFull && (
        <ul className="space-y-2">
          {others.map(({name,bet})=>(<li key={name} className="border border-white/10 rounded p-3 bg-neutral-900 flex items-center gap-3"><Avatar name={name} avatar={db.meta?.avatars?.[name]} size="sm"/><div className="flex-1 min-w-0"><div className="font-medium">{name}</div>{bet?<div className="text-sm"><div><b>Pole:</b> {bet.pole||"—"}</div><div><b>Podio:</b> {(bet.podium||["","",""]).join(" · ")}</div><div><b>P.Adic.:</b> {(bet.q||["","",""]).join(" · ")}</div></div>:<div className="text-xs text-slate-400">Sin apuesta</div>}</div></li>))}
        </ul>
      )}
    </div>)}
  </div>);
}

function WelcomeBanner({user,db,races,mode,onDismiss}){
  const standings=useMemo(()=>{
    if(mode==="f1") return computeGlobalStandings(db,races);
    const futbol=db.futbol||defaultFutbolState();
    const jornadas=listFutbolJornadas(futbol);
    const parts=Object.keys(db.participants||{});
    return computeFutbolStandings(futbol,parts,jornadas);
  },[db,races,mode]);
  const total=standings.length;
  const myIdx=standings.findIndex(s=>s.name===user);
  const pos=myIdx>=0?myIdx+1:null;
  const myPts=pos?standings[myIdx].points:0;
  const leader=standings[0];
  const last=standings[total-1];
  if(!pos||total<2) return null;

  const nextRaceKey=useMemo(()=>{
    if(mode!=="f1") return "futbol_current";
    const now=Date.now();
    const next=(races||[]).find(r=>r.qStart&&r.qStart.getTime()>now);
    return next?next.key:(races||[]).length?races[races.length-1].key:"unknown";
  },[races,mode]);
  const dismissKey=`porra_banner_${user}_${nextRaceKey}`;
  if(localStorage.getItem(dismissKey)==="1") return null;

  const gap=leader?leader.points-myPts:0;
  const gapToLast=last&&myIdx!==total-1?myPts-last.points:0;
  let emoji,title,msg;
  if(pos===1){
    emoji="🏆🍺";
    title="¡Vas líder, crack!";
    msg=total>2?`Llevas ${myPts} pts y ${standings[1]?standings[1].name:"nadie"} te persigue a ${standings[1]?myPts-standings[1].points:0} pts. ¡Las birras las paga ${last.name}!`:`Estás primero con ${myPts} pts. ¡Sigue así!`;
  }else if(pos===2){
    emoji="🥈😤";
    title="¡Casi, casi!";
    msg=`Estás a solo ${gap} pts de ${leader.name}. Un buen GP y te llevas las birras gratis. ¡${last.name} va último y se la juega!`;
  }else if(pos===3){
    emoji="🥉🍻";
    title="En el podio, pero no te relajes";
    msg=`A ${gap} pts del líder ${leader.name}. Ojo que solo ${gapToLast} pts te separan de pagar la ronda de ${last.name}.`;
  }else if(pos===total){
    emoji="💸🍺";
    title="¡Houston, tenemos un problema!";
    msg=`Vas último con ${myPts} pts. ${leader.name} lidera con ${leader.points} pts. Más te vale espabilar o te toca pagar TODAS las birras, ¡${user}!`;
  }else if(pos===total-1){
    emoji="😰🍺";
    title="¡Ojo, que huele a ronda!";
    msg=`Penúltimo a ${gapToLast} pts de ${last.name} que va último. Un mal GP y te toca sacar la cartera...`;
  }else{
    emoji="😏🍺";
    title="Ahí andas, buscando hueco";
    msg=`Posición ${pos}/${total} con ${myPts} pts. A ${gap} pts de ${leader.name}. No eres primero ni último... por ahora.`;
  }
  const otherStandings=standings.filter(s=>s.name!==user).slice(0,5);

  return (
    <div className="card card-racing p-4 md:p-5 relative overflow-hidden" style={{background:"linear-gradient(135deg,rgba(245,158,11,.06),rgba(225,6,0,.04),rgba(10,10,20,.6))"}}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{background:"linear-gradient(90deg,transparent,#f59e0b 20%,#e10600 50%,#f59e0b 80%,transparent)"}}></div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-2xl mb-1">{emoji}</div>
          <h3 className="text-base md:text-lg font-black text-white mb-1">{title}</h3>
          <p className="text-sm text-white/60 leading-relaxed">{msg}</p>
        </div>
        <button onClick={onDismiss} className="text-white/20 hover:text-white/60 text-lg transition-colors flex-shrink-0 mt-1" title="Cerrar">✕</button>
      </div>
      {otherStandings.length>0&&<div className="mt-3 pt-3 border-t border-white/5">
        <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2">Así van los birreros</div>
        <div className="flex flex-wrap gap-2">
          {standings.slice(0,total).map((s,i)=>{
            const isMe=s.name===user;
            const isFirst=i===0;
            const isLast=i===total-1&&total>1;
            return <div key={s.name} className={`text-xs px-2 py-1 rounded-lg border ${isMe?"bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold":isFirst?"bg-emerald-500/10 border-emerald-500/20 text-emerald-300":isLast?"bg-red-500/10 border-red-500/20 text-red-300":"bg-white/[.03] border-white/8 text-white/50"}`}>
              <span className="font-semibold">{i+1}.</span> {s.name} <span className="text-[10px] opacity-60">{s.points}pts</span>
              {isLast&&total>1&&<span className="ml-1">🍺</span>}
              {isFirst&&<span className="ml-1">👑</span>}
            </div>;
          })}
        </div>
      </div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={()=>{localStorage.setItem(dismissKey,"1");onDismiss();}} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70 transition-all">
          No mostrar hasta el próximo {mode==="f1"?"GP":"jornada"}
        </button>
        <button onClick={onDismiss} className="text-[11px] px-3 py-1.5 rounded-lg text-white/40 hover:text-white/60 transition-colors">Cerrar</button>
      </div>
    </div>
  );
}

function App(){
  const [db,setDb]=useState(loadDB()); const [cal,setCal]=useState([]); const [drivers,setDrivers]=useState([]); const [teams,setTeams]=useState([]); const [circuits,setCircuits]=useState({}); const [selectedRaceKey,setSelectedRaceKey]=useState(()=>sessionStorage.getItem("porra_selected_race")||""); useEffect(()=>{ if(selectedRaceKey&&!cal?.find(r=>r.key===selectedRaceKey)&&cal?.length) setSelectedRaceKey(cal[0].key); },[cal,selectedRaceKey]); useEffect(()=>{ if(selectedRaceKey) sessionStorage.setItem("porra_selected_race",selectedRaceKey); },[selectedRaceKey]); const [user,setUser]=useState(sessionStorage.getItem("porra_session_user")||""); const [view,setView]=useState("participante"); const [mode,setMode]=useState(()=>localStorage.getItem("porra_mode")||"f1"); const [showPass,setShowPass]=useState(false); const [showAvatar,setShowAvatar]=useState(false); const [showAI,setShowAI]=useState(false); const [hydrated,setHydrated]=useState(false); const [defaultPwdHash,setDefaultPwdHash]=useState("");
  const [showBanner,setShowBanner]=useState(false);
  const userActionRef=useRef(false);
  const setDbUser=useCallback((updater)=>{ userActionRef.current=true; setDb(prev=> typeof updater==="function" ? updater(prev) : updater); },[]);
  const logout=React.useCallback((reason)=>{
    sessionStorage.removeItem("porra_session_user");
    localStorage.removeItem("porra_user");
    sessionStorage.removeItem("admin_ok");
    setUser("");
    setView("participante");
    setShowPass(false);
    if(reason) toast(reason);
  },[]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const remote=await fetchRemoteState();
        if(remote && !cancelled){
          if(userActionRef.current){
            console.warn("Saltando carga remota: hay cambios locales recientes");
          } else {
            setDb(remote); saveDB(remote);
          }
        }
      }catch(err){ console.warn("No se pudo cargar estado remoto", err); }
      finally{ if(!cancelled) setHydrated(true); }
    })();
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    saveDB(db);
    if(!hydrated) return;
    saveRemoteState(db).catch(err=>console.warn("No se pudo guardar estado remoto", err));
  },[db,hydrated]);
  useEffect(()=>{ loadCalendar().then(setCal); loadDrivers().then(setDrivers); loadTeams().then(setTeams); loadCircuits().then(setCircuits).catch(()=>{}); hashPassword(DEFAULT_PASSWORD).then(setDefaultPwdHash).catch(err=>console.warn("No se pudo calcular hash por defecto",err)); },[]);
  useEffect(()=>{
    const stored=Number(localStorage.getItem("porra_last_active")||0);
    if(user && stored && Date.now()-stored>SESSION_TIMEOUT_MS){
      logout("Sesión caducada por inactividad (30 min). Vuelve a introducir la contraseña.");
      return;
    }
    if(!sessionStorage.getItem("porra_session_user") && user){
      logout();
      return;
    }
    const mark=()=>{ const ts=Date.now(); localStorage.setItem("porra_last_active", String(ts)); sessionStorage.setItem("porra_session_user", user); };
    mark();
    const onFocus=()=>mark();
    window.addEventListener("click", mark);
    window.addEventListener("keydown", mark);
    window.addEventListener("focus", onFocus);
    const id=setInterval(()=>{
      const last=Number(localStorage.getItem("porra_last_active")||0);
      if(user && last && Date.now()-last>SESSION_TIMEOUT_MS){
        logout("Sesión caducada por inactividad (30 min). Vuelve a introducir la contraseña.");
      }
    },60000);
    return ()=>{ window.removeEventListener("click", mark); window.removeEventListener("keydown", mark); window.removeEventListener("focus", onFocus); clearInterval(id); };
  },[user,logout]);
  useEffect(()=>{
    if(!hydrated) return;
    const entries=Object.entries(db.users||{}).filter(([_,u])=>u?.password && !u.passwordHash);
    if(!entries.length) return;
    (async()=>{
      const users={...(db.users||{})};
      for(const [name,u] of entries){
        try{
          const hash=await hashPassword(u.password);
          users[name]={...u,passwordHash:hash};
          delete users[name].password;
        }catch(err){ console.warn("No se pudo migrar pass de", name, err); }
      }
      setDbUser(prev=>({...prev, users}));
    })();
  },[hydrated,db.users,setDbUser]);
  useEffect(()=>{
    if(db.meta?.seeded || !defaultPwdHash) return;
    const initial=["Antonio","Carlos","Pere","Toni","Manrique"];
    setDb(prev=>{
      const baseUsers={...(prev.users||{})}; initial.forEach(n=>{ if(!baseUsers[n]) baseUsers[n]={name:n,passwordHash:defaultPwdHash,mustChange:true,isAdmin:n==="Manrique",blocked:false}; else if(baseUsers[n].password && !baseUsers[n].passwordHash){ baseUsers[n]={...baseUsers[n],passwordHash:defaultPwdHash}; delete baseUsers[n].password; } });
      const baseParticipants={...(prev.participants||{})}; initial.forEach(n=>{ if(!baseParticipants[n]) baseParticipants[n]={name:n,createdAt:nowISO()}; });
      const prevMeta=prev.meta||{};
      const championships=prevMeta.championships || {Carlos:1,Toni:1,Pere:1};
      const nextDrivers=drivers&&drivers.length?drivers:(prevMeta.drivers||[]);
      const nextTeams=teams&&teams.length?teams:(prevMeta.teams||[]);
      const basePoints=prevMeta.basePoints || {};
      return {...prev, users:baseUsers, participants:baseParticipants, meta:{...prevMeta, adminSecret:prevMeta.adminSecret||atob("bWFucmlxdWU="), drivers:nextDrivers, teams:nextTeams, championships, basePoints, seeded:true}};
    });
  },[drivers,teams,db.meta,defaultPwdHash]);
  useEffect(()=>{
    if(!hydrated) return;
    if(db.meta?.futbolJornadasUpdated) return;
    const futbol=db.futbol||defaultFutbolState();
    const order=futbol.order||[];
    const hasOldSeed=order.length>0 && order.every(id=>["J1","J2","J3"].includes(id));
    const needsUpdate=order.length===0||hasOldSeed;
    if(!needsUpdate) return;
    const defaultJornadas=[
      {id:"J28",name:"Jornada 28 (13-16 Mar)",deadline:new Date(2026,2,13,15,0).toISOString(),matches:[{home:"Real Madrid",away:"Elche"},{home:"FC Barcelona",away:"Sevilla"},{home:"Real Sociedad",away:"Osasuna"},{home:"Oviedo",away:"Valencia"}]},
      {id:"J29",name:"Jornada 29 (20-22 Mar)",deadline:new Date(2026,2,20,15,0).toISOString(),matches:[{home:"Real Madrid",away:"Atlético de Madrid"},{home:"FC Barcelona",away:"Rayo Vallecano"},{home:"Villarreal",away:"Real Sociedad"},{home:"Athletic Club",away:"Betis"}]},
      {id:"J30",name:"Jornada 30 (5 Abr)",deadline:new Date(2026,3,3,15,0).toISOString(),matches:[{home:"Mallorca",away:"Real Madrid"},{home:"Atlético de Madrid",away:"FC Barcelona"},{home:"Real Sociedad",away:"Levante"},{home:"Oviedo",away:"Sevilla"}]}
    ];
    setDb(prev=>{
      const f=prev.futbol||defaultFutbolState();
      let jornadas={...f.jornadas};
      let newOrder=[...f.order||[]];
      if(hasOldSeed){
        ["J1","J2","J3"].forEach(id=>{ delete jornadas[id]; newOrder=newOrder.filter(x=>x!==id); });
      }
      defaultJornadas.forEach(j=>{
        jornadas[j.id]=j;
        if(!newOrder.includes(j.id)) newOrder.push(j.id);
      });
      newOrder.sort((a,b)=>{ const na=parseInt(a.replace(/\D/g,""),10); const nb=parseInt(b.replace(/\D/g,""),10); return (na||0)-(nb||0)||a.localeCompare(b); });
      return {...prev, futbol:{...f, jornadas, order:newOrder}, meta:{...(prev.meta||{}), futbolJornadasUpdated:true}};
    });
  },[hydrated,db.futbol,db.meta]);
  const raceOverrides=db.meta?.raceOverrides||{};
  const races=(Array.isArray(cal)?cal:[]).map(item=>{
    const override=raceOverrides[item.key]||{};
    const timeZone=override.timezone||item.timezone||MADRID_TZ;
    const qDate=override.qDate || item.q_date_local || item.date_local;
    const qTime=override.qTime || item.qualifying_time_local;
    const raceDate=override.raceDate || item.race_date_local || item.date_local;
    const raceTime=override.raceTime || item.race_time_local;
    const qStart=toZonedDate(qDate,qTime,timeZone);
    const raceStart=raceTime?toZonedDate(raceDate,raceTime,timeZone):null;
    const cutoff=qStart?new Date(qStart.getTime()-60*1000):null;
    const showBetsAt=qStart?new Date(qStart.getTime()+60*1000):null;
    const authorCutoff=qStart?new Date(qStart.getTime()-24*60*60*1000):null;
    const labels=qStart?{qLocal:formatDateTime(qStart,timeZone), qMadrid:formatDateTime(qStart,MADRID_TZ), raceLocal:raceStart?formatDateTime(raceStart,timeZone):null, raceMadrid:raceStart?formatDateTime(raceStart,MADRID_TZ):null}:{qLocal:"—",qMadrid:"—",raceLocal:raceStart?formatDateTime(raceStart,timeZone):null,raceMadrid:raceStart?formatDateTime(raceStart,MADRID_TZ):null};
    return {...item,q_date_local:qDate,race_date_local:raceDate,timeZone,qStart,raceStart,cutoff,showBetsAt,authorCutoff,labels};
  }).filter(r=>r.qStart);
  useEffect(()=>{
    if(!races?.length || !hydrated) return;
    const participants=Object.keys(db.participants||{});
    if(!participants.length) return;
    const needsUpdate=races.some(r=>!db.questionOwner?.[r.key]);
    if(!needsUpdate) return;
    setDb(prev=>{
      const next={...prev, questionOwner:{...(prev.questionOwner||{})}};
      races.forEach(r=>{
        if(!next.questionOwner[r.key]){
          const idx=(r.round-1)%QUESTION_AUTHORS_ORDER.length;
          const author=QUESTION_AUTHORS_ORDER[idx];
          if(participants.includes(author)) next.questionOwner[r.key]=author;
        }
      });
      return next;
    });
  },[hydrated,races,db.participants,db.questionOwner]);
  useEffect(()=>{ document.body.dataset.porraMode=mode||"f1"; },[mode]);
  const sidebarRace=mode==="f1"&&view==="participante"&&selectedRaceKey?races?.find(r=>r.key===selectedRaceKey):null;
  const handleModeChange=(newMode)=>{
    setMode(newMode);
    localStorage.setItem("porra_mode",newMode);
    // Resetear vista si la actual no existe en el nuevo modo
    if(newMode==="f1" && !["participante","ranking","stats","questions","historico","rules","admin"].includes(view)){
      setView("participante");
    } else if(newMode==="futbol" && !["participante","ranking","rules","admin"].includes(view)){
      setView("participante");
    }
  };
  return (<div className="w-full max-w-4xl lg:max-w-5xl mx-auto p-3 md:p-4 space-y-4">
    <header className="hero speed-lines p-4 md:p-6">
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0" style={mode==="futbol"?{background:"linear-gradient(135deg,#16a34a,#d97706)",boxShadow:"0 4px 20px rgba(34,197,94,.2)"}:{background:"linear-gradient(135deg,#e10600,#d97706)",boxShadow:"0 4px 20px rgba(225,6,0,.2)"}}>
            <span className="text-lg md:text-xl">{mode==="f1"?"🏎️":"⚽"}</span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black tracking-tighter text-white" style={{fontStyle:"italic"}}>PORRA BIRREROS <span className="text-base md:text-lg" style={{verticalAlign:"middle"}}>🍺</span></div>
            <div className="text-[11px] text-white/35 font-semibold tracking-[.15em] uppercase">{mode==="f1"?"Formula 1 · 2026 · Las birras en juego":"Liga · Fútbol · Las birras en juego"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={`px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all ${mode==="f1"?"bg-red-600/25 text-white border border-red-500/30 shadow-lg shadow-red-600/10":"bg-white/5 text-white/40 border border-white/8 hover:bg-white/10 hover:text-white/70"}`} onClick={()=>handleModeChange("f1")}>F1</button>
          <button className={`px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all ${mode==="futbol"?"bg-emerald-600/25 text-white border border-emerald-500/30 shadow-lg shadow-emerald-600/10":"bg-white/5 text-white/40 border border-white/8 hover:bg-white/10 hover:text-white/70"}`} onClick={()=>handleModeChange("futbol")}>FUT</button>
          {user && <div className="hidden md:flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
            <Avatar name={user} avatar={db.meta?.avatars?.[user]} size="sm"/>
            <span className="text-sm font-semibold text-white/80">{user}</span>
            <button className="text-white/40 hover:text-white/70 text-xs ml-1 transition-colors" onClick={()=>setShowPass(true)}>🔑</button>
            <button className="text-white/40 hover:text-white/70 text-xs transition-colors" onClick={()=>logout()}>Salir</button>
          </div>}
        </div>
        {user && <div className="flex md:hidden items-center justify-center gap-3 text-xs pt-2 mt-1 border-t border-white/8">
          <div className="flex items-center gap-1.5"><Avatar name={user} avatar={db.meta?.avatars?.[user]} size="sm"/><span className="font-semibold text-white/70">{user}</span></div>
          <button className="text-white/35 hover:text-white/70 transition-colors" onClick={()=>setShowPass(true)}>Contraseña</button>
          <button className="text-white/40 hover:text-white/65 transition-colors" onClick={()=>logout()}>Salir</button>
        </div>}
      </div>
    </header>
    {user && <nav className="porra-nav justify-center" role="tablist" aria-label="Navegación principal">
      <button role="tab" aria-selected={view==="participante"} className={view==="participante"?"nav-active":""} onClick={()=>setView("participante")}>Mi apuesta</button>
      <button role="tab" aria-selected={view==="ranking"} className={view==="ranking"?"nav-active":""} onClick={()=>setView("ranking")}>Ranking</button>
      {mode==="f1" && <button role="tab" aria-selected={view==="stats"} className={view==="stats"?"nav-active":""} onClick={()=>setView("stats")}>Estadísticas</button>}
      {mode==="f1" && <button role="tab" aria-selected={view==="questions"} className={view==="questions"?"nav-active":""} onClick={()=>setView("questions")}>Preguntas</button>}
      {mode==="f1" && <button role="tab" aria-selected={view==="historico"} className={view==="historico"?"nav-active":""} onClick={()=>setView("historico")}>Histórico</button>}
      <button role="tab" aria-selected={view==="rules"} className={view==="rules"?"nav-active":""} onClick={()=>setView("rules")}>Normas</button>
      {mode==="f1" && <button className="nav-special flex items-center gap-1.5" onClick={()=>setShowAI(true)} aria-label="Abrir ManriBot"><img src="./assets/manribot.svg" alt="ManriBot" className="w-4 h-4"/> ManriBot</button>}
      <button role="tab" aria-selected={view==="admin"} className={view==="admin"?"nav-active":""} onClick={()=>setView("admin")}>⚙ Admin</button>
    </nav>}
    {!user ? (<div className="card card-racing beer-glow p-6 max-w-sm mx-auto"><h2 className="section-title text-center mb-1">Entra en la porra</h2><p className="text-center text-xs text-white/30 mb-4">🍺 Que empiecen las apuestas — y las birras</p><Login db={db} setDb={setDbUser} onLogged={(u)=>{ setUser(u); sessionStorage.setItem("porra_session_user", u); localStorage.setItem("porra_user", u); setShowBanner(true); }} /></div>) : (<>
      {showBanner && <WelcomeBanner user={user} db={db} races={races} mode={mode} onDismiss={()=>setShowBanner(false)}/>}
      <div className="md:flex md:gap-4"><aside className="sidebar p-4 w-52 shrink-0 hidden md:flex md:flex-col md:items-center gap-2"><Avatar name={user} avatar={db.meta?.avatars?.[user]}/><button type="button" className="text-[11px] text-white/40 hover:text-white/60 transition-colors mt-1" onClick={()=>setShowAvatar(true)}>Cambiar avatar</button><div className="text-[10px] text-amber-400/20 mt-1 tracking-wider uppercase">birreros club</div>{sidebarRace&&<div className="mt-2 w-full"><CircuitCard race={sidebarRace} circuits={circuits} compact/></div>}</aside><main className="flex-1 space-y-4 min-w-0">
        {mode==="f1" && (
          <>
            {view==="participante" && <Participante user={user} races={races} db={db} setDb={setDbUser} drivers={drivers} circuits={circuits} selectedRaceKey={mode==="f1"?selectedRaceKey:""} setSelectedRaceKey={mode==="f1"?setSelectedRaceKey:()=>{}}/>}
            {view==="admin" && <Admin db={db} setDb={setDbUser} races={races} drivers={drivers} teams={teams} calendar={cal}/>}
            {view==="ranking" && <Ranking db={db} setDb={setDbUser} races={races} currentUser={user}/>}
            {view==="stats" && <Stats db={db} races={races}/>}
            {view==="questions" && <QuestionsHistory db={db} races={races}/>}
            {view==="historico" && <Historico/>}
            {view==="rules" && <F1Rules/>}
          </>
        )}
        {mode==="futbol" && (
          <>
            {view==="participante" && <FutbolParticipante user={user} db={db} setDb={setDbUser}/>}
            {view==="admin" && <FutbolAdmin db={db} setDb={setDbUser} currentUser={user}/>}
            {view==="ranking" && <FutbolRanking db={db}/>}
            {view==="rules" && <FutbolRules/>}
          </>
        )}
      </main></div>
    </>)}
    <footer className="text-[11px] text-white/35 pt-8 pb-6 text-center tracking-widest uppercase font-medium"><span className="beer-icon">🍺</span> Porra Birreros · Quien pierde, pone las birras <span className="beer-icon">🍻</span> {mode==="f1"?"A todo gas":"Gol y cerveza"} <span className="beer-icon">🍺</span></footer>
    <ChangePasswordModal open={showPass} onClose={()=>setShowPass(false)} db={db} setDb={setDbUser} user={user} /><ChangeAvatarModal open={showAvatar} onClose={()=>setShowAvatar(false)} db={db} setDb={setDbUser} user={user} />
    <AIAssistant open={showAI} onClose={()=>setShowAI(false)} races={races} />
    <ToastContainer/>
  </div>);
}

try {
  if (!document.getElementById("root")) {
    console.error("[Porra] No se encontró el elemento #root");
    document.body.innerHTML = '<div style="padding:20px;color:red;background:white;">Error: No se encontró el elemento #root</div>';
  } else if (typeof React === "undefined" || typeof ReactDOM === "undefined") {
    console.error("[Porra] React o ReactDOM no están cargados");
    document.getElementById("root").innerHTML = '<div style="padding:20px;color:red;background:white;">Error: React no está cargado. Verifica que los archivos vendor se carguen correctamente.</div>';
  } else {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(React.createElement(App));
    console.info("[Porra] Aplicación renderizada correctamente");
  }
} catch (error) {
  console.error("[Porra] Error al renderizar:", error);
  const rootEl = document.getElementById("root");
  if (rootEl) {
    const esc=s=>(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    rootEl.innerHTML = `<div style="padding:20px;color:red;background:white;font-family:monospace;">
      <h2>Error al cargar la aplicación</h2>
      <p>${esc(error.message)}</p>
      <pre>${esc(error.stack)}</pre>
      <p>Por favor, abre la consola del navegador (F12) para más detalles.</p>
    </div>`;
  }
}
