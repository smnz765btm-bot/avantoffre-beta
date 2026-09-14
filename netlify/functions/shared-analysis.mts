import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function store(){return getStore("avantoffre-jobs",{consistency:"strong"})}
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60"}});

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url);
  const id=String(url.searchParams.get("id")||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(!id)return json({error:"Lien de partage invalide."},400);
  try{
    const shared:any=await store().get(`share-${id}`,{type:"json"});
    if(!shared)return json({error:"Cette analyse partagée est introuvable ou n’est plus disponible."},404);
    return json(shared);
  }catch(err){console.error("AvantOffre shared analysis error",err);return json({error:"Impossible de charger cette analyse."},500)}
};

export const config:Config={path:"/api/shared-analysis"};