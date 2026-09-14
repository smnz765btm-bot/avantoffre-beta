import type { Context, Config } from "@netlify/functions";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=3600"}});
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null;
const dist=(a:number,b:number,c:number,d:number)=>{const R=6371000,toRad=(x:number)=>x*Math.PI/180,dp=toRad(c-a),dl=toRad(d-b),s=Math.sin(dp/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(s))};

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const u=new URL(req.url),lat=num(u.searchParams.get("lat")),lon=num(u.searchParams.get("lon"));
  if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)return json({error:"Coordonnées invalides."},400);
  const radius=900;
  const q=`[out:json][timeout:10];(nwr(around:${radius},${lat},${lon})[amenity=pharmacy];nwr(around:${radius},${lat},${lon})[amenity=school];nwr(around:${radius},${lat},${lon})[amenity=kindergarten];nwr(around:${radius},${lat},${lon})[shop=supermarket];nwr(around:${radius},${lat},${lon})[shop=convenience];nwr(around:${radius},${lat},${lon})[shop=bakery];nwr(around:${radius},${lat},${lon})[railway=subway_entrance];nwr(around:${radius},${lat},${lon})[railway=tram_stop];nwr(around:${radius},${lat},${lon})[public_transport=station];nwr(around:${radius},${lat},${lon})[leisure=park];);out center tags;`;
  try{
    const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","User-Agent":"AvantOffre/1.0"},body:"data="+encodeURIComponent(q)});
    if(!r.ok)throw new Error(`Overpass ${r.status}`);
    const d:any=await r.json(),els=Array.isArray(d?.elements)?d.elements:[];
    const items=els.map((e:any)=>{const t=e.tags||{},la=num(e.lat??e.center?.lat),lo=num(e.lon??e.center?.lon);if(la===null||lo===null)return null;let category="";if(t.amenity==="pharmacy")category="Santé";else if(t.amenity==="school"||t.amenity==="kindergarten")category="Écoles";else if(["supermarket","convenience","bakery"].includes(t.shop))category="Commerces";else if(t.railway==="subway_entrance"||t.railway==="tram_stop"||t.public_transport==="station")category="Transports";else if(t.leisure==="park")category="Espaces verts";if(!category)return null;const meters=Math.round(dist(lat,lon,la,lo));return{category,name:String(t.name||category),distance_m:meters,walk_min:Math.max(1,Math.round(meters/80))}}).filter(Boolean).sort((a:any,b:any)=>a.distance_m-b.distance_m);
    const order=["Commerces","Écoles","Transports","Santé","Espaces verts"],nearby=order.map(category=>items.find((x:any)=>x.category===category)).filter(Boolean);
    return json({nearby,radius_m:radius,source:"OpenStreetMap"});
  }catch(err){console.error("AvantOffre nearby error",err);return json({nearby:[],radius_m:radius,source:"OpenStreetMap",unavailable:true});}
};

export const config:Config={path:"/api/nearby"};