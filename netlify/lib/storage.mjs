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

// Share links outlive preview deployments; job inputs remain deploy-scoped.
export function shareStore(){return getStore('avantoffre-shares',{consistency:'strong'})}
export async function readSharedReport(id){
 const key='share-'+id,stable=shareStore();let shared=await stable.get(key,{type:'json'});
 if(shared)return shared;
 const current=await jobStore().get(key,{type:'json'});
 if(current){if(!isExpired(current))await stable.setJSON(key,current);return current}
 // Migrate existing preview links from the deployment that created them.
 for(const deployID of ['6abba9c5f430e6000869b8da']){
  try{shared=await getDeployStore('avantoffre-jobs',{deployID}).get(key,{type:'json'});if(shared){if(!isExpired(shared))await stable.setJSON(key,shared);return shared}}catch{}
 }
 return null;
}
