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

export async function processF1Query(question){
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

export const F1_SUGG=[
  "¿Quién fue campeón en 2024?","Resultados GP Mónaco 2024","Clasificación mundial 2023",
  "Victorias de Alonso","Calendario 2026","Coches que acabaron en Australia últimos 5 años",
  "Clasificación GP Bahréin 2024","Vuelta rápida Monza 2023","¿Quién ha ganado más en Silverstone?",
  "Hamilton temporada 2020","Constructores 2023","Próxima carrera",
  "Alonso en Mónaco","Compañero de Leclerc en 2024",
  "🔮 Predice el podio del próximo GP","🔮 ¿Quién será campeón este año?",
];

export const FUTBOL_SUGG=[
  "¿Quién ganó el último Mundial?","Máximo goleador de la Champions League","Palmarés del Real Madrid",
  "¿Cuántos Balones de Oro tiene Messi?","Historia del Clásico Barça-Madrid","¿Quién ha ganado más Eurocopas?",
  "Mejores porteros de la historia","Récord de goles en una temporada","¿Qué es el fuera de juego?",
  "Mayores goleadas en mundiales","Mejor once histórico","¿Cuándo se inventó el VAR?",
  "🔮 Predice el resultado del próximo Clásico","🔮 ¿Quién ganará la Champions este año?",
];

export async function processFutbolQuery(question){
  const aiUrl=window.PORRA_AI_URL;
  if(!aiUrl) return "ManriBot no está configurado. Falta PORRA_AI_URL.";
  try{
    const res=await fetch(aiUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,mode:"futbol"}),signal:AbortSignal.timeout(35000)});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    return data.answer||"No se pudo obtener respuesta.";
  }catch(err){
    console.error("ManriBot futbol error:",err);
    return "Error al consultar ManriBot. Inténtalo de nuevo en unos segundos.";
  }
}
