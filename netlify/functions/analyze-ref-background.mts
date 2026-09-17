import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn } from "../lib/storage.mjs";

export default async(req:Request,_context:Context)=>{
  let jobId="";const store=jobStore();
  try{
    const trigger:any=await req.json();
    jobId=String(trigger?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return;
    const meta:any=await store.get(`input-meta-${jobId}`,{type:"json"});
    if(!meta)throw new Error("Les données de l'analyse sont introuvables.");
    const refs=Array.isArray(meta.documentRefs)?meta.documentRefs.slice(0,30):[],documents:any[]=[];
    for(const ref of refs){
      const key=String(ref||"");if(!key.startsWith(`doc-${jobId}-`))continue;
      const doc:any=await store.get(key,{type:"json"});if(doc)documents.push(doc);await store.delete(key);
    }
    const quality=documents.map((d:any)=>{
      const q=String(d?.quality||""),weak=Math.max(0,Number(d?.weakPages)||0),ocr=Math.max(0,Number(d?.ocrPages)||0),chars=String(d?.text||"").length;
      const label=q==="partial"?`lecture partielle après OCR (${weak} page(s) faibles)`:q==="ok"?`lecture contrôlée${ocr?` avec OCR sur ${ocr} page(s)`:""}`:"qualité non déterminée";
      return `${String(d?.name||"document")}: ${label} (${chars} caractères${d?.pages?`, ${d.pages} pages`:""})`;
    }).join("\n");
    const rigor=`\n\nCONSIGNE REVISITE — PÉRIMÈTRE DOCUMENTAIRE :\n- Les pièces réellement transmises sont listées ci-dessous avec leur qualité d'extraction.\n- Une pièce partielle réduit la confiance mais n'est pas une anomalie du bien.\n- Avant de déclarer une information absente, recherche-la dans toutes les pièces et recoupe les exercices.\n- Pour les PV d'AG : distingue voté / discuté / rejeté-reporté / PPPT.\n- Pour les charges : distingue courant / récupérable / exceptionnel / fonds travaux / solde individuel.\n- Si aucun risque majeur n'est établi, formule-le sans dramatiser.\n\nÉTAT DES EXTRACTIONS :\n${quality||"Aucun document transmis."}`;
    const expiry=expiresIn(1000*60*60*3),input={listingUrl:String(meta.listingUrl||""),address:String(meta.address||""),extra:String(meta.extra||"")+rigor,documents,expires_at:expiry};
    await store.setJSON(`input-${jobId}`,input);await store.setJSON(`retry-${jobId}`,input);await store.delete(`input-meta-${jobId}`);
    const workerUrl=new URL("/api/worker-background",req.url);
    const rsp=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
    if(!rsp.ok)throw new Error(`Le moteur d'analyse n'a pas pu démarrer (${rsp.status}).`);
  }catch(err:any){
    console.error("ReVisite reference worker error",err);
    if(jobId)await store.setJSON(jobId,{status:"error",error:err?.message||"Impossible de préparer les documents.",expires_at:expiresIn(1000*60*60)});
  }
};

export const config:Config={path:"/api/worker-ref-background",background:true};
