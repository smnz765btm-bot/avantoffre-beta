import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn } from "../lib/storage.mjs";
import { hardenScores } from "../lib/reliability-core.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url),jobId=String(url.searchParams.get("jobId")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
  const store=jobStore();
  try{
    const job:any=await store.get(jobId,{type:"json"});
    if(!job)return json({status:"pending"});
    if(job.status==="done"){
      try{hardenScores(job.result)}catch(err){console.error("ReVisite status score hardening error",err)}
      const shareId=job.result?.meta?.share_id||crypto.randomUUID().replace(/-/g,"").slice(0,24),expiresAt=job.result?.meta?.share_expires_at||expiresIn(1000*60*60*24*14);
      let shareReady=Boolean(job.result?.meta?.share_id);
      try{
        await store.setJSON(`share-${shareId}`,{result:job.result,shared_at:new Date().toISOString(),expires_at:expiresAt});
        shareReady=true;
      }catch(err){console.error("ReVisite share persistence error",err)}
      if(job.result){
        const meta={...(job.result.meta||{})};
        if(shareReady){meta.share_id=shareId;meta.share_url=`/share.html?id=${shareId}`;meta.share_expires_at=expiresAt}
        else{delete meta.share_id;delete meta.share_url;delete meta.share_expires_at}
        job.result.meta=meta;
      }
      await Promise.allSettled([store.delete(`input-${jobId}`),store.delete(`input-meta-${jobId}`)]);
      try{await store.setJSON(jobId,{...job,expires_at:job.expires_at||expiresIn(1000*60*60*3)})}
      catch(err){console.error("ReVisite status refresh persistence error",err)}
      return json(job);
    }
    if(job.status==="error"){
      const code=String(job.error_code||"ENGINE");
      const error=
        code==="MODEL_OUTPUT"?"Le rapport a été interrompu avant sa finalisation. Relancez l’analyse : les documents peuvent rester sélectionnés.":
        code==="PROVIDER_RATE"?"Le moteur d’analyse est momentanément saturé. Réessayez dans quelques minutes.":
        code==="INPUT_TOO_LARGE"?"Le dossier transmis est trop volumineux pour une seule analyse. ReVisite a déjà tenté une version compacte automatiquement.":
        code==="PROVIDER_TRANSIENT"?"Le moteur d'analyse a rencontré une indisponibilité temporaire malgré la tentative de secours automatique.":
        "L'analyse n'a pas pu être finalisée malgré la tentative de secours automatique.";
      await Promise.allSettled([store.delete(`input-${jobId}`),store.delete(`input-meta-${jobId}`)]);
      return json({status:"error",error,error_code:code},500);
    }
    return json(job);
  }catch(err){console.error("ReVisite status error",err);return json({error:"Impossible de lire l'état de l'analyse."},500)}
};
export const config:Config={path:"/api/analyze-status"};
