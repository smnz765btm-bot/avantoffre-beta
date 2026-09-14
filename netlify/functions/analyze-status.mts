import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function store(){return getStore("avantoffre-jobs",{consistency:"strong"})}
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url);const jobId=String(url.searchParams.get("jobId")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
  const s=store();
  try{
    const job:any=await s.get(jobId,{type:"json"});
    if(!job)return json({status:"pending"});
    if(job.status==="done"){
      const shareId=crypto.randomUUID().replace(/-/g,"").slice(0,20);
      const shared={result:job.result,shared_at:new Date().toISOString()};
      await s.setJSON(`share-${shareId}`,shared);
      if(job.result){job.result.meta={...(job.result.meta||{}),share_id:shareId,share_url:`/share.html?id=${shareId}`}}
      await s.delete(jobId);
      return json(job);
    }
    if(job.status==="error"){await s.delete(jobId);return json(job,500)}
    return json(job);
  }catch(err){console.error("AvantOffre status error",err);return json({error:"Impossible de lire l'état de l'analyse."},500)}
};
export const config:Config={path:"/api/analyze-status"};