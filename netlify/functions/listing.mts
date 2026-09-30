import type { Config } from '@netlify/functions';
import {resolveListing} from '../lib/listing-resolver.mjs';
export default async (req:Request)=>{
 if(req.method!=='GET')return new Response('Method not allowed',{status:405});
 const data=await resolveListing(new URL(req.url).searchParams.get('url')||'');
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
};
export const config:Config={path:'/api/listing'};
