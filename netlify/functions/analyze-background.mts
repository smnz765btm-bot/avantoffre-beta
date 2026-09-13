import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

type Doc={name:string;text:string;pages?:number;chars?:number};
function jobStore(){return getStore("avantoffre-jobs",{consistency:"strong"})}
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null;

function deterministicScores(a:any,docs:Doc[]){
 const r=a?.risk_flags||{};
 let property=82;
 if(r.electrical_anomalies)property-=5;if(r.major_property_defect)property-=12;if(r.no_elevator_high_floor)property-=6;if(r.poor_dpe)property-=8;if(r.sold_occupied)property-=2;if(r.no_parking_when_expected)property-=3;if(r.strong_property_assets)property+=4;property=clamp(property);
 let finance=40;const ar=num(a?.copro_metrics?.collective_arrears_ratio_pct),sr=num(a?.copro_metrics?.supplier_debt_ratio_pct),fr=num(a?.copro_metrics?.works_fund_ratio_pct);
 if(ar!==null)finance-=ar>25?18:ar>15?12:ar>8?6:0;else finance-=5;if(sr!==null)finance-=sr>15?7:sr>8?4:0;if(fr!==null)finance+=fr>15?3:fr<3?-4:0;finance=clamp(finance,0,40);
 let works=25;if(r.voted_major_works)works-=10;if(r.pppt_significant_medium_term)works-=6;if(r.recurring_major_technical_issue)works-=5;if(r.recent_major_works_completed)works+=2;works=clamp(works,0,25);
 let governance=20;if(r.litigation)governance-=5;if(r.governance_issue)governance-=6;if(r.asl_active)governance-=2;governance=clamp(governance,0,20);
 let technical=15;if(r.poor_maintenance)technical-=6;if(r.recurring_major_technical_issue)technical-=4;if(r.recent_major_works_completed)technical+=2;technical=clamp(technical,0,15);
 const copro=Math.round(finance+works+governance+technical);
 const names=docs.map(d=>d.name.toLowerCase()).join(" ");
 const present={ag:/(?:pv|ag|assembl)/.test(names),synth:/fiche.*synth|synth[eé]tique/.test(names),charges:/charge|decompte|appel|ped|pré.?etat|pre.?etat/.test(names),accounts:/budget|compte|annexe/.test(names),dpe:/dpe|diag|dia-/.test(names),pppt:/pppt|ppt/.test(names),entretien:/entretien/.test(names),reglement:/reglement|règlement|edd/.test(names),collective:/collectif|dtg/.test(names)};
 let documentation=0;if(present.ag)documentation+=25;if(present.synth)documentation+=15;if(present.charges)documentation+=10;if(present.accounts)documentation+=10;if(present.pppt)documentation+=15;if(present.dpe)documentation+=10;if(present.entretien)documentation+=5;if(present.reglement)documentation+=5;if(present.collective)documentation+=5;documentation=clamp(documentation);
 let market=70;const ask=num(a?.property?.asking_price),lo=num(a?.market?.estimate_low),hi=num(a?.market?.estimate_high);if(ask&&lo&&hi){if(ask<=hi&&ask>=lo)market=84;else if(ask<lo)market=90;else{const over=(ask-hi)/hi*100;market=clamp(Math.round(84-over*3),35,84)}}else market=60;
 const confidence=documentation>=85?90:documentation>=70?80:documentation>=55?68:documentation>=40?55:40;
 const overall=documentation>=60?Math.round(property*.30+copro*.40+market*.30):null;
 return{property,copro,market,documentation,confidence,overall,axes:{finance,works,governance,technical}};
}

function safeJsonFromText(text:string){const cleaned=text.trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();try{return JSON.parse(cleaned)}catch{}const s=cleaned.indexOf("{"),e=cleaned.lastIndexOf("}");if(s>=0&&e>s)return JSON.parse(cleaned.slice(s,e+1));throw new Error("Réponse IA non structurée")}
function prepareDocs(docs:Doc[]){const MAX_TOTAL=520000,MAX_DOC=70000;let left=MAX_TOTAL;const out:any[]=[];for(const d of docs){const raw=String(d.text||"");if(left<=0){out.push({name:String(d.name||"document"),text:"[CONTENU NON TRANSMIS: LIMITE TECHNIQUE ATTEINTE]",pages:d.pages||null});continue}const text=raw.slice(0,Math.min(MAX_DOC,left));left-=text.length;out.push({name:String(d.name||"document"),text,pages:d.pages||null})}return out}

export default async(req:Request,_context:Context)=>{let jobId="";const store=jobStore();try{
 const body:any=await req.json();jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);if(!jobId)return;
 await store.setJSON(jobId,{status:"running",started_at:new Date().toISOString(),progress:"Analyse documentaire et marché en cours"});
 const apiKey=Netlify.env.get("OPENAI_API_KEY"),model=Netlify.env.get("OPENAI_MODEL")||"gpt-5.6-luna";if(!apiKey)throw new Error("La clé OpenAI n'est pas configurée sur AvantOffre.");
 const listingUrl=String(body?.listingUrl||"").trim(),docs:Doc[]=Array.isArray(body?.documents)?body.documents.slice(0,30):[],extra=String(body?.extra||"").slice(0,7000);if(!listingUrl&&docs.length===0)throw new Error("Ajoutez au moins une annonce ou un document.");const prepared=prepareDocs(docs);
 const system=`Tu es le moteur d'analyse AvantOffre, service français d'aide à la décision AVANT une offre immobilière. Produis une synthèse exhaustive mais lisible, orientée décision d'achat, à partir de l'annonce, des documents et du marché. Le niveau d'analyse doit être celui d'un professionnel expérimenté de la transaction immobilière et de la lecture de copropriété.

RÈGLES DE FIABILITÉ :
- Distingue strictement FACT / INFERENCE / UNKNOWN.
- Une donnée absente n'est jamais zéro et ne signifie jamais absence de risque.
- Un solde vendeur/lot n'est jamais un impayé collectif de copropriété.
- Un devis, une discussion, un scénario PPPT/PPT ou un projet n'est jamais un travail voté.
- Un montant ASL/SDC global n'est jamais une dette personnelle du lot.
- Chaque affirmation importante doit citer le fichier/page quand repérable.
- Si insuffisant : écris clairement \"non déterminable avec les documents transmis\".
- N'invente jamais une vente, un prix, un montant ou une décision d'AG.

ANALYSE PRIX : si URL fournie, utilise le web. Priorité comparables : même résidence > même rue > rues adjacentes > 300 m > 500 m. Cherche typologie/surface comparables, étage/ascenseur, extérieur, parking, époque, DPE/état. Distingue ventes DVF et prix affichés. Donne une fourchette de valeur, positionnement du prix affiché et zone d'offre cohérente avec niveau de confiance.

COPROPRIÉTÉ : couvre finances, travaux, gouvernance/vie de copropriété, technique/énergie. Sépare travaux votés / discutés / rejetés / reportés / recommandés PPPT. Signale sujets récurrents sur plusieurs AG. Analyse budget, impayés collectifs, dettes fournisseurs, trésorerie si connue, fonds travaux, charges du lot, travaux votés restant à charge, procédures/litiges, syndic, approbation des comptes, sinistres/infiltrations/ascenseur/toiture/façade/chauffage/réseaux.

BIEN : couvre configuration, état apparent/documenté, DPE/diagnostics, anomalies électriques/gaz/amiante/termites/ERP quand disponibles, nuisances, étage/ascenseur, exposition, extérieur, parking, occupation, rentabilité si loué.

AVIS : conclus sans ambiguïté par un avis avant offre : ACHAT RASSURANT / ACHAT À NÉGOCIER / ACHAT À CADRER / VIGILANCE FORTE / À ÉVITER, avec raisons, conditions avant engagement et stratégie de négociation.

Retourne UNIQUEMENT un JSON valide, sans markdown, avec ce schéma exact :
{"property":{"title":"","address":"","asking_price":null,"surface_m2":null,"price_per_m2":null,"rooms":null,"floor":"","dpe":"","occupied":null,"rent_excl_charges":null,"charges_provision":null,"assets":[],"weaknesses":[],"diagnostics":[],"property_analysis":""},"market":{"estimate_low":null,"estimate_high":null,"offer_low":null,"offer_high":null,"confidence":"faible|moyenne|bonne","positioning":"","comparables":[{"label":"","date":"","price":null,"surface":null,"price_m2":null,"type":"DVF|annonce|estimation","distance_note":""}],"analysis":""},"copro_metrics":{"annual_budget":null,"collective_arrears":null,"collective_arrears_ratio_pct":null,"supplier_debt":null,"supplier_debt_ratio_pct":null,"cash":null,"works_fund":null,"works_fund_ratio_pct":null,"lot_annual_charges":null,"recoverable_charges":null},"copro":{"financial_analysis":"","governance_analysis":"","technical_analysis":"","recurring_topics":[],"litigation":[],"strengths":[],"weaknesses":[]},"works":{"voted":[],"discussed":[],"rejected_or_postponed":[],"recommended_pppt":[],"recent_completed":[],"asl":[],"analysis":""},"documents":{"received":[],"missing_or_to_obtain":[],"quality_notes":[],"analysis":""},"risk_flags":{"electrical_anomalies":false,"major_property_defect":false,"no_elevator_high_floor":false,"poor_dpe":false,"sold_occupied":false,"no_parking_when_expected":false,"strong_property_assets":false,"voted_major_works":false,"pppt_significant_medium_term":false,"recurring_major_technical_issue":false,"recent_major_works_completed":false,"poor_maintenance":false,"litigation":false,"governance_issue":false,"asl_active":false},"executive_summary":{"headline":"","overview":"","top_strengths":[],"top_risks":[],"financial_exposure":"","what_changes_the_decision":[]},"negotiation":{"recommended_strategy":"","arguments":[],"conditions_before_offer":[],"offer_comment":""},"evidence":[{"claim":"","status":"FACT|INFERENCE|UNKNOWN","source":"nom fichier / page si repérable, ou web","detail":""}],"questions_before_offer":[],"verdict":{"label":"","summary":"","vigilance":"faible|modérée|forte","why":"","go_if":[],"stop_if":[]}}`;
 const user=`URL ANNONCE:\n${listingUrl||"non fournie"}\n\nINFORMATIONS COMPLÉMENTAIRES:\n${extra||"aucune"}\n\nDOCUMENTS EXTRAITS:\n${prepared.map((d,i)=>`\n--- DOCUMENT ${i+1}: ${d.name} ---\n${d.text}`).join("\n")}`;
 const payload:any={model,input:[{role:"system",content:[{type:"input_text",text:system}]},{role:"user",content:[{type:"input_text",text:user}]}],tools:listingUrl?[{type:"web_search"}]:[],reasoning:{effort:"medium"},max_output_tokens:16000};
 const rsp=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});const raw=await rsp.text();let data:any=null;try{data=raw?JSON.parse(raw):null}catch{}if(!rsp.ok)throw new Error(data?.error?.message||`Le moteur d'analyse a renvoyé une erreur (${rsp.status}).`);
 let outText=data?.output_text;if(!outText&&Array.isArray(data?.output))outText=data.output.flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("\n");if(!outText)throw new Error("Le moteur d'analyse n'a pas produit de rapport exploitable.");
 const analysis=safeJsonFromText(outText),scores=deterministicScores(analysis,docs),p=analysis?.property||{};if(p.asking_price&&p.surface_m2&&!p.price_per_m2)p.price_per_m2=Math.round(p.asking_price/p.surface_m2);analysis.market=analysis.market||{};if(p.rent_excl_charges&&p.asking_price)analysis.market.gross_yield_pct=Math.round((p.rent_excl_charges*12/p.asking_price)*10000)/100;
 await store.setJSON(jobId,{status:"done",result:{analysis,scores,meta:{model,document_count:docs.length,beta:true,generated_at:new Date().toISOString(),input_chars:prepared.reduce((s,d)=>s+d.text.length,0)}}});
 }catch(err:any){console.error("AvantOffre background error",err);if(jobId)await store.setJSON(jobId,{status:"error",error:err?.message||"Erreur interne pendant l'analyse."});}};
export const config:Config={path:"/api/analyze-background"};