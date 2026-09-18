import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn, isExpired } from "../lib/storage.mjs";
import { prepareDocs, normalizeAnalysis, applyOfficialMarketData, deterministicScores, num } from "../lib/reliability-core.mjs";

type Doc={name:string;text:string;pages?:number;chars?:number;quality?:string;ocrPages?:number;weakPages?:number;pageStats?:any[]};

const jsonText=(value:any)=>JSON.stringify(value);
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);
const safeJsonFromText=(value:string)=>{
  const cleaned=String(value||"").trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(cleaned)}catch{}
  const s=cleaned.indexOf("{"),e=cleaned.lastIndexOf("}");
  if(s>=0&&e>s)return JSON.parse(cleaned.slice(s,e+1));
  throw new Error("Réponse IA non structurée");
};

const mergeUsage=(a:any,b:any)=>{
  if(!b)return a||null;
  const x=a||{};
  return{
    input_tokens:(Number(x.input_tokens)||0)+(Number(b.input_tokens)||0),
    output_tokens:(Number(x.output_tokens)||0)+(Number(b.output_tokens)||0),
    total_tokens:(Number(x.total_tokens)||0)+(Number(b.total_tokens)||0)
  };
};
const retryableModelFailure=(message:string)=>/REPORT_OUTPUT_LIMIT|Réponse IA non structurée|Aucun rapport exploitable|context|too long|too large|request too large|timeout|aborted|ECONN|HTTP 5\d\d|server_error|temporarily unavailable/i.test(message);
async function fetchWithTimeout(url:string,init:any,timeoutMs=180000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal})}
  catch(err:any){if(err?.name==="AbortError")throw new Error("MODEL_TIMEOUT");throw err}
  finally{clearTimeout(timer)}
}

async function fetchJson(url:string,timeoutMs=9000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const rsp=await fetch(url,{headers:{Accept:"application/json","User-Agent":"ReVisite/0.3"},signal:controller.signal});
    if(!rsp.ok)throw new Error(`HTTP ${rsp.status}`);
    return await rsp.json();
  }finally{clearTimeout(timer)}
}

const slimDvfRow=(x:any)=>({
  valeurfonc:x?.valeurfonc??null,sbati:x?.sbati??null,libtypbien:x?.libtypbien??null,codtypbien:x?.codtypbien??null,datemut:x?.datemut??null
});

async function fetchDvfCandidates(address:string,store:any){
  if(!address)return{status:"not_requested",candidates:[],source:"",cache_hit:false};
  const normalized=address.toLowerCase().replace(/\s+/g," ").trim();
  const cacheKey=`dvf-cache-${await digest(normalized)}`;
  try{
    const cached:any=await store.get(cacheKey,{type:"json"});
    if(cached&&!isExpired(cached)&&Array.isArray(cached.candidates))return{...cached,cache_hit:true};
  }catch{}
  try{
    const geo=new URL("https://data.geopf.fr/geocodage/completion/");
    geo.searchParams.set("text",address);geo.searchParams.set("type","StreetAddress");geo.searchParams.set("maximumResponses","1");
    const g:any=await fetchJson(geo.toString(),7000);
    const first=Array.isArray(g?.results)?g.results[0]:null;
    const lon=num(first?.x),lat=num(first?.y);
    if(lon===null||lat===null)return{status:"geocode_unavailable",candidates:[],source:"",cache_hit:false};
    const latDelta=.0052,lonDelta=.0052/Math.max(.45,Math.cos(lat*Math.PI/180));
    const bbox=[lon-lonDelta,lat-latDelta,lon+lonDelta,lat+latDelta].map(v=>v.toFixed(6)).join(",");
    const year=new Date().getUTCFullYear()-3;
    const bases=["https://apidf.cerema.fr","https://apidf-preprod.cerema.fr"];
    for(const base of bases){
      try{
        const u=new URL("/dvf_opendata/mutations/",base);
        u.searchParams.set("in_bbox",bbox);u.searchParams.set("anneemut_min",String(year));u.searchParams.set("codtypbien","111,121");u.searchParams.set("page_size","120");u.searchParams.set("ordering","-datemut");
        const d:any=await fetchJson(u.toString(),10000);
        const rows=(Array.isArray(d?.results)?d.results:Array.isArray(d)?d:[]).slice(0,120).map(slimDvfRow);
        if(rows.length){
          const result:any={status:"ok",candidates:rows,source:base,lat,lon,cache_hit:false,expires_at:expiresIn(1000*60*60*24)};
          try{await store.setJSON(cacheKey,result)}catch{}
          return result;
        }
      }catch{}
    }
    return{status:"unavailable",candidates:[],source:"",lat,lon,cache_hit:false};
  }catch{return{status:"unavailable",candidates:[],source:"",cache_hit:false}}
}

function dvfPromptRows(rows:any[]){
  return rows.slice(0,24).map((x:any)=>{
    const p=num(x?.valeurfonc),s=num(x?.sbati),pm=p&&s?Math.round(p/s):null;
    return [x?.datemut||"?",x?.libtypbien||x?.codtypbien||"bien",p?`${Math.round(p)}€`:"prix ?",s?`${s}m²`:"surface ?",pm?`${pm}€/m²`:""].filter(Boolean).join(" | ");
  }).join("\n");
}

async function recordUsage(store:any,usage:any){
  if(!usage)return;
  try{
    const day=new Date().toISOString().slice(0,10),key=`usage-${day}`;
    const previous:any=await store.get(key,{type:"json"})||{};
    await store.setJSON(key,{
      date:day,calls:(Number(previous.calls)||0)+1,
      input_tokens:(Number(previous.input_tokens)||0)+(Number(usage.input_tokens)||0),
      output_tokens:(Number(previous.output_tokens)||0)+(Number(usage.output_tokens)||0),
      total_tokens:(Number(previous.total_tokens)||0)+(Number(usage.total_tokens)||0),
      expires_at:expiresIn(1000*60*60*24*120)
    });
  }catch{}
}

function getOpenAIKey(){
  const direct=Netlify.env.get("OPENAI_API_KEY");
  if(direct)return direct;
  return ["REVISITE_OPENAI_A","REVISITE_OPENAI_B","REVISITE_OPENAI_C1","REVISITE_OPENAI_C2"].map(k=>Netlify.env.get(k)||"").join("");
}

export default async(req:Request,_context:Context)=>{
  let jobId="";const store=jobStore();
  try{
    const trigger:any=await req.json();
    jobId=String(trigger?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return;
    const inputKey=`input-${jobId}`;
    const body:any=await store.get(inputKey,{type:"json"});
    if(!body)throw new Error("Les données de l'analyse sont introuvables.");
    await store.delete(inputKey);
    await store.setJSON(jobId,{status:"running",started_at:new Date().toISOString(),progress:"Analyse en cours",expires_at:expiresIn(1000*60*60*3)});

    const apiKey=getOpenAIKey(),model=Netlify.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
    if(!apiKey)throw new Error("La clé OpenAI n'est pas configurée.");
    const listingUrl=String(body?.listingUrl||"").trim().slice(0,1200),address=String(body?.address||"").trim().slice(0,300),docs:Doc[]=Array.isArray(body?.documents)?body.documents.slice(0,30):[],extra=String(body?.extra||"").slice(0,7000),cacheKey=String(body?.cacheKey||"").slice(0,100);
    if(!listingUrl&&!address&&docs.length===0)throw new Error("Ajoutez au moins une annonce, une adresse ou un document.");

    const prepared=prepareDocs(docs),preparedChars=prepared.reduce((s:number,d:any)=>s+(Number(d.chars_transmitted)||0),0),dvf:any=await fetchDvfCandidates(address,store);
    const officialDvf=dvf.status==="ok"?dvfPromptRows(dvf.candidates):"Aucune donnée DVF+ officielle n'a pu être récupérée automatiquement pour cette analyse.";

    const system=`Tu es le moteur ReVisite, outil français d'aide à la décision avant une offre immobilière. Tu dois être utile, simple et surtout factuel.

RÈGLES DE FIABILITÉ
- Distingue FACT, INFERENCE et UNKNOWN. Une donnée absente n'est jamais zéro et n'est jamais un risque avéré.
- Un solde vendeur n'est pas un impayé collectif. Un projet ou PPPT n'est pas un travail voté. Une discussion en AG n'est pas une décision.
- N'invente jamais un prix, une vente, une surface, un montant de charges, une obligation légale, une décision d'AG ou une quote-part.
- Chaque fait important issu d'un document doit indiquer le fichier et la page lorsque le marqueur [PAGE N] est disponible.
- Un document partiellement extrait réduit la confiance mais ne constitue pas un défaut du bien.
- Les caractéristiques neutres (ex. premier étage sans ascenseur) ne deviennent pas des risques sans impact concret.

PRIX / MARCHÉ
- Les lignes DVF+ fournies dans le message utilisateur proviennent du Cerema. Utilise-les comme source prioritaire pour les ventes enregistrées.
- N'invente AUCUNE vente DVF supplémentaire. Si les ventes fournies sont insuffisantes, indique une confiance faible ou moyenne.
- L'URL d'annonce peut être recherchée uniquement pour compléter les caractéristiques ou le prix demandé. Une annonce n'est jamais une vente réalisée.

COPROPRIÉTÉ
- Sépare strictement travaux votés, discutés, rejetés/reportés et recommandations PPPT/PPT.
- Distingue charges courantes, récupérables, travaux exceptionnels, impayés collectifs et solde individuel.

DIAGNOSTICS / TRAVAUX
- Une anomalie de diagnostic n'est pas automatiquement un travail juridiquement obligatoire.
- Ne chiffre que ce qui peut raisonnablement l'être et indique quand un devis professionnel est nécessaire.

STYLE
- Français naturel, sobre et concret. 3 points forts maximum, 3 points de vigilance maximum, 4 éléments qui changent la décision maximum.
- Bannir les formulations artificielles et alarmistes. Le rapport doit être compréhensible par un acquéreur non spécialiste.

Retourne uniquement un objet JSON valide correspondant aux rubriques demandées.`;

    const schemaHint={
      property:{title:"",address:"",asking_price:null,surface_m2:null,price_per_m2:null,rooms:null,floor:"",dpe:"",occupied:null,rent_excl_charges:null,charges_provision:null,assets:[],weaknesses:[],diagnostics:[],property_analysis:""},
      market:{estimate_low:null,estimate_high:null,offer_low:null,offer_high:null,confidence:"faible|moyenne|bonne",positioning:"",comparables:[],analysis:""},
      copro_metrics:{annual_budget:null,collective_arrears:null,collective_arrears_ratio_pct:null,supplier_debt:null,supplier_debt_ratio_pct:null,cash:null,works_fund:null,works_fund_ratio_pct:null,lot_annual_charges:null,recoverable_charges:null},
      copro:{financial_analysis:"",governance_analysis:"",technical_analysis:"",recurring_topics:[],litigation:[],strengths:[],weaknesses:[]},
      works:{voted:[],discussed:[],rejected_or_postponed:[],recommended_pppt:[],recent_completed:[],asl:[],analysis:""},
      buyer_blocks:{diagnostic_works:{summary:"",items:[],total_budget_low:null,total_budget_high:null,budget_note:""},future_copro_costs:{summary:"",items:[],lot_exposure_low:null,lot_exposure_high:null,unknown_exposure:[]},real_acquisition_budget:{purchase_price:null,acquisition_fees_estimate:null,private_works_low:null,private_works_high:null,voted_copro_share:null,known_total_low:null,known_total_high:null,unknown_costs:[],summary:""},before_offer_checks:{summary:"",checks:[],inconsistencies:[],negotiation_impacts:[]}},
      documents:{received:[],missing_or_to_obtain:[],quality_notes:[],analysis:""},risk_flags:{},
      executive_summary:{headline:"",overview:"",top_strengths:[],top_risks:[],financial_exposure:"",what_changes_the_decision:[]},
      negotiation:{recommended_strategy:"",arguments:[],conditions_before_offer:[],offer_comment:""},
      evidence:[],questions_before_offer:[],verdict:{label:"",summary:"",vigilance:"faible|modérée|forte",why:"",go_if:[],stop_if:[]}
    };

    const user=`ADRESSE DU BIEN:\n${address||"non fournie"}\n\nURL ANNONCE:\n${listingUrl||"non fournie"}\n\nINFORMATIONS COMPLÉMENTAIRES:\n${extra||"aucune"}\n\nVENTES DVF+ OFFICIELLES DU SECTEUR (CANDIDATS BRUTS À FILTRER SELON LE BIEN):\n${officialDvf}\n\nSTRUCTURE JSON ATTENDUE:\n${jsonText(schemaHint)}\n\nDOCUMENTS EXTRAITS:\n${prepared.map((d:any,i:number)=>`\n--- DOCUMENT ${i+1}: ${d.name} | pages=${d.pages??"?"} | lecture=${d.quality||"non qualifiée"} | caractères transmis=${d.chars_transmitted}/${d.chars_source}${d.truncated?" | ÉCHANTILLONNÉ":""} ---\n${d.text}`).join("\n")}`;

    // L'analyse documentaire privilégie une restitution structurée et factuelle.
    // Un raisonnement "medium" sur les gros dossiers peut consommer le budget de sortie
    // avant que le JSON soit terminé. "low" est plus fiable et moins coûteux ici.
    const reasoningEffort="low";
    const payload:any={
      model,input:[{role:"system",content:[{type:"input_text",text:system}]},{role:"user",content:[{type:"input_text",text:user}]}],
      tools:listingUrl?[{type:"web_search"}]:[],reasoning:{effort:reasoningEffort},max_output_tokens:12000,
      text:{format:{type:"json_object"},verbosity:"low"},store:false,prompt_cache_key:"revisite-analysis-v3"
    };
    const rsp=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const raw=await rsp.text();let data:any=null;try{data=raw?JSON.parse(raw):null}catch{}
    if(!rsp.ok)throw new Error(data?.error?.message||`Erreur moteur (${rsp.status}).`);
    let outText=data?.output_text;
    if(!outText&&Array.isArray(data?.output))outText=data.output.flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("\n");
    if(!outText)throw new Error("Aucun rapport exploitable.");
    if(data?.status==="incomplete"&&data?.incomplete_details?.reason==="max_output_tokens"){
      throw new Error("REPORT_OUTPUT_LIMIT");
    }

    let analysis=normalizeAnalysis(safeJsonFromText(outText));
    if(address)analysis.property.address=address;
    analysis=applyOfficialMarketData(analysis,dvf.candidates||[]);
    const p=analysis.property||{};
    if(p.asking_price&&p.surface_m2&&!p.price_per_m2)p.price_per_m2=Math.round(Number(p.asking_price)/Number(p.surface_m2));
    const officialCount=Array.isArray(analysis?.market?.comparables)?analysis.market.comparables.filter((x:any)=>x?.type==="DVF").length:0;
    const scores=deterministicScores(analysis,docs,{officialCount});
    await recordUsage(store,data?.usage);

    const result={analysis,scores,meta:{
      model,document_count:docs.length,beta:true,generated_at:new Date().toISOString(),
      input_chars:preparedChars,dvf_status:dvf.status,dvf_source:dvf.source||null,dvf_candidate_count:Array.isArray(dvf.candidates)?dvf.candidates.length:0,
      dvf_cache_hit:Boolean(dvf.cache_hit),usage:data?.usage||null,score_withheld:scores.overall===null,cache_hit:false
    }};
    await store.setJSON(jobId,{status:"done",result,expires_at:expiresIn(1000*60*60*3)});
    if(cacheKey.startsWith("analysis-cache-")){
      try{await store.setJSON(cacheKey,{result,expires_at:expiresIn(1000*60*60*24)})}catch{}
    }
  }catch(err:any){
    console.error("ReVisite background error",err);
    const message=String(err?.message||"");
    const error_code=
      /REPORT_OUTPUT_LIMIT|Réponse IA non structurée/i.test(message)?"MODEL_OUTPUT":
      /429|rate limit|quota/i.test(message)?"PROVIDER_RATE":
      /context|too large|request too large|413/i.test(message)?"INPUT_TOO_LARGE":
      "ENGINE";
    if(jobId)await store.setJSON(jobId,{status:"error",error_code,expires_at:expiresIn(1000*60*60)});
  }
};

export const config:Config={path:"/api/worker-background",background:true};
