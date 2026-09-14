import type { Context, Config } from "@netlify/functions";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=1800"}});
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null;
const dist=(a:number,b:number,c:number,d:number)=>{const R=6371000,toRad=(x:number)=>x*Math.PI/180,dp=toRad(c-a),dl=toRad(d-b),s=Math.sin(dp/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(s))};
const clean=(v:any)=>String(v||"").trim();

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const u=new URL(req.url),lat=num(u.searchParams.get("lat")),lon=num(u.searchParams.get("lon"));
  if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)return json({error:"Coordonnées invalides."},400);
  const radius=1100;
  const q=`[out:json][timeout:14];(
    nwr(around:${radius},${lat},${lon})[amenity=pharmacy];
    nwr(around:${radius},${lat},${lon})[amenity=doctors];
    nwr(around:${radius},${lat},${lon})[amenity=school];
    nwr(around:${radius},${lat},${lon})[amenity=kindergarten];
    nwr(around:${radius},${lat},${lon})[shop=supermarket];
    nwr(around:${radius},${lat},${lon})[shop=convenience];
    nwr(around:${radius},${lat},${lon})[shop=bakery];
    nwr(around:${radius},${lat},${lon})[railway=subway_entrance];
    nwr(around:${radius},${lat},${lon})[station=subway];
    nwr(around:${radius},${lat},${lon})[railway=station][station=subway];
    nwr(around:${radius},${lat},${lon})[highway=bus_stop];
    nwr(around:${radius},${lat},${lon})[public_transport=platform][bus=yes];
    nwr(around:${radius},${lat},${lon})[railway=tram_stop];
    nwr(around:${radius},${lat},${lon})[leisure=park];
    nwr(around:${radius},${lat},${lon})[leisure=garden];
  );out center tags;`;
  try{
    const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","User-Agent":"AvantOffre/1.0"},body:"data="+encodeURIComponent(q)});
    if(!r.ok)throw new Error(`Overpass ${r.status}`);
    const d:any=await r.json(),els=Array.isArray(d?.elements)?d.elements:[];
    const seen=new Set<string>();
    const items=els.map((e:any)=>{
      const t=e.tags||{},la=num(e.lat??e.center?.lat),lo=num(e.lon??e.center?.lon);if(la===null||lo===null)return null;
      let category="",subtype="",icon="";
      if(t.amenity==="pharmacy"||t.amenity==="doctors"){category="Santé";subtype=t.amenity==="pharmacy"?"Pharmacie":"Cabinet médical";icon="health"}
      else if(t.amenity==="school"||t.amenity==="kindergarten"){category="Écoles";subtype=t.amenity==="kindergarten"?"École maternelle":"École";icon="school"}
      else if(["supermarket","convenience","bakery"].includes(t.shop)){category="Commerces";subtype=t.shop==="bakery"?"Boulangerie":t.shop==="supermarket"?"Supermarché":"Commerce de proximité";icon="shop"}
      else if(t.station==="subway"||t.railway==="subway_entrance"||(t.railway==="station"&&t.station==="subway")){category="Transports";subtype="Métro";icon="metro"}
      else if(t.highway==="bus_stop"||(t.public_transport==="platform"&&t.bus==="yes")){category="Transports";subtype="Bus";icon="bus"}
      else if(t.railway==="tram_stop"){category="Transports";subtype="Tram";icon="tram"}
      else if(t.leisure==="park"||t.leisure==="garden"){category="Espaces verts";subtype=t.leisure==="garden"?"Jardin":"Parc";icon="park"}
      if(!category)return null;
      const meters=Math.round(dist(lat,lon,la,lo));
      const name=clean(t.name)||subtype||category;
      const ref=clean(t.ref||t.local_ref||t.route_ref||t.line||t.lines);
      const network=clean(t.network||t.operator);
      const key=`${category}|${subtype}|${name.toLowerCase()}|${Math.round(meters/25)}`;if(seen.has(key))return null;seen.add(key);
      return{category,subtype,icon,name,ref,network,distance_m:meters,walk_min:Math.max(1,Math.round(meters/80)),lat:la,lon:lo};
    }).filter(Boolean).sort((a:any,b:any)=>a.distance_m-b.distance_m);
    const limits:any={"Transports":5,"Commerces":3,"Écoles":3,"Santé":2,"Espaces verts":2};
    const order=["Transports","Commerces","Écoles","Santé","Espaces verts"],nearby=order.flatMap(category=>items.filter((x:any)=>x.category===category).slice(0,limits[category]||2));
    return json({nearby,radius_m:radius,source:"OpenStreetMap"});
  }catch(err){console.error("AvantOffre nearby error",err);return json({nearby:[],radius_m:radius,source:"OpenStreetMap",unavailable:true});}
};

export const config:Config={path:"/api/nearby"};