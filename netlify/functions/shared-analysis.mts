import type { Context, Config } from "@netlify/functions";
import { jobStore, isExpired } from "../lib/storage.mjs";
import { normalizeAnalysis, applyDeterministicGuardrails, applyVerdictGuardrails } from "../lib/reliability-core.mjs";

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
    if(shared?.result?.analysis){
      shared.result.analysis=normalizeAnalysis(shared.result.analysis);
      if(shared.result.analysis?.__shape_repaired){
        delete shared.result.analysis.__shape_repaired;
        shared.result.meta={...(shared.result.meta||{}),shape_repaired_on_read:true};
      }
      const received=Array.isArray(shared.result.analysis?.documents?.received)?shared.result.analysis.documents.received:[];
      const rejected=Array.isArray(shared.result.analysis?.documents?.rejected)?shared.result.analysis.documents.rejected:[];
      const docs=received.map((name:any)=>({name:String(name||"document"),text:""}));
      const documentIssues=rejected.map((x:any)=>typeof x==="string"?{name:x,reason:"Document non exploitable"}:{name:String(x?.name||"document"),reason:String(x?.reason||"Document non exploitable")});
      shared.result.analysis=applyDeterministicGuardrails(shared.result.analysis,{docs,documentIssues});
      shared.result.analysis=applyVerdictGuardrails(shared.result.analysis,shared.result.scores||{},documentIssues);
    }
    return json(shared);
  }catch(err){console.error("ReVisite shared analysis error",err);return json({error:"Impossible de charger cette analyse."},500)}
};

export const config:Config={path:"/api/shared-analysis"};
