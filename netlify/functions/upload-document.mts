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
  const limit=Math.max(10,Number(Netlify.env.get("REVISITE_UPLOAD_DAILY_LIMIT"))||40),count=Number(prev?.count)||0;
  if(count>=limit)return false;
  await store.setJSON(key,{count:count+1,expires_at:expiresIn(1000*60*60*48)});
  return true;
}

function normalizeDocument(raw:any){
  const index=Number(raw?.index),name=String(raw?.name||"document").slice(0,240),text=String(raw?.text||"");
  const pages=Number.isFinite(Number(raw?.pages))?Number(raw.pages):null;
  const quality=["ok","partial","failed"].includes(String(raw?.quality))?String(raw.quality):text.trim().length>=80?"ok":"failed";
  const ocrPages=Math.max(0,Number(raw?.ocrPages)||0),weakPages=Math.max(0,Number(raw?.weakPages)||0);
  if(!Number.isInteger(index)||index<0||index>29)throw new Error("Référence de document invalide.");
  if(text.length>500000)throw new Error(`${name} est trop volumineux après extraction.`);
  if(quality==="failed"||text.trim().length<80)throw new Error(`${name} n'est pas assez exploitable après OCR.`);
  return{index,name,text,pages,quality,ocrPages,weakPages};
}

export default async(req:Request,_context:Context)=>{
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  if(!hasUsableOpenAIKey())return json({error:"Le moteur ReVisite n'est pas correctement configuré."},503);
  const store=jobStore();
  try{
    if(!await allowUpload(store,req))return json({error:"Limite d'envoi atteinte pour aujourd'hui sur cette bêta."},429);
    const body:any=await req.json();
    const jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return json({error:"Référence d'analyse invalide."},400);

    const incoming=Array.isArray(body?.documents)?body.documents:[body];
    if(!incoming.length||incoming.length>12)return json({error:"Lot de documents invalide."},400);
    const docs=incoming.map(normalizeDocument);
    const totalChars=docs.reduce((s:number,d:any)=>s+d.text.length,0);
    if(totalChars>900000)return json({error:"Lot de documents trop volumineux. ReVisite le renverra en plusieurs lots."},413);

    const prepared=[];
    for(const d of docs){
      const contentHash=await hash(`${d.name}\n${d.text}`);
      prepared.push({...d,contentHash,created_at:new Date().toISOString()});
    }
    const batchIndex=Math.max(0,Number(body?.batchIndex)||0);
    const key=`docbatch-${jobId}-${batchIndex}`;
    await store.setJSON(key,{documents:prepared,expires_at:expiresIn(1000*60*60*3)});

    return json({
      ref:key,
      count:prepared.length,
      documents:prepared.map(d=>({
        index:d.index,name:d.name,chars:d.text.length,actualChars:d.text.length,quality:d.quality,
        ocrPages:d.ocrPages,weakPages:d.weakPages,contentHash:d.contentHash
      }))
    });
  }catch(err:any){
    console.error("ReVisite upload document error",err);
    return json({error:err?.message||"Impossible d'envoyer les documents."},500);
  }
};

export const config:Config={path:"/api/upload-document"};
