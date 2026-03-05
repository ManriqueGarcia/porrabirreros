export function defaultFutbolState(){
  return {order:[], jornadas:{}, bets:{}, results:{}, betsWindow:{}, betsReveal:{}, betHistory:{}, questions:{}, questionsStatus:{}};
}

export function futbolSign(score){
  if(!score || score.home==null || score.away==null || Number.isNaN(score.home) || Number.isNaN(score.away)) return null;
  if(score.home>score.away) return "1";
  if(score.home<score.away) return "2";
  return "X";
}

export function futbolMatchPoints(pred,res){
  if(!res || res.home==null || res.away==null) return {points:0,exact:false,sign:false};
  if(!pred || pred.home==null || pred.away==null) return {points:0,exact:false,sign:false};
  const exact=Number(pred.home)===Number(res.home) && Number(pred.away)===Number(res.away);
  const signOk=futbolSign(pred)===futbolSign(res);
  const points=exact?3:(signOk?1:0);
  return {points, exact, sign:signOk};
}

export function scoreFutbolJornada(db,jornadaId,name){
  const futbol=db.futbol||{};
  const jornada=futbol.jornadas?.[jornadaId];
  const bet=futbol.bets?.[jornadaId]?.[name];
  const res=futbol.results?.[jornadaId];
  if(!res) return {pending:true,points:0,exact:0,signs:0,qHits:0,missed:false,catPenalty:0,missingPenalty:0,latePenalty:0,late:!!bet?.late,goalDiff:0,items:[]};
  const hasBet=!!bet;
  const predictions=hasBet?(bet.matches||[]):[];
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
  const missed=!bet;
  let missingPenalty=0;
  let latePenalty=0;
  if(missed){ missingPenalty=-3; points+=missingPenalty; items.push({label:"No participó en la apuesta", delta:missingPenalty}); goalDiff+=40; }
  else if(late){ latePenalty=-2; points+=latePenalty; items.push({label:"Apuesta fuera de plazo", delta:latePenalty}); }
  let catPenalty=0;
  if(!missed && !late && points===0){ catPenalty=-1; points+=catPenalty; items.push({label:"Apuesta catastrófica", delta:catPenalty}); }
  return {pending:false,points,exact,signs,qHits,missed,late,catPenalty,missingPenalty,latePenalty,goalDiff,items};
}

export function computeAvgFutbolSubmitTime(dbFutbol, jornadas, name){
  let total=0, count=0;
  (jornadas||[]).forEach(j=>{
    const bet=dbFutbol.bets?.[j.id]?.[name];
    if(bet?.submittedAt){ total+=new Date(bet.submittedAt).getTime(); count++; }
  });
  return count>0?total/count:Infinity;
}

export function computeFutbolJornadaWins(dbFutbol, participants, jornadas){
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

export function computeFutbolStandings(dbFutbol,participants,jornadas){
  const completed=(jornadas||[]).filter(j=>dbFutbol.results?.[j.id]);
  const jornadaWins=computeFutbolJornadaWins(dbFutbol, participants, jornadas);
  return participants.map(name=>{
    const acc=completed.reduce((a,j)=>{
      const s=scoreFutbolJornada({futbol:dbFutbol},j.id,name);
      a.points+=s.points; a.exact+=s.exact; a.signs+=s.signs; a.missed+=s.missed?1:0; a.late+=s.late?1:0; a.cat+=s.catPenalty?1:0; a.goalDiff+=s.goalDiff; return a;
    },{points:0,exact:0,signs:0,missed:0,late:0,cat:0,goalDiff:0});
    return {name,...acc, wins:jornadaWins[name]||0, penCount:acc.missed+acc.late, avgSubmit:computeAvgFutbolSubmitTime(dbFutbol,jornadas,name)};
  }).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.exact-a.exact||b.signs-a.signs||a.penCount-b.penCount||a.goalDiff-b.goalDiff||a.avgSubmit-b.avgSubmit);
}

export function listFutbolJornadas(futbol){
  const entries=Object.values(futbol?.jornadas||{});
  const order=futbol?.order||[];
  if(order.length){
    return order.map(id=>entries.find(j=>j.id===id)).filter(Boolean);
  }
  return entries.sort((a,b)=>{
    const da=a.deadline?new Date(a.deadline).getTime():Infinity;
    const db_=b.deadline?new Date(b.deadline).getTime():Infinity;
    return da-db_||a.name.localeCompare(b.name);
  });
}
