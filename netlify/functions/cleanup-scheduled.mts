import type { Config } from "@netlify/functions";
import { jobStore, isExpired } from "../lib/storage.mjs";

export default async()=>{
  const store=jobStore();
  try{
    const listed:any=await store.list();
    const blobs=Array.isArray(listed?.blobs)?listed.blobs:[];
    let removed=0;
    for(const item of blobs){
      const key=String(item?.key||"");
      if(!/^(?:input-|input-meta-|retry-|doc-|share-|rate-|upload-|usage-|ao_)/.test(key))continue;
      try{const value:any=await store.get(key,{type:"json"});if(value&&isExpired(value)){await store.delete(key);removed++}}catch{}
    }
    console.log(`ReVisite cleanup: ${removed} expired blob(s) removed`);
  }catch(err){console.error("ReVisite cleanup error",err)}
};

export const config:Config={schedule:"17 3 * * *"};
