
/* global React, ReactDOM */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const CACHE_BUST = "v20250310";
console.info("[PorraF1] Versión carga", CACHE_BUST);

const LS_KEY = "porra_f1_clean_v3";
const DEFAULT_PASSWORD = "B1rr3r0s";
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

async function loadCalendar(){ const r = await fetch(`./assets/calendar_2025_last3.json?${CACHE_BUST}`); return r.json(); }
async function loadDrivers(){ const r = await fetch(`./assets/drivers_2025.json?${CACHE_BUST}`); return r.json(); }
async function hashPassword(pwd){
  const data=new TextEncoder().encode(pwd||"");
  const digest=await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function passwordMatches(user,pwd){
  if(!user) return false;
  if(user.passwordHash){
    const h=await hashPassword(pwd);
    return h===user.passwordHash;
  }
  if(user.password){
    return user.password===pwd;
  }
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
  if(!res) return {pending:true,points:0,exact:0,signs:0,qHits:0,missed:false,catPenalty:0,missingPenalty:0,late:!!bet?.late,items:[]};
  const validBet=!!bet && !bet.late;
  const predictions=validBet?(bet.matches||[]):[];
  const questions=validBet?(bet.questions||[]):[];
  const late=!!bet?.late;
  let points=0; let exact=0; let signs=0; let qHits=0; const items=[];
  const official=res.matches||[];
  official.forEach((m,idx)=>{
    const pred=predictions[idx];
    const {points:p,exact:ex,sign}=futbolMatchPoints(pred,m);
    points+=p; if(ex) exact++; if(sign) signs++;
    items.push({label:`${jornada?.matches?.[idx]?.home||"Local"} ${pred?.home??"?"}-${pred?.away??"?"} vs ${m?.home??"?"}-${m?.away??"?"}`, delta:p});
  });
  const answers=res.qAnswers||[];
  answers.forEach((ans,idx)=>{
    const sel=(questions[idx]||"").trim();
    const ok=ans && sel && sel.toLowerCase()===ans.trim().toLowerCase();
    if(ok){ points+=2; qHits++; }
    items.push({label:`Pregunta ${idx+1}: ${sel||"—"} vs ${ans||"—"}`, delta:ok?2:0});
  });
  const missed=!bet || late;
  let missingPenalty=0;
  if(missed){ missingPenalty=-2; points+=missingPenalty; items.push({label:"Sin apuesta a tiempo", delta:missingPenalty}); }
  let catPenalty=0;
  if(!missed && points===0){ catPenalty=-1; points+=catPenalty; items.push({label:"Apuesta catastrófica", delta:catPenalty}); }
  return {pending:false,points,exact,signs,qHits,missed,late,catPenalty,missingPenalty,items};
}
function computeFutbolStandings(dbFutbol,participants,jornadas){
  const completed=(jornadas||[]).filter(j=>dbFutbol.results?.[j.id]);
  return participants.map(name=>{
    return completed.reduce((acc,j)=>{
      const s=scoreFutbolJornada({futbol:dbFutbol},j.id,name);
      acc.points+=s.points; acc.exact+=s.exact; acc.qHits+=s.qHits; acc.signs+=s.signs; acc.missed+=s.missed?1:0; acc.cat+=s.catPenalty?1:0; return acc;
    },{name,points:0,exact:0,signs:0,qHits:0,missed:0,cat:0});
  }).sort((a,b)=>b.points-a.points||b.exact-a.exact||b.qHits-a.qHits||b.signs-a.signs||a.missed-b.missed||a.name.localeCompare(b.name));
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

function Avatar({name}){
  const src = `./assets/avatars/${name.toLowerCase()}.svg`; return <img src={src} alt={name} className="w-28 h-32 rounded-xl object-cover" />;
}

function ChangePasswordModal({open,onClose,db,setDb,user}){
  const [curr,setCurr]=React.useState("");
  const [n1,setN1]=React.useState("");
  const [n2,setN2]=React.useState("");
  if(!open) return null;
  const submit=async (e)=>{
    e.preventDefault();
    const u=db.users?.[user]; if(!u) return alert("Usuario no válido");
    const ok=await passwordMatches(u,curr);
    if(!ok) return alert("Contraseña actual incorrecta");
    if(n1.length<6) return alert("Mínimo 6 caracteres");
    if(n1!==n2) return alert("No coinciden");
    const hash=await hashPassword(n1);
    setDb(prev=>{ const users={...(prev.users||{})}; users[user]={...users[user],passwordHash:hash,mustChange:false,changedAt:new Date().toISOString()}; delete users[user].password; return {...prev,users}; });
    alert("Contraseña actualizada"); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white text-slate-900 rounded-xl p-5 w-96">
        <div className="font-semibold mb-2">Cambiar contraseña</div>
        <form onSubmit={submit} className="grid gap-2">
          <label className="text-sm">Actual</label><input type="password" className="border rounded px-3 py-2" value={curr} onChange={e=>setCurr(e.target.value)} />
          <label className="text-sm">Nueva</label><input type="password" className="border rounded px-3 py-2" value={n1} onChange={e=>setN1(e.target.value)} />
          <label className="text-sm">Repetir nueva</label><input type="password" className="border rounded px-3 py-2" value={n2} onChange={e=>setN2(e.target.value)} />
          <div className="flex gap-2 mt-2 justify-end"><button type="button" className="px-3 py-2 rounded bg-slate-200" onClick={onClose}>Cancelar</button><button className="px-3 py-2 rounded bg-slate-900 text-white">Guardar</button></div>
        </form>
      </div>
    </div>
  );
}

function Login({db,setDb,onLogged}){
  const [name,setName]=useState(""); const [pass,setPass]=useState("");
  const [needsChange,setNeedsChange]=useState(false); const [n1,setN1]=useState(""); const [n2,setN2]=useState("");
  const tryLogin=async (e)=>{ e&&e.preventDefault(); const u=db.users?.[name]; if(!u) return alert("Usuario no encontrado"); const ok=await passwordMatches(u,pass); if(!ok) return alert("Contraseña incorrecta"); if(u.blocked) return alert("Usuario bloqueado temporalmente"); if(u.mustChange){ setNeedsChange(true); return; } if(u.password && !u.passwordHash){ const hash=await hashPassword(pass); setDb(prev=>{ const users={...(prev.users||{})}; users[name]={...users[name],passwordHash:hash}; delete users[name].password; return {...prev,users}; }); } onLogged(name); };
  const doChange=async (e)=>{ e.preventDefault(); if(n1.length<6) return alert("Mínimo 6 caracteres"); if(n1!==n2) return alert("No coinciden"); const hash=await hashPassword(n1); setDb(prev=>{ const users={...(prev.users||{})}; users[name]={...users[name],passwordHash:hash,mustChange:false,changedAt:nowISO()}; delete users[name].password; return {...prev,users}; }); onLogged(name); };
  return (
    <div className="grid gap-2 max-w-md">
      {!needsChange ? (
        <form onSubmit={tryLogin} className="grid gap-2">
          <label className="text-sm">Usuario</label>
          <select className="select border rounded px-3 py-2 text-base" value={name} onChange={e=>setName(e.target.value)}>
            <option value="">— elige —</option>
            {Object.keys(db.users||{}).sort().map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-sm mt-2">Contraseña</label>
          <input type="password" className="select border rounded px-3 py-2" value={pass} onChange={e=>setPass(e.target.value)} />
          <button className="mt-2 px-4 py-2 rounded bg-slate-900 text-white" onClick={tryLogin}>Entrar</button>
        </form>
      ) : (
        <form onSubmit={doChange} className="grid gap-2">
          <div className="text-sm text-amber-300">Es tu primer acceso. Cambia tu contraseña.</div>
          <label className="text-sm">Nueva contraseña</label><input type="password" className="select border rounded px-3 py-2" value={n1} onChange={e=>setN1(e.target.value)} />
          <label className="text-sm">Repite la nueva contraseña</label><input type="password" className="select border rounded px-3 py-2" value={n2} onChange={e=>setN2(e.target.value)} />
          <button className="mt-2 px-4 py-2 rounded bg-emerald-600 text-white">Guardar y entrar</button>
        </form>
      )}
    </div>
  );
}

function SelectDriver({value,onChange,drivers,placeholder}){
  return <select className="select border rounded px-3 py-2" value={value||""} onChange={e=>onChange(e.target.value)}><option value="">{placeholder}</option>{drivers.map(d=><option key={d} value={d}>{d}</option>)}</select>;
}

function BetForm({bet,disabled,onSubmit,questions,drivers}){
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
      <button disabled={disabled} className={`mt-3 px-4 py-2 rounded ${disabled?"bg-slate-200 text-slate-500":"bg-emerald-600 text-white"}`}>{disabled?"Cerrado":"Guardar apuesta"}</button>
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
  const bet=db.bets?.[raceKey]?.[name]; const res=db.results?.[raceKey]; if(!bet) return {points:0,tb1:999,hits:0,exact:0,pen:0,gotPole:false,gotAllPodium:false,gotAllQuestions:false,fullHouse:false};
  let pts=0,hits=0,pen=0,exact=0;
  if(res?.pole && bet.pole===res.pole){pts++;hits++;}
  if(res?.podium){ bet.podium?.forEach((p,i)=>{ if(p===res.podium[i]){pts++;hits++;} }); }
  if(res?.qAnswers){ bet.q?.forEach((a,i)=>{ if((a||'').toLowerCase().trim()===(res.qAnswers[i]||'').toLowerCase().trim()){pts++;hits++;} }); }
  const gotPole=res?.pole && bet.pole===res.pole; const gotAllPod=res?.podium && bet.podium?.every((p,i)=>p===res.podium[i]); const gotAllQ=res?.qAnswers && bet.q?.every((a,i)=>(a||'').toLowerCase().trim()===(res.qAnswers[i]||'').toLowerCase().trim());
  if(gotPole && gotAllPod) pts+=2; if(gotPole && gotAllPod && gotAllQ) pts+=2;
  if(!bet.pole && (!bet.podium || bet.podium.filter(Boolean).length<3)){pts-=1;pen++;}
  if(bet.late){pts-=3;pen++;}
  const pos=(p)=>{const i=res?.podium?.indexOf(p); return i>=0?i+1:99;}; const tb1=(bet.podium||[]).slice(0,3).reduce((a,p)=>a+pos(p),0);
  if(gotAllPod) exact=1; const fullHouse=!!(gotPole && gotAllPod && gotAllQ);
  const manualAdj=Number(db.scoreAdjustments?.[raceKey]?.[name]||0) || 0;
  const finalPoints=pts+manualAdj;
  return {points:finalPoints,tb1,hits,exact,pen,gotPole:!!gotPole,gotAllPodium:!!gotAllPod,gotAllQuestions:!!gotAllQ,fullHouse,manualAdj};
}

function computeGlobalStandings(db,races){
  const participants=Object.keys(db.participants||{});
  const keys=(races||[]).map(r=>r.key);
  return participants.map(name=>keys.reduce((acc,k)=>{
    const s=scoreForRace(db,k,name);
    acc.points+=s.points; acc.tb2+=s.tb1; acc.hits+=s.hits; acc.exact+=s.exact; acc.pen+=s.pen; return acc;
  },{name,points:0,tb2:0,hits:0,exact:0,pen:0})).sort((A,B)=>B.points-A.points||A.tb2-B.tb2||B.hits-A.hits||B.exact-A.exact||A.pen-B.pen||A.name.localeCompare(B.name));
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
  if(!bet) return {points:0, items:[{label:"Sin apuesta enviada", delta:0}]};
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
  if(bet.late) push("Penalización por fuera de plazo",-3);
  if(manualAdj!==0) push("Ajuste manual", manualAdj);
  return {points:pts, items};
}

function Ranking({db,races,setDb,currentUser}){
  const [scope,setScope]=useState("all"); const participants=Object.keys(db.participants||{});
  const isAdmin=!!db.users?.[currentUser]?.isAdmin;
  const forceAuto=!!db.meta?.forceAutoStandings;
  const backupDefaults={Antonio:38,Carlos:17,Manrique:25,Pere:44,Toni:25};
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
  const computedData=useMemo(()=>{ if(scope==="all"){ const keys=(races||[]).map(r=>r.key); return participants.map(n=>keys.reduce((acc,k)=>{const s=scoreForRace(db,k,n); acc.points+=s.points;acc.tb2+=s.tb1;acc.tb3+=s.hits;acc.tb4+=s.exact;acc.pen+=s.pen;return acc;},{name:n,points:Number(basePoints[n]||0),tb2:0,tb3:0,tb4:0,pen:0})).sort((A,B)=>B.points-A.points||A.tb2-B.tb2||B.tb3-A.tb3||B.tb4-A.tb4||A.pen-B.pen||A.name.localeCompare(B.name)); } else { const k=scope; return participants.map(n=>{const s=scoreForRace(db,k,n); return {name:n,points:s.points,tb1:s.tb1,tb3:s.hits,tb4:s.exact,pen:s.pen};}).sort((A,B)=>B.points-A.points||A.tb1-B.tb1||B.tb3-A.tb3||B.tb4-A.tb4||A.pen-B.pen||A.name.localeCompare(B.name)); } },[db,races,scope,participants,basePoints]);
  const manualActive=scope==="all" && manualStandings.length>0 && !forceAuto;
  const data=manualActive?manualStandings.map((item,idx)=>({name:item.name,points:item.points,tb2:"—",tb3:"—",tb4:"—",pen:"—",manualRank:item.rank??(idx+1)})):computedData;
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
  return (<div className="space-y-4">
    <div className="card p-4"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Ranking</h2><select className="select select-strong border rounded px-3 py-2 shadow-sm" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Global</option>{(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix}</option>)}</select></div><div className="overflow-x-auto"><table className="min-w-[800px] text-sm"><thead><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Participante</th><th className="p-2 text-left">Puntos</th><th className="p-2 text-left">{scope==="all"?"TB2 Σ":"TB1 Σ"}</th><th className="p-2 text-left">Aciertos</th><th className="p-2 text-left">Orden exacto</th><th className="p-2 text-left">Penalizaciones</th></tr></thead><tbody>{data.map((r,i)=>(<tr key={r.name} className="border-t border-white/10"><td className="p-2">{manualActive?(r.manualRank||i+1):i+1}</td><td className="p-2">{r.name}</td><td className="p-2 font-semibold">{r.points}</td><td className="p-2">{scope==="all"?r.tb2:r.tb1}</td><td className="p-2">{r.tb3}</td><td className="p-2">{r.tb4}</td><td className="p-2">{r.pen}</td></tr>))}</tbody></table></div>{manualActive?<div className="text-xs text-amber-300 mt-2 flex flex-wrap items-center gap-2">Mostrando clasificación importada desde backup.<button className="px-2 py-1 rounded bg-slate-800 text-white" onClick={resetManual}>Usar automática + sumar backup</button></div>:<p className="text-xs text-slate-300 mt-2">Desempates: puntos, TB1 (menor), TB2 global (menor), aciertos, orden exacto y menos penalizaciones.</p>}{!manualActive && baseEntries.length>0 && <p className="text-xs text-emerald-300 mt-1">Incluye puntos base importados: {baseEntries.map(([n,v])=>`${n} ${v}`).join(" · ")}</p>}</div>
    <RaceBreakdown db={db} races={races} raceKey={scope} rows={data} />
    <div className="card p-4"><h3 className="font-semibold mb-2">Ranking campeonatos mundiales</h3>{champData.length?(<ul className="space-y-2">{champData.map((item,idx)=>(<li key={item.name} className="flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900"><span className="font-medium">{idx+1}. {item.name}</span><span className="text-sm">{item.titles} 🏆</span></li>))}</ul>):(<p className="text-sm text-slate-300">No hay participantes registrados.</p>)}<p className="text-xs text-slate-400 mt-2">Se edita desde Admin &gt; Campeonatos mundiales.</p></div>
    {isAdmin && setDb && (
      <div className="card p-4 space-y-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold">Puntos base (backup inicial)</h3>
            <p className="text-xs text-slate-400">Se suman al cálculo automático del global. Úsalos si vienes de un backup.</p>
          </div>
          {scope!=="all" && <button className="text-xs underline" onClick={()=>setScope("all")}>Ir a Global para editar</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-emerald-700 text-white text-sm" onClick={()=>{ setDb(prev=>({...prev, meta:{...(prev.meta||{}), basePoints:{...backupDefaults}, forceAutoStandings:true}})); }}>Cargar valores del backup</button>
          <button className="px-3 py-2 rounded bg-slate-800 text-white text-sm" onClick={()=>{ participants.forEach(n=>updateBasePoint(n,0)); }}>Resetear a 0</button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {participants.map(name=>{
            const val=Number(basePoints[name]||0);
            const disabled=scope!=="all";
            return (
              <label key={name} className={`flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900 text-sm ${disabled?"opacity-60":""}`}>
                <span>{name}</span>
                <input disabled={disabled} type="number" className="w-24 text-right select border rounded px-2 py-1" value={val} onChange={e=>{ const parsed=parseInt(e.target.value,10); updateBasePoint(name, Number.isNaN(parsed)?0:parsed); }} />
              </label>
            );
          })}
        </div>
      </div>
    )}
  </div>);
}
function RaceBreakdown({db,races,raceKey,rows}){
  if(!raceKey || raceKey==="all"){
    const latest=(races||[]).find(r=>db.results?.[r.key]);
    return <div className="card p-4"><h3 className="font-semibold">Detalle puntos</h3><p className="text-sm text-slate-300">{latest?"Selecciona un GP en el selector de arriba para ver su desglose.":"No hay resultados publicados aún."}</p></div>;
  }
  const race=(races||[]).find(r=>r.key===raceKey);
  const res=db.results?.[raceKey];
  if(!res) return <div className="card p-4"><h3 className="font-semibold">Detalle puntos — {race?.grand_prix||raceKey}</h3><p className="text-sm text-slate-300">Añade resultados oficiales para ver el desglose.</p></div>;
  const podium=res.podium||["","",""]; const questions=res.qAnswers||["","",""];
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">Detalle puntos — {race?.grand_prix||raceKey}</h3>
        <div className="text-sm text-slate-300">Oficial: Pole {res.pole||"—"} · Podio {podium.join(" · ")} · Preguntas {questions.join(" · ")}</div>
        <div className="text-xs text-slate-400">Desempates en la tabla superior: puntos, TB1 (suma de posiciones), aciertos, orden exacto, penalizaciones.</div>
      </div>
      <div className="grid gap-3">
        {rows.map(row=>{
          const bet=db.bets?.[raceKey]?.[row.name];
          const manualAdj=db.scoreAdjustments?.[raceKey]?.[row.name]||0;
          const detail=describeBetAgainstResult(bet,res,manualAdj);
          return (
            <div key={row.name} className="border border-white/10 rounded p-3 bg-neutral-900">
              <div className="flex items-center justify-between">
                <div className="font-medium">{row.name}</div>
                <div className="text-sm">{row.points} pts {bet?.late && <span className="text-xs text-amber-300 ml-2">(tarde)</span>}</div>
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
  return (<div className="card p-4 space-y-3"><h2 className="font-semibold">Histórico de preguntas</h2>{(races||[]).map(r=>{ const qs=db.questions?.[r.key]||["","",""]; const st=db.questionsStatus?.[r.key]; const owner=db.questionOwner?.[r.key]||""; return (<div key={r.key} className="border border-white/10 rounded p-3 bg-neutral-900"><div className="flex items-center justify-between"><div className="font-medium">{r.round}. {r.grand_prix} — <span className="text-slate-300">{r.date_local}</span></div><div className="text-xs">{st?.published?<span className="text-emerald-400">Publicado</span>:<span className="text-amber-400">Pendiente</span>}</div></div><div className="text-xs text-slate-300">Autor: {owner||"—"}</div>{st?.published?<ol className="list-decimal pl-5 text-sm">{qs.map((q,i)=><li key={i}>{q||"—"}</li>)}</ol>:<div className="text-sm text-slate-400">Aún no publicadas.</div>}</div>); })}</div>);
}

function Stats({db,races}){
  const stats=useMemo(()=>buildStats(db,races),[db,races]);
  const renderList=(items,emptyLabel,formatter)=> items?.length ? (
    <ul className="space-y-1 text-sm mt-1">{items.map((item,idx)=><li key={idx} className="flex items-center justify-between border border-white/10 rounded px-2 py-1 bg-neutral-900"><span>{idx+1}. {formatter?formatter(item):item.name}</span><span className="text-xs text-slate-300">{item.value!=null?item.value:""}</span></li>)}</ul>
  ) : (<p className="text-sm text-slate-400">{emptyLabel}</p>);
  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Estadísticas</h2>
        <p className="text-xs text-slate-400">Solo se calculan con carreras que ya tienen resultados publicados.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-white/10 rounded p-3 bg-neutral-900">
            <h3 className="font-semibold mb-1">Más carreras ganadas</h3>
            {renderList(stats.winners,"Aún no hay ganadores registrados.",(item)=>`${item.name}`)} 
            <h3 className="font-semibold mt-3 mb-1">Plenos (pole+podio+preguntas)</h3>
            {renderList(stats.fulls,"Nadie ha hecho pleno todavía.",(item)=>`${item.name}`)}
            <h3 className="font-semibold mt-3 mb-1">Más aciertos totales</h3>
            {renderList(stats.hitsLeaders,"Sin aciertos calculados.",(item)=>`${item.name}`)}
          </div>
          <div className="border border-white/10 rounded p-3 bg-neutral-900">
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

function FutbolRules(){
  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-semibold text-lg">📋 Chuleta porra futbolera</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-slate-200">
        <li>4 partidos por jornada: Madrid, Barça, Real Sociedad y Sporting. Si se enfrentan entre ellos, mete partido(s) de reserva hasta llegar a 4.</li>
        <li>Límite para apostar: viernes 15:00 (marcadores + respuestas a 3 preguntas).</li>
        <li>Puntos partidos: 3 por resultado exacto, 1 por acertar el signo (1X2), 0 si fallas.</li>
        <li>Preguntas extra: 3 por jornada, cada acierto vale 2 puntos. Máximo jornada = 18 puntos.</li>
        <li>No apostar a tiempo: 0 puntos + -2 puntos en la general. Con 3 jornadas sin apostar → eliminado.</li>
        <li>Apuestas catastróficas (0 puntos en todo): -1 punto extra en la general.</li>
        <li>Desempate: más exactos → más preguntas acertadas → más signos → segunda vuelta → duelo especial → sorteo.</li>
      </ul>
      <p className="text-xs text-slate-400">Las reglas se aplican a la porra de fútbol; la de F1 sigue con sus normas actuales.</p>
    </div>
  );
}

function FutbolBetForm({jornada,bet,disabled,onSubmit}){
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
    <form className="grid gap-3" onSubmit={submit}>
      <div className="space-y-2">
        {matches.map((m,idx)=>(
          <div key={idx} className="border border-white/10 rounded p-2 bg-neutral-900">
            <div className="text-sm font-medium mb-1">Partido {idx+1}: {m.home||"Local"} vs {m.away||"Visitante"}</div>
            <div className="grid grid-cols-2 gap-2">
              <input disabled={disabled} type="number" min="0" className="select border rounded px-3 py-2" placeholder="Goles local" value={scores[idx]?.home} onChange={e=>handleScoreChange(idx,"home",e.target.value)} />
              <input disabled={disabled} type="number" min="0" className="select border rounded px-3 py-2" placeholder="Goles visitante" value={scores[idx]?.away} onChange={e=>handleScoreChange(idx,"away",e.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold">Preguntas</div>
        <div className="grid gap-2 md:grid-cols-3">
          {[0,1,2].map(i=>(
            <input key={i} disabled={disabled} className="select border rounded px-3 py-2" placeholder={`Respuesta ${i+1}`} value={qs[i]||""} onChange={e=>setQs(prev=>{ const next=[...(prev||["","",""])]; next[i]=e.target.value; return next; })} />
          ))}
        </div>
      </div>
      <button disabled={disabled} className={`mt-2 px-4 py-2 rounded ${disabled?"bg-slate-200 text-slate-500":"bg-emerald-600 text-white"}`}>{disabled?"Cerrado":"Guardar apuesta"}</button>
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
  const baseCanEdit=deadline ? now<deadline : true;
  const canEdit=manualWindow?.forceClosed?false:manualWindow?.forceOpen?true:baseCanEdit;
  const revealAt=deadline?new Date(deadline.getTime()+60*1000):null;
  const canViewFull=manualReveal?.forceShow || (!!revealAt && now>revealAt);
  const bet=jornada ? (futbol.bets?.[selected]?.[user]||{matches:[],questions:["","",""],submittedAt:null,late:false}) : null;
  const res=jornada ? futbol.results?.[selected] : null;
  const others=Object.keys(db.participants||{}).filter(n=>n!==user).map(name=>({name,bet:jornada?futbol.bets?.[selected]?.[name]:null}));
  const myScore=jornada && res ? scoreFutbolJornada(db,selected,user) : null;
  const betsStatus=jornada ? (manualWindow?.forceClosed?"Cerrado por admin":manualWindow?.forceOpen?"Abierto por admin":(deadline?`Cierre automático: ${formatDateTime(deadline,MADRID_TZ)}`:"Abierto")) : "—";
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
    alert(late?"Apuesta registrada (fuera de plazo)":"Apuesta guardada");
  };
  const showOthersPanel=showOthers && !!jornada;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]":"";
  return (
    <div className={`grid gap-4 ${layoutCols}`}>
      <div className="card p-4 min-w-0">
        <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold">Tu apuesta (fútbol)</h2>
          {jornada && (<button type="button" className="text-sm px-3 py-1.5 rounded bg-neutral-900 text-white" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar apuestas":"Ver apuestas de otros"}</button>)}
        </div>
        <select className="select select-strong border rounded px-3 py-2 mb-3 shadow-sm" value={selected} onChange={e=>setSelected(e.target.value)}>
          {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id} {j.deadline?`— ${new Date(j.deadline).toLocaleDateString("es-ES")}`:""}</option>)}
        </select>
        {jornada ? (
          <div className="text-sm text-slate-200 mb-3 space-y-1">
            <div>Partidos: {jornada.matches?.length||0} (Madrid · Barça · Real Sociedad · Sporting)</div>
            <div>Cierre apuestas: {deadline?formatDateTime(deadline,MADRID_TZ):"Sin límite (define en Admin)"}</div>
            <div>Estado apuestas: {betsStatus}</div>
            <div>Visibilidad: {manualReveal?.forceShow?"Publicadas por admin":"Se verán tras el cierre (o si se publican antes)"}</div>
          </div>
        ) : (
          <p className="text-sm text-slate-300 mb-3">No hay jornadas creadas. Pide al admin que añada una.</p>
        )}
        {jornada && (
          <FutbolBetForm jornada={jornada} bet={bet} disabled={!canEdit} onSubmit={saveBet} />
        )}
        {myScore && (
          <div className="mt-4 border border-white/10 rounded p-3 bg-neutral-900">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Puntos jornada</h3>
              <span className="text-sm font-semibold">{myScore.points} pts</span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-3">
              <span>Exactos: {myScore.exact}</span>
              <span>Signos: {myScore.signs}</span>
              <span>Preguntas: {myScore.qHits}</span>
              {myScore.missed && <span className="text-amber-300">Sin apuesta a tiempo (-2)</span>}
              {myScore.catPenalty<0 && <span className="text-amber-300">Catastrófica (-1)</span>}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {myScore.items.map((item,idx)=>(<li key={idx} className="flex items-center justify-between border border-white/5 rounded px-2 py-1"><span>{item.label}</span><span className={`${item.delta>0?"text-emerald-300":item.delta<0?"text-amber-300":"text-slate-400"}`}>{item.delta>0?`+${item.delta}`:item.delta}</span></li>))}
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
          <h2 className="font-semibold mb-4">Apuestas de otros</h2>
          {!jornada && <p className="text-sm text-slate-300">Selecciona una jornada.</p>}
          {jornada && !canViewFull && <p className="text-sm text-slate-300">Se publicarán tras el cierre o si el admin las muestra antes.</p>}
          {jornada && canViewFull && (
            <ul className="space-y-2">
              {others.map(({name,bet:other})=>(
                <li key={name} className="border border-white/10 rounded p-3 bg-neutral-900">
                  <div className="font-medium">{name}</div>
                  {other ? (
                    <div className="text-xs space-y-1 mt-1">
                      {(jornada.matches||[]).map((m,idx)=><div key={idx}><b>{m.home||"Local"}-{m.away||"Visitante"}:</b> {other.matches?.[idx]?.home??"—"}-{other.matches?.[idx]?.away??"—"}</div>)}
                      <div><b>P.Adic.:</b> {(other.questions||["","",""]).join(" · ")}</div>
                      {other.late && <div className="text-amber-300">Fuera de plazo</div>}
                    </div>
                  ) : (<div className="text-xs text-slate-400">Sin apuesta</div>)}
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
  if(!isAdmin) return <div className="card p-4"><h2 className="font-semibold">Admin fútbol</h2><p className="text-sm text-slate-300">Inicia sesión como admin para editar.</p></div>;
  const ensureId=()=>{
    const id=(jId||jName||"").trim();
    return id || "";
  };
  const saveJornada=()=>{
    const id=ensureId();
    if(!id) return alert("Define ID o nombre de jornada");
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
    alert("Jornada guardada");
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
    if(!id) return alert("Guarda la jornada primero");
    const parsedScores=scores.slice(0,matches.length).map(s=>({home:s.home===""||s.home==null?null:Number(s.home), away:s.away===""||s.away==null?null:Number(s.away)}));
    setDb(prev=>{
      const futbolPrev=prev.futbol||defaultFutbolState();
      const resultsMap={...(futbolPrev.results||{})};
      resultsMap[id]={matches:parsedScores,qAnswers:[...answers]};
      return {...prev, futbol:{...futbolPrev, results:resultsMap}};
    });
    alert("Resultados guardados");
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
    if(!id) return alert("Selecciona jornada");
    if(!editUser) return alert("Selecciona participante");
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
    alert("Apuesta guardada para el usuario");
  };
  const manualStatus=selected ? (futbol.betsWindow?.[selected]?.forceOpen?"Abierto manualmente":futbol.betsWindow?.[selected]?.forceClosed?"Cerrado manualmente":"Automático (viernes 15:00)") : "—";
  const revealStatus=selected ? (futbol.betsReveal?.[selected]?.forceShow?"Publicadas manualmente":"Automático tras cierre") : "—";
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Admin fútbol</h2>
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
    }).sort((A,B)=>B.points-A.points||B.exact-A.exact||B.qHits-A.qHits||B.signs-A.signs||A.missed-B.missed||A.name.localeCompare(B.name));
  },[scope,standings,participants,futbol.results,db]);
  const selectedJornada=scope==="all"?null:jornadas.find(j=>j.id===scope);
  const res=scope==="all"?null:futbol.results?.[scope];
  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ranking fútbol</h2>
          <select className="select border rounded px-3 py-2" value={scope} onChange={e=>setScope(e.target.value)}>
            <option value="all">Global</option>
            {jornadas.map(j=><option key={j.id} value={j.id}>{j.name||j.id}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Participante</th><th className="p-2 text-left">Pts</th><th className="p-2 text-left">Exactos</th><th className="p-2 text-left">Preg.</th><th className="p-2 text-left">Signos</th><th className="p-2 text-left">Sin apostar</th><th className="p-2 text-left">Cat.</th></tr>
            </thead>
            <tbody>
              {rows.map((r,idx)=>(
                <tr key={r.name} className="border-t border-white/10">
                  <td className="p-2">{idx+1}</td>
                  <td className="p-2">{r.name}{r.missed>=3 && <span className="text-[11px] text-amber-300 ml-2">(eliminado)</span>}</td>
                  <td className="p-2 font-semibold">{r.points}</td>
                  <td className="p-2">{r.exact}</td>
                  <td className="p-2">{r.qHits}</td>
                  <td className="p-2">{r.signs}</td>
                  <td className="p-2">{r.missed}</td>
                  <td className="p-2">{r.cat}</td>
                </tr>
              ))}
              {rows.length===0 && <tr><td className="p-2 text-sm text-slate-300" colSpan={8}>Sin datos (añade resultados y apuestas).</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Desempate: exactos → preguntas → signos → segunda vuelta → duelo especial → sorteo.</p>
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

function Admin({db,setDb,races,drivers,calendar}){
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
  if(!db.users?.[user]?.isAdmin) return <div className="card p-4"><h2 className="font-semibold">Admin</h2><p className="text-sm text-slate-300">Inicia sesión como admin.</p></div>;
  if(!ok){ return (<div className="card p-4"><h2 className="font-semibold mb-2">Admin</h2><form onSubmit={(e)=>{e.preventDefault(); if(pass===(db.meta?.adminSecret||"manrique")){setOk(true);sessionStorage.setItem("admin_ok","1");} else alert("Contraseña admin incorrecta");}}><input type="password" className="select border rounded px-3 py-2 mr-2" placeholder="Contraseña admin" value={pass} onChange={e=>setPass(e.target.value)} /><button className="px-3 py-2 rounded bg-slate-900 text-white">Entrar</button></form></div>); }
  const driversText=(db.meta?.drivers||[]).join("\n");
  const driverList=(db.meta?.drivers?.length?db.meta.drivers:drivers)||[];
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
    if(!selected) return alert("Selecciona un GP");
    if(!qDateInput || !qTimeInput) return alert("Completa fecha y hora de quali");
    if(!raceDateInput || !raceTimeInput) return alert("Completa fecha y hora de carrera");
    const tzValue=tzInput || baseCal?.timezone || MADRID_TZ;
    setDb(prev=>{
      const meta={...(prev.meta||{})};
      const overrides={...(meta.raceOverrides||{})};
      overrides[selected]={qDate:qDateInput,qTime:qTimeInput,raceDate:raceDateInput,raceTime:raceTimeInput,timezone:tzValue};
      return {...prev, meta:{...meta, raceOverrides:overrides}};
    });
    alert("Horario actualizado");
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
    alert("Horario restablecido al calendario");
  };
  const handleAddUser=async (e)=>{
    e.preventDefault();
    const name=newUserName.trim();
    if(!name) return alert("Introduce un nombre");
    if(db.users?.[name]) return alert("Ese usuario ya existe");
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
    alert(`Usuario ${name} creado`);
  };
  const resetPasswordFor=(name)=>{
    if(!window.confirm(`¿Resetear la contraseña de ${name}?`)) return;
    hashPassword(DEFAULT_PASSWORD).then(hash=>{
      setDb(prev=>{
        const users={...(prev.users||{})};
        if(users[name]){ users[name]={...users[name],passwordHash:hash,mustChange:true,blocked:false,changedAt:null}; delete users[name].password; }
        return {...prev,users};
      });
      alert("Contraseña reseteada");
    }).catch(()=>alert("No se pudo resetear"));
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
    if(db.users?.[name]?.isAdmin) return alert("No puedes borrar un admin");
    if(name===user) return alert("No puedes borrarte a ti mismo");
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
    alert("Usuario eliminado");
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
    if(!selected) return alert("Selecciona un GP");
    if(!editName) return alert("Elige un participante");
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
    alert("Apuesta actualizada por admin");
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
      navigator.clipboard.writeText(exportJson).then(()=>alert("JSON copiado al portapapeles"))
        .catch(()=>alert("No se pudo copiar automáticamente"));
    } else {
      if(typeof window!=="undefined") window.prompt("Copia manualmente el JSON", exportJson);
    }
  };
  const importFromText=()=>{
    if(!importText.trim()) return alert("Pega un JSON para importarlo");
    try{
      const parsed=JSON.parse(importText);
      if(typeof parsed!=="object" || parsed===null) throw new Error("Formato no válido");
      setDb(parsed);
      setImportText("");
      alert("Backup importado. Revisa y exporta antes del próximo sync.");
    }catch(err){
      alert("JSON inválido: "+err.message);
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
  return (<div className="card p-4 space-y-4">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Admin</h2><button onClick={()=>{sessionStorage.removeItem("admin_ok"); setOk(false); setPass("");}} className="text-sm underline">Salir</button></div>
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
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Parrilla (pilotos) — desplegables</h3><textarea className="w-full h-40 select border rounded px-3 py-2" defaultValue={driversText} onBlur={(e)=>{ const lines=e.target.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); setDb(prev=>({...prev, meta:{...prev.meta, drivers:lines}})); alert("Lista de pilotos actualizada"); }}></textarea></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Horario del GP</h3>{selectedRace ? (<div className="text-sm text-slate-200 space-y-1 mb-3"><div>Quali local: {selectedRace.q_date_local} {selectedRace.labels?.qLocal||"—"} · España: {selectedRace.labels?.qMadrid||"—"}</div>{selectedRace.labels?.raceLocal && <div>Carrera local: {selectedRace.race_date_local} {selectedRace.labels.raceLocal} · España: {selectedRace.labels.raceMadrid||"—"}</div>}<div className="text-xs text-slate-400">Usa hora local del circuito; las horas de España se recalculan.</div></div>):(<p className="text-sm text-slate-300 mb-2">Selecciona un GP para editar su horario.</p>)}<div className="grid gap-2 md:grid-cols-2"><label className="text-sm">Fecha quali (local)</label><label className="text-sm">Hora quali (local)</label><input type="date" className="select border rounded px-3 py-2" value={qDateInput} onChange={e=>setQDateInput(e.target.value)} /><input type="time" className="select border rounded px-3 py-2" value={qTimeInput} onChange={e=>setQTimeInput(e.target.value)} /><label className="text-sm">Fecha carrera (local)</label><label className="text-sm">Hora carrera (local)</label><input type="date" className="select border rounded px-3 py-2" value={raceDateInput} onChange={e=>setRaceDateInput(e.target.value)} /><input type="time" className="select border rounded px-3 py-2" value={raceTimeInput} onChange={e=>setRaceTimeInput(e.target.value)} /></div><label className="text-sm mt-2 block">Zona horaria (IANA, ej. Europe/Madrid)</label><input className="select border rounded px-3 py-2 mb-2" placeholder={baseCal?.timezone||"Asia/Dubai"} value={tzInput} onChange={e=>setTzInput(e.target.value)} /><div className="flex flex-wrap gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={saveSchedule}>Guardar horario</button><button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={resetSchedule}>Volver al calendario</button></div><p className="text-xs text-slate-400 mt-2">El horario ajusta el cierre de apuestas y la publicación automática.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Resultados oficiales</h3><div className="grid gap-2"><label className="text-sm">Pole</label><SelectDriver value={currentRes.pole||""} onChange={(val)=>updateRes(prev=>({...prev, pole:val}))} drivers={driverList} placeholder="Selecciona piloto" /><label className="text-sm">Podio</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><SelectDriver key={i} value={currentRes.podium?.[i]||""} onChange={(val)=>updateRes(prev=>{ const next=[...(prev.podium||["","",""])]; next[i]=val; return {...prev, podium:next}; })} drivers={driverList} placeholder={`P${i+1}`} />)}</div><label className="text-sm">Respuestas a preguntas</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" value={currentRes.qAnswers?.[i]||""} onChange={e=>updateRes(prev=>{ const next=[...(prev.qAnswers||["","",""])]; next[i]=e.target.value; return {...prev, qAnswers:next}; })}/>)}</div><button className="mt-2 px-3 py-2 rounded bg-slate-900 text-white" onClick={()=>{ setDb(prev=>({...prev, results:{...(prev.results||{}), [selected]:currentRes}})); alert("Resultados guardados (puedes guardar parciales)"); }}>Guardar</button></div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Control de apuestas</h3><p className="text-xs text-slate-400">Fuerza apertura o cierre sin depender del horario.</p><div className="flex flex-wrap gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={()=>setBetsOverride("open")}>Abrir</button><button className="px-3 py-2 rounded bg-red-700 text-white" onClick={()=>setBetsOverride("close")}>Cerrar</button><button className="px-3 py-2 rounded bg-slate-800 text-white" onClick={()=>setBetsOverride("auto")}>Automático</button></div><div className="text-xs text-slate-300 mt-2">Estado actual: {betsStatusLabel}</div>{selectedRace && (<div className="text-xs text-slate-400 mt-1">Quedará automático 1 minuto antes de la quali ({selectedRace.labels?.qLocal||"—"} · España: {selectedRace.labels?.qMadrid||"—"})</div>)}<div className="mt-3 border border-white/5 rounded p-3 bg-neutral-900"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium text-sm">Publicar apuestas</div><div className="text-xs text-slate-400">Enséñalas antes de la hora de quali.</div></div><div className="flex flex-wrap gap-2"><button className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm" onClick={()=>setBetsReveal("show")}>Publicar ya</button><button className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm" onClick={()=>setBetsReveal("auto")}>Volver a automático</button></div></div><div className="text-xs text-slate-300 mt-2">Visibilidad: {betsRevealLabel}</div>{selectedRace && <div className="text-[11px] text-slate-500">Automático: 1 minuto después del inicio de quali ({selectedRace.labels?.qMadrid||"—"}).</div>}</div></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Editar apuestas de participantes</h3><div className="grid gap-2 md:grid-cols-[2fr,1fr]"><select className="select border rounded px-3 py-2" value={editName} onChange={e=>setEditName(e.target.value)}><option value="">— Elige participante —</option>{participantNames.map(n=><option key={n} value={n}>{n}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editBet.late} onChange={e=>setEditBet(prev=>({...prev, late:e.target.checked}))} /><span>Marcar como fuera de plazo</span></label></div><div className="grid gap-2 mt-3"><label className="text-sm">Pole</label><SelectDriver value={editBet.pole} onChange={(val)=>setEditBet(prev=>({...prev, pole:val}))} drivers={driverList} placeholder="Selecciona piloto" /><label className="text-sm">Podio</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><SelectDriver key={i} value={editBet.podium?.[i]||""} onChange={(val)=>setEditBet(prev=>{ const next=[...(prev.podium||["","",""])]; next[i]=val; return {...prev, podium:next}; })} drivers={driverList} placeholder={`P${i+1}`} />)}</div><label className="text-sm">Preguntas adicionales</label><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" value={editBet.q?.[i]||""} onChange={e=>setEditBet(prev=>{ const next=[...(prev.q||["","",""])]; next[i]=e.target.value; return {...prev, q:next}; })} placeholder={`Respuesta ${i+1}`}/>)}</div><button className="mt-2 px-3 py-2 rounded bg-emerald-700 text-white" onClick={saveAdminBet}>Guardar apuesta</button></div><p className="text-xs text-slate-400 mt-2">Guarda una apuesta tal cual la haría el usuario y decide si computa como tarde.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Ajustes manuales de puntuación ({selected||"—"})</h3><p className="text-xs text-slate-400 mb-2">Suma o resta puntos de esta carrera. Afecta ranking, detalle y estadísticas.</p><div className="grid gap-2 md:grid-cols-2">{participantNames.map(name=>{ const val=Number(scoreAdjustments[name]||0); return (<label key={name} className="flex items-center justify-between border border-white/10 rounded px-3 py-2 bg-neutral-900 text-sm"><span>{name}</span><input type="number" className="w-24 text-right select border rounded px-2 py-1" value={val} onChange={e=>{ const parsed=parseInt(e.target.value,10); updateScoreAdjustment(name, Number.isNaN(parsed)?0:parsed); }} /></label>); })}</div><p className="text-[11px] text-slate-500 mt-2">Deja en 0 para eliminar ajustes.</p></div>
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Autor y publicación de preguntas</h3><div className="flex gap-2 items-center"><span className="text-sm">Autor asignado:</span><select className="select border rounded px-3 py-2" value={db.questionOwner?.[selected]||""} onChange={e=>setDb(prev=>({...prev, questionOwner:{...(prev.questionOwner||{}), [selected]:e.target.value}}))}><option value="">— Sin asignar —</option>{Object.keys(db.participants||{}).map(n=><option key={n} value={n}>{n}</option>)}</select></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">{[0,1,2].map(i=><input key={i} className="select border rounded px-3 py-2" placeholder={`Pregunta ${i+1}`} value={(db.questions?.[selected]?.[i]||"")} onChange={e=>{const next=[...(db.questions?.[selected]||["","",""])]; next[i]=e.target.value; setDb(prev=>({...prev, questions:{...(prev.questions||{}), [selected]: next}}));}}/>)}</div><div className="flex items-center gap-2 mt-2"><button className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={()=>{ setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), published:true, force:true}}})); alert("Publicación forzada"); }}>Forzar publicar</button><button className="px-3 py-2 rounded bg-gray-700 text-white" onClick={()=>{ setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), published:false, force:false}}})); alert("Despublicado"); }}>Despublicar</button><button className="px-3 py-2 rounded bg-red-700 text-white" onClick={()=>{ const v=!(db.questionsStatus?.[selected]?.locked); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [selected]:{...(prev.questionsStatus?.[selected]||{}), locked:v}}})); alert(v?"Edición bloqueada":"Edición desbloqueada"); }}>{db.questionsStatus?.[selected]?.locked ? "Desbloquear edición" : "Bloquear edición"}</button></div></div>
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
                  <div className="flex items-center justify-between"><span>{timeLabel}</span>{entry?.late && <span className="text-[10px] uppercase text-amber-300">Tarde</span>}</div>
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
    <div className="border border-white/10 rounded p-3"><h3 className="font-semibold mb-2">Backup antes del sync</h3><p className="text-xs text-slate-400">Descarga o copia el JSON antes de sincronizar con S3 y vuélvelo a importar después.</p><div className="flex flex-wrap gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-emerald-700 text-white" onClick={downloadBackup}>Descargar JSON</button><button type="button" className="px-3 py-2 rounded bg-slate-800 text-white" onClick={copyBackup}>Copiar JSON</button></div><textarea className="w-full h-32 select border rounded px-3 py-2 mt-3" placeholder="Pega aquí el JSON que quieres importar" value={importText} onChange={e=>setImportText(e.target.value)}></textarea><div className="flex flex-wrap items-center gap-2 mt-2"><button type="button" className="px-3 py-2 rounded bg-slate-900 text-white" onClick={importFromText}>Importar JSON</button><label className="cursor-pointer text-sm text-slate-200"><span className="inline-block px-3 py-2 rounded bg-slate-800 text-white">Cargar archivo</span><input type="file" accept="application/json" className="hidden" onChange={handleBackupFile} /></label></div></div>
  </div>);
}

function Participante({user,races,db,setDb,drivers}){
  const [now,setNow]=useState(()=>new Date());
  const [selected,setSelected]=useState(races?.[0]?.key||""); const race=races?.find(r=>r.key===selected);
  const [showOthers,setShowOthers]=useState(false);
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),30000); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ if(!race) setShowOthers(false); },[race]);
  const bet=race?(db.bets?.[race.key]?.[user]||{pole:"",podium:["","",""],q:["","",""],submittedAt:null,late:false}):null;
  const owner=race?(db.questionOwner?.[race.key]||""):""; const questions=race?(db.questions?.[race.key]||["","",""]):["","",""];
  const manualWindow=race ? db.betsWindow?.[race.key] : null;
  const manualReveal=race ? db.betsReveal?.[race.key] : null;
  const baseCanEdit=race && now<race.cutoff;
  const canEdit=race ? (manualWindow?.forceClosed?false:manualWindow?.forceOpen?true:baseCanEdit) : false;
  const isAdmin=!!db.users?.[user]?.isAdmin;
  const canViewFull=race && (manualReveal?.forceShow || now>race.showBetsAt);
  const showStatusOnly=isAdmin && race && !canViewFull;
  const others=Object.keys(db.participants||{}).filter(n=>n!==user).map(name=>({name,bet:race?db.bets?.[race.key]?.[name]:null}));
  const driverList=(db.meta?.drivers&&db.meta.drivers.length)?db.meta.drivers:drivers; const authorDeadline = race ? race.authorCutoff : null;
  const betsStatus=race ? (manualWindow?.forceClosed?"Cerrado por admin":manualWindow?.forceOpen?"Abierto por admin":(now<race.cutoff?"Abierto (horario)":"Cerrado (horario)")) : "—";
  const myRaceScores=useMemo(()=>{
    return (races||[]).map(r=>{
      const res=db.results?.[r.key];
      if(!res) return null;
      return {race:r,score:scoreForRace(db,r.key,user)};
    }).filter(Boolean);
  },[races,db.results,db.bets,user]);
  const showOthersPanel=showOthers && !!race;
  const layoutCols=showOthersPanel?"md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]":"";
  return (<div className={`grid gap-4 ${layoutCols}`}>
    <div className="card p-4 min-w-0">
      <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
        <h2 className="font-semibold">Tu apuesta</h2>
        {race && (<button type="button" className="text-sm px-3 py-1.5 rounded bg-neutral-900 text-white" onClick={()=>setShowOthers(prev=>!prev)}>{showOthersPanel?"Ocultar apuestas":"Ver apuestas de otros"}</button>)}
      </div>
      <select className="select select-strong border rounded px-3 py-2 mb-3 shadow-sm" value={selected} onChange={e=>setSelected(e.target.value)}>{(races||[]).map(r=><option key={r.key} value={r.key}>{r.round}. {r.grand_prix} — {r.date_local}</option>)}</select>
      {race && <div className="text-sm text-slate-200 mb-3 space-y-1"><div>Quali (local): {race.labels?.qLocal||"—"} · España: {race.labels?.qMadrid||"—"}</div>{race.labels?.raceLocal && <div>Carrera (local): {race.labels.raceLocal} · España: {race.labels.raceMadrid}</div>}{authorDeadline && <div>Cierre preguntas (autor): {formatDateTime(authorDeadline,MADRID_TZ)} (España)</div>}<div>Cierre apuestas automático: {formatTime(race.cutoff,MADRID_TZ)} (España)</div><div>Estado apuestas: {betsStatus}</div><div>Visibilidad de apuestas: {manualReveal?.forceShow?"Publicadas por admin":"Ocultas hasta quali (o cuando el admin publique)"}</div></div>}
      {race && (<div className="mb-3"><div className="flex items-start justify-between bg-amber-500/10 border border-amber-400/30 rounded p-2"><div><div className="font-medium text-amber-200">Preguntas de este GP</div><div className="text-xs text-amber-300">{owner?<>Autor: <b>{owner}</b> — {db.questionsStatus?.[race.key]?.published?"Publicadas":"Pendiente"}</>:"Sin autor asignado"}</div></div></div>{(owner===user && authorDeadline && now<authorDeadline && !(db.questionsStatus?.[race.key]?.locked)) && (<div id="owner-questions-editor" className="mt-2 space-y-2 bg-neutral-900 border border-white/10 rounded p-3"><div className="text-xs text-slate-300">Editor de preguntas (hasta 4h antes de quali)</div><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[0,1,2].map(i=>(<input key={i} className="select border rounded px-3 py-2 w-full" placeholder={"Pregunta "+(i+1)} value={(db.questions?.[race.key]?.[i]||"")} onChange={e=>{const curr=db.questions?.[race.key]||["","",""]; const next=[...curr]; next[i]=e.target.value; setDb(prev=>({...prev, questions:{...(prev.questions||{}), [race.key]: next}})); }}/>))}</div><div className="flex gap-2">{!db.questionsStatus?.[race.key]?.published ? (<button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={()=>{ const list=(db.questions?.[race.key]||["","",""]); if(list.some(q=>!q||!q.trim())) return alert("Rellena las 3 preguntas"); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [race.key]:{published:true, author:user, publishedAt:new Date().toISOString()}}})); alert("Publicado"); }}>Publicar</button>):(<button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={()=>{ const list=(db.questions?.[race.key]||["","",""]); if(list.some(q=>!q||!q.trim())) return alert("Rellena las 3 preguntas"); setDb(prev=>({...prev, questionsStatus:{...(prev.questionsStatus||{}), [race.key]:{...prev.questionsStatus[race.key], updatedAt:new Date().toISOString()}}})); alert("Actualizado"); }}>Actualizar</button>)}</div></div>)}</div>)}
      {race && <BetForm key={race.key} bet={bet} disabled={!canEdit} questions={((db.questionsStatus?.[race.key]?.published||db.questionsStatus?.[race.key]?.force)?(questions||["","",""]):["","",""])} drivers={driverList} onSubmit={(b)=>{ const late=new Date()>=race.cutoff; setDb(prev=>{
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
      }); alert(late?"Apuesta enviada (fuera de plazo)":"Apuesta guardada"); }}/>}      
      {myRaceScores.length>0 ? (
        <div className="mt-4 border border-white/10 rounded p-3 bg-neutral-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Puntos por carrera</h3>
            <span className="text-xs text-slate-400">Incluye bonus/penalizaciones</span>
          </div>
          <div className="space-y-2">
            {myRaceScores.map(({race:rc,score})=>(
              <div key={rc.key} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-white/5 rounded px-2 py-2">
                <div className="text-sm font-medium">{rc.round}. {rc.grand_prix}</div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold">{score.points} pts</span>
                  <span className="text-xs text-slate-300">TB1: {score.tb1}</span>
                  <span className="text-xs text-slate-300">Aciertos: {score.hits}</span>
                  <span className="text-xs text-slate-300">Exactos: {score.exact}</span>
                  {score.pen>0 && <span className="text-xs text-amber-300">Pen: {score.pen}</span>}
                  {score.manualAdj!==0 && <span className="text-xs text-emerald-300">Ajuste: {score.manualAdj>0?`+${score.manualAdj}`:score.manualAdj}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-300">Aún no hay resultados oficiales cargados.</div>
      )}
    </div>
    {showOthersPanel && (<div className="card p-4 md:min-w-[220px] md:max-w-[320px] self-start"><h2 className="font-semibold mb-4">Apuestas de otros {showStatusOnly && <span className="text-xs text-emerald-300">(estado admin)</span>}</h2>
      {!race && <p className="text-sm text-slate-300">Selecciona un GP para ver apuestas.</p>}
      {race && showStatusOnly && (
        <ul className="space-y-2">
          {others.map(({name,bet})=>(<li key={name} className="border border-white/10 rounded p-3 bg-neutral-900 flex items-center justify-between">
            <div>
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
          {others.map(({name,bet})=>(<li key={name} className="border border-white/10 rounded p-3 bg-neutral-900"><div className="font-medium">{name}</div>{bet?<div className="text-sm"><div><b>Pole:</b> {bet.pole||"—"}</div><div><b>Podio:</b> {(bet.podium||["","",""]).join(" · ")}</div><div><b>P.Adic.:</b> {(bet.q||["","",""]).join(" · ")}</div></div>:<div className="text-xs text-slate-400">Sin apuesta</div>}</li>))}
        </ul>
      )}
    </div>)}
  </div>);
}

function App(){
  const [db,setDb]=useState(loadDB()); const [cal,setCal]=useState([]); const [drivers,setDrivers]=useState([]); const [user,setUser]=useState(sessionStorage.getItem("porra_session_user")||""); const [view,setView]=useState("participante"); const [mode,setMode]=useState(()=>localStorage.getItem("porra_mode")||"f1"); const [showPass,setShowPass]=useState(false); const [hydrated,setHydrated]=useState(false); const [defaultPwdHash,setDefaultPwdHash]=useState("");
  const userActionRef=useRef(false);
  const setDbUser=useCallback((updater)=>{ userActionRef.current=true; setDb(prev=> typeof updater==="function" ? updater(prev) : updater); },[]);
  const logout=React.useCallback((reason)=>{
    sessionStorage.removeItem("porra_session_user");
    localStorage.removeItem("porra_user");
    sessionStorage.removeItem("admin_ok");
    setUser("");
    setView("participante");
    setShowPass(false);
    if(reason) alert(reason);
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
  useEffect(()=>{ loadCalendar().then(setCal); loadDrivers().then(setDrivers); hashPassword(DEFAULT_PASSWORD).then(setDefaultPwdHash).catch(err=>console.warn("No se pudo calcular hash por defecto",err)); },[]);
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
      const championships=prevMeta.championships || {Carlos:1,Toni:1};
      const nextDrivers=drivers&&drivers.length?drivers:(prevMeta.drivers||[]);
      const basePoints=prevMeta.basePoints || {Antonio:38,Carlos:17,Manrique:25,Pere:44,Toni:25};
      return {...prev, users:baseUsers, participants:baseParticipants, meta:{...prevMeta, adminSecret:prevMeta.adminSecret||"manrique", drivers:nextDrivers, championships, basePoints, seeded:true}};
    });
  },[drivers,db.meta,defaultPwdHash]);
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
    const authorCutoff=qStart?new Date(qStart.getTime()-4*60*60*1000):null;
    const labels=qStart?{qLocal:formatDateTime(qStart,timeZone), qMadrid:formatDateTime(qStart,MADRID_TZ), raceLocal:raceStart?formatDateTime(raceStart,timeZone):null, raceMadrid:raceStart?formatDateTime(raceStart,MADRID_TZ):null}:{qLocal:"—",qMadrid:"—",raceLocal:raceStart?formatDateTime(raceStart,timeZone):null,raceMadrid:raceStart?formatDateTime(raceStart,MADRID_TZ):null};
    return {...item,q_date_local:qDate,race_date_local:raceDate,timeZone,qStart,raceStart,cutoff,showBetsAt,authorCutoff,labels};
  }).filter(r=>r.qStart);
  const handleModeChange=(newMode)=>{
    setMode(newMode);
    localStorage.setItem("porra_mode",newMode);
    // Resetear vista si la actual no existe en el nuevo modo
    if(newMode==="f1" && !["participante","ranking","stats","questions","admin"].includes(view)){
      setView("participante");
    } else if(newMode==="futbol" && !["participante","ranking","rules","admin"].includes(view)){
      setView("participante");
    }
  };
  return (<div className="w-full max-w-4xl lg:max-w-5xl mx-auto p-4 space-y-6">
    <section className="hero p-4 text-center md:text-left">
      <div className="text-xl md:text-2xl font-bold">Porra de los birreros</div>
      <div className="text-sm md:text-base text-slate-200">Las cervezas están en juego 🍻</div>
    </section>
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-center md:text-left">{mode==="f1"?"Porra F1 — Últimas 3 (2025)":"Porra Fútbol"}</h1>
        <div className="flex gap-2 justify-center md:justify-start items-center">
          <span className="text-sm text-slate-300">Modo:</span>
          <button className={`px-4 py-2 rounded font-medium ${mode==="f1"?"bg-emerald-600 text-white":"bg-neutral-700 text-slate-300 hover:bg-neutral-600"}`} onClick={()=>handleModeChange("f1")}>🏎️ F1</button>
          <button className={`px-4 py-2 rounded font-medium ${mode==="futbol"?"bg-emerald-600 text-white":"bg-neutral-700 text-slate-300 hover:bg-neutral-600"}`} onClick={()=>handleModeChange("futbol")}>⚽ Fútbol</button>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <nav className="flex flex-wrap gap-2 justify-center md:justify-end">
          <button className={`px-3 py-2 rounded ${view==="participante"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>setView("participante")}>Participante</button>
          <button className={`px-3 py-2 rounded ${view==="ranking"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>setView("ranking")}>Ranking</button>
          {mode==="f1" && <button className={`px-3 py-2 rounded ${view==="stats"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>setView("stats")}>Estadísticas</button>}
          {mode==="f1" && <button className={`px-3 py-2 rounded ${view==="questions"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>setView("questions")}>Preguntas</button>}
          {mode==="futbol" && <button className={`px-3 py-2 rounded ${view==="rules"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>setView("rules")}>Reglas</button>}
          <button className={`px-3 py-2 rounded ${view==="admin"?"bg-slate-900 text-white":"bg-neutral-900"}`} onClick={()=>setView("admin")}>Admin</button>
        </nav>
        {user ? (
          <div className="text-sm flex flex-wrap items-center justify-center md:justify-end gap-2">
            Hola, <span className="font-medium">{user}</span>
            <button className="px-2 py-1 rounded bg-slate-900 text-white" onClick={()=>setShowPass(true)}>Cambiar contraseña</button>
            <button className="underline" onClick={()=>logout()}>Salir</button>
          </div>
        ) : null}
      </div>
    </header>
    {!user ? (<div className="card p-4"><h2 className="font-semibold mb-2">Acceso</h2><Login db={db} setDb={setDbUser} onLogged={(u)=>{ setUser(u); sessionStorage.setItem("porra_session_user", u); localStorage.setItem("porra_user", u); }} /></div>) : (
      <div className="md:flex md:gap-4"><aside className="sidebar p-3 w-56 shrink-0 hidden md:flex md:flex-col md:items-center"><Avatar name={user}/><div className="mt-2 text-sm font-medium">{user}</div></aside><main className="flex-1 space-y-6">
        {mode==="f1" && (
          <>
            {view==="participante" && <Participante user={user} races={races} db={db} setDb={setDbUser} drivers={drivers}/>}
            {view==="admin" && <Admin db={db} setDb={setDbUser} races={races} drivers={drivers} calendar={cal}/>}
            {view==="ranking" && <Ranking db={db} setDb={setDbUser} races={races} currentUser={user}/>}
            {view==="stats" && <Stats db={db} races={races}/>}
            {view==="questions" && <QuestionsHistory db={db} races={races}/>}
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
    )}
    <footer className="text-xs text-slate-400 pt-8">Hecho con ❤️. </footer>
    <ChangePasswordModal open={showPass} onClose={()=>setShowPass(false)} db={db} setDb={setDbUser} user={user} />
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
    rootEl.innerHTML = `<div style="padding:20px;color:red;background:white;font-family:monospace;">
      <h2>Error al cargar la aplicación</h2>
      <p>${error.message}</p>
      <pre>${error.stack}</pre>
      <p>Por favor, abre la consola del navegador (F12) para más detalles.</p>
    </div>`;
  }
}
