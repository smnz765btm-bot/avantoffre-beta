import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn } from "../lib/storage.mjs";
import { partitionUploadDocuments } from "../lib/upload-core.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);

function hasUsableOpenAIKey(){
  const direct=String(Netlify.env.get("OPENAI_API_KEY")||"").trim();
  if(direct.startsWith("sk-"))return true;
  const split=["REVISITE_OPENAI_A","REVISITE_OPENAI_B","REVISITE_OPENAI_C1","REVISITE_OPENAI_C2"].map(k=>String(Netlify.env.get(k)||"")).join("").trim();
  return split.startsWith("sk-");
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
    const {normalized,accepted:docs}=partitionUploadDocuments(incoming);
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
        ocrPages:d.ocrPages,weakPages:d.weakPages,documentKind:d.documentKind||"text",extractedChars:d.extractedChars||0,contentHash:saved?.contentHash||null
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
