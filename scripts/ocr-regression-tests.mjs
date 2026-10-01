import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('async function extractFile(f){'),html.indexOf('async function uploadDocs(jobId)'));
async function run(native,{name='PV0846_15.05.2025.pdf',fail=false,code=source}={}){
 const calls=[];
 const context=vm.createContext({AO_MIN_NATIVE_PAGE_CHARS:90,AO_MIN_USABLE_PAGE_CHARS:35,status(){},console:{error(){}},aoCleanLen:s=>String(s).replace(/\s/g,'').length,
 pdfjsLib:{getDocument:()=>({promise:Promise.resolve({numPages:native.length,async getPage(n){assert.ok(Number.isInteger(n)&&n>0&&n<=native.length,'PDF page must be a valid number');return {getTextContent:async()=>({items:[{str:native[n-1]}]})}}})})},
 aoOcrPage:async(page,name,n)=>{calls.push(n);if(fail)throw Error('OCR unavailable');return `Résolution numéro ${n}. Le budget annuel de la copropriété est adopté pour un montant de 24000 euros. Les copropriétaires approuvent les comptes et le contrat de maintenance.`}});
 vm.runInContext(code,context);
 const result=await context.extractFile({name,arrayBuffer:async()=>new ArrayBuffer(0)});
 return {result,calls};
}
const scan=await run(['','']);
assert.equal(scan.result.quality,'ok');assert.equal(scan.result.ocrPages,2);assert.deepEqual(scan.calls,[1,2]);
assert.match(scan.result.text,/\[PAGE 2 \| OCR\]/);assert.doesNotMatch(scan.result.text,/object Object/);
const old=await run(['',''],{code:source.replace('pages.push({page:p,','pages.push({page,')});
assert.equal(old.result.quality,'failed','Fixture must reproduce the original defect');
const nativeText='Les copropriétaires approuvent les comptes annuels et le budget prévisionnel de la résidence pour le prochain exercice. '.repeat(2);
assert.deepEqual((await run([nativeText,nativeText])).calls,[]);
const dpe=await run(['Rapport DPE : 1/14 '+nativeText,nativeText],{name:'diagnostic.pdf'});
assert.deepEqual(dpe.calls,[1,2],'DPE targets use actual PDF page numbers');
assert.equal((await run(['',''],{fail:true})).result.quality,'failed','An OCR failure must never be marked readable');
console.log('OCR regression tests: OK (scan recovery, old defect, native PDF, DPE, engine failure)');
