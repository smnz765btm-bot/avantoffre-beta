import type { Context, Config } from "@netlify/functions";
import { jobStore, isExpired } from "../lib/storage.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60"}});

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url),id=String(url.searchParams.get("id")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!id)return json({error:"Lien de partage invalide."},400);
  const store=jobStore();
  try{
    const key=`share-${id}`,shared:any=await store.get(key,{type:"json"});
    if(!shared)return json({error:"Cette analyse partagée est introuvable ou n’est plus disponible."},404);
    if(isExpired(shared)){await store.delete(key);return json({error:"Ce lien de partage a expiré."},410)}
    return json(shared);
  }catch(err){console.error("ReVisite shared analysis error",err);return json({error:"Impossible de charger cette analyse."},500)}
};

export const config:Config={path:"/api/shared-analysis"};
