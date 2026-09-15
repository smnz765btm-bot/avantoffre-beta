const fs=require('fs');
const path=require('path');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
for(const name of fs.readdirSync('.')){
  if(['dist','.git','node_modules','index.html'].includes(name)) continue;
  if(fs.statSync(name).isFile()) fs.copyFileSync(name,path.join('dist',name));
}
if(fs.existsSync('netlify')) fs.cpSync('netlify',path.join('dist','netlify'),{recursive:true});
let html=fs.readFileSync('index.html','utf8');
html=html.replaceAll('AvantOffre','ReVisite');
html=html.replace('ReVisite — Analyse avant offre','ReVisite — Au-delà de la visite.');
html=html.replace('<span>ReVisite</span>','<span>[re]visite</span>');
fs.writeFileSync(path.join('dist','index.html'),html);
console.log('ReVisite build generated:',html.length);