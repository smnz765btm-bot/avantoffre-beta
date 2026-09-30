(()=>{
 const $=s=>document.querySelector(s),input=$('#url'),price=$('#askingPrice'),status=$('#listingStatus');let seq=0,timer,pending=null,pendingUrl="";
 async function read(){const url=input.value.trim(),ticket=++seq;if(!url){status.textContent='';return}status.textContent='Recherche du prix de cette annonce…';
 try{const r=await fetch('/api/listing?url='+encodeURIComponent(url));const d=await r.json();if(ticket!==seq||input.value.trim()!==url)return;
 if(d.status==='ok'){if(price.dataset.origin!=='manual'){price.value=d.asking_price;price.dataset.origin='listing'}status.textContent='Prix trouvé : '+Number(d.asking_price).toLocaleString('fr-FR')+' € · source : '+(d.provider||'annonce');status.dataset.state='ok'}
 else{status.textContent='Le site ne permet pas de confirmer le prix. Renseignez-le ci-dessous pour obtenir la note prix.';status.dataset.state='warning'}
 }catch{if(ticket===seq){status.textContent='Lecture momentanément indisponible. Vous pouvez renseigner le prix.';status.dataset.state='warning'}}}
 function start(){const url=input.value.trim();if(pending&&pendingUrl===url)return pending;pendingUrl=url;const task=read();pending=task;task.finally(()=>{if(pending===task)pending=null});return task}
 price?.addEventListener('input',()=>{price.dataset.origin='manual'});
 input.addEventListener('input',()=>{seq++;clearTimeout(timer);if(price.dataset.origin==='listing'){price.value='';delete price.dataset.origin}timer=setTimeout(()=>{window.rvListingReady=start()},700)});
 input.addEventListener('change',()=>{clearTimeout(timer);window.rvListingReady=start()});
})();
