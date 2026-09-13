import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const store=getStore("avantoffre-jobs",{consistency:"strong"});
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url);const jobId=String(url.searchParams.get("jobId")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
  try{
    const job=await store.get(jobId,{type:"json"});
    if(!job)return json({status:"pending"});
    if(job.status==="done"){await store.delete(jobId);return json(job)}
    if(job.status==="error"){await store.delete(jobId);return json(job,500)}
    return json(job);
  }catch(err){console.error("AvantOffre status error",err);return json({error:"Impossible de lire l'état de l'analyse."},500)}
};
export const config:Config={path:"/api/analyze-status"};