import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function jobStore(){return getStore("avantoffre-jobs",{consistency:"strong"})}
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export default async(req:Request,_context:Context)=>{
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  try{
    const body:any=await req.json();
    const jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    const index=Number(body?.index);
    const name=String(body?.name||"document").slice(0,240);
    const text=String(body?.text||"");
    const pages=Number.isFinite(Number(body?.pages))?Number(body.pages):null;
    if(!jobId||!Number.isInteger(index)||index<0||index>29)return json({error:"Référence de document invalide."},400);
    if(text.length>180000)return json({error:"Document trop volumineux après extraction."},413);
    const key=`doc-${jobId}-${index}`;
    await jobStore().setJSON(key,{name,text,pages,chars:text.length});
    return json({ref:key,index,name,chars:text.length});
  }catch(err:any){
    console.error("AvantOffre upload document error",err);
    return json({error:err?.message||"Impossible d'envoyer le document."},500);
  }
};

export const config:Config={path:"/api/upload-document"};
