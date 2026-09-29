// Keep every extracted character in a model pass. Never silently sample a long file.
export function splitDocument(text,size=60000){const parts=[];for(let i=0;i<text.length;i+=size)parts.push(text.slice(i,i+size));return parts}
export async function prepareCompleteDocuments(docs,summarize){
 const total=docs.reduce((n,d)=>n+String(d.text||'').length,0),limit=360000;
 const budget=Math.min(180000,Math.floor(limit/Math.max(1,docs.length)));
 const prepared=[],coverage=[];
 for(const d of docs){
  const raw=String(d.text||'');const needsPass=raw.length>180000||(total>limit&&raw.length>budget);
  if(!needsPass){prepared.push({...d,chars_source:raw.length,chars_transmitted:raw.length,truncated:false});coverage.push({name:d.name,mode:'full_text',source_chars:raw.length,processed_chars:raw.length,passes:1});continue}
  const chunks=splitDocument(raw),notes=[];
  for(let i=0;i<chunks.length;i++){
   const note=await summarize({name:d.name,text:chunks[i],part:i+1,total:chunks.length});
   if(typeof note!=='string'||!note.trim())throw Error('DOCUMENT_PASS_FAILED');
   notes.push('[PARTIE '+(i+1)+'/'+chunks.length+' — '+d.name+']\n'+note);
  }
  const text='[LECTURE INTÉGRALE EN '+chunks.length+' PARTIES — synthèses de toutes les parties, pas un échantillon]\n'+notes.join('\n');
  prepared.push({...d,text,chars_source:raw.length,chars_transmitted:text.length,truncated:false,summarized:true});
  coverage.push({name:d.name,mode:'all_parts_summarized',source_chars:raw.length,processed_chars:raw.length,passes:chunks.length});
 }
 if(prepared.reduce((n,d)=>n+d.text.length,0)>limit)throw Error('DOCUMENT_SUMMARIES_TOO_LARGE');
 return{prepared,coverage};
}
