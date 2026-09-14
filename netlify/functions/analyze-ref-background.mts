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
    const input={listingUrl:String(meta.listingUrl||""),address:String(meta.address||""),extra:String(meta.extra||""),documents};
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
