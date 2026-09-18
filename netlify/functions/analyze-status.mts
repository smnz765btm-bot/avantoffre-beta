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
  const url=new URL(req.url),jobId=String(url.searchParams.get("jobId")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
  const store=jobStore();
  try{
    const job:any=await store.get(jobId,{type:"json"});
    if(!job)return json({status:"pending"});
    if(job.status==="done"){
      hardenScores(job.result);
      const shareId=crypto.randomUUID().replace(/-/g,"").slice(0,24),expiresAt=expiresIn(1000*60*60*24*14);
      await store.setJSON(`share-${shareId}`,{result:job.result,shared_at:new Date().toISOString(),expires_at:expiresAt});
      if(job.result)job.result.meta={...(job.result.meta||{}),share_id:shareId,share_url:`/share.html?id=${shareId}`,share_expires_at:expiresAt};
      await Promise.allSettled([store.delete(`input-${jobId}`),store.delete(`input-meta-${jobId}`),store.delete(jobId)]);
      return json(job);
    }
    if(job.status==="error"){
      const code=String(job.error_code||"ENGINE");
      const error=
        code==="MODEL_OUTPUT"?"Le rapport a été interrompu avant sa finalisation. Relancez l’analyse : les documents peuvent rester sélectionnés.":
        code==="PROVIDER_RATE"?"Le moteur d’analyse est momentanément saturé. Réessayez dans quelques minutes.":
        code==="INPUT_TOO_LARGE"?"Le dossier transmis est trop volumineux pour une seule analyse. Retirez les pièces en double puis relancez.":
        "L'analyse n'a pas pu être finalisée. Relancez-la : vos documents peuvent rester sélectionnés.";
      await Promise.allSettled([store.delete(`input-${jobId}`),store.delete(`input-meta-${jobId}`),store.delete(jobId)]);
      return json({status:"error",error,error_code:code},500);
    }
    return json(job);
  }catch(err){console.error("ReVisite status error",err);return json({error:"Impossible de lire l'état de l'analyse."},500)}
};
export const config:Config={path:"/api/analyze-status"};
