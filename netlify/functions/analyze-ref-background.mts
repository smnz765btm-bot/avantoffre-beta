import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function jobStore(){return getStore("avantoffre-jobs",{consistency:"strong"})}

export default async(req:Request,_context:Context)=>{
  let jobId="";
  const store=jobStore();
  try{
    const trigger:any=await req.json();
    jobId=String(trigger?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return;
    const meta:any=await store.get(`input-meta-${jobId}`,{type:"json"});
    if(!meta)throw new Error("Les données de l'analyse sont introuvables.");
    const refs=Array.isArray(meta.documentRefs)?meta.documentRefs.slice(0,30):[];
    const documents:any[]=[];
    for(const ref of refs){
      const key=String(ref||"");
      if(!key.startsWith(`doc-${jobId}-`))continue;
      const doc:any=await store.get(key,{type:"json"});
      if(doc)documents.push(doc);
      await store.delete(key);
    }

    const quality=documents.map((d:any)=>{
      const text=String(d?.text||"").trim();
      const weak=/EXTRACTION TEXTE FAIBLE|EXTRACTION IMPOSSIBLE/i.test(text);
      return `${String(d?.name||"document")}: ${weak?"extraction faible à confirmer":text.length>=500?"contenu texte exploitable":"contenu court mais exploitable si les informations sont présentes"} (${text.length} caractères extraits${d?.pages?`, ${d.pages} pages`:""})`;
    }).join("\n");

    const rigor=`\n\nCONSIGNE AVANTOFFRE — LECTURE DOCUMENTAIRE RIGOUREUSE ET PROPORTIONNÉE :\n- Considère comme LISIBLE tout document dont le texte transmis contient des informations exploitables. Ne dis jamais qu'un document, un PV d'AG, un décompte ou un diagnostic est « non lisible », « inexploitable » ou « non exploitable » si son contenu texte permet d'en extraire des faits.\n- Avant de déclarer une information absente, recherche-la dans TOUS les documents transmis et recoupe les années entre elles. Un élément trouvé dans un PV, une annexe, un décompte ou un PPPT doit être exploité et sourcé.\n- Distingue strictement : (1) information trouvée et confirmée, (2) information partielle, (3) information réellement absente des pièces transmises. Ne transforme jamais (2) ou (3) en anomalie du bien.\n- Une pièce manquante réduit seulement la FIABILITÉ de l'analyse ; elle ne constitue pas en elle-même un point négatif du bien et ne doit pas dégrader artificiellement le verdict.\n- Pour les PV d'AG, extrais prioritairement : travaux votés avec montant/date, travaux rejetés ou reportés, appels de fonds, sinistres, procédures, impayés, changement de syndic, contrats importants, sujets techniques récurrents. Ignore les résolutions administratives ordinaires sans impact acheteur.\n- Pour les charges, distingue charges courantes, eau/chauffage, charges récupérables, travaux exceptionnels et appels de fonds. Ne compare pas deux montants de périmètres différents comme s'ils étaient contradictoires.\n- Pour les incohérences, ne signale que celles qui sont certaines et matériellement utiles. Si deux chiffres peuvent correspondre à des périmètres ou exercices différents, explique d'abord cette hypothèse au lieu de conclure à une incohérence.\n- TON : reste factuel, rassurant et orienté décision. Commence par ce qui est établi et favorable. Ne remonte en vigilance que les éléments susceptibles de modifier réellement le prix, le budget, la sécurité, la jouissance ou la décision d'achat.\n- Si aucun risque majeur n'est établi, dis explicitement : « Aucun élément majeur identifié dans les pièces analysées ne remet en cause l'achat à ce stade. »\n\nÉTAT TECHNIQUE DES EXTRACTIONS (ceci décrit l'extraction, pas la qualité visuelle originale des PDF) :\n${quality||"Aucun document transmis."}`;

    const input={listingUrl:String(meta.listingUrl||""),address:String(meta.address||""),extra:String(meta.extra||"")+rigor,documents};
    await store.setJSON(`input-${jobId}`,input);
    await store.setJSON(`retry-${jobId}`,input);
    await store.delete(`input-meta-${jobId}`);
    const workerUrl=new URL("/api/worker-background",req.url);
    const rsp=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
    if(!rsp.ok)throw new Error(`Le moteur d'analyse n'a pas pu démarrer (${rsp.status}).`);
  }catch(err:any){
    console.error("AvantOffre reference worker error",err);
    if(jobId)await store.setJSON(jobId,{status:"error",error:err?.message||"Impossible de préparer les documents."});
  }
};

export const config:Config={path:"/api/worker-ref-background",background:true};
