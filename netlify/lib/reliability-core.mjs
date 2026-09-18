export const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
export const num=v=>v===null||v===undefined||(typeof v==='string'&&v.trim()==='')?null:(Number.isFinite(Number(v))?Number(v):null);
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=v=>typeof v==='string'?v:'';
const scoreNum=v=>v===null||v===undefined||(typeof v==='string'&&v.trim()==='')?null:(Number.isFinite(Number(v))?clamp(Number(v)):null);
const sourceInText=v=>/(?:\.pdf\b|\bDIA-[A-Z0-9-]+|\bDECOMPTE\b|\bCarnet\b|\bPV[_\s-]|\bpage\s*\d+|\bdossier\s*\d+)/i.test(text(v));
const neutralBalconyWeakness=v=>/balcon/i.test(text(v))&&/(?:hors|non\s+inclus|exclu).*carrez|carrez.*(?:hors|non\s+inclus|exclu)/i.test(text(v))&&!/(?:défaut|fissur|infiltr|étanch|sécur|dégrad|travaux)/i.test(text(v));
const noLitigation=v=>/(?:\bRAS\b|aucune\s+(?:procédure|action|litige)|absence\s+de\s+(?:procédure|litige)|sans\s+(?:procédure|litige))/i.test(text(v));
const unsupportedChargeJudgment=v=>/charges?/i.test(text(v))&&/(?:élev[ée]es?|faibles?|excessiv|important(?:es)?)/i.test(text(v))&&!/(?:compar|moyenne|benchmark|référence|secteur|budget\s+prévisionnel)/i.test(text(v));

const CATEGORY_WEIGHTS={ag:25,charges:15,accounts:10,diagnostics:15,pppt:15,reglement:10,synthese:5,entretien:5};
const CATEGORY_PATTERNS={
  ag:/assembl[ée]e\s+g[ée]n[ée]rale|proc[èe]s[- ]verbal.{0,80}assembl|\bago\b|\bag\s+(?:du|des|ordinaire|extraordinaire)\b/i,
  charges:/d[ée]compte\s+de\s+charges|r[ée]partition.{0,40}charges|appel\s+de\s+fonds|charges\s+du\s+lot|total\s+des\s+charges/i,
  accounts:/approbation\s+des\s+comptes|budget\s+pr[ée]visionnel|annexe\s+[1-5]|situation\s+comptable|cr[ée]ances|dettes\s+fournisseurs/i,
  diagnostics:/diagnostic\s+de\s+performance\s+[ée]nerg[ée]tique|\bdpe\b|installation\s+int[ée]rieure\s+d['’]?[ée]lectricit[ée]|amiante|termites|[ée]tat\s+des\s+risques/i,
  pppt:/\bpppt\b|projet\s+de\s+plan\s+pluriannuel|plan\s+pluriannuel\s+de\s+travaux|\bppt\b/i,
  reglement:/r[èe]glement\s+de\s+copropri[ée]t[ée]|[ée]tat\s+descriptif\s+de\s+division|\bedd\b/i,
  synthese:/fiche\s+synth[ée]tique|synth[èe]se\s+de\s+la\s+copropri[ée]t[ée]/i,
  entretien:/carnet\s+d['’]entretien|contrat\s+d['’]entretien|maintenance\s+ascenseur|entretien\s+toiture/i,
};

function docSignal(doc){
  const raw=text(doc?.text);
  const name=text(doc?.name);
  const sample=(name+'\n'+raw.slice(0,50000)).replace(/\s+/g,' ');
  const quality=String(doc?.quality||'').toLowerCase();
  const weakPages=Math.max(0,Number(doc?.weakPages)||0);
  const pages=Math.max(0,Number(doc?.pages)||0);
  const chars=raw.trim().length;
  let readability=quality==='failed'?0:quality==='partial'?0.68:chars<80?0:1;
  if(pages>0&&weakPages>0)readability*=Math.max(.55,1-(weakPages/pages)*.75);
  const categories={};
  for(const [k,re] of Object.entries(CATEGORY_PATTERNS))categories[k]=re.test(sample);
  return{readability,chars,pages,weakPages,categories};
}

export function documentCoverage(docs=[]){
  if(!Array.isArray(docs)||docs.length===0)return{score:0,readability:0,categories:{},readableDocs:0,totalDocs:0};
  const signals=docs.map(docSignal);
  const categories={};
  for(const k of Object.keys(CATEGORY_WEIGHTS))categories[k]=signals.some(s=>s.readability>0&&s.categories[k]);
  const categoryScore=Object.entries(CATEGORY_WEIGHTS).reduce((sum,[k,w])=>sum+(categories[k]?w:0),0);
  const readable=signals.filter(s=>s.readability>0);
  const readability=readable.length?readable.reduce((s,x)=>s+x.readability,0)/docs.length:0;
  const usefulChars=signals.reduce((s,x)=>s+Math.min(x.chars,80000)*x.readability,0);
  const volumeFactor=clamp(usefulChars/120000,0.35,1);
  const score=Math.round(clamp(categoryScore*readability*volumeFactor));
  return{score,readability:Math.round(readability*100),categories,readableDocs:readable.length,totalDocs:docs.length};
}

function splitPages(raw){
  const matches=[...raw.matchAll(/(?=\[PAGE\s+\d+\s*\|)/gi)].map(m=>m.index??0);
  if(matches.length<2)return[];
  const out=[];
  for(let i=0;i<matches.length;i++)out.push(raw.slice(matches[i],matches[i+1]??raw.length));
  return out;
}

function balancedExcerpt(raw,maxChars){
  if(raw.length<=maxChars)return raw;
  const pages=splitPages(raw);
  if(pages.length>1){
    const header='[EXTRACTION ÉCHANTILLONNÉE SUR TOUT LE DOCUMENT — certaines portions longues ont été condensées]\n';
    const budget=Math.max(1000,maxChars-header.length);
    const per=Math.max(450,Math.floor(budget/pages.length));
    const selected=pages.map(p=>p.length<=per?p:p.slice(0,Math.floor(per*.72))+'\n[…portion condensée…]\n'+p.slice(-Math.floor(per*.28)));
    let joined=header+selected.join('\n');
    if(joined.length>maxChars)joined=joined.slice(0,maxChars);
    return joined;
  }
  const head=Math.floor(maxChars*.55),mid=Math.floor(maxChars*.20),tail=maxChars-head-mid-90;
  const midStart=Math.max(head,Math.floor(raw.length/2-mid/2));
  return raw.slice(0,head)+'\n[…contenu intermédiaire condensé…]\n'+raw.slice(midStart,midStart+mid)+'\n[…fin condensée…]\n'+raw.slice(-Math.max(0,tail));
}

export function prepareDocs(docs=[],options={}){
  // Keep the model input comfortably bounded even on 20–30 document dossiers.
  // 360k characters is intentionally conservative and a compact fallback can go lower.
  const MAX_TOTAL=Math.max(90000,Number(options?.maxTotal)||360000);
  const MAX_DOC=Math.max(12000,Number(options?.maxDoc)||50000);
  const list=Array.isArray(docs)?docs.slice(0,30):[];
  if(!list.length)return[];
  const fairCap=Math.max(3000,Math.floor(MAX_TOTAL/list.length));
  const cap=Math.min(MAX_DOC,fairCap);
  return list.map(d=>{
    const raw=text(d?.text);
    const prepared=balancedExcerpt(raw,cap);
    return{
      name:text(d?.name)||'document',text:prepared,pages:num(d?.pages),quality:text(d?.quality)||undefined,
      weakPages:num(d?.weakPages),ocrPages:num(d?.ocrPages),chars_source:raw.length,chars_transmitted:prepared.length,
      truncated:prepared.length<raw.length
    };
  });
}

export function normalizeAnalysis(input){
  const a=obj(input);
  a.property=obj(a.property);a.market=obj(a.market);a.copro_metrics=obj(a.copro_metrics);a.copro=obj(a.copro);a.works=obj(a.works);
  a.buyer_blocks=obj(a.buyer_blocks);a.documents=obj(a.documents);a.risk_flags=obj(a.risk_flags);a.executive_summary=obj(a.executive_summary);
  a.negotiation=obj(a.negotiation);a.verdict=obj(a.verdict);
  a.buyer_blocks.diagnostic_works=obj(a.buyer_blocks.diagnostic_works);
  a.buyer_blocks.future_copro_costs=obj(a.buyer_blocks.future_copro_costs);
  a.buyer_blocks.real_acquisition_budget=obj(a.buyer_blocks.real_acquisition_budget);
  a.buyer_blocks.before_offer_checks=obj(a.buyer_blocks.before_offer_checks);
  const arrayPaths=[
    [a.property,'assets'],[a.property,'weaknesses'],[a.property,'diagnostics'],[a.market,'comparables'],
    [a.copro,'recurring_topics'],[a.copro,'litigation'],[a.copro,'strengths'],[a.copro,'weaknesses'],
    [a.works,'voted'],[a.works,'discussed'],[a.works,'rejected_or_postponed'],[a.works,'recommended_pppt'],[a.works,'recent_completed'],[a.works,'asl'],
    [a.buyer_blocks.diagnostic_works,'items'],[a.buyer_blocks.future_copro_costs,'items'],[a.buyer_blocks.future_copro_costs,'unknown_exposure'],
    [a.buyer_blocks.real_acquisition_budget,'unknown_costs'],[a.buyer_blocks.before_offer_checks,'checks'],[a.buyer_blocks.before_offer_checks,'inconsistencies'],[a.buyer_blocks.before_offer_checks,'negotiation_impacts'],
    [a.documents,'received'],[a.documents,'missing_or_to_obtain'],[a.documents,'quality_notes'],
    [a.executive_summary,'top_strengths'],[a.executive_summary,'top_risks'],[a.executive_summary,'what_changes_the_decision'],
    [a.negotiation,'arguments'],[a.negotiation,'conditions_before_offer'],[a,'evidence'],[a,'questions_before_offer'],[a.verdict,'go_if'],[a.verdict,'stop_if']
  ];
  for(const [o,k] of arrayPaths)o[k]=arr(o[k]);

  // Remove neutral facts accidentally promoted to risks.
  a.property.weaknesses=a.property.weaknesses.filter(x=>!neutralBalconyWeakness(x));
  a.executive_summary.top_risks=a.executive_summary.top_risks.filter(x=>!neutralBalconyWeakness(x));
  // "RAS / aucune procédure" is evidence of no known litigation, never litigation itself.
  a.copro.litigation=a.copro.litigation.filter(x=>!noLitigation(x));
  // Do not describe charges as high/low without an explicit benchmark.
  a.negotiation.arguments=a.negotiation.arguments.filter(x=>!unsupportedChargeJudgment(x));
  a.executive_summary.top_risks=a.executive_summary.top_risks.filter(x=>!unsupportedChargeJudgment(x));

  a.executive_summary.top_strengths=a.executive_summary.top_strengths.slice(0,3);
  a.executive_summary.top_risks=a.executive_summary.top_risks.slice(0,3);
  a.executive_summary.what_changes_the_decision=a.executive_summary.what_changes_the_decision.slice(0,4);
  a.documents.missing_or_to_obtain=a.documents.missing_or_to_obtain.slice(0,5);
  a.questions_before_offer=a.questions_before_offer.slice(0,5);

  a.evidence=a.evidence.slice(0,30).map(e=>{
    const x=obj(e),claim=text(x.claim)||text(x.text);
    let status=['FACT','INFERENCE','UNKNOWN'].includes(String(x.status))?String(x.status):'UNKNOWN';
    const explicitSource=text(x.source).trim()||text(x.file).trim();
    if(status==='FACT'&&!explicitSource&&!sourceInText(claim))status='UNKNOWN';
    return{...x,claim:claim||undefined,status,source:explicitSource||undefined};
  });
  for(const key of Object.keys(a.risk_flags))a.risk_flags[key]=a.risk_flags[key]===true;
  return a;
}

export function hardenScores(result){
  const s=result?.scores;if(!s)return result;
  s.property=scoreNum(s.property);s.copro=scoreNum(s.copro);s.market=scoreNum(s.market);
  s.documentation=scoreNum(s.documentation);s.confidence=scoreNum(s.confidence);
  const meta=result?.meta||{};
  const allAxesKnown=s.property!==null&&s.copro!==null&&s.market!==null;
  const enoughDocs=s.documentation!==null&&s.documentation>=60;
  const enoughConfidence=s.confidence!==null&&s.confidence>=60;
  s.overall=Boolean(meta.score_withheld)||!allAxesKnown||!enoughDocs||!enoughConfidence?null:scoreNum(s.overall);
  const conf=s.confidence;
  s.confidence_label=conf===null?"faible":conf>=85?"très bonne":conf>=70?"bonne":conf>=55?"moyenne":conf>=40?"limitée":"faible";
  return result;
}


const frNumber=v=>{const s=String(v??'').replace(/\s/g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null};
const firstMatchNumber=(raw,re)=>{const m=String(raw||'').match(re);return m?frNumber(m[1]):null};
const dpeClassFromValues=(surface,energy,ges)=>{
  if(!(surface>40)||!(energy>=0)||!(ges>=0))return null;
  const thresholds=[[70,6,'A'],[110,11,'B'],[180,30,'C'],[250,50,'D'],[330,70,'E'],[420,100,'F']];
  for(const [e,g,label] of thresholds)if(energy<=e&&ges<=g)return label;
  return 'G';
};

export function extractDeterministicFacts(docs=[]){
  const list=Array.isArray(docs)?docs:[];
  const diagnosticDocs=list.filter(d=>{const s=docSignal(d);return s.categories.diagnostics||/DIA|diagnostic/i.test(text(d?.name))});
  const chargeDocs=list.filter(d=>{const s=docSignal(d);return s.categories.charges||/d[ée]compte|appel.*fonds/i.test(text(d?.name))});
  const diag=diagnosticDocs.map(d=>text(d?.text)).join('\n');
  const charges=chargeDocs.map(d=>text(d?.text)).join('\n');

  const surface=
    firstMatchNumber(diag,/(?:superficie|surface)\s*[«"']?\s*carrez\s*[»"']?\s*[:=]?\s*(\d{1,3}(?:[.,]\d{1,2})?)/i) ??
    firstMatchNumber(diag,/surface\s+de\s+r[ée]f[ée]rence\s*[:=]?\s*(\d{1,3}(?:[.,]\d{1,2})?)/i);
  const roomMatch=diag.match(/\b(?:Appartement\s+)?T([1-9])\b/i);
  const rooms=roomMatch?Number(roomMatch[1]):null;
  const floorMatch=diag.match(/(?:[ée]tage|etage)\s*[:=]?\s*(\d{1,2})(?:\s*[°ºeè])?/i);
  const floor=floorMatch?`${Number(floorMatch[1])}e étage`:null;
  const energyCostMatch=diag.match(/(?:entre|de)\s*(\d{2,5}(?:\s\d{3})?)\s*€\s*(?:et|à|a)\s*(\d{1,3}(?:\s\d{3})?)\s*€\s*(?:par\s+an|\/\s*an)/i);
  const energyCostLow=energyCostMatch?frNumber(energyCostMatch[1]):null;
  const energyCostHigh=energyCostMatch?frNumber(energyCostMatch[2]):null;

  let energy=null,ges=null;
  const perf=diag.match(/performance\s+[ée]nerg[ée]tique\s+et\s+climatique([\s\S]{0,1800}?)(?:estimation\s+des\s+co[uû]ts|informations\s+diagnostiqueur|\[PAGE|$)/i);
  if(perf){
    const nums=[...perf[1].matchAll(/\b(\d{1,3})\b/g)].map(m=>Number(m[1])).filter(Number.isFinite);
    for(let i=0;i<nums.length-1;i++){
      if(nums[i]>=20&&nums[i]<=700&&nums[i+1]>=0&&nums[i+1]<=150&&nums[i]>nums[i+1]*2){energy=nums[i];ges=nums[i+1];break}
    }
  }
  const dpe=dpeClassFromValues(surface,energy,ges);

  const annualCharges=
    firstMatchNumber(charges,/total\s+des\s+charges\s+sur\s+cette\s+p[ée]riode[\s\S]{0,220}?(\d{3,6}(?:[.,]\d{2}))/i);
  const individualBalance=firstMatchNumber(charges,/solde\s+d[ée]biteur\s+(\d{1,6}(?:[.,]\d{2}))/i);
  const currentCall=firstMatchNumber(charges,/montant\s+de\s+l['’]?appel\s+de\s+fonds\s+(\d{1,6}(?:[.,]\d{2}))/i);
  const totalToPay=firstMatchNumber(charges,/total\s+[àa]\s+payer\s+(\d{1,6}(?:[.,]\d{2}))/i);

  return{
    surface_m2:surface,rooms,floor,dpe,energy_consumption_kwh_m2:energy,ghg_kgco2_m2:ges,
    energy_cost_low:energyCostLow,energy_cost_high:energyCostHigh,lot_annual_charges:annualCharges,
    individual_balance:individualBalance,current_call_amount:currentCall,total_to_pay:totalToPay
  };
}

export function applyDeterministicFacts(analysis,docs=[]){
  const a=normalizeAnalysis(analysis),f=extractDeterministicFacts(docs);
  if(f.surface_m2!==null)a.property.surface_m2=f.surface_m2;
  if(f.rooms!==null)a.property.rooms=f.rooms;
  if(f.floor)a.property.floor=f.floor;
  if(f.dpe)a.property.dpe=f.dpe;
  if(f.energy_consumption_kwh_m2!==null)a.property.energy_consumption_kwh_m2=f.energy_consumption_kwh_m2;
  if(f.ghg_kgco2_m2!==null)a.property.ghg_kgco2_m2=f.ghg_kgco2_m2;
  if(f.energy_cost_low!==null)a.property.energy_cost_low=f.energy_cost_low;
  if(f.energy_cost_high!==null)a.property.energy_cost_high=f.energy_cost_high;
  if(f.lot_annual_charges!==null)a.copro_metrics.lot_annual_charges=f.lot_annual_charges;
  if(f.individual_balance!==null)a.copro_metrics.individual_balance=f.individual_balance;
  if(f.current_call_amount!==null)a.copro_metrics.current_call_amount=f.current_call_amount;
  if(f.total_to_pay!==null)a.copro_metrics.total_to_pay=f.total_to_pay;
  return a;
}

function parseCsvLine(line){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){out.push(cur);cur=''}
    else cur+=ch;
  }
  out.push(cur);return out;
}
function haversineMeters(lat1,lon1,lat2,lon2){
  const r=6371000,toRad=x=>x*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
export function parseStaticDvfCsv(csv,{lat,lon,maxDistanceM=1200,source='data.gouv.fr — DVF Etalab'}={}){
  const raw=String(csv||'').replace(/^\uFEFF/,'');if(!raw.trim())return[];
  const lines=raw.split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];
  const headers=parseCsvLine(lines[0]).map(x=>x.trim());
  const ix=Object.fromEntries(headers.map((h,i)=>[h,i]));
  const required=['id_mutation','date_mutation','valeur_fonciere','type_local','surface_reelle_bati','longitude','latitude'];
  if(required.some(k=>ix[k]===undefined))return[];
  const seen=new Set(),out=[];
  for(let i=1;i<lines.length;i++){
    const row=parseCsvLine(lines[i]);
    const type=String(row[ix.type_local]||'').trim();
    if(type!=='Appartement'&&type!=='Maison')continue;
    const price=frNumber(row[ix.valeur_fonciere]),surface=frNumber(row[ix.surface_reelle_bati]);
    const rlat=frNumber(row[ix.latitude]),rlon=frNumber(row[ix.longitude]);
    if(!(price>0)||!(surface>10)||rlat===null||rlon===null)continue;
    const pm=price/surface;if(!(pm>500&&pm<15000&&price<5000000))continue;
    const distance_m=Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))?Math.round(haversineMeters(Number(lat),Number(lon),rlat,rlon)):null;
    if(distance_m!==null&&distance_m>maxDistanceM)continue;
    const id=String(row[ix.id_mutation]||'')+'|'+type+'|'+surface+'|'+price;
    if(seen.has(id))continue;seen.add(id);
    const num=ix.adresse_numero===undefined?'':String(row[ix.adresse_numero]||'').trim();
    const voie=ix.adresse_nom_voie===undefined?'':String(row[ix.adresse_nom_voie]||'').trim();
    out.push({
      valeurfonc:price,sbati:surface,libtypbien:type.toUpperCase(),codtypbien:type==='Appartement'?'121':'111',
      datemut:String(row[ix.date_mutation]||''),distance_m,source,
      address:[num,voie].filter(Boolean).join(' '),id_mutation:String(row[ix.id_mutation]||'')
    });
  }
  out.sort((a,b)=>(a.distance_m??999999)-(b.distance_m??999999)||String(b.datemut).localeCompare(String(a.datemut)));
  return out;
}

function median(xs){const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function percentile(xs,p){const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo);}

function inferKind(property={}){const s=(text(property.title)+' '+text(property.property_analysis)+' '+text(property.floor)).toLowerCase();if(/maison|villa|pavillon/.test(s))return'house';if(/appartement|studio|\bt[1-9]\b|étage|etage/.test(s))return'apartment';return null;}

export function selectOfficialComparables(candidates=[],property={}){
  const surface=num(property.surface_m2),kind=inferKind(property);
  let list=arr(candidates).map(c=>{
    const price=num(c.valeurfonc??c.price),surf=num(c.sbati??c.surface),type=String(c.libtypbien??c.type??''),code=String(c.codtypbien??'');
    const ckind=/APPART/i.test(type)||code==='121'?'apartment':/MAISON/i.test(type)||code==='111'?'house':null;
    const date=String(c.datemut??c.date??'');
    const pm=price&&surf?price/surf:null;
    return{raw:c,price,surface:surf,type,kind:ckind,date,price_m2:pm};
  }).filter(x=>x.price&&x.surface&&x.surface>10&&x.price_m2&&x.price_m2>500&&x.price_m2<15000&&x.price<5000000);
  if(kind)list=list.filter(x=>!x.kind||x.kind===kind);
  if(surface){const tight=list.filter(x=>Math.abs(x.surface-surface)/surface<=.30);if(tight.length>=3)list=tight;else{const wide=list.filter(x=>Math.abs(x.surface-surface)/surface<=.50);if(wide.length>=2)list=wide;}}
  list.sort((a,b)=>{
    const sd=surface?(Math.abs(a.surface-surface)-Math.abs(b.surface-surface)):0;
    if(sd!==0)return sd;
    return String(b.date).localeCompare(String(a.date));
  });
  return list.slice(0,5).map(x=>{
    const distance=num(x.raw?.distance_m),address=text(x.raw?.address),source=text(x.raw?.source)||'Cerema — DVF+ open-data';
    return{
      label:[address||x.type||'Vente',Math.round(x.surface)+' m²'].filter(Boolean).join(' · '),date:x.date,price:Math.round(x.price),surface:Math.round(x.surface*10)/10,
      price_m2:Math.round(x.price_m2),type:'DVF',distance_m:distance,distance_note:distance!==null?`${Math.round(distance)} m env.`:'secteur proche',source
    };
  });
}

export function applyOfficialMarketData(analysis,candidates=[]){
  const a=normalizeAnalysis(analysis);const comps=selectOfficialComparables(candidates,a.property);
  if(comps.length){
    a.market.comparables=comps;
    a.market.confidence=comps.length>=3?'bonne':'moyenne';
    const surface=num(a.property.surface_m2),pms=comps.map(c=>num(c.price_m2)).filter(Number.isFinite);
    if(surface&&pms.length>=2){
      const q25=percentile(pms,.25),q75=percentile(pms,.75),med=median(pms);
      const low=Math.round(surface*(q25??med)*.95/1000)*1000,high=Math.round(surface*(q75??med)*1.05/1000)*1000;
      a.market.dvf_reference={low,high,median_price_m2:Math.round(med),count:comps.length,source:comps[0]?.source||'DVF open-data'};
      const aiLow=num(a.market.estimate_low),aiHigh=num(a.market.estimate_high);
      const grosslyOutside=aiLow&&aiHigh&&(aiHigh<low*.72||aiLow>high*1.28||aiLow>aiHigh);
      if(!aiLow||!aiHigh||grosslyOutside){a.market.estimate_low=low;a.market.estimate_high=high;a.market.positioning=[text(a.market.positioning),'Fourchette recalée sur les ventes DVF+ disponibles dans le secteur.'].filter(Boolean).join(' ');}
    }
  }else{
    a.market.comparables=arr(a.market.comparables).filter(c=>String(c?.type||'').toLowerCase()!=='dvf');
    a.market.confidence='faible';
  }
  return a;
}

export function deterministicScores(a,docs=[],marketMeta={}){
  const r=obj(a?.risk_flags),coverage=documentCoverage(docs),documentation=coverage.score;
  let property=82;
  if(r.electrical_anomalies)property-=5;if(r.major_property_defect)property-=12;if(r.no_elevator_high_floor)property-=6;if(r.poor_dpe)property-=8;if(r.sold_occupied)property-=2;if(r.no_parking_when_expected)property-=3;if(r.strong_property_assets)property+=4;property=clamp(property);

  let finance=40;const ar=num(a?.copro_metrics?.collective_arrears_ratio_pct),sr=num(a?.copro_metrics?.supplier_debt_ratio_pct),fr=num(a?.copro_metrics?.works_fund_ratio_pct);
  if(ar!==null)finance-=ar>25?18:ar>15?12:ar>8?6:0;else finance-=5;
  if(sr!==null)finance-=sr>15?7:sr>8?4:0;
  if(fr!==null)finance+=fr>15?3:fr<3?-4:0;finance=clamp(finance,0,40);

  let works=25;if(r.voted_major_works)works-=10;if(r.pppt_significant_medium_term)works-=6;if(r.recurring_major_technical_issue)works-=5;if(r.recent_major_works_completed)works+=2;works=clamp(works,0,25);
  let governance=20;if(r.litigation)governance-=5;if(r.governance_issue)governance-=6;if(r.asl_active)governance-=2;governance=clamp(governance,0,20);
  let technical=15;if(r.poor_maintenance)technical-=6;if(r.recurring_major_technical_issue)technical-=4;if(r.recent_major_works_completed)technical+=2;technical=clamp(technical,0,15);
  const copro=Math.round(finance+works+governance+technical);

  let market=55;const ask=num(a?.property?.asking_price),lo=num(a?.market?.estimate_low),hi=num(a?.market?.estimate_high);
  if(ask&&lo&&hi&&lo<=hi){if(ask>=lo&&ask<=hi)market=84;else if(ask<lo)market=88;else market=clamp(Math.round(84-((ask-hi)/hi*100)*2.5),35,84)}

  const officialCount=Math.max(0,Number(marketMeta?.officialCount)||0);
  const marketReliability=officialCount>=3?90:officialCount>=1?60:0;
  // Confidence describes the document analysis. Market availability is handled separately.
  const confidence=Math.round(documentation*.85+(coverage.readability||0)*.15);

  const diagnostics=arr(a?.property?.diagnostics);
  const propertyEvidence=Boolean(
    num(a?.property?.surface_m2)!==null &&
    num(a?.property?.rooms)!==null &&
    text(a?.property?.dpe).trim() &&
    diagnostics.length>=2
  );

  const signals=Array.isArray(docs)?docs.map(docSignal):[];
  const strongAg=signals.some(s=>s.readability>=.85&&s.categories.ag);
  const strongAccounts=signals.some(s=>s.readability>=.9&&(s.categories.accounts||s.categories.synthese));
  const coproMetrics=a?.copro_metrics||{};
  const financeCoreCount=["annual_budget","collective_arrears","supplier_debt","cash","works_fund"].filter(k=>num(coproMetrics?.[k])!==null).length;
  // A list of works or a charge statement alone cannot justify a reassuring copro score.
  const coproEvidence=strongAg&&(strongAccounts||financeCoreCount>=2);
  const marketEvidence=officialCount>=3&&lo!==null&&hi!==null&&lo<=hi;

  const propertyScore=propertyEvidence?property:null;
  const coproScore=coproEvidence?copro:null;
  const marketScore=marketEvidence?market:null;
  const overall=docs.length>0&&documentation>=60&&confidence>=60&&propertyScore!==null&&coproScore!==null&&marketScore!==null
    ?Math.round(propertyScore*.30+coproScore*.40+marketScore*.30):null;

  return{
    property:propertyScore,copro:coproScore,market:marketScore,documentation,confidence,overall,
    axes:{finance,works,governance,technical},coverage,
    evidence_gate:{property:propertyEvidence,copro:coproEvidence,market:marketEvidence,finance_core_count:financeCoreCount,strong_ag:strongAg,strong_accounts:strongAccounts,official_count:officialCount}
  };
}

