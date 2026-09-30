// Fixed public provider endpoint: no arbitrary URL fetch or redirect (SSRF).
export function bieniciId(value){
 try{const u=new URL(value);return u.protocol==='https:'&&['bienici.com','www.bienici.com'].includes(u.hostname)&&!u.port&&/^\/annonce\/vente\//.test(u.pathname)&&/^[a-zA-Z0-9_-]+$/.test(u.pathname.replace(/\/$/,'').split('/').pop())?u.pathname.replace(/\/$/,'').split('/').pop():null}catch{return null}
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

const providers=new Set(['bienici.com','www.bienici.com','seloger.com','www.seloger.com','logic-immo.com','www.logic-immo.com','leboncoin.fr','www.leboncoin.fr','adl-immo.com','www.adl-immo.com','adl-immo.fr','www.adl-immo.fr']);
export function listingUrlSafe(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||!providers.has(u.hostname)||u.port||u.username||u.password||/location|\/rent\//i.test(u.pathname))return null;u.hash='';u.search='';u.pathname=u.pathname.replace(/\/$/,'');return u.href}catch{return null}}
export function parseListingHtml(html,url){
 if(!listingUrlSafe(url))return null;
 const prices=[];const add=v=>{const n=Number(String(v??'').replace(/[\s\u202f]/g,'').replace(',','.'));if(n>1000&&n<100000000)prices.push(n)};
 for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const attrs=Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(x=>[x[1].toLowerCase(),x[2]]));if(['product:price:amount','og:price:amount'].includes(attrs.property))add(attrs.content)}
 for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const data=JSON.parse(m[1]);const roots=Array.isArray(data)?data:[data];for(const root of roots.flatMap(x=>x['@graph']||[x])){if(/ItemList|BreadcrumbList/i.test(String(root['@type'])))continue;const offer=root.offers||root.mainEntity?.offers;if(offer&&!Array.isArray(offer)&&(!offer.priceCurrency||offer.priceCurrency==='EUR'))add(offer.price)}}catch{}}
 const unique=[...new Set(prices)];return unique.length===1?{status:'ok',asking_price:unique[0],source:url,provider:new URL(url).hostname,retrieved_at:new Date().toISOString(),method:'structured_page'}:null;
}

export function listingSources(output=[]){return output.flatMap(x=>[
 ...(x.type==='web_search_call'&&x.status==='completed'?[x.action?.url,...(x.action?.sources||[]).map(s=>s.url)]:[]),
 ...(x.content||[]).flatMap(c=>(c.annotations||[]).filter(a=>a.type==='url_citation').map(a=>a.url))
]).filter(Boolean).map(listingUrlSafe).filter(Boolean)}
