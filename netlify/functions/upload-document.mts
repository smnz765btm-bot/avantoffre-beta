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
    const quality=["ok","partial","failed"].includes(String(body?.quality))?String(body.quality):text.trim().length>=80?"ok":"failed";
    const ocrPages=Math.max(0,Number(body?.ocrPages)||0);
    const weakPages=Math.max(0,Number(body?.weakPages)||0);
    const pageStats=Array.isArray(body?.pageStats)?body.pageStats.slice(0,250):[];
    if(!jobId||!Number.isInteger(index)||index<0||index>29)return json({error:"Référence de document invalide."},400);
    if(text.length>500000)return json({error:"Document trop volumineux après extraction."},413);
    if(quality==="failed"||text.trim().length<80)return json({error:"Lecture insuffisante après seconde lecture OCR. Le document n'est pas assez exploitable pour une analyse fiable.",quality,ocrPages,weakPages,chars:text.length},422);
    const key=`doc-${jobId}-${index}`;
    await jobStore().setJSON(key,{name,text,pages,chars:text.length,quality,ocrPages,weakPages,pageStats});
    if(quality==="partial")return json({ref:key,index,name,chars:79,actualChars:text.length,quality,ocrPages,weakPages,error:`Lecture partielle après OCR : ${weakPages} page(s) restent difficiles à exploiter.`});
    return json({ref:key,index,name,chars:text.length,actualChars:text.length,quality,ocrPages,weakPages});
  }catch(err:any){
    console.error("AvantOffre upload document error",err);
    return json({error:err?.message||"Impossible d'envoyer le document."},500);
  }
};

export const config:Config={path:"/api/upload-document"};
