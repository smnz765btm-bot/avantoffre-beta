import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn, isExpired } from "../lib/storage.mjs";
import { prepareDocs, normalizeAnalysis, applyDeterministicFacts, applyOfficialMarketData, deterministicScores, hardenScores, num } from "../lib/reliability-core.mjs";

type Doc={name:string;text:string;pages?:number;chars?:number;quality?:string;ocrPages?:number;weakPages?:number;pageStats?:any[]};

const jsonText=(value:any)=>JSON.stringify(value);
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);
const safeJsonFromText=(value:string)=>{
  const cleaned=String(value||"").trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(cleaned)}catch{}
  const s=cleaned.indexOf("{"),e=cleaned.lastIndexOf("}");
  if(s>=0&&e>s){try{return JSON.parse(cleaned.slice(s,e+1))}catch{}}
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

function basicFallbackAnalysis(docs:Doc[],address:string){
  const received=docs.map(d=>String(d?.name||"document")).slice(0,30);
  const readable=docs.filter(d=>String(d?.quality||"").toLowerCase()!=="failed"&&String(d?.text||"").trim().length>=80);
  const partial=docs.filter(d=>String(d?.quality||"").toLowerCase()==="partial").map(d=>String(d?.name||"document"));
  const sample=readable.map(d=>String(d.text||"").slice(0,25000)).join("\n").replace(/\s+/g," ");
  const findNumber=(re:RegExp)=>{const m=sample.match(re);if(!m)return null;const n=Number(String(m[1]).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:null};
  const surface=findNumber(/(?:surface(?:\s+carrez)?|carrez)[^0-9]{0,40}(\d{1,3}(?:[.,]\d{1,2})?)\s*m(?:²|2)/i);
  const charges=findNumber(/(?:total\s+annuel|charges?\s+(?:annuelles?|du\s+lot))[^0-9]{0,50}(\d{2,6}(?:[\s.]\d{3})*(?:[.,]\d{1,2})?)/i);
  const dpeMatch=sample.match(/(?:\bDPE\b|performance\s+énergétique)[^A-G]{0,30}\b([A-G])\b/i);
  const dpe=dpeMatch?String(dpeMatch[1]).toUpperCase():"";
  const propertyEvidence=[surface?String(surface)+" m²":"",dpe?"DPE "+dpe:""].filter(Boolean);
  return normalizeAnalysis({
    property:{title:"",address,asking_price:null,surface_m2:surface,price_per_m2:null,rooms:null,floor:"",dpe,assets:propertyEvidence,weaknesses:["Analyse approfondie temporairement indisponible : seules les données explicitement reconnues sont affichées."],diagnostics:[],property_analysis:"ReVisite a sécurisé les informations directement lisibles sans extrapoler les éléments non vérifiés."},
    market:{estimate_low:null,estimate_high:null,offer_low:null,offer_high:null,confidence:"faible",positioning:"Marché non calculé en mode de secours.",comparables:[],analysis:"Aucune estimation n’est produite sans analyse complète et comparables fiables."},
    copro_metrics:{annual_budget:null,collective_arrears:null,cash:null,works_fund:null,lot_annual_charges:charges},
    copro:{financial_analysis:"Mode de secours : la situation financière détaillée de la copropriété n’est pas scorée.",strengths:[],weaknesses:[]},
    works:{voted:[],discussed:[],recommended_pppt:[],analysis:"Les décisions de travaux ne sont pas déduites sans lecture structurée complète."},
    buyer_blocks:{diagnostic_works:{summary:"Non chiffré en mode de secours.",items:[],total_budget_low:null,total_budget_high:null},future_copro_costs:{summary:"Non chiffré en mode de secours.",items:[]},real_acquisition_budget:{purchase_price:null,acquisition_fees_estimate:null,private_works_low:null,private_works_high:null,known_total_low:null,known_total_high:null,summary:"Budget total non calculé en mode de secours."},before_offer_checks:{summary:"Relire les pièces signalées comme partielles avant offre.",checks:partial.slice(0,4),inconsistencies:[]}},
    documents:{received,missing_or_to_obtain:[],quality_notes:partial.map(n=>n+" — lecture partielle")},
    risk_flags:{},
    executive_summary:{headline:"Analyse sécurisée en mode de secours",overview:"Le rapport complet n’a pas pu être généré automatiquement. ReVisite affiche uniquement les données directement reconnues et ne produit aucun score global artificiel.",top_strengths:propertyEvidence,top_risks:partial.length?[String(partial.length)+" document(s) à lecture partielle"]:[],what_changes_the_decision:[]},
    negotiation:{recommended_strategy:"Ne pas fonder une offre sur le seul mode de secours.",arguments:[],conditions_before_offer:[]},
    evidence:[],questions_before_offer:[],
    verdict:{label:"À documenter avant offre",summary:"Rapport partiel sécurisé : aucune conclusion forte n’est produite sans analyse complète.",vigilance:"forte",why:"Certaines étapes du moteur d’analyse n’ont pas abouti.",go_if:[],stop_if:[]}
  });
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
    const documentIssues=Array.isArray(body?.documentIssues)?body.documentIssues.slice(0,30).map((x:any)=>({name:String(x?.name||"document").slice(0,240),reason:String(x?.reason||"Non exploitable").slice(0,300)})):[];
    if(!listingUrl&&!address&&docs.length===0)throw new Error("Ajoutez au moins une annonce, une adresse ou un document.");

    let prepared=prepareDocs(docs),preparedChars=prepared.reduce((s:number,d:any)=>s+(Number(d.chars_transmitted)||0),0);
    const dvf:any=await fetchDvfCandidates(address,store);
    const officialDvf=dvf.status==="ok"?dvfPromptRows(dvf.candidates):"Aucune donnée DVF+ officielle n'a pu être récupérée automatiquement pour cette analyse.";

    const system=`Tu es le moteur ReVisite, outil français d'aide à la décision avant une offre immobilière. Tu dois être utile, simple et surtout factuel.

RÈGLES DE FIABILITÉ
- Distingue FACT, INFERENCE et UNKNOWN. Une donnée absente n'est jamais zéro et n'est jamais un risque avéré.
- Un solde vendeur n'est pas un impayé collectif. Un projet ou PPPT n'est pas un travail voté. Une discussion en AG n'est pas une décision.
- N'invente jamais un prix, une vente, une surface, un montant de charges, une obligation légale, une décision d'AG ou une quote-part.
- Chaque fait important issu d'un document doit indiquer le fichier et la page lorsque le marqueur [PAGE N] est disponible.
- Un document partiellement extrait réduit la confiance mais ne constitue pas un défaut du bien.
- Une pièce rejetée/illisible doit être signalée comme limite documentaire, jamais transformée en défaut du bien.
- Les caractéristiques neutres (balcon hors Carrez, étage, absence d'une donnée) ne deviennent pas des risques sans impact concret démontré.
- Ne qualifie jamais des charges de "élevées", "faibles" ou "excessives" sans comparaison chiffrée explicite.
- "RAS", "aucune procédure" ou "absence de procédure" ne sont jamais des litiges.
- Un travail ancien déjà réalisé doit rester dans l'historique ; il ne doit pas être présenté comme dépense future.
- Un PPPT/PPT voté signifie que l'étude/le plan a été décidé ; cela ne transforme pas automatiquement tous les travaux du plan en travaux votés.

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
      property:{title:"",address:"",asking_price:null,surface_m2:null,price_per_m2:null,rooms:null,floor:"",dpe:"",energy_consumption_kwh_m2:null,ghg_kgco2_m2:null,energy_cost_low:null,energy_cost_high:null,occupied:null,rent_excl_charges:null,charges_provision:null,assets:[],weaknesses:[],diagnostics:[],property_analysis:""},
      market:{estimate_low:null,estimate_high:null,offer_low:null,offer_high:null,confidence:"faible|moyenne|bonne",positioning:"",comparables:[],analysis:""},
      copro_metrics:{annual_budget:null,collective_arrears:null,collective_arrears_ratio_pct:null,supplier_debt:null,supplier_debt_ratio_pct:null,cash:null,works_fund:null,works_fund_ratio_pct:null,lot_annual_charges:null,recoverable_charges:null},
      copro:{financial_analysis:"",governance_analysis:"",technical_analysis:"",recurring_topics:[],litigation:[],strengths:[],weaknesses:[]},
      works:{voted:[],discussed:[],rejected_or_postponed:[],recommended_pppt:[],recent_completed:[],asl:[],analysis:""},
      buyer_blocks:{diagnostic_works:{summary:"",items:[],total_budget_low:null,total_budget_high:null,budget_note:""},future_copro_costs:{summary:"",items:[],lot_exposure_low:null,lot_exposure_high:null,unknown_exposure:[]},real_acquisition_budget:{purchase_price:null,acquisition_fees_estimate:null,private_works_low:null,private_works_high:null,voted_copro_share:null,known_total_low:null,known_total_high:null,unknown_costs:[],summary:""},before_offer_checks:{summary:"",checks:[],inconsistencies:[],negotiation_impacts:[]}},
      documents:{received:[],rejected:[],missing_or_to_obtain:[],quality_notes:[],analysis:""},risk_flags:{},
      executive_summary:{headline:"",overview:"",top_strengths:[],top_risks:[],financial_exposure:"",what_changes_the_decision:[]},
      negotiation:{recommended_strategy:"",arguments:[],conditions_before_offer:[],offer_comment:""},
      evidence:[{claim:"",status:"FACT|INFERENCE|UNKNOWN",source:"",page:null}],questions_before_offer:[],verdict:{label:"",summary:"",vigilance:"faible|modérée|forte",why:"",go_if:[],stop_if:[]}
    };

    const buildUser=(preparedDocs:any[],compact=false)=>`ADRESSE DU BIEN:\n${address||"non fournie"}\n\nURL ANNONCE:\n${listingUrl||"non fournie"}\n\nINFORMATIONS COMPLÉMENTAIRES:\n${extra||"aucune"}\n\nDOCUMENTS NON EXPLOITABLES / EXCLUS DE L'ANALYSE:\n${documentIssues.length?documentIssues.map((x:any)=>`- ${x.name}: ${x.reason}`).join("\n"):"aucun"}\n\nVENTES DVF+ OFFICIELLES DU SECTEUR (CANDIDATS BRUTS À FILTRER SELON LE BIEN):\n${officialDvf}\n\nSTRUCTURE JSON ATTENDUE:\n${jsonText(schemaHint)}\n\n${compact?"MODE DE SECOURS COMPACT : sois particulièrement concis et priorise les montants, décisions d’AG, diagnostics, charges, travaux et incohérences.\n\n":""}DOCUMENTS EXTRAITS:\n${preparedDocs.map((d:any,i:number)=>`\n--- DOCUMENT ${i+1}: ${d.name} | pages=${d.pages??"?"} | lecture=${d.quality||"non qualifiée"} | caractères transmis=${d.chars_transmitted}/${d.chars_source}${d.truncated?" | ÉCHANTILLONNÉ":""} ---\n${d.text}`).join("\n")}`;

    let data:any=null,parsed:any=null,totalUsage:any=null,modelAttempts=0,fallbackCompaction=false,lastError:any=null;
    for(let attempt=1;attempt<=3;attempt++){
      modelAttempts=attempt;
      if(attempt===2){
        prepared=prepareDocs(docs,{maxTotal:180000,maxDoc:30000});
        preparedChars=prepared.reduce((s:number,d:any)=>s+(Number(d.chars_transmitted)||0),0);
        fallbackCompaction=true;
      }else if(attempt===3){
        prepared=prepareDocs(docs,{maxTotal:100000,maxDoc:18000});
        preparedChars=prepared.reduce((s:number,d:any)=>s+(Number(d.chars_transmitted)||0),0);
        fallbackCompaction=true;
      }
      const user=buildUser(prepared,attempt>=2);
      const payload:any={
        model,input:[{role:"system",content:[{type:"input_text",text:system}]},{role:"user",content:[{type:"input_text",text:user}]}],
        tools:attempt===1&&listingUrl?[{type:"web_search"}]:[],reasoning:{effort:"low"},max_output_tokens:attempt===1?12000:attempt===2?8000:6000,
        text:{format:{type:"json_object"},verbosity:"low"},store:false,prompt_cache_key:"revisite-analysis-v5"
      };
      try{
        const rsp=await fetchWithTimeout("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
        const raw=await rsp.text();data=null;try{data=raw?JSON.parse(raw):null}catch{}
        totalUsage=mergeUsage(totalUsage,data?.usage);
        if(!rsp.ok){
          const msg=data?.error?.message||`HTTP ${rsp.status}`;
          const e:any=new Error(msg);e.status=rsp.status;throw e;
        }
        if(data?.status==="incomplete"&&data?.incomplete_details?.reason==="max_output_tokens")throw new Error("REPORT_OUTPUT_LIMIT");
        let outText=data?.output_text;
        if(!outText&&Array.isArray(data?.output))outText=data.output.flatMap((o:any)=>o.content||[]).filter((x:any)=>x.type==="output_text").map((x:any)=>x.text).join("\n");
        if(!outText)throw new Error("Aucun rapport exploitable.");
        parsed=safeJsonFromText(outText);
        lastError=null;
        break;
      }catch(err:any){
        lastError=err;
        const msg=String(err?.message||"");
        const status=Number(err?.status)||0;
        const canRetry=attempt<3&&status!==401&&status!==403;
        if(!canRetry)break;
      }
    }
    const degradedMode=Boolean(lastError||!parsed);
    let analysis=degradedMode?basicFallbackAnalysis(docs,address):normalizeAnalysis(parsed);
    if(address)analysis.property.address=address;
    analysis=applyOfficialMarketData(analysis,dvf.candidates||[]);
    analysis.documents=analysis.documents||{};
    analysis.documents.received=docs.map((d:any)=>String(d?.name||"document"));
    analysis.documents.rejected=documentIssues;
    if(documentIssues.length){
      const notes=Array.isArray(analysis.documents.quality_notes)?analysis.documents.quality_notes:[];
      analysis.documents.quality_notes=[...notes,...documentIssues.map((x:any)=>`${x.name} — exclu de l'analyse : ${x.reason}`)].slice(0,12);
    }
    if(dvf.status!=="ok"){
      analysis.market=analysis.market||{};
      analysis.market.estimate_low=null;analysis.market.estimate_high=null;analysis.market.offer_low=null;analysis.market.offer_high=null;
      analysis.market.comparables=[];analysis.market.confidence="faible";
      analysis.market.positioning="Source DVF+ officielle momentanément indisponible : aucun positionnement prix n'est affiché.";
      analysis.market.analysis="ReVisite préfère ne produire aucune estimation plutôt que d'utiliser des comparables non vérifiés.";
    }
    const p=analysis.property||{};
    if(p.asking_price&&p.surface_m2&&!p.price_per_m2)p.price_per_m2=Math.round(Number(p.asking_price)/Number(p.surface_m2));
    const officialCount=Array.isArray(analysis?.market?.comparables)?analysis.market.comparables.filter((x:any)=>x?.type==="DVF").length:0;
    const scores=deterministicScores(analysis,docs,{officialCount});
    if(degradedMode){
      scores.property=null;scores.copro=null;scores.market=null;scores.overall=null;scores.confidence=Math.min(Number(scores.confidence)||0,35);
    }
    const result={analysis,scores,meta:{
      model,document_count:docs.length,rejected_document_count:documentIssues.length,beta:true,generated_at:new Date().toISOString(),
      input_chars:preparedChars,dvf_status:dvf.status,dvf_source:dvf.source||null,dvf_candidate_count:Array.isArray(dvf.candidates)?dvf.candidates.length:0,
      dvf_cache_hit:Boolean(dvf.cache_hit),usage:totalUsage||null,model_attempts:modelAttempts,fallback_compaction:fallbackCompaction,degraded_mode:degradedMode,score_withheld:scores.overall===null,cache_hit:false,
      document_quality:docs.map((d:any)=>({name:String(d?.name||"document"),quality:String(d?.quality||"unknown"),pages:Number(d?.pages)||null,weak_pages:Number(d?.weakPages)||0,ocr_pages:Number(d?.ocrPages)||0}))
    }};
    hardenScores(result);
    await store.setJSON(jobId,{status:"done",result,expires_at:expiresIn(1000*60*60*3)});
    if(!degradedMode&&cacheKey.startsWith("analysis-cache-")){
      try{await store.setJSON(cacheKey,{result,expires_at:expiresIn(1000*60*60*24)})}catch{}
    }
  }catch(err:any){
    console.error("ReVisite background error",err);
    const message=String(err?.message||"");
    const error_code=
      /REPORT_OUTPUT_LIMIT|Réponse IA non structurée|Aucun rapport exploitable/i.test(message)?"MODEL_OUTPUT":
      /429|rate limit|quota/i.test(message)?"PROVIDER_RATE":
      /context|too long|too large|request too large|413/i.test(message)?"INPUT_TOO_LARGE":
      /MODEL_TIMEOUT|timeout|aborted|5\d\d|server_error|temporarily unavailable/i.test(message)?"PROVIDER_TRANSIENT":
      "ENGINE";
    if(jobId)await store.setJSON(jobId,{status:"error",error_code,expires_at:expiresIn(1000*60*60)});
  }
};

export const config:Config={path:"/api/worker-background",background:true};
