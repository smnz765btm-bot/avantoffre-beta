from pathlib import Path

ui = Path('ui-enhancements.js')
s = ui.read_text()
css = '''
.ao-location{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:12px;margin:0 0 12px}.ao-mapcard,.ao-nearby{background:#fff;border:1px solid #e2e9ec;border-radius:20px;overflow:hidden}.ao-maphead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 11px}.ao-maphead b,.ao-nearby h3{color:#0b314d;font-size:14px;margin:0}.ao-maphead span{font-size:9px;color:#80919b;text-transform:uppercase;letter-spacing:.05em;font-weight:800}.ao-mapframe{width:100%;height:235px;border:0;display:block;background:#eef3f5}.ao-mapfoot{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-size:10px;color:#71848f}.ao-mapfoot a{color:#0a806b;font-weight:800;text-decoration:none}.ao-nearby{padding:15px 16px}.ao-nearby h3{margin-bottom:9px}.ao-nearlist{display:grid;gap:7px}.ao-nearitem{display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1f2}.ao-nearitem:last-child{border-bottom:0}.ao-nearicon{width:28px;height:28px;border-radius:9px;background:#eef8f5;color:#0b806b;display:grid;place-items:center;font-size:11px;font-weight:900}.ao-nearitem b{display:block;color:#173a50;font-size:11px}.ao-nearitem small{display:block;color:#80919b;font-size:9.5px;margin-top:1px}.ao-neartime{font-size:10px;color:#4f6878;white-space:nowrap}.ao-location-note{grid-column:1/-1;background:#eef8f5;border:1px solid #dcefe9;border-radius:13px;padding:10px 13px;color:#426a61;font-size:10.5px;line-height:1.4}.ao-location-loading{padding:18px;color:#71848f;font-size:11px}.ao-location-empty{color:#71848f;font-size:10.5px;line-height:1.4}
'''
if '.ao-location{' not in s:
    s = s.replace('@media(max-width:900px){', css + '@media(max-width:900px){.ao-location{grid-template-columns:1fr}.ao-mapframe{height:210px}')
js = '''
let aoLocationBusy=false;
const aoCatIcon=c=>c==='Commerces'?'C':c==='Écoles'?'É':c==='Transports'?'T':c==='Santé'?'+':'V';
async function addLocationBlock(){
  const report=document.querySelector('#report'),overview=document.querySelector('#overview');
  if(!report||report.classList.contains('hidden')||!overview||overview.querySelector('#aoLocation')||aoLocationBusy)return;
  const address=(document.querySelector('#address')?.value||'').trim();if(!address)return;
  aoLocationBusy=true;
  const holder=document.createElement('div');holder.id='aoLocation';holder.className='ao-location';holder.innerHTML='<div class="ao-mapcard"><div class="ao-location-loading">Localisation en cours…</div></div>';
  const first=overview.querySelector('.reportCard');first?first.after(holder):overview.prepend(holder);
  try{
    const gr=await fetch('/api/address-suggest?q='+encodeURIComponent(address),{cache:'no-store'}),gd=await gr.json(),g=Array.isArray(gd?.suggestions)?gd.suggestions[0]:null;
    if(!g||!Number.isFinite(Number(g.lat))||!Number.isFinite(Number(g.lon)))throw new Error('Adresse non localisée');
    const lat=Number(g.lat),lon=Number(g.lon),padLat=.006,padLon=.009;
    let nearby=[];try{const nr=await fetch(`/api/nearby?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,{cache:'no-store'}),nd=await nr.json();nearby=Array.isArray(nd?.nearby)?nd.nearby:[]}catch{}
    const bbox=[lon-padLon,lat-padLat,lon+padLon,lat+padLat].join('%2C');
    const map=`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${encodeURIComponent(lat)}%2C${encodeURIComponent(lon)}`;
    const open=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
    const items=nearby.slice(0,5).map(x=>`<div class="ao-nearitem"><span class="ao-nearicon">${aoCatIcon(x.category)}</span><span><b>${esc(x.category)}</b><small>${esc(x.name)}</small></span><span class="ao-neartime">${Number.isFinite(Number(x.walk_min))?esc(x.walk_min)+' min à pied':esc(x.distance_m)+' m'}</span></div>`).join('');
    holder.innerHTML=`<div class="ao-mapcard"><div class="ao-maphead"><b>Localisation</b><span>Autour du bien</span></div><iframe class="ao-mapframe" loading="lazy" title="Carte du quartier" src="${map}"></iframe><div class="ao-mapfoot"><span>${esc(address)}</span><a href="${open}" target="_blank" rel="noopener">Voir la carte ↗</a></div></div><div class="ao-nearby"><h3>À proximité</h3>${items?`<div class="ao-nearlist">${items}</div>`:'<div class="ao-location-empty">Les informations de proximité ne sont pas disponibles pour le moment.</div>'}</div><div class="ao-location-note">Repères indicatifs autour de l’adresse : ils donnent un aperçu pratique du quartier sans remplacer vos propres critères de proximité.</div>`;
  }catch(e){holder.remove()}finally{aoLocationBusy=false}
}
'''
if 'async function addLocationBlock()' not in s:
    s = s.replace('function polish(){', js + '\nfunction polish(){')
    s = s.replace('function polish(){simplifyScores();reportScope();compact();', 'function polish(){simplifyScores();reportScope();compact();addLocationBlock();')
ui.write_text(s)

bg = Path('netlify/functions/analyze-background.mts')
s = bg.read_text()
anchor = 'FIABILITÉ : distingue FACT / INFERENCE / UNKNOWN.'
editorial = "STYLE RÉDACTIONNEL : écris comme un professionnel de l’immobilier expérimenté qui explique simplement un dossier à un acquéreur. Utilise un français naturel, sobre et concret. Bannir absolument le mot « achetable » et les tournures artificielles ou typiques d’une IA telles que « opportunité intéressante », « présente un profil », « il convient de noter », « dans ce contexte », « à mettre en perspective » lorsqu’une formulation simple suffit. Préfère : prix cohérent, bien correctement positionné, élément à vérifier, point à prendre en compte, marge de négociation possible. Ne transforme pas une caractéristique neutre en défaut. Un 1er étage sans ascenseur ou un dernier étage bas sans ascenseur n’est pas, à lui seul, un point négatif. L’absence d’ascenseur devient une vigilance seulement si l’étage, l’usage ou le marché local lui donnent un impact réel. Réserve top_risks et weaknesses aux éléments objectivement défavorables, documentés et utiles à la décision.\n"
if 'Bannir absolument le mot « achetable »' not in s:
    s = s.replace(anchor, editorial + anchor)
s = s.replace("AVIS : donne un avis général clair et une stratégie d'offre, sans dramatiser les pièces simplement absentes.", "AVIS : donne un avis général clair et une stratégie d'offre, sans dramatiser les pièces simplement absentes ni les caractéristiques neutres. Le ton doit rester mesuré : distingue un vrai risque, un simple point à connaître et une préférence personnelle.")
bg.write_text(s)

an = Path('netlify/functions/analyze.mts')
s = an.read_text()
old = "const system=`Tu es le moteur AvantOffre, aide à la décision avant offre immobilière en France. Analyse le bien, le prix/micro-secteur et la copropriété."
new = "const system=`Tu es le moteur AvantOffre, aide à la décision avant offre immobilière en France. Analyse le bien, le prix/micro-secteur et la copropriété. Écris comme un professionnel de l’immobilier expérimenté, en français naturel, sobre et concret. Bannir absolument le mot « achetable » et les formulations artificielles ou typiques d’une IA. Ne transforme pas une caractéristique neutre en défaut : un 1er étage sans ascenseur ou un dernier étage bas sans ascenseur n’est pas un point négatif à lui seul. Réserve les faiblesses aux éléments objectivement défavorables et utiles à la décision."
if old in s:
    s=s.replace(old,new)
an.write_text(s)

idx=Path('index.html')
s=idx.read_text().replace('/ui-enhancements.js?v=3','/ui-enhancements.js?v=5').replace('/ui-enhancements.js?v=4','/ui-enhancements.js?v=5')
idx.write_text(s)
