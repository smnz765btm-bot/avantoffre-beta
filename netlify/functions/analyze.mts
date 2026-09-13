import type { Context, Config } from "@netlify/functions";

type Doc = { name: string; text: string; pages?: number; chars?: number };

const clamp = (n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const num = (v:any)=> Number.isFinite(Number(v)) ? Number(v) : null;

function deterministicScores(a:any, docs:Doc[]){
  const r = a?.risk_flags || {};
  let property = 82;
  if (r.electrical_anomalies) property -= 5;
  if (r.major_property_defect) property -= 12;
  if (r.no_elevator_high_floor) property -= 6;
  if (r.poor_dpe) property -= 8;
  if (r.sold_occupied) property -= 2;
  if (r.no_parking_when_expected) property -= 3;
  if (r.strong_property_assets) property += 4;
  property = clamp(property);

  let finance = 25;
  const ar = num(a?.copro_metrics?.collective_arrears_ratio_pct);
  const sr = num(a?.copro_metrics?.supplier_debt_ratio_pct);
  const fr = num(a?.copro_metrics?.works_fund_ratio_pct);
  if (ar !== null) finance -= ar > 25 ? 12 : ar > 15 ? 8 : ar > 8 ? 4 : 0;
  else finance -= 3;
  if (sr !== null) finance -= sr > 15 ? 5 : sr > 8 ? 3 : 0;
  if (fr !== null) finance += fr > 15 ? 2 : fr < 3 ? -2 : 0;
  finance = Math.max(0,Math.min(25,finance));

  let works = 25;
  if (r.voted_major_works) works -= 9;
  if (r.pppt_significant_medium_term) works -= 5;
  if (r.recurring_major_technical_issue) works -= 5;
  if (r.recent_major_works_completed) works += 2;
  works = Math.max(0,Math.min(25,works));

  let maintenance = 20;
  if (r.poor_maintenance) maintenance -= 8;
  if (r.recurring_major_technical_issue) maintenance -= 4;
  if (r.recent_major_works_completed) maintenance += 2;
  maintenance = Math.max(0,Math.min(20,maintenance));

  let governance = 20;
  if (r.litigation) governance -= 4;
  if (r.governance_issue) governance -= 5;
  if (r.asl_active) governance -= 2;
  governance = Math.max(0,Math.min(20,governance));

  const coproRaw = finance + works + maintenance + governance;
  const copro = Math.round(coproRaw / 90 * 100);

  const names = docs.map(d=>d.name.toLowerCase()).join(" ");
  const present = {
    ag: /(?:pv|ag|assembl)/.test(names),
    charges: /charge|decompte|appel|ped|pré.?etat|pre.?etat/.test(names),
    dpe: /dpe|diag|dia-/.test(names),
    pppt: /pppt|ppt/.test(names),
    entretien: /entretien/.test(names),
    reglement: /reglement|règlement|edd/.test(names)
  };
  let docScore = 0;
  if (present.ag) docScore += 30;
  if (present.charges) docScore += 20;
  if (present.dpe) docScore += 15;
  if (present.pppt) docScore += 15;
  if (present.entretien) docScore += 10;
  if (present.reglement) docScore += 10;
  docScore = clamp(docScore);

  return { property, copro, documentation: docScore, axes:{finance,works,maintenance,governance} };
}

function safeJsonFromText(text:string){
  const cleaned = text.trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if(start>=0 && end>start) return JSON.parse(cleaned.slice(start,end+1));
  throw new Error("Réponse IA non structurée");
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({error:"Méthode non autorisée"},{status:405});
  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  const model = Netlify.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
  if (!apiKey) return Response.json({error:"La clé OPENAI_API_KEY n'est pas configurée sur Netlify."},{status:503});

  const body = await req.json().catch(()=>null) as any;
  const listingUrl = String(body?.listingUrl || "").trim();
  const docs:Doc[] = Array.isArray(body?.documents) ? body.documents.slice(0,30) : [];
  const extra = String(body?.extra || "").slice(0,5000);
  if (!listingUrl && docs.length===0) return Response.json({error:"Ajoutez au moins une annonce ou un document."},{status:400});

  const prepared = docs.map(d=>({
    name:String(d.name||"document"),
    text:String(d.text||"").slice(0,70000),
    pages:d.pages||null
  }));

  const system = `Tu es le moteur d'analyse AvantOffre, service français d'aide à la décision AVANT une offre immobilière.
Tu analyses le bien, son prix/micro-secteur et la copropriété. Tu dois être rigoureux : distingue FACT / INFERENCE / UNKNOWN. Une donnée absente n'est jamais zéro. Un solde vendeur n'est jamais un impayé collectif. Un devis, une discussion ou un scénario PPPT n'est pas un travail voté. Un montant ASL/SDC global n'est pas une dette personnelle du lot. Cite les noms de fichiers dans les sources.
Si une URL d'annonce est fournie, utilise la recherche web pour retrouver l'annonce et, si possible, des références de prix du micro-secteur (priorité même résidence, même rue, 300m, puis 500m). Distingue prix de vente DVF et prix affichés.
Retourne UNIQUEMENT un objet JSON valide, sans markdown. N'invente jamais une valeur manquante.
Schéma attendu:
{
 "property":{"title":"","address":"","asking_price":null,"surface_m2":null,"price_per_m2":null,"rooms":null,"floor":"","dpe":"","occupied":null,"rent_excl_charges":null,"charges_provision":null,"assets":[],"weaknesses":[]},
 "market":{"estimate_low":null,"estimate_high":null,"confidence":"faible|moyenne|bonne","positioning":"","comparables":[{"label":"","date":"","price":null,"surface":null,"price_m2":null,"type":"DVF|annonce|estimation","distance_note":""}],"analysis":""},
 "copro_metrics":{"annual_budget":null,"collective_arrears":null,"collective_arrears_ratio_pct":null,"supplier_debt":null,"supplier_debt_ratio_pct":null,"works_fund":null,"works_fund_ratio_pct":null,"lot_annual_charges":null,"recoverable_charges":null},
 "works":{"voted":[],"recommended_pppt":[],"recent_completed":[],"asl":[]},
 "risk_flags":{"electrical_anomalies":false,"major_property_defect":false,"no_elevator_high_floor":false,"poor_dpe":false,"sold_occupied":false,"no_parking_when_expected":false,"strong_property_assets":false,"voted_major_works":false,"pppt_significant_medium_term":false,"recurring_major_technical_issue":false,"recent_major_works_completed":false,"poor_maintenance":false,"litigation":false,"governance_issue":false,"asl_active":false},
 "evidence":[{"claim":"","status":"FACT|INFERENCE|UNKNOWN","source":"nom fichier / page si repérable, ou web","detail":""}],
 "questions_before_offer":[],
 "verdict":{"label":"","summary":"","vigilance":"faible|modérée|forte"}
}`;

  const user = `URL ANNONCE:\n${listingUrl || "non fournie"}\n\nINFORMATIONS COMPLÉMENTAIRES:\n${extra || "aucune"}\n\nDOCUMENTS EXTRAITS:\n${prepared.map((d,i)=>`\n--- DOCUMENT ${i+1}: ${d.name} ---\n${d.text}`).join("\n")}`;

  const payload:any = {
    model,
    input:[
      {role:"system",content:[{type:"input_text",text:system}]},
      {role:"user",content:[{type:"input_text",text:user}]}
    ],
    tools: listingUrl ? [{type:"web_search"}] : [],
    reasoning:{effort:"medium"},
    max_output_tokens:12000
  };

  const rsp = await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data:any = await rsp.json();
  if(!rsp.ok) return Response.json({error:data?.error?.message || "Erreur OpenAI"},{status:502});

  let outText = data.output_text;
  if(!outText && Array.isArray(data.output)){
    outText = data.output.flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("\n");
  }
  if(!outText) return Response.json({error:"Réponse IA vide"},{status:502});
  const analysis = safeJsonFromText(outText);
  const scores = deterministicScores(analysis, docs);

  const p = analysis?.property || {};
  if (p.asking_price && p.surface_m2 && !p.price_per_m2) p.price_per_m2 = Math.round(p.asking_price / p.surface_m2);
  if (p.rent_excl_charges && p.asking_price) analysis.market.gross_yield_pct = Math.round((p.rent_excl_charges*12/p.asking_price)*10000)/100;
  return Response.json({analysis,scores,meta:{model,document_count:docs.length,beta:true,generated_at:new Date().toISOString()}});
};

export const config: Config = { path: "/api/analyze" };