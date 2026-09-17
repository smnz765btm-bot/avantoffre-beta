import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn } from "../lib/storage.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));

function hardenScores(result:any){
  const s=result?.scores;if(!s)return;
  const documentation=Number(s.documentation),confidence=Number(s.confidence);
  if(Number.isFinite(documentation))s.documentation=clamp(documentation);
  if(Number.isFinite(confidence))s.confidence=clamp(confidence);
  if(!Number.isFinite(documentation)||documentation<50)s.overall=null;
  else if(Number.isFinite(Number(s.overall)))s.overall=clamp(Number(s.overall));
  else s.overall=null;
  const c=Number(s.confidence);
  s.confidence_label=!Number.isFinite(c)?"faible":c>=85?"très bonne":c>=70?"bonne":c>=55?"moyenne":c>=40?"limitée":"faible";
}

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url);const jobId=String(url.searchParams.get("jobId")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
  const s=jobStore();
  try{
    const job:any=await s.get(jobId,{type:"json"});
    if(!job)return json({status:"pending"});
    if(job.status==="done"){
      hardenScores(job.result);
      const shareId=crypto.randomUUID().replace(/-/g,"").slice(0,24),expiresAt=expiresIn(1000*60*60*24*14);
      await s.setJSON(`share-${shareId}`,{result:job.result,shared_at:new Date().toISOString(),expires_at:expiresAt});
      if(job.result)job.result.meta={...(job.result.meta||{}),share_id:shareId,share_url:`/share.html?id=${shareId}`,share_expires_at:expiresAt};
      await Promise.allSettled([s.delete(`retry-${jobId}`),s.delete(`input-${jobId}`),s.delete(`input-meta-${jobId}`),s.delete(jobId)]);
      return json(job);
    }
    if(job.status==="error"){
      const message=String(job.error||"");
      const malformed=/JSON|array element|Expected ['\",}\]]|Réponse IA non structurée/i.test(message);
      const retryInput:any=malformed?await s.get(`retry-${jobId}`,{type:"json"}):null;
      if(retryInput){
        await s.delete(`retry-${jobId}`);
        await s.setJSON(`input-${jobId}`,retryInput);
        await s.setJSON(jobId,{status:"queued",started_at:new Date().toISOString(),progress:"Nouvelle tentative automatique",expires_at:expiresIn(1000*60*60*3)});
        const workerUrl=new URL("/api/worker-background",req.url);
        const workerResponse=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
        if(workerResponse.ok)return json({status:"running",progress:"Nouvelle tentative automatique"});
        await s.delete(`input-${jobId}`);
      }
      await Promise.allSettled([s.delete(`retry-${jobId}`),s.delete(jobId)]);
      const diagnostic=jobId.startsWith("smoke_")?message.slice(0,500):undefined;
      return json({status:"error",error:"L'analyse n'a pas pu être finalisée. Relancez-la : vos documents peuvent rester sélectionnés.",...(diagnostic?{diagnostic}: {})},500);
    }
    return json(job);
  }catch(err){console.error("ReVisite status error",err);return json({error:"Impossible de lire l'état de l'analyse."},500)}
};
export const config:Config={path:"/api/analyze-status"};
