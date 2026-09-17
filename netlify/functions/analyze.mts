import type { Config } from "@netlify/functions";

export default async(req:Request)=>{
  if(req.method!=="POST")return new Response(JSON.stringify({error:"Méthode non autorisée."}),{status:405,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  return new Response(JSON.stringify({error:"Cet ancien point d'analyse est désactivé. Utilisez le parcours ReVisite actuel."}),{status:410,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
};

export const config:Config={path:"/api/analyze"};
