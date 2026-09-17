import type { Context, Config } from "@netlify/functions";
import { jobStore, expiresIn } from "../lib/storage.mjs";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const limitEnv=(key:string,fallback:number)=>{const n=Number(Netlify.env.get(key));return Number.isFinite(n)&&n>0?Math.floor(n):fallback};
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);

async function checkRateLimit(store:any,req:Request){
  const ip=(req.headers.get("x-nf-client-connection-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").trim();
  const ipHash=await hash(ip),now=new Date(),day=now.toISOString().slice(0,10),hour=now.toISOString().slice(0,13);
  const globalKey=`rate-global-${day}`,dayKey=`rate-ip-${day}-${ipHash}`,hourKey=`rate-ip-${hour}-${ipHash}`;
  const [g,d,h]=await Promise.all([store.get(globalKey,{type:"json"}),store.get(dayKey,{type:"json"}),store.get(hourKey,{type:"json"})]);
  const globalLimit=limitEnv("REVISITE_GLOBAL_DAILY_LIMIT",60),dailyLimit=limitEnv("REVISITE_IP_DAILY_LIMIT",12),hourlyLimit=limitEnv("REVISITE_IP_HOURLY_LIMIT",4);
  if((Number(g?.count)||0)>=globalLimit)return{ok:false,message:"La limite quotidienne de la bêta ReVisite est atteinte. Réessayez demain."};
  if((Number(d?.count)||0)>=dailyLimit)return{ok:false,message:"Vous avez atteint la limite d'analyses autorisées aujourd'hui pour cette bêta."};
  if((Number(h?.count)||0)>=hourlyLimit)return{ok:false,message:"Plusieurs analyses viennent d'être lancées. Réessayez dans environ une heure."};
  const expiry=expiresIn(1000*60*60*48);
  await Promise.all([
    store.setJSON(globalKey,{count:(Number(g?.count)||0)+1,expires_at:expiry}),
    store.setJSON(dayKey,{count:(Number(d?.count)||0)+1,expires_at:expiry}),
    store.setJSON(hourKey,{count:(Number(h?.count)||0)+1,expires_at:expiry})
  ]);
  return{ok:true};
}

export default async(req:Request,_context:Context)=>{
  let jobId="";const store=jobStore();
  try{
    if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
    let body:any;try{body=await req.json()}catch{return json({error:"La demande envoyée à ReVisite est invalide."},400)}
    jobId=String(body?.jobId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
    if(!jobId)return json({error:"Identifiant d'analyse manquant."},400);
    const listingUrl=String(body?.listingUrl||"").trim().slice(0,1200),address=String(body?.address||"").trim().slice(0,300);
    const documents=Array.isArray(body?.documents)?body.documents.slice(0,30):[];
    const documentRefs=Array.isArray(body?.documentRefs)?body.documentRefs.slice(0,30).map((x:any)=>String(x||"")).filter((x:string)=>x.startsWith(`doc-${jobId}-`)):[];
    const extra=String(body?.extra||"").slice(0,7000);
    if(!listingUrl&&!address&&documents.length===0&&documentRefs.length===0)return json({error:"Ajoutez au moins une annonce, une adresse ou un document."},400);

    const rate=await checkRateLimit(store,req);if(!rate.ok)return json({error:rate.message},429);
    const expiry=expiresIn(1000*60*60*3);
    await store.setJSON(jobId,{status:"queued",started_at:new Date().toISOString(),progress:"Analyse en attente",expires_at:expiry});
    let workerPath="/api/worker-background";
    if(documentRefs.length){
      await store.setJSON(`input-meta-${jobId}`,{listingUrl,address,extra,documentRefs,expires_at:expiry});
      workerPath="/api/worker-ref-background";
    }else{
      const input={listingUrl,address,documents,extra,expires_at:expiry};
      await store.setJSON(`input-${jobId}`,input);await store.setJSON(`retry-${jobId}`,input);
    }
    const workerUrl=new URL(workerPath,req.url);
    const workerResponse=await fetch(workerUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId})});
    if(!workerResponse.ok){
      await Promise.allSettled([store.delete(`input-${jobId}`),store.delete(`input-meta-${jobId}`),store.delete(`retry-${jobId}`)]);
      throw new Error(`Le moteur d'analyse n'a pas pu démarrer (${workerResponse.status}).`);
    }
    return json({jobId,status:"queued"},202);
  }catch(err:any){
    console.error("ReVisite start error",err);
    if(jobId)await store.setJSON(jobId,{status:"error",error:err?.message||"Impossible de lancer l'analyse.",expires_at:expiresIn(1000*60*60)});
    return json({error:err?.message||"Impossible de lancer l'analyse."},500);
  }
};

export const config:Config={path:"/api/analyze-background"};
