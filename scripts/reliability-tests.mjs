import assert from 'node:assert/strict';
import {documentCoverage,prepareDocs,normalizeAnalysis,selectOfficialComparables,applyOfficialMarketData,deterministicScores,num} from '../netlify/lib/reliability-core.mjs';

assert.equal(num(null),null,'Une valeur nulle doit rester inconnue et ne jamais devenir zéro');
assert.equal(num(undefined),null,'Une valeur absente doit rester inconnue');
assert.equal(num(''),null,'Une chaîne vide doit rester inconnue');
assert.equal(num('1976.66'),1976.66,'Une valeur numérique explicite doit rester exploitable');

const empty=deterministicScores({risk_flags:{},copro_metrics:{},property:{},market:{}},[],{officialCount:0});
assert.equal(empty.overall,null,'Un dossier sans document ne doit jamais avoir de score global');
assert.equal(empty.documentation,0,'Un dossier sans document doit avoir une couverture documentaire nulle');
assert.equal(empty.copro,null,'La copropriété ne doit pas être scorée sans pièces de copropriété');
assert.equal(empty.market,null,'Le marché ne doit pas être scoré sans comparables officiels');

const fakeDocs=[
 {name:'pv.pdf',quality:'ok',pages:6,weakPages:0,text:('PROCÈS-VERBAL ASSEMBLÉE GÉNÉRALE. Approbation des comptes. Budget prévisionnel. '+ 'dépenses tantièmes résolution '.repeat(1500))},
 {name:'diag.pdf',quality:'ok',pages:20,weakPages:0,text:('Diagnostic de performance énergétique DPE. Installation intérieure d’électricité. '+ 'consommation énergie anomalie logement '.repeat(1500))},
 {name:'charges.pdf',quality:'ok',pages:3,weakPages:0,text:('DÉCOMPTE DE CHARGES. Total des charges du lot. '+ 'quote-part provisions locatif '.repeat(1000))},
 {name:'pppt.pdf',quality:'partial',pages:30,weakPages:3,text:('Projet de plan pluriannuel de travaux PPPT. '+ 'travaux estimation échéance '.repeat(800))},
 {name:'reglement.pdf',quality:'ok',pages:50,weakPages:0,text:('Règlement de copropriété et état descriptif de division. '+ 'lot tantièmes parties communes '.repeat(1200))}
];
const cov=documentCoverage(fakeDocs);
assert.ok(cov.score>=50,'Un dossier immobilier correctement documenté doit pouvoir franchir le seuil de couverture');
const scored=deterministicScores({risk_flags:{},copro_metrics:{},property:{asking_price:200000,surface_m2:82,rooms:4,dpe:'C'},market:{estimate_low:190000,estimate_high:210000}},fakeDocs,{officialCount:4});
assert.ok(scored.overall!==null,'Le score global est autorisé lorsque la couverture est suffisante');
assert.ok(scored.confidence>=scored.documentation*.7,'La confiance doit suivre principalement la qualité documentaire');


const partialAgDocs=[
 {name:'PV_AG_2026.pdf',quality:'partial',pages:20,weakPages:12,text:('PROCÈS-VERBAL ASSEMBLÉE GÉNÉRALE. '+'résolution '.repeat(1000))},
 {name:'DECOMPTE.pdf',quality:'ok',pages:3,weakPages:0,text:('DÉCOMPTE DE CHARGES. Total des charges du lot. '+'charges '.repeat(700))},
 {name:'Carnet Entretien.pdf',quality:'ok',pages:8,weakPages:0,text:('Carnet d’entretien maintenance ascenseur toiture VMC. '+'entretien '.repeat(700))}
];
const partialScores=deterministicScores({
 risk_flags:{},
 property:{surface_m2:83.44,rooms:4,dpe:'C'},
 copro_metrics:{lot_annual_charges:1976.66},
 copro:{recurring_topics:['Ascenseur','Toiture','VMC'],litigation:[]},
 works:{voted:[],discussed:[],rejected_or_postponed:[],recommended_pppt:[],recent_completed:[]},
 market:{}
},partialAgDocs,{officialCount:0});
assert.equal(partialScores.copro,null,'Des AG seulement partielles et des charges courantes ne doivent pas produire un score copropriété rassurant');

const many=Array.from({length:30},(_,i)=>({name:`doc-${i}.pdf`,text:'X'.repeat(100000),pages:10,quality:'ok'}));
const prepared=prepareDocs(many);
assert.equal(prepared.length,30,'Aucun document ne doit disparaître à cause du budget global');
assert.ok(prepared.every(d=>d.chars_transmitted>0),'Chaque document doit transmettre du contenu');
assert.ok(prepared.reduce((s,d)=>s+d.chars_transmitted,0)<=360000,'Le budget global de caractères doit être respecté');

const analysis=normalizeAnalysis({property:{surface_m2:83.44,title:'Appartement T4'},market:{comparables:[{type:'DVF',price:1}]},risk_flags:{electrical_anomalies:false},evidence:[{claim:'x',status:'FACT',source:''}]});
assert.equal(analysis.evidence[0].status,'UNKNOWN','Un fait sans source ne doit pas rester FACT');
const candidates=[
 {valeurfonc:'205000',sbati:'82',libtypbien:'UN APPARTEMENT',codtypbien:'121',datemut:'2026-01-10'},
 {valeurfonc:'214000',sbati:'85',libtypbien:'UN APPARTEMENT',codtypbien:'121',datemut:'2025-11-03'},
 {valeurfonc:'198000',sbati:'80',libtypbien:'UN APPARTEMENT',codtypbien:'121',datemut:'2025-06-20'},
 {valeurfonc:'550000',sbati:'180',libtypbien:'UNE MAISON',codtypbien:'111',datemut:'2026-02-01'}
];
const comps=selectOfficialComparables(candidates,analysis.property);
assert.equal(comps.length,3,'Les comparables doivent respecter le type et une surface proche');
assert.ok(comps.every(c=>c.type==='DVF'&&c.source.includes('Cerema')),'Les DVF affichées doivent venir de la source officielle');
const market=applyOfficialMarketData(analysis,candidates);
assert.equal(market.market.comparables.length,3,'Les comparables IA non vérifiés doivent être remplacés par les DVF officielles');
assert.ok(market.market.estimate_low&&market.market.estimate_high,'Une fourchette DVF doit pouvoir être calculée');

console.log('ReVisite reliability tests: OK');

const compact=prepareDocs(many,{maxTotal:180000,maxDoc:30000});
assert.ok(compact.reduce((s,d)=>s+d.chars_transmitted,0)<=180000,'Le mode compact doit réduire fortement le contexte');
