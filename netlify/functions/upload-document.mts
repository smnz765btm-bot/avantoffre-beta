import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn } from "../lib/storage.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);

function hasUsableOpenAIKey(){
  const direct=String(Netlify.env.get("OPENAI_API_KEY")||"").trim();
  if(direct.startsWith("sk-"))return true;
  const split=["REVISITE_OPENAI_A","REVISITE_OPENAI_B","REVISITE_OPENAI_C1","REVISITE_OPENAI_C2"].map(k=>String(Netlify.env.get(k)||"")).join("").trim();
  return split.startsWith("sk-");
}

async function allowUpload(store:any,req:Request){
  const ip=(req.headers.get("x-nf-client-connection-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").trim();
  const day=new Date().toISOString().slice(0,10),key=`upload-ip-${day}-${await hash(ip)}`,prev:any=await store.get(key,{type:"json"});
  const limit=Math.max(30,Number(Netlify.env.get("REVISITE_UPLOAD_DAILY_LIMIT"))||120),count=Number(prev?.count)||0;
  if(count>=limit)return false;
  await store.setJSON(key,{count:count+1,expires_at:expiresIn(1000*60*60*48)});return true;
}

export default async(req:Request,_context:Context)=>{
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  if(!hasUsableOpenAIKey())return json({error:"Le moteur ReVisite n'est pas correctement configuré : la clé API OpenAI doit être remplacée."},503);
  const store=jobStore();
  try{
    if(!await allowUpload(store,req))return json({error:"Limite d'envoi atteinte pour aujourd'hui sur cette bêta."},429);
    const body:any=await req.json();
    const jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    const index=Number(body?.index),name=String(body?.name||"document").slice(0,240),text=String(body?.text||"");
    const pages=Number.isFinite(Number(body?.pages))?Number(body.pages):null;
    const quality=["ok","partial","failed"].includes(String(body?.quality))?String(body.quality):text.trim().length>=80?"ok":"failed";
    const ocrPages=Math.max(0,Number(body?.ocrPages)||0),weakPages=Math.max(0,Number(body?.weakPages)||0);
    if(!jobId||!Number.isInteger(index)||index<0||index>29)return json({error:"Référence de document invalide."},400);
    if(text.length>500000)return json({error:"Document trop volumineux après extraction."},413);
    if(quality==="failed"||text.trim().length<80)return json({error:"Lecture insuffisante après seconde lecture OCR. Le document n'est pas assez exploitable pour une analyse fiable.",quality,ocrPages,weakPages,chars:text.length},422);
    const contentHash=await hash(`${name}\n${text}`),key=`doc-${jobId}-${index}`;
    await store.setJSON(key,{name,text,pages,chars:text.length,quality,ocrPages,weakPages,contentHash,created_at:new Date().toISOString(),expires_at:expiresIn(1000*60*60*3)});
    if(quality==="partial")return json({ref:key,index,name,chars:79,actualChars:text.length,quality,ocrPages,weakPages,contentHash,error:`Lecture partielle après OCR : ${weakPages} page(s) restent difficiles à exploiter.`});
    return json({ref:key,index,name,chars:text.length,actualChars:text.length,quality,ocrPages,weakPages,contentHash});
  }catch(err:any){
    console.error("ReVisite upload document error",err);
    return json({error:err?.message||"Impossible d'envoyer le document."},500);
  }
};

export const config:Config={path:"/api/upload-document"};
