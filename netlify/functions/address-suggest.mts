import type { Context, Config } from "@netlify/functions";

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
  const url=new URL(req.url);
  const q=String(url.searchParams.get("q")||"").trim().slice(0,180);
  if(q.length<3)return json({suggestions:[]});
  try{
    const target=new URL("https://data.geopf.fr/geocodage/completion/");
    target.searchParams.set("text",q);
    target.searchParams.set("type","StreetAddress");
    target.searchParams.set("maximumResponses","6");
    const rsp=await fetch(target,{headers:{"Accept":"application/json"}});
    if(!rsp.ok)throw new Error(`IGN ${rsp.status}`);
    const data:any=await rsp.json();
    const items=Array.isArray(data?.results)?data.results:[];
    const suggestions=items.map((x:any)=>({
      label:String(x?.fulltext||x?.label||"").trim(),
      city:String(x?.city||"").trim(),
      postcode:String(x?.zipcode||x?.postalcode||"").trim(),
      lon:Number.isFinite(Number(x?.x))?Number(x.x):null,
      lat:Number.isFinite(Number(x?.y))?Number(x.y):null
    })).filter((x:any)=>x.label).slice(0,6);
    return json({suggestions});
  }catch(err){
    console.error("AvantOffre address suggest error",err);
    return json({suggestions:[]});
  }
};

export const config:Config={path:"/api/address-suggest"};
