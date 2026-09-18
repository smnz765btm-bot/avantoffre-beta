(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const st=document.createElement('style');st.textContent=`
:root{--ao-navy:#082d49;--ao-teal:#18a98f;--ao-soft:#f6f9fa;--ao-line:#e4ebee;--ao-text:#15354a;--ao-muted:#71848f}
body{background:#f7f9fa;color:var(--ao-text)}nav{height:76px;border-bottom:1px solid #e8eef0;box-shadow:0 1px 0 rgba(8,45,73,.02)}.wrap{max-width:1240px}.brand{letter-spacing:-.02em}.beta{background:#f0f5f7;color:#557080;padding:7px 11px;font-size:10px;letter-spacing:.04em}.hero{padding:58px 0 54px;background:radial-gradient(circle at 76% 15%,rgba(24,169,143,.16),transparent 32%),linear-gradient(135deg,#082d49 0%,#0a3d5b 100%)}.hero h1{font-size:50px;letter-spacing:-.035em;max-width:690px}.hero p{font-size:17px;max-width:650px;color:#dbe8ec}.heroPanel{border-radius:24px;background:rgba(255,255,255,.075);backdrop-filter:blur(4px)}.promise span{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.065)}
.section{padding:42px 0}.sectionHead{margin-bottom:28px}.sectionHead h2{font-size:30px;letter-spacing:-.025em}.sectionHead p{font-size:14px}.workspace{gap:22px;grid-template-columns:minmax(0,1.45fr) minmax(310px,.55fr)}.card{border-radius:24px;border:1px solid var(--ao-line);box-shadow:0 14px 40px rgba(8,45,73,.045);padding:25px}.sideCard{top:96px}.input,textarea{border-color:#dbe5e9;background:#fff;border-radius:14px;transition:.2s ease}.input:focus,textarea:focus{border-color:#8ed4c7;box-shadow:0 0 0 4px rgba(24,169,143,.08)}.drop{border-color:#b7d4dd;background:linear-gradient(180deg,#fbfdfd,#f5faf9);border-radius:20px}.drop:hover{border-color:#75c7b7;background:#f5fbf9}.uploadIcon{background:#e9f8f4}.assurance{background:#f0f8f6;border:1px solid #e0f0ec}.btn{background:linear-gradient(135deg,#16a58b,#1bb398);box-shadow:0 8px 20px rgba(24,169,143,.16);transition:.2s ease}.btn:hover{transform:translateY(-1px);box-shadow:0 11px 24px rgba(24,169,143,.2)}
.files{gap:6px}.file{position:relative;gap:10px;border-radius:12px;border-color:#e1e8eb;padding:10px 11px;background:#fff;transition:.15s ease}.file:hover{border-color:#cbdde3;background:#fcfefe}.fileMain{flex:1;min-width:0}.fileIcon{background:#edf5f7;color:#16415a}.fileName{color:#15354a}.file button{background:#f3f5f6;color:#607784;cursor:pointer}
.addressWrap{position:relative}.addressSuggest{position:absolute;left:0;right:0;top:100%;z-index:80;background:#fff;border:1px solid #c8d6de;border-radius:12px;box-shadow:0 14px 34px rgba(13,43,64,.14);margin-top:4px;overflow:hidden;display:none}.addressSuggest.show{display:block}.addressOption{padding:11px 13px;cursor:pointer;border-bottom:1px solid #edf2f4;font-size:13px;color:#17384f}.addressOption:hover{background:#edf9f6}.addressSource{padding:7px 12px;font-size:9px;color:#7b8d99;background:#f7fafb;text-align:right}
#report{background:#f5f7f8;padding-top:34px}.reportTop{margin-bottom:18px}.reportTop h2{font-size:31px;letter-spacing:-.025em}.reportActions{gap:7px}.ghostBtn{border-radius:11px;border-color:#dfe7ea;background:#fff}.reportHero{grid-template-columns:150px 1fr;background:linear-gradient(135deg,#ffffff,#fbfdfd);border:1px solid #dfe8ec;border-radius:26px;padding:26px 30px;box-shadow:0 14px 38px rgba(8,45,73,.05)}.verdict{letter-spacing:-.025em}.headline{color:#24485d}.reportHero .summary{max-width:850px}.scoreGrid.simplifiedScores{grid-template-columns:repeat(3,1fr);gap:10px}.scoreCard{border-radius:17px;border-color:#e4eaed;box-shadow:none;background:#fff}.analysisConfidence{margin:10px 0;padding:10px 13px;border-radius:12px;background:#eef6f7;font-size:11px;color:#516979}.confidenceDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#10aa8d;margin-right:7px}.decisionCards{gap:10px}.chipBox{border-radius:18px;box-shadow:none;border-color:#e4eaed}.chipBox h3{font-size:13px}.chip{font-size:10.5px;padding:7px 9px}.chip.good{background:#edf8f5;color:#176b54}.chip.warn{background:#f7f5ee;color:#755d2d}.tabs{margin:18px 0 13px;padding:5px;background:#eaf0f2;border-radius:14px;top:82px}.tab{padding:10px 12px;font-size:12px}.tab.active{background:#fff;box-shadow:0 2px 8px rgba(8,45,73,.06)}.reportCard{border-radius:20px;padding:20px 22px;margin-bottom:12px;box-shadow:none;border-color:#e2e9ec;background:#fff}.reportCard h3{font-size:17px;letter-spacing:-.012em}.reportCard h4{font-size:11px;text-transform:uppercase;letter-spacing:.055em;color:#71838e}.reportCard>.summary{font-size:12.5px;line-height:1.5;color:#506a79}.focusBox{background:#f8fafb;border:1px solid #eef2f3}.kpi{background:#fbfcfc;border-color:#e7edef;border-radius:13px}.kpi span{color:#82919a}.kpi b{letter-spacing:-.01em}.ao-clamped{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ao-readmore{border:0;background:transparent;color:#0a806b;font-size:10.5px;font-weight:800;cursor:pointer}.ao-consent{display:flex;gap:9px;align-items:flex-start;margin:12px 0 10px;padding:11px;border-radius:12px;background:#f5f8fa;color:#526a7b;font-size:10.5px;line-height:1.4}.ao-consent input{margin-top:2px;flex:0 0 auto}.ao-scope{margin:0 0 12px;padding:11px 13px;border:1px solid #dce6eb;border-radius:13px;background:#fff;font-size:11px;color:#526a7b}.ao-scope b{color:#062b4a}.ao-scope.bad{border-color:#efcccc;background:#fff7f7}
.ao-docstatus{margin-left:auto;margin-right:10px;display:flex;align-items:center;gap:7px;min-width:175px;max-width:280px;font-size:11px;font-weight:800}.ao-dot{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;font-size:12px;flex:0 0 21px}.ao-docstatus.ok{color:#0a806b}.ao-docstatus.ok .ao-dot{background:#13a584;color:#fff}.ao-docstatus.wait{color:#71818c;font-weight:700}.ao-docstatus.wait .ao-dot{background:#edf2f4;color:#71818c}.ao-docstatus.bad{color:#c74646}.ao-docstatus.bad .ao-dot{background:#e95757;color:#fff}.ao-docstatus.warn{color:#b36b00}.ao-docstatus.warn .ao-dot{background:#f2a11a;color:#fff}.ao-docreason{display:block;font-size:9.5px;font-weight:500;color:#687b89;margin-top:2px;line-height:1.25}.ao-readalert{margin:11px 0;padding:11px 13px;border:1px solid #efc3c3;border-radius:13px;background:#fff7f7;color:#713d3d;font-size:10.5px;line-height:1.4}.ao-readalert strong{display:block;color:#8e3737;font-size:11.5px;margin-bottom:4px}.ao-readalert ul{margin:5px 0 0;padding-left:17px}.ao-readalert li{margin:4px 0}.ao-readalert .ao-solution{display:block;margin-top:2px;color:#526a7b}.ao-readalert.critical{border-width:2px}.ao-readalert.report{margin-bottom:14px}.ao-readalert .ao-file{font-weight:850;color:#5d3030}

.ao-location{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:12px;margin:0 0 12px}.ao-mapcard,.ao-nearby{background:#fff;border:1px solid #e2e9ec;border-radius:20px;overflow:hidden}.ao-maphead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 11px}.ao-maphead b,.ao-nearby h3{color:#0b314d;font-size:14px;margin:0}.ao-maphead span{font-size:9px;color:#80919b;text-transform:uppercase;letter-spacing:.05em;font-weight:800}.ao-mapframe{width:100%;height:235px;border:0;display:block;background:#eef3f5}.ao-mapfoot{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-size:10px;color:#71848f}.ao-mapfoot a{color:#0a806b;font-weight:800;text-decoration:none}.ao-nearby{padding:15px 16px}.ao-nearby h3{margin-bottom:9px}.ao-nearlist{display:grid;gap:7px}.ao-nearitem{display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1f2}.ao-nearitem:last-child{border-bottom:0}.ao-nearicon{width:28px;height:28px;border-radius:9px;background:#eef8f5;color:#0b806b;display:grid;place-items:center;font-size:11px;font-weight:900}.ao-nearitem b{display:block;color:#173a50;font-size:11px}.ao-nearitem small{display:block;color:#80919b;font-size:9.5px;margin-top:1px}.ao-neartime{font-size:10px;color:#4f6878;white-space:nowrap}.ao-location-note{grid-column:1/-1;background:#eef8f5;border:1px solid #dcefe9;border-radius:13px;padding:10px 13px;color:#426a61;font-size:10.5px;line-height:1.4}.ao-location-loading{padding:18px;color:#71848f;font-size:11px}.ao-location-empty{color:#71848f;font-size:10.5px;line-height:1.4}
@media(max-width:900px){.ao-location{grid-template-columns:1fr}.ao-mapframe{height:210px}.hero{padding:40px 0}.hero h1{font-size:37px}.workspace{grid-template-columns:1fr}.scoreGrid.simplifiedScores,.reportHero{grid-template-columns:1fr}.ao-docstatus{min-width:120px;max-width:160px}.ao-docreason{font-size:9px}.reportHero{text-align:center}.reportCard{padding:17px}.tabs{overflow:auto;flex-wrap:nowrap}.tab{min-width:max-content}}
`;document.head.appendChild(st);
const aoGeoCache=new Map();
async function aoGeoSuggest(query,signal){
  const q=String(query||'').trim();if(q.length<3)return[];
  const key=q.toLowerCase();if(aoGeoCache.has(key))return aoGeoCache.get(key);
  const target=new URL('https://data.geopf.fr/geocodage/completion/');
  target.searchParams.set('text',q);target.searchParams.set('type','StreetAddress');target.searchParams.set('maximumResponses','6');
  const r=await fetch(target.toString(),{signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('Géocodage indisponible');
  const d=await r.json(),rows=Array.isArray(d?.results)?d.results:[];
  const items=rows.map(x=>({label:String(x?.fulltext||x?.label||'').trim(),city:String(x?.city||'').trim(),postcode:String(x?.zipcode||x?.postalcode||'').trim(),lon:Number.isFinite(Number(x?.x))?Number(x.x):null,lat:Number.isFinite(Number(x?.y))?Number(x.y):null})).filter(x=>x.label).slice(0,6);
  aoGeoCache.set(key,items);if(aoGeoCache.size>30)aoGeoCache.delete(aoGeoCache.keys().next().value);
  return items;
}
function setupAddress(){
  const input=document.querySelector('#address');if(!input||input.dataset.autocompleteReady)return;input.dataset.autocompleteReady='1';
  const wrap=document.createElement('div');wrap.className='addressWrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  const box=document.createElement('div');box.className='addressSuggest';wrap.appendChild(box);
  let timer,controller,items=[];const close=()=>box.classList.remove('show');const choose=i=>{if(!items[i])return;input.value=items[i].label;close()};
  input.autocomplete='off';
  input.addEventListener('input',()=>{clearTimeout(timer);if(controller)controller.abort();const q=input.value.trim();if(q.length<3)return close();timer=setTimeout(async()=>{controller=new AbortController();try{items=await aoGeoSuggest(q,controller.signal);box.innerHTML=items.map((x,i)=>`<div class="addressOption" data-i="${i}">${esc(x.label)}</div>`).join('')+(items.length?'<div class="addressSource">IGN / Géoplateforme</div>':'');box.classList.toggle('show',!!items.length);box.querySelectorAll('.addressOption').forEach(el=>el.onmousedown=e=>{e.preventDefault();choose(+el.dataset.i)})}catch{close()}},450)});
  input.addEventListener('blur',()=>setTimeout(close,120));
}
const readState=new Map();const isPv=name=>/\b(pv|ag)\b|assembl/i.test(name||'');function rows(){return [...document.querySelectorAll('#filesList .file')]}function fileNamesFromRows(){return rows().map(r=>r.querySelector('.fileName')?.textContent||'document')}
function reasonFor(status,error,chars){const e=String(error||'').toLowerCase();if(status===413||e.includes('volumineux'))return{reason:'Fichier trop volumineux',solution:'Scindez le PDF puis réimportez-le.',kind:'warn'};if(e.includes('password')||e.includes('mot de passe')||e.includes('encrypted'))return{reason:'PDF protégé',solution:'Enregistrez-le sans mot de passe puis réimportez-le.',kind:'bad'};if(Number(chars)<80)return{reason:e.includes('partielle')?'Lecture partielle après seconde lecture':'Lecture insuffisante après seconde lecture',solution:e.includes('partielle')?'Certaines pages restent difficiles à exploiter. Fournissez si possible le PDF natif ou une version plus nette.':'ReVisite a tenté une seconde lecture OCR sans obtenir assez de contenu fiable. Fournissez une version non protégée ou plus nette.',kind:e.includes('partielle')?'warn':'bad'};if(status>=400)return{reason:'Échec de traitement',solution:'Réenregistrez le document en PDF standard.',kind:'bad'};return{reason:'Non lisible',solution:'Réenregistrez-le en PDF standard ou appliquez un OCR.',kind:'bad'}}
function setRowStatus(i,state){const row=rows()[i];if(!row)return;let box=row.querySelector('.ao-docstatus');if(!box){box=document.createElement('div');box.className='ao-docstatus';const remove=row.querySelector('button');remove?row.insertBefore(box,remove):row.appendChild(box)}if(!state){box.className='ao-docstatus wait';box.innerHTML='<span class="ao-dot">·</span><span>En attente</span>';return}if(state.status==='ok'){box.className='ao-docstatus ok';box.innerHTML='<span class="ao-dot">✓</span><span>Traité</span>';return}const kind=state.kind==='warn'?'warn':'bad';box.className='ao-docstatus '+kind;box.innerHTML=`<span class="ao-dot">${kind==='warn'?'!':'×'}</span><span>${esc(state.reason)}<small class="ao-docreason">${esc(state.solution)}</small></span>`}function renderFileStates(){rows().forEach((_,i)=>setRowStatus(i,readState.get(i)))}
window.addEventListener('revisite-document-issue',e=>{
  const d=e?.detail||{},i=Number(d.index);if(!Number.isFinite(i))return;
  readState.set(i,{name:String(d.name||'document'),status:'failed',reason:'Document non exploitable',solution:String(d.reason||'Réimportez une version lisible.'),kind:'bad',chars:0});
  setRowStatus(i,readState.get(i));try{renderReadWarnings()}catch{}
});
function installUploadMonitor(){
  if(window.__aoUploadMonitor)return;window.__aoUploadMonitor=true;const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input?.url||'');let metas=[];
    if(url.includes('/api/upload-document')){
      try{const b=JSON.parse(String(init?.body||'{}'));const docs=Array.isArray(b?.documents)?b.documents:[b];metas=docs.map(x=>({name:String(x?.name||'document'),index:Number(x?.index)})).filter(x=>Number.isFinite(x.index))}catch{}
    }
    try{
      const res=await nativeFetch(input,init);
      if(metas.length){
        let data={};try{data=await res.clone().json()}catch{}
        if(!res.ok&&(res.status===429||res.status>=500))return res;
        const results=Array.isArray(data?.documents)?data.documents:[];
        for(const meta of metas){
          const item=results.find(x=>Number(x?.index)===meta.index)||data;
          const actualChars=Number(item?.actualChars??item?.chars??0),quality=String(item?.quality||'');
          if(res.ok&&quality==='partial')readState.set(meta.index,{name:meta.name,status:'failed',reason:'Lecture partielle',solution:'Le document reste exploitable ; certaines pages sont moins lisibles.',kind:'warn',chars:actualChars});
          else if(res.ok&&actualChars>=80)readState.set(meta.index,{name:meta.name,status:'ok',chars:actualChars});
          else readState.set(meta.index,{name:meta.name,status:'failed',...reasonFor(res.status,item?.error||data?.error,actualChars),chars:actualChars});
          setRowStatus(meta.index,readState.get(meta.index));
        }
        try{renderReadWarnings()}catch{}
      }
      return res;
    }catch(err){
      for(const meta of metas){readState.set(meta.index,{name:meta.name,status:'failed',...reasonFor(500,err?.message,0)});setRowStatus(meta.index,readState.get(meta.index))}
      try{renderReadWarnings()}catch{};throw err;
    }
  }
}
function failures(includeMissing=false){const names=fileNamesFromRows(),out=[];names.forEach((name,i)=>{const s=readState.get(i);if(s?.status==='failed')out.push({...s,index:i});else if(includeMissing&&!s)out.push({name,index:i,status:'failed',reason:'Fichier non traité',solution:'Réimportez le document puis relancez l’analyse.',kind:'bad'})});return out}
function warningHtml(list,forReport=false){if(!list.length)return'';const partialOnly=list.every(x=>x.kind==='warn');const critical=list.some(x=>isPv(x.name));const title=partialOnly?'⚠ Lecture partielle de certains documents':critical?'⚠ PV d’AG non exploitable : analyse copropriété incomplète':'⚠ Certains documents n’ont pas pu être exploités';return `<div class="ao-readalert ${critical?'critical':''} ${forReport?'report':''}"><strong>${title}</strong><ul>${list.map(x=>`<li><span class="ao-file">${esc(x.name)}</span> — ${esc(x.reason)} <span class="ao-solution">${esc(x.solution)}</span></li>`).join('')}</ul>${critical?'<span class="ao-solution"><b>Important :</b> seules les informations effectivement lisibles sont prises en compte dans les conclusions copropriété.</span>':''}</div>`}
function renderReadWarnings(final=false){
  const list=failures(final),html=warningHtml(list,false);
  const side=document.querySelector('.sideCard');
  if(side){
    let el=document.querySelector('#aoReadWarning');
    if(!list.length){el?.remove()}
    else{
      if(!el){el=document.createElement('div');el.id='aoReadWarning';document.querySelector('#analyze')?.before(el)}
      if(el&&el.innerHTML!==html)el.innerHTML=html;
    }
  }
  // Nettoyage défensif des anciennes alertes du rapport. Le rapport n'affiche
  // plus qu'un unique bandeau de périmètre documentaire via reportScope().
  const report=document.querySelector('#report');
  if(report)report.querySelectorAll('.ao-readalert.report,#aoReportReadWarning,.ao-report-warning-host').forEach(x=>x.remove());
}
function setupConsent(){const btn=document.querySelector('#analyze');if(!btn||document.querySelector('#aoConsent'))return;const note=document.createElement('div');note.id='aoConsent';note.className='ao-consent';note.innerHTML='<span><b>Périmètre documentaire.</b> ReVisite analyse uniquement les pièces transmises ; un document absent ou illisible peut limiter certaines conclusions.</span>';btn.before(note)}
function simplifyScores(){const grid=document.querySelector('#scores');if(!grid)return;const cards=[...grid.querySelectorAll('.scoreCard')];if(cards.length<4)return;const dossier=cards.find(c=>/Dossier/i.test(c.textContent||''))||cards[3];const m=(dossier.textContent||'').match(/(\d{1,3})\s*\/\s*100/),doc=m?+m[1]:null;dossier.style.display='none';grid.classList.add('simplifiedScores');let label=doc==null?'à confirmer':doc>=85?'très bonne':doc>=70?'bonne':doc>=55?'moyenne':doc>=40?'limitée':'faible';let info=document.querySelector('#analysisConfidence');if(!info){info=document.createElement('div');info.id='analysisConfidence';info.className='analysisConfidence';grid.after(info)}info.innerHTML=`<span class="confidenceDot"></span><b>Fiabilité de l’analyse : ${label}</b> — calculée selon les pièces effectivement analysées.`}
function softenVigilance(){const title=[...document.querySelectorAll('.chipBox h3')].find(x=>/vigilance/i.test(x.textContent||''));if(title)title.textContent='Points à connaître';const risks=document.querySelector('#risks');if(!risks)return;[...risks.children].forEach(ch=>{const t=(ch.textContent||'').toLowerCase();if(/1er.*(sans ascenseur|absence d.ascenseur)|premier.*(sans ascenseur|absence d.ascenseur)|dernier étage sans ascenseur/.test(t)&&!/3e|4e|5e|6e|troisième|quatrième|cinquième|sixième/.test(t))ch.remove();else if(/sans ascenseur|absence d.ascenseur/.test(t)&&!/étage élevé|3e|4e|5e|6e|troisième|quatrième|cinquième|sixième/.test(t)){ch.classList.remove('warn');ch.style.background='#eef4f6';ch.style.color='#526a7b'}})}
function reportScope(){const report=document.querySelector('#report');if(!report||report.classList.contains('hidden'))return;const top=report.querySelector('.reportHero');if(!top)return;const unread=failures(true),partial=unread.filter(x=>x.kind==='warn'),critical=unread.filter(x=>x.kind!=='warn');let d=document.querySelector('#aoScope');if(!d){d=document.createElement('div');d.id='aoScope';top.before(d)}const key=[partial.length,critical.length,fileNamesFromRows().length].join(':');if(d.dataset.key===key)return;d.dataset.key=key;d.className='ao-scope '+(critical.length?'bad':partial.length?'partial':'');const total=fileNamesFromRows().length;const headline=critical.length?'Périmètre documentaire incomplet':partial.length?'Périmètre documentaire — lecture partielle':'Périmètre documentaire complet';const detail=critical.length?`${critical.length} document(s) non exploitable(s).`:partial.length?`${partial.length} document(s) partiellement lisible(s), pris en compte uniquement sur les éléments effectivement extraits.`:`${total||'Tous les'} document(s) transmis ont été pris en compte.`;d.innerHTML=`<b>${headline}</b><br><span>${detail} ReVisite n’extrapole pas les informations absentes ou illisibles.</span>`}
function compact(){document.querySelectorAll('#report .pane:not(#detail) .reportCard>.summary').forEach(p=>{if(p.dataset.compacted||p.textContent.trim().length<240)return;p.dataset.compacted='1';p.classList.add('ao-clamped');const b=document.createElement('button');b.className='ao-readmore';b.textContent='Voir le détail';b.onclick=()=>{const o=p.classList.toggle('ao-clamped');b.textContent=o?'Voir le détail':'Réduire'};p.after(b)})}

let aoLocationBusy=false;
async function addLocationBlock(){
  const report=document.querySelector('#report'),overview=document.querySelector('#overview');
  if(!report||report.classList.contains('hidden')||!overview||overview.querySelector('#aoLocation')||aoLocationBusy)return;
  const address=(document.querySelector('#address')?.value||'').trim();if(!address)return;
  aoLocationBusy=true;
  const holder=document.createElement('div');holder.id='aoLocation';holder.className='ao-location';holder.innerHTML='<div class="ao-mapcard"><div class="ao-location-loading">Localisation en cours…</div></div>';
  const first=overview.querySelector('.reportCard');first?first.after(holder):overview.prepend(holder);
  try{
    const suggestions=await aoGeoSuggest(address),g=suggestions[0];
    if(!g||!Number.isFinite(Number(g.lat))||!Number.isFinite(Number(g.lon)))throw new Error('Adresse non localisée');
    const lat=Number(g.lat),lon=Number(g.lon),padLat=.006,padLon=.009;
    const bbox=[lon-padLon,lat-padLat,lon+padLon,lat+padLat].join('%2C');
    const map=`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${encodeURIComponent(lat)}%2C${encodeURIComponent(lon)}`;
    const open=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
    holder.innerHTML=`<div class="ao-mapcard"><div class="ao-maphead"><b>Localisation</b><span>Autour du bien</span></div><iframe class="ao-mapframe" loading="lazy" title="Carte du quartier" src="${map}"></iframe><div class="ao-mapfoot"><span>${esc(address)}</span><a href="${open}" target="_blank" rel="noopener">Voir la carte ↗</a></div></div><div class="ao-location-note">Carte indicative issue d’OpenStreetMap. Les services de proximité détaillés ne sont chargés qu’en dehors du moteur ReVisite afin de préserver les ressources d’analyse.</div>`;
  }catch{holder.remove()}finally{aoLocationBusy=false}
}

function polish(){simplifyScores();softenVigilance();reportScope();compact();addLocationBlock();if(!document.querySelector('#report')?.classList.contains('hidden'))renderReadWarnings(false)}
function init(){installUploadMonitor();setupAddress();setupConsent();const list=document.querySelector('#filesList');if(list)new MutationObserver(()=>requestAnimationFrame(renderFileStates)).observe(list,{childList:true});document.querySelector('#files')?.addEventListener('change',()=>setTimeout(()=>{readState.clear();renderFileStates();renderReadWarnings(false)},30));renderFileStates();const report=document.querySelector('#report');if(report)new MutationObserver(()=>requestAnimationFrame(polish)).observe(report,{childList:true,subtree:true,attributes:true});polish()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();