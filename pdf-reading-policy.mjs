// Every low-text page is eligible, regardless of the document's filename.
export function readingPlan(name,pages){
 const diagnostic=/diag|(?:^|[_\s.-])(?:ddt|dpe)(?:[_\s.-]|$)/i.test(name)||pages.some(p=>/diagnostic\s+de\s+performance|dossier\s+de\s+diagnostics?/i.test(p.native||''));
 const targets=new Set(pages.filter(p=>p.chars<(diagnostic?160:90)).map(p=>p.page));
 if(diagnostic)for(const p of pages){if(/Rapport\s+DPE|diagnostic\s+de\s+performance\s+[ée]nerg[ée]tique|performance\s+[ée]nerg[ée]tique\s+et\s+climatique/i.test(p.native||'')){targets.add(p.page);if(p.page<pages.length)targets.add(p.page+1)}}
 return{diagnostic,targets:[...targets].sort((a,b)=>a-b)};
}
