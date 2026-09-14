import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function jobStore(){return getStore("avantoffre-jobs", { consistency: "strong" });}
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export default async(req:Request,_context:Context)=>{
  let jobId="";
  const store=jobStore();
  try{
    if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
    let body:any;try{body=await req.json()}catch{return json({error:"La demande envoyée à AvantOffre est invalide."},400)}
    jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
    const listingUrl=String(body?.listingUrl||"").trim();
    const address=String(body?.address||"").trim().slice(0,300);
    const documents=Array.isArray(body?.documents)?body.documents.slice(0,30):[];
    const documentRefs=Array.isArray(body?.documentRefs)?body.documentRefs.slice(0,30).map((x:any)=>String(x||"")):[];
    const extra=String(body?.extra||"").slice(0,7000);
    if(!listingUrl&&!address&&documents.length===0&&documentRefs.length===0)return json({error:"Ajoutez au moins une annonce, une adresse ou un document."},400);
    await store.setJSON(jobId,{status:"queued",started_at:new Date().toISOString(),progress:"Analyse en attente"});
    let workerPath="/api/worker-background";
    if(documentRefs.length){
      await store.setJSON(`input-meta-${jobId}`,{listingUrl,address,extra,documentRefs});
      workerPath="/api/worker-ref-background";
    }else{
      const input={listingUrl,address,documents,extra};
      await store.setJSON(`input-${jobId}`,input);
      await store.setJSON(`retry-${jobId}`,input);
    }
    const workerUrl=new URL(workerPath,req.url);
    const workerResponse=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
    if(!workerResponse.ok){
      await store.delete(`input-${jobId}`);await store.delete(`input-meta-${jobId}`);await store.delete(`retry-${jobId}`);
      throw new Error(`Le moteur d'analyse n'a pas pu démarrer (${workerResponse.status}).`);
    }
    return json({jobId,status:"queued"},202);
  }catch(err:any){
    console.error("AvantOffre start error",err);
    if(jobId)await store.setJSON(jobId,{status:"error",error:err?.message||"Impossible de lancer l'analyse."});
    return json({error:err?.message||"Impossible de lancer l'analyse."},500);
  }
};

export const config:Config={path:"/api/analyze-background"};
