import type { Context, Config } from "@netlify/functions";

export default async(req:Request,_context:Context)=>{
  if(req.method!=="GET")return new Response("Method not allowed",{status:405});
  const direct=String(Netlify.env.get("OPENAI_API_KEY")||"").trim();
  const parts=["REVISITE_OPENAI_A","REVISITE_OPENAI_B","REVISITE_OPENAI_C1","REVISITE_OPENAI_C2"].map(k=>String(Netlify.env.get(k)||""));
  const split=parts.join("").trim();
  const body={
    direct_present:Boolean(direct),direct_openai_format:direct.startsWith("sk-"),
    split_parts_present:parts.map(Boolean),split_complete:parts.every(Boolean),split_openai_format:split.startsWith("sk-")
  };
  return new Response(JSON.stringify(body),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
};

export const config:Config={path:"/api/env-check"};
