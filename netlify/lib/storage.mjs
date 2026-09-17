import { getStore, getDeployStore } from "@netlify/blobs";

export function jobStore(){
  const deployContext=typeof Netlify!=="undefined"?Netlify.context?.deploy?.context:undefined;
  if(deployContext==="production")return getStore("avantoffre-jobs",{consistency:"strong"});
  return getDeployStore("avantoffre-jobs");
}

export const nowIso=()=>new Date().toISOString();
export const expiresIn=ms=>new Date(Date.now()+ms).toISOString();
export const isExpired=value=>{
  const t=Date.parse(String(value?.expires_at||""));
  return Number.isFinite(t)&&t<=Date.now();
};
