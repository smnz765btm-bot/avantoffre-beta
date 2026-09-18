import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn, isExpired } from "../lib/storage.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const limitEnv=(key:string,fallback:number)=>{const n=Number(Netlify.env.get(key));return Number.isFinite(n)&&n>0?Math.floor(n):fallback};
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);
const CACHE_VERSION="revisite-analysis-v7";

function hasUsableOpenAIKey(){
  const direct=String(Netlify.env.get("OPENAI_API_KEY")||"").trim();
  if(direct.startsWith("sk-"))return true;
  const split=["REVISITE_OPENAI_A","REVISITE_OPENAI_B","REVISITE_OPENAI_C1","REVISITE_OPENAI_C2"].map(k=>String(Netlify.env.get(k)||"")).join("").trim();
  return split.startsWith("sk-");
}

async function checkRateLimit(store:any,req:Request,cacheKey:string){
  const ip=(req.headers.get("x-nf-client-connection-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").trim();
  const ipHash=await hash(ip),now=new Date(),day=now.toISOString().slice(0,10),hour=now.toISOString().slice(0,13);
  const globalKey=`rate-global-${day}`,dayKey=`rate-ip-${day}-${ipHash}`,hourKey=`rate-ip-${hour}-${ipHash}`;
  const fingerprint=String(cacheKey||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(-32);
  const seenKey=fingerprint?`rate-seen-${day}-${ipHash}-${fingerprint}`:"";
  const [g,d,h,seen]=await Promise.all([
    store.get(globalKey,{type:"json"}),store.get(dayKey,{type:"json"}),store.get(hourKey,{type:"json"}),
    seenKey?store.get(seenKey,{type:"json"}):Promise.resolve(null)
  ]);
  // Une relance du même dossier dans la même journée ne consomme pas un nouveau quota.
  // Cela évite qu'un échec technique bloque l'utilisateur pendant ses tests.
  if(seen&&!isExpired(seen))return{ok:true,retry:true};
  const globalLimit=limitEnv("REVISITE_GLOBAL_DAILY_LIMIT",60),dailyLimit=limitEnv("REVISITE_IP_DAILY_LIMIT",12),hourlyLimit=limitEnv("REVISITE_IP_HOURLY_LIMIT",4);
  if((Number(g?.count)||0)>=globalLimit)return{ok:false,message:"La limite quotidienne de la bêta ReVisite est atteinte. Réessayez demain."};
  if((Number(d?.count)||0)>=dailyLimit)return{ok:false,message:"Vous avez atteint la limite d'analyses autorisées aujourd'hui pour cette bêta."};
  if((Number(h?.count)||0)>=hourlyLimit)return{ok:false,message:"Plusieurs analyses différentes viennent d'être lancées. Réessayez un peu plus tard."};
  const expiry=expiresIn(1000*60*60*48);
  const writes=[
    store.setJSON(globalKey,{count:(Number(g?.count)||0)+1,expires_at:expiry}),
    store.setJSON(dayKey,{count:(Number(d?.count)||0)+1,expires_at:expiry}),
    store.setJSON(hourKey,{count:(Number(h?.count)||0)+1,expires_at:expiry})
  ];
  if(seenKey)writes.push(store.setJSON(seenKey,{cache_key:cacheKey,expires_at:expiry}));
  await Promise.all(writes);
  return{ok:true,retry:false};
}

async function resolveDocuments(store:any,jobId:string,inlineDocs:any[],refs:string[]){
  if(!refs.length)return inlineDocs;
  const loaded=await Promise.all(refs.map(ref=>store.get(ref,{type:"json"})));
  const documents=loaded.filter(Boolean);
  if(documents.length!==refs.length)throw new Error("Un ou plusieurs documents temporaires ne sont plus disponibles. Réimportez-les puis relancez l'analyse.");
  return documents;
}

async function analysisCacheKey(listingUrl:string,address:string,extra:string,documents:any[]){
  const fingerprints:string[]=[];
  for(const d of documents){
    const existing=String(d?.contentHash||"").trim();
    fingerprints.push(existing||await hash(`${String(d?.name||"")}\n${String(d?.text||"")}`));
  }
  return `analysis-cache-${await hash(JSON.stringify({v:CACHE_VERSION,listingUrl,address,extra,documents:fingerprints}))}`;
}

export default async(req:Request,_context:Context)=>{
  let jobId="";const store=jobStore();let documentRefs:string[]=[];
  try{
    if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
    let body:any;try{body=await req.json()}catch{return json({error:"La demande envoyée à ReVisite est invalide."},400)}
    jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
    const listingUrl=String(body?.listingUrl||"").trim().slice(0,1200),address=String(body?.address||"").trim().slice(0,300);
    const inlineDocuments=Array.isArray(body?.documents)?body.documents.slice(0,30):[];
    documentRefs=Array.isArray(body?.documentRefs)?body.documentRefs.slice(0,30).map((x:any)=>String(x||"")).filter((x:string)=>x.startsWith(`doc-${jobId}-`)):[];
    const extra=String(body?.extra||"").slice(0,7000);
    if(!listingUrl&&!address&&inlineDocuments.length===0&&documentRefs.length===0)return json({error:"Ajoutez au moins une annonce, une adresse ou un document."},400);
    if(!hasUsableOpenAIKey()){
      if(documentRefs.length)await Promise.allSettled(documentRefs.map(ref=>store.delete(ref)));
      return json({error:"Le moteur ReVisite n'est pas correctement configuré : la clé API OpenAI doit être remplacée."},503);
    }

    const documents=await resolveDocuments(store,jobId,inlineDocuments,documentRefs);
    const cacheKey=await analysisCacheKey(listingUrl,address,extra,documents);
    const cached:any=await store.get(cacheKey,{type:"json"});
    if(cached?.result&&!isExpired(cached)){
      const result=structuredClone(cached.result);
      result.meta={...(result.meta||{}),cache_hit:true,cache_reused_at:new Date().toISOString()};
      await store.setJSON(jobId,{status:"done",result,expires_at:expiresIn(1000*60*60)});
      await Promise.allSettled(documentRefs.map(ref=>store.delete(ref)));
      return json({jobId,status:"done",cache_hit:true},202);
    }

    const rate=await checkRateLimit(store,req,cacheKey);if(!rate.ok){await Promise.allSettled(documentRefs.map(ref=>store.delete(ref)));return json({error:rate.message},429)}
    const expiry=expiresIn(1000*60*60*3),input={listingUrl,address,documents,extra,cacheKey,expires_at:expiry};
    await store.setJSON(jobId,{status:"queued",started_at:new Date().toISOString(),progress:"Analyse en attente",expires_at:expiry});
    await store.setJSON(`input-${jobId}`,input);
    await Promise.allSettled(documentRefs.map(ref=>store.delete(ref)));

    const workerUrl=new URL("/api/worker-background",req.url);
    const workerResponse=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
    if(!workerResponse.ok){
      await store.delete(`input-${jobId}`);
      throw new Error(`Le moteur d'analyse n'a pas pu démarrer (${workerResponse.status}).`);
    }
    return json({jobId,status:"queued"},202);
  }catch(err:any){
    console.error("ReVisite start error",err);
    if(documentRefs.length)await Promise.allSettled(documentRefs.map(ref=>store.delete(ref)));
    if(jobId)await store.setJSON(jobId,{status:"error",error:err?.message||"Impossible de lancer l'analyse.",expires_at:expiresIn(1000*60*60)});
    return json({error:err?.message||"Impossible de lancer l'analyse."},500);
  }
};

export const config:Config={path:"/api/analyze-background"};
