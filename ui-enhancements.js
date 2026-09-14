(()=>{
  const css=`
  .addressWrap{position:relative}.addressSuggest{position:absolute;left:0;right:0;top:100%;z-index:80;background:#fff;border:1px solid #c8d6de;border-radius:12px;box-shadow:0 14px 34px rgba(13,43,64,.14);margin-top:4px;overflow:hidden;display:none}.addressSuggest.show{display:block}.addressOption{padding:11px 13px;cursor:pointer;border-bottom:1px solid #edf2f4;font-size:13px;color:#17384f}.addressOption:last-child{border-bottom:0}.addressOption:hover,.addressOption.active{background:#edf9f6;color:#075e4d}.addressSource{padding:7px 12px;font-size:9px;color:#7b8d99;background:#f7fafb;text-align:right}.analysisConfidence{margin-top:10px;padding:11px 14px;border:1px solid #dce6eb;border-radius:12px;background:#fff;font-size:12px;color:#516979}.analysisConfidence b{color:#062b4a}.analysisConfidence .confidenceDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#10aa8d;margin-right:7px}.scoreGrid.simplifiedScores{grid-template-columns:repeat(3,1fr)}@media(max-width:900px){.scoreGrid.simplifiedScores{grid-template-columns:1fr}}
  `;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  function setupAddress(){
    const input=document.querySelector('#address');if(!input||input.dataset.autocompleteReady)return;input.dataset.autocompleteReady='1';
    const wrap=document.createElement('div');wrap.className='addressWrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const box=document.createElement('div');box.className='addressSuggest';wrap.appendChild(box);
    let timer=null,controller=null,items=[],active=-1,selectedLabel='';
    const close=()=>{box.classList.remove('show');active=-1};
    const draw=()=>{if(!items.length){close();return}box.innerHTML=items.map((x,i)=>`<div class="addressOption${i===active?' active':''}" data-i="${i}">${escapeHtml(x.label)}</div>`).join('')+'<div class="addressSource">Adresses : Base Adresse Nationale / IGN</div>';box.classList.add('show');box.querySelectorAll('.addressOption').forEach(el=>el.addEventListener('mousedown',e=>{e.preventDefault();choose(Number(el.dataset.i))}))};
    const choose=i=>{const x=items[i];if(!x)return;input.value=x.label;selectedLabel=x.label;close();input.dispatchEvent(new Event('change',{bubbles:true}))};
    input.setAttribute('autocomplete','off');
    input.addEventListener('input',()=>{
      const q=input.value.trim();if(q===selectedLabel){close();return}selectedLabel='';clearTimeout(timer);if(controller)controller.abort();if(q.length<3){items=[];close();return}
      timer=setTimeout(async()=>{controller=new AbortController();try{const r=await fetch('/api/address-suggest?q='+encodeURIComponent(q),{signal:controller.signal,cache:'no-store'});const d=await r.json();items=Array.isArray(d.suggestions)?d.suggestions:[];active=-1;draw()}catch(e){if(e.name!=='AbortError')close()}},260)
    });
    input.addEventListener('keydown',e=>{if(!box.classList.contains('show')||!items.length)return;if(e.key==='ArrowDown'){e.preventDefault();active=(active+1)%items.length;draw()}else if(e.key==='ArrowUp'){e.preventDefault();active=(active-1+items.length)%items.length;draw()}else if(e.key==='Enter'&&active>=0){e.preventDefault();choose(active)}else if(e.key==='Escape')close()});
    input.addEventListener('blur',()=>setTimeout(close,120));
  }

  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  function simplifyScores(){
    const grid=document.querySelector('#scores');if(!grid)return;
    const cards=[...grid.querySelectorAll('.scoreCard')];if(cards.length<4)return;
    const dossier=cards.find(c=>/Dossier/i.test(c.textContent||''))||cards[3];
    const m=(dossier.textContent||'').match(/(\d{1,3})\s*\/\s*100/);const doc=m?Number(m[1]):null;
    dossier.style.display='none';grid.classList.add('simplifiedScores');
    let label='à confirmer';if(doc!=null)label=doc>=85?'très bonne':doc>=70?'bonne':doc>=55?'moyenne':doc>=40?'limitée':'faible';
    let info=document.querySelector('#analysisConfidence');if(!info){info=document.createElement('div');info.id='analysisConfidence';info.className='analysisConfidence';grid.insertAdjacentElement('afterend',info)}
    info.innerHTML=`<span class="confidenceDot"></span><b>Fiabilité de l’analyse : ${label}</b> <span>— la complétude du dossier influence la confiance, pas la note du bien.</span>`;
  }

  function init(){
    setupAddress();
    const scores=document.querySelector('#scores');if(scores&&!scores.dataset.scoreObserver){scores.dataset.scoreObserver='1';new MutationObserver(()=>simplifyScores()).observe(scores,{childList:true,subtree:true});simplifyScores()}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
