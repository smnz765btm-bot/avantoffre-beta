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

function normalizeDocument(raw:any){
  const index=Number(raw?.index),name=String(raw?.name||"document").slice(0,240),text=String(raw?.text||"");
  const pages=Number.isFinite(Number(raw?.pages))?Number(raw.pages):null;
  const requestedQuality=String(raw?.quality||"");
  const quality=["ok","partial","failed"].includes(requestedQuality)?requestedQuality:(text.trim().length>=80?"ok":"failed");
  const ocrPages=Math.max(0,Number(raw?.ocrPages)||0),weakPages=Math.max(0,Number(raw?.weakPages)||0);
  if(!Number.isInteger(index)||index<0||index>29)return{index,name,text:"",pages,quality:"failed",ocrPages,weakPages,accepted:false,error:"Référence de document invalide."};
  if(text.length>500000)return{index,name,text:"",pages,quality:"failed",ocrPages,weakPages,accepted:false,error:`${name} est trop volumineux après extraction.`};
  if(quality==="failed"||text.trim().length<80)return{index,name,text:"",pages,quality:"failed",ocrPages,weakPages,accepted:false,error:`${name} n'est pas assez exploitable après OCR.`};
  return{index,name,text,pages,quality,ocrPages,weakPages,accepted:true,error:null};
}

export default async(req:Request,_context:Context)=>{
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  if(!hasUsableOpenAIKey())return json({error:"Le moteur ReVisite n'est pas correctement configuré."},503);
  const store=jobStore();
  try{
    const body:any=await req.json();
    const jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return json({error:"Référence d'analyse invalide."},400);

    const incoming=Array.isArray(body?.documents)?body.documents:[body];
    if(!incoming.length||incoming.length>12)return json({error:"Lot de documents invalide."},400);
    const normalized=incoming.map(normalizeDocument);
    const docs=normalized.filter((d:any)=>d.accepted);
    const totalChars=docs.reduce((s:number,d:any)=>s+d.text.length,0);
    if(totalChars>900000)return json({error:"Lot de documents trop volumineux. ReVisite le renverra en plusieurs lots."},413);

    const prepared=[];
    for(const d of docs){
      const contentHash=await hash(`${d.name}\n${d.text}`);
      prepared.push({...d,contentHash,created_at:new Date().toISOString()});
    }
    const batchIndex=Math.max(0,Number(body?.batchIndex)||0);
    const key=`docbatch-${jobId}-${batchIndex}`;
    if(prepared.length)await store.setJSON(key,{documents:prepared,expires_at:expiresIn(1000*60*60*3)});

    const responseDocs=normalized.map((d:any)=>{
      const saved=prepared.find((p:any)=>p.index===d.index);
      return{
        index:d.index,name:d.name,chars:saved?.text?.length||0,actualChars:saved?.text?.length||0,
        quality:saved?.quality||"failed",accepted:Boolean(saved),error:d.error||null,
        ocrPages:d.ocrPages,weakPages:d.weakPages,contentHash:saved?.contentHash||null
      };
    });
    return json({
      ref:prepared.length?key:null,
      count:prepared.length,
      rejected:normalized.length-prepared.length,
      documents:responseDocs
    });
  }catch(err:any){
    console.error("ReVisite upload document error",err);
    return json({error:err?.message||"Impossible d'envoyer les documents."},500);
  }
};

export const config:Config={path:"/api/upload-document"};
