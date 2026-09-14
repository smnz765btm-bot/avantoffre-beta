import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function store(){return getStore("avantoffre-jobs",{consistency:"strong"})}
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));

function normalizeScores(result:any){
  const s=result?.scores;
  if(!s)return;
  const property=Number(s.property),copro=Number(s.copro),market=Number(s.market),documentation=Number(s.documentation);
  if(Number.isFinite(property)&&Number.isFinite(copro)&&Number.isFinite(market)){
    s.overall=clamp(property*.35+copro*.35+market*.30);
  }
  if(Number.isFinite(documentation)){
    s.confidence=documentation>=85?90:documentation>=70?80:documentation>=55?68:documentation>=40?55:40;
    s.confidence_label=documentation>=85?"très bonne":documentation>=70?"bonne":documentation>=55?"moyenne":documentation>=40?"limitée":"faible";
  }
}

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url);const jobId=String(url.searchParams.get("jobId")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
  const s=store();
  try{
    const job:any=await s.get(jobId,{type:"json"});
    if(!job)return json({status:"pending"});
    if(job.status==="done"){
      normalizeScores(job.result);
      const shareId=crypto.randomUUID().replace(/-/g,"").slice(0,20);
      const shared={result:job.result,shared_at:new Date().toISOString()};
      await s.setJSON(`share-${shareId}`,shared);
      if(job.result){job.result.meta={...(job.result.meta||{}),share_id:shareId,share_url:`/share.html?id=${shareId}`}}
      await s.delete(`retry-${jobId}`);
      await s.delete(jobId);
      return json(job);
    }
    if(job.status==="error"){
      const message=String(job.error||"");
      const malformed=/JSON|array element|Expected ['\",}\]]|Réponse IA non structurée/i.test(message);
      const retryInput:any=malformed?await s.get(`retry-${jobId}`,{type:"json"}):null;
      if(retryInput){
        await s.delete(`retry-${jobId}`);
        await s.setJSON(`input-${jobId}`,retryInput);
        await s.setJSON(jobId,{status:"queued",started_at:new Date().toISOString(),progress:"Nouvelle tentative automatique"});
        const workerUrl=new URL("/api/worker-background",req.url);
        const workerResponse=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
        if(workerResponse.ok)return json({status:"running",progress:"Nouvelle tentative automatique"});
        await s.delete(`input-${jobId}`);
        await s.setJSON(jobId,{status:"error",error:"Le moteur n'a pas pu relancer l'analyse."});
        return json({status:"error",error:"Le moteur n'a pas pu relancer l'analyse."},500);
      }
      await s.delete(`retry-${jobId}`);
      await s.delete(jobId);
      return json({status:"error",error:"L'analyse n'a pas pu être finalisée. Relancez-la : vos documents peuvent rester sélectionnés."},500);
    }
    return json(job);
  }catch(err){console.error("AvantOffre status error",err);return json({error:"Impossible de lire l'état de l'analyse."},500)}
};
export const config:Config={path:"/api/analyze-status"};