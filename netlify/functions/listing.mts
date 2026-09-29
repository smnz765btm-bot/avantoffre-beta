import type { Config } from '@netlify/functions';
import {fetchListing} from '../lib/listing.mjs';
export default async (req:Request)=>{
 if(req.method!=='GET')return new Response('Method not allowed',{status:405});
 const data=await fetchListing(new URL(req.url).searchParams.get('url')||'');
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
};
export const config:Config={path:'/api/listing'};
