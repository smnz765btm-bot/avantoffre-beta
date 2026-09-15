import fs from 'node:fs';
import path from 'node:path';

fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
for(const name of fs.readdirSync('.')){
  if(['dist','.git','node_modules','index.html'].includes(name)) continue;
  const stat=fs.statSync(name);
  if(stat.isFile()) fs.copyFileSync(name,path.join('dist',name));
}
if(fs.existsSync('netlify')) fs.cpSync('netlify',path.join('dist','netlify'),{recursive:true});

let html=fs.readFileSync('index.html','utf8');
html=html.replaceAll('AvantOffre','ReVisite');
html=html.replace('ReVisite — Analyse avant offre','ReVisite — Au-delà de la visite.');
html=html.replace('<span>ReVisite</span>','<span class="rv-wordmark"><b>[re]</b>visite</span>');
html=html.replace('</head>',`<style id="revisite-brand">
:root{--navy:#111318;--navy2:#191c22;--teal:#2f36ff;--ao-accent:#2f36ff;--ao-accent-dark:#252bd8;--ao-accent-soft:#eef0ff;--bg:#f7f7f8;--ink:#17191e;--muted:#70747d;--line:#e7e7ea;--green:#176b54;--greenbg:#edf8f4}
body{background:#f7f7f8;color:#17191e}.brand{color:#111318!important}.brand .logoMark{display:none!important}.rv-wordmark{font-size:28px;font-weight:850;letter-spacing:-.055em;color:#111318}.rv-wordmark b{color:#2f36ff;font-weight:900}.brand em{color:#2f36ff!important}.beta{background:#f1f1f3!important;color:#5f626b!important;border-color:#e5e5e8!important}.hero{background:radial-gradient(circle at 78% 18%,rgba(47,54,255,.22),transparent 30%),linear-gradient(138deg,#111318 0%,#191c22 58%,#222630 100%)!important}.eyebrow{color:#9da2ff!important}.heroPanel{background:rgba(255,255,255,.06)!important}.stepNum,.uploadIcon{background:#eef0ff!important;color:#2f36ff!important}.input:focus,textarea:focus{border-color:#9ca0ff!important;box-shadow:0 0 0 4px rgba(47,54,255,.09)!important}.drop{background:linear-gradient(180deg,#fff,#f8f8ff)!important;border-color:#cfd1ff!important}.drop:hover{border-color:#8f93ff!important}.assurance{background:#f5f5ff!important;color:#363b9f!important;border-color:#e5e6ff!important}.btn,.shareBtn,.shareLinkBox button{background:#2f36ff!important;box-shadow:0 10px 24px rgba(47,54,255,.18)!important}.btn:hover,.shareBtn:hover,.shareLinkBox button:hover{box-shadow:0 14px 30px rgba(47,54,255,.23)!important}.reportHero{border-color:#e5e6f3!important;background:radial-gradient(circle at 92% 12%,rgba(47,54,255,.08),transparent 30%),#fff!important}.reportHero:before{background:#2f36ff!important}.tabs{background:#ececef!important}.tab.active{color:#111318!important}.scoreBar i{background:#2f36ff}.analysisConfidence{background:#f2f3ff!important;border-color:#e3e4ff!important}.confidenceDot{background:#2f36ff!important}.ao-map-v2-icon{background:#eef0ff!important;color:#252bd8!important}.ao-map-v2-poi{background:#2f36ff!important}.ao-map-v2-pin{background:#111318!important}.ao-map-v2-head a{color:#2f36ff!important}.kpi:after{background:linear-gradient(90deg,#2f36ff,transparent)!important}.footer{color:#777b84}
</style></head>`);
fs.writeFileSync(path.join('dist','index.html'),html);
console.log('ReVisite production build generated:',html.length);
