import type {Config} from '@netlify/functions';
import {readSharedReport,shareStore,isExpired,expiresIn} from '../lib/storage.mjs';
import {resolveListing} from '../lib/listing-resolver.mjs';
import {applyListing} from '../lib/listing.mjs';
import {hardenScores,marketStrategy} from '../lib/reliability-core.mjs';
export default async(req:Request)=>{
 const json=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return json({error:'Méthode non autorisée'},405);
 try{
  const body=await req.json(),id=String(body.id||'');if(!/^[a-f0-9]{24}$/.test(id))return json({error:'Lien invalide'},400);
  const original:any=await readSharedReport(id);if(!original||isExpired(original))return json({error:'Rapport indisponible ou expiré'},404);
  const listing=await resolveListing(String(body.listingUrl||original.result.meta?.listing_url||''));
  if(listing.status!=='ok')return json({error:'Le prix n’a pas pu être confirmé sur cette annonce. Aucun rapport n’a été modifié.'},422);
  const result=structuredClone(original.result),p=result.analysis.property;
  if((listing.surface_m2&&p.surface_m2&&Math.abs(listing.surface_m2-p.surface_m2)>Math.max(2,p.surface_m2*.05))||(listing.rooms&&p.rooms&&listing.rooms!==p.rooms))return json({error:'Cette annonce ne correspond pas à la surface ou au nombre de pièces du rapport.'},422);
  result.analysis=applyListing(result.analysis,listing);
  const a=result.analysis,missingPrice=(x:any)=>/prix (?:demandé|affiché|d’achat|d'achat).{0,40}(?:manqu|absent|non (?:transmis|disponible|fourni|établi))|(?:obtenir|quel est).{0,20}prix demandé|prix demandé et (?:fiche|caractéristiques)/i.test(typeof x==='string'?x:'');
  for(const [o,k] of [[a.property,'weaknesses'],[a.documents,'missing_or_to_obtain'],[a,'questions_before_offer'],[a.buyer_blocks?.before_offer_checks,'checks']])if(o&&Array.isArray(o[k]))o[k]=o[k].filter((x:any)=>!missingPrice(x));
  a.negotiation.recommended_strategy=marketStrategy(a.market.estimate_low,a.market.estimate_high,a.property.asking_price);
  a.market.positioning=a.negotiation.recommended_strategy;
  a.verdict.summary='Prix de l’annonce actualisé. Les autres constats proviennent de l’analyse documentaire initiale.';
  result.scores.revision=0;hardenScores(result);
  const shareId=crypto.randomUUID().replace(/-/g,'').slice(0,24),expiry=expiresIn(14*86400000);
  result.meta={...result.meta,listing_url:listing.source,listing_status:'ok',listing_source:listing.source,price_refreshed_at:new Date().toISOString(),documents_reanalyzed:false,original_share_id:id,share_id:shareId,share_url:'/share.html?id='+shareId,share_expires_at:expiry};
  await shareStore().setJSON('share-'+shareId,{result,shared_at:new Date().toISOString(),expires_at:expiry});
  return json({share_url:result.meta.share_url,result});
 }catch{return json({error:'Impossible d’actualiser le prix pour le moment.'},500)}
};
export const config:Config={path:'/api/refresh-report'};
