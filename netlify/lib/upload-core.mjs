export function normalizeUploadDocument(raw){
  const index=Number(raw?.index),name=String(raw?.name||"document").slice(0,240),text=String(raw?.text||"");
  const pages=Number.isFinite(Number(raw?.pages))?Number(raw.pages):null;
  const requestedQuality=String(raw?.quality||"");
  const quality=["ok","partial","failed"].includes(requestedQuality)?requestedQuality:(text.trim().length>=80?"ok":"failed");
  const ocrPages=Math.max(0,Number(raw?.ocrPages)||0),weakPages=Math.max(0,Number(raw?.weakPages)||0);
  if(!Number.isInteger(index)||index<0||index>29)return{index,name,text:"",pages,quality:"failed",ocrPages,weakPages,accepted:false,error:"Référence de document invalide."};
  if(text.length>500000)return{index,name,text:"",pages,quality:"failed",ocrPages,weakPages,accepted:false,error:`${name} est trop volumineux après extraction.`};
  if(quality==="failed"||text.trim().length<80)return{index,name,text:"",pages,quality:"failed",ocrPages,weakPages,accepted:false,error:`${name} n'est pas assez exploitable après OCR.`};
  return{index,name,text,pages,quality,ocrPages,weakPages,accepted:true,error:null};
}

export function partitionUploadDocuments(incoming=[]){
  const normalized=(Array.isArray(incoming)?incoming:[]).map(normalizeUploadDocument);
  return{normalized,accepted:normalized.filter(d=>d.accepted),rejected:normalized.filter(d=>!d.accepted)};
}
