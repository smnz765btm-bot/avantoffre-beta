import fs from 'node:fs';import path from 'node:path';

fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist',{recursive:true});
for(const n of fs.readdirSync('.')){if(['dist','.git','node_modules','index.html'].includes(n))continue;const s=fs.statSync(n);if(s.isFile())fs.copyFileSync(n,path.join('dist',n))}
if(fs.existsSync('netlify'))fs.cpSync('netlify','dist/netlify',{recursive:true});

let h=fs.readFileSync('index.html','utf8');
h=h.replaceAll('AvantOffre','ReVisite').replaceAll('AVANTOFFRE','REVISITE');
h=h.replace(/<title>.*?<\/title>/i,'<title>ReVisite — Au-delà de la visite.</title>');
h=h.replace(/<div class="brand">[\s\S]*?<\/div>/i,'<div class="brand"><span class="rv-wordmark"><b>[re]</b>visite</span><small class="rv-baseline">Au-delà de la visite.</small></div>');

// Economie Netlify: les statuts n'ont pas besoin d'être interrogés toutes les 4 secondes.
const pollOld="for(let i=0;i<180;i++){await sleep(4000);";
const pollNew="for(let i=0;i<75;i++){await sleep(i<3?6000:i<12?10000:15000);";
if(!h.includes(pollOld))throw new Error('ReVisite polling hook missing');
h=h.replace(pollOld,pollNew);

// Les statistiques page par page servent au contrôle local d'OCR mais ne sont pas nécessaires au backend.
const uploadOld="body:JSON.stringify({jobId,index:i,...d})";
const uploadNew="body:JSON.stringify({jobId,index:i,name:d.name,text:d.text,pages:d.pages,quality:d.quality,ocrPages:d.ocrPages,weakPages:d.weakPages})";
if(!h.includes(uploadOld))throw new Error('ReVisite upload hook missing');
h=h.replace(uploadOld,uploadNew);

h=h.replace('</head>',`<style id="rv-ui">
:root{--navy:#0b1533;--navy2:#101a3b;--teal:#1258ff;--bg:#f6f8fb;--ink:#0c1633;--muted:#6f7890;--line:#e6eaf1}*{box-sizing:border-box}body{background:#f6f8fb!important;color:#0c1633!important}.container{max-width:1280px!important}.topbar{background:#fff!important;border-bottom:1px solid #eef0f4!important}.brand{display:flex!important;align-items:baseline!important;gap:11px!important}.brand .logoMark,.brand>em{display:none!important}.rv-wordmark{font-size:30px;font-weight:900;letter-spacing:-.06em;color:#07112d}.rv-wordmark b{color:#1258ff}.rv-baseline{font-size:9px;color:#7c8497}.beta{background:#f2f3f6!important;color:#646b7b!important;border:0!important}.hero{background:#fff!important;color:#0c1633!important;padding:38px 0!important;border-bottom:1px solid #edf0f5}.hero h1{color:#0c1633!important;font-size:43px!important}.hero p{color:#68738d!important}.eyebrow{color:#1258ff!important}.heroPanel{background:#f8faff!important;border:1px solid #e7ebf4!important}.heroPanel *{color:#17213b!important}.section{padding:26px 0!important}.sectionHead h2,.reportTop h2{color:#0c1633!important}.drop{background:#fff!important;border:1.5px dashed #ccd5e7!important;border-radius:18px!important}.stepNum,.uploadIcon{background:#edf3ff!important;color:#1258ff!important}.btn,.shareBtn,.shareLinkBox button{background:#1258ff!important;border-radius:11px!important;box-shadow:0 8px 20px rgba(18,88,255,.15)!important}.reportTop{background:#fff!important;border:1px solid #e6eaf1!important;border-radius:18px!important;padding:16px 20px!important;margin-bottom:14px!important}.reportHero{background:linear-gradient(135deg,#f0fbf9,#fff)!important;border:1px solid #ccece5!important;border-radius:18px!important;padding:20px!important;box-shadow:none!important}.reportHero:before{display:none!important}.verdict{color:#0c1633!important;font-size:25px!important}.headline{font-size:12px!important;color:#66728c!important}.scoreGrid.simplifiedScores{grid-template-columns:repeat(3,1fr)!important;gap:10px!important}.scoreCard,.reportCard,.kpi{background:#fff!important;border:1px solid #e6eaf1!important;border-radius:16px!important;box-shadow:none!important}.scoreCard{padding:13px!important}.scoreCard b{color:#0c1633!important}.scoreBar i{background:#1258ff!important}.tabs{background:#eef0f5!important;border-radius:16px!important;padding:5px!important;position:sticky;top:72px;z-index:50}.tab{border-radius:11px!important;font-size:11px!important}.tab.active{background:#fff!important;color:#1258ff!important;box-shadow:0 3px 10px rgba(20,30,55,.05)!important}.reportGrid{gap:14px!important}.reportCard{padding:17px 18px!important}.reportCard h3{font-size:16px!important;color:#0c1633!important}.reportCard p,.reportCard li{color:#5f6b84!important;line-height:1.45!important}.kpi{min-height:62px!important;padding:10px!important}.kpi:after{background:#1258ff!important}.analysisConfidence{background:#eef3ff!important;border-color:#dfe7ff!important}.confidenceDot{background:#1258ff!important}.footer{color:#8a91a2!important}.assurance{background:#eef3ff!important;color:#3156a4!important;border-color:#dfe7ff!important}@media(max-width:800px){.rv-baseline{display:none}.hero h1{font-size:34px!important}.scoreGrid.simplifiedScores{grid-template-columns:1fr!important}}
</style></head>`);

for(const required of ['id="files"','id="analyze"','id="shareAnalysis"','window.print()'])if(!h.includes(required))throw new Error('Critical feature missing: '+required);
if(!h.includes('[re]'))throw new Error('ReVisite branding missing');
fs.writeFileSync('dist/index.html',h);

// Réduit les appels à l'autocomplétion et autorise la réutilisation des réponses IGN déjà reçues.
const uiPath='dist/ui-enhancements.js';
if(fs.existsSync(uiPath)){
  let ui=fs.readFileSync(uiPath,'utf8');
  ui=ui.replace("},250)});input.addEventListener('blur'","},450)});input.addEventListener('blur'");
  ui=ui.replace("{signal:controller.signal,cache:'no-store'}","{signal:controller.signal,cache:'default'}");
  fs.writeFileSync(uiPath,ui);
}

console.log('ReVisite approved-reference build ready',h.length,'— polling/uploads optimized');
