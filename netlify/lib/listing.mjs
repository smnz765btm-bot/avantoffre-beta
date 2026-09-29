// Fixed public provider endpoint: no arbitrary URL fetch or redirect (SSRF).
export function bieniciId(value){
 try{const u=new URL(value);return u.protocol==='https:'&&['bienici.com','www.bienici.com'].includes(u.hostname)&&!u.port&&/^\/annonce\/vente\//.test(u.pathname)&&/^[a-zA-Z0-9_-]+$/.test(u.pathname.split('/').pop())?u.pathname.split('/').pop():null}catch{return null}
}
export function parseBienici(data,id,url){
 const price=Number(data?.price);
 if(data?.id!==id||data?.adType!=='buy'||!Number.isFinite(price)||price<=0||data?.onTheMarket===false)return null;
 const description=String(data.description||'').replace(/<[^>]*>/g,' ').slice(0,12000);
 const garageExtra=/garage[^.!?]{0,150}(?:en sus|supplément)/i.test(description);
 return {asking_price:price,source:url,provider:'Bien’ici',retrieved_at:new Date().toISOString(),garage_extra:garageExtra,description};
}
export async function fetchListing(url,fetcher=fetch){
 const id=bieniciId(url);if(!id)return {status:'unsupported'};
 try{const response=await fetcher('https://www.bienici.com/realEstateAd.json?id='+encodeURIComponent(id),{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
 if(!response.ok)return {status:'unavailable'};
 const data=parseBienici(await response.json(),id,url);return data?{status:'ok',...data}:{status:'unavailable'};
 }catch{return {status:'unavailable'}}
}
export function applyListing(analysis,listing){
 if(listing?.status!=='ok')return analysis;
 analysis.property=analysis.property||{};const p=analysis.property;
 p.asking_price=listing.asking_price;p.price_source=listing.source;p.garage_extra=listing.garage_extra;
 p.price_scope=listing.garage_extra?'Appartement seul ; garage proposé en supplément.':'Périmètre du prix à vérifier dans l’annonce.';
 if(p.surface_m2>0)p.price_per_m2=Math.round(p.asking_price/p.surface_m2);
 analysis.evidence=Array.isArray(analysis.evidence)?analysis.evidence:[];
 analysis.evidence.push({status:'FACT',claim:'Prix affiché : '+p.asking_price+' €. '+p.price_scope,source:listing.source});
 return analysis;
}
