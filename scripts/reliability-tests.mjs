import assert from 'node:assert/strict';
import {documentCoverage,prepareDocs,normalizeAnalysis,extractDeterministicFacts,applyDeterministicFacts,parseStaticDvfCsv,selectOfficialComparables,applyOfficialMarketData,deterministicScores,hardenScores,num} from '../netlify/lib/reliability-core.mjs';
import {partitionUploadDocuments} from '../netlify/lib/upload-core.mjs';

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
 {name:'diag.pdf',quality:'ok',pages:20,weakPages:0,text:('Appartement T4. Superficie Carrez : 82 m². Diagnostic de performance énergétique DPE : C. Installation intérieure d’électricité. '+ 'consommation énergie anomalie logement '.repeat(1500))},
 {name:'charges.pdf',quality:'ok',pages:3,weakPages:0,text:('DÉCOMPTE DE CHARGES. Total des charges du lot. '+ 'quote-part provisions locatif '.repeat(1000))},
 {name:'pppt.pdf',quality:'partial',pages:30,weakPages:3,text:('Projet de plan pluriannuel de travaux PPPT. '+ 'travaux estimation échéance '.repeat(800))},
 {name:'reglement.pdf',quality:'ok',pages:50,weakPages:0,text:('Règlement de copropriété et état descriptif de division. '+ 'lot tantièmes parties communes '.repeat(1200))}
];
const cov=documentCoverage(fakeDocs);
assert.ok(cov.score>=50,'Un dossier immobilier correctement documenté doit pouvoir franchir le seuil de couverture');
const scored=deterministicScores({
 risk_flags:{},
 copro_metrics:{annual_budget:140000,collective_arrears:5000,cash:45000,works_fund:30000},
 property:{asking_price:200000,surface_m2:82,rooms:4,dpe:'C',diagnostics:['Électricité conforme au rapport','DPE C']},
 market:{estimate_low:190000,estimate_high:210000,confidence:'bonne',dvf_reference:{sample_count:20,dispersion_ratio:1.3}}
},fakeDocs,{officialCount:5});
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

const malformedNested=normalizeAnalysis({
  property:{
    title:'Appartement T3',
    surface_m2:62.33,
    market:{estimate_low:140000,estimate_high:160000,analysis:'Marché IA'},
    copro_metrics:{annual_budget:13548,lot_annual_charges:1306},
    copro:{financial_analysis:'Budget approuvé',strengths:['Comptes approuvés']},
    works:{recent_completed:['Portail remplacé']},
    buyer_blocks:{before_offer_checks:{checks:['Vérifier AG 2025']}},
    documents:{missing_or_to_obtain:['AG 2025 lisible']},
    executive_summary:{top_strengths:['Terrasse']},
    negotiation:{arguments:['Électricité à chiffrer']},
    verdict:{label:'À approfondir'},
    evidence:[{claim:'Charge annuelle',status:'FACT',source:'decompte.pdf'}],
    questions_before_offer:['Travaux votés ?']
  },
  market:{estimate_low:124000,estimate_high:170000,comparables:[{price:136500}]},
  documents:{received:['ag24.pdf'],quality_notes:['OCR partiel']}
});
assert.equal(malformedNested.property.market,undefined,'Les sections top-level ne doivent pas rester imbriquées dans property');
assert.equal(malformedNested.copro_metrics.annual_budget,13548,'Les métriques copropriété imbriquées doivent être récupérées');
assert.equal(malformedNested.copro.financial_analysis,'Budget approuvé');
assert.deepEqual(malformedNested.works.recent_completed,['Portail remplacé']);
assert.deepEqual(malformedNested.buyer_blocks.before_offer_checks.checks,['Vérifier AG 2025']);
assert.equal(malformedNested.market.estimate_low,124000,'Les données marché déterministes déjà présentes doivent primer');
assert.deepEqual(malformedNested.documents.received,['ag24.pdf']);
assert.ok(malformedNested.documents.missing_or_to_obtain.includes('AG 2025 lisible'),'Les pièces manquantes imbriquées doivent être récupérées');
assert.equal(malformedNested.evidence[0].status,'FACT');
assert.equal(malformedNested.verdict.label,'À approfondir');

const sanitized=normalizeAnalysis({
 property:{weaknesses:['Balcon non inclus dans la surface Carrez','Infiltration constatée sur balcon']},
 copro:{litigation:['Carnet : procédures en cours RAS','Litige judiciaire documenté']},
 negotiation:{arguments:['Charges 2025 élevées à vérifier','Travaux votés à chiffrer']},
 executive_summary:{top_risks:['Charges élevées','PV partiellement lisibles']},
 evidence:[
   {claim:'Charges 2025 : DECOMPTE.pdf, page 3',status:'FACT'},
   {claim:'Affirmation sans source',status:'FACT'}
 ]
});
assert.deepEqual(sanitized.property.weaknesses,['Infiltration constatée sur balcon'],'Un balcon hors Carrez ne doit pas être présenté comme une faiblesse');
assert.deepEqual(sanitized.copro.litigation,['Litige judiciaire documenté'],'RAS ne doit jamais être classé comme litige');
assert.deepEqual(sanitized.negotiation.arguments,['Travaux votés à chiffrer'],'Les charges ne doivent pas être qualifiées sans benchmark');
assert.equal(sanitized.evidence[0].status,'FACT','Une référence fichier/page intégrée doit suffire à sourcer un fait');
assert.equal(sanitized.evidence[1].status,'UNKNOWN','Un fait réellement non sourcé doit être déclassé');

const deterministicDoc=[
 {name:'DIA-test.pdf',quality:'ok',pages:6,weakPages:0,text:`Nature du bien : Appartement T4
Superficie « Carrez » : 83,44 m²
Etage : 2
Performance énergétique et climatique 106 3 Estimation des coûts annuels d’énergie du logement entre 890 € et 1 240 € par an
Diagnostic électricité : aucune anomalie`},
 {name:'DECOMPTE.pdf',quality:'ok',pages:3,weakPages:0,text:`Total des charges sur cette période
Dont TVA
Total des provisions appelées
Reste à percevoir
1976.66
264.89
-1789.97
186.69`},
 {name:'1ERTRIM26.pdf',quality:'ok',pages:2,weakPages:0,text:`Montant de l'appel de fonds 444.53 €
SOLDE DEBITEUR 110.25
TOTAL A PAYER 554.78`}
];
const facts=extractDeterministicFacts(deterministicDoc);
assert.equal(facts.surface_m2,83.44);
assert.equal(facts.rooms,4);
assert.equal(facts.floor,'2e étage');
assert.equal(facts.dpe,'B','106 kWh/m²/an et 3 kgCO2/m²/an sur >40 m² correspondent à B');
assert.equal(facts.energy_cost_low,890);
assert.equal(facts.energy_cost_high,1240);
assert.equal(facts.lot_annual_charges,1976.66);
assert.equal(facts.individual_balance,110.25);
assert.equal(facts.current_call_amount,444.53);
assert.equal(facts.total_to_pay,554.78);
const factual=applyDeterministicFacts({property:{surface_m2:50,rooms:2,dpe:'E'},copro_metrics:{}},deterministicDoc);
assert.equal(factual.property.surface_m2,83.44,'Les faits documentaires déterministes doivent primer');
assert.equal(factual.property.dpe,'B');
assert.equal(factual.copro_metrics.individual_balance,110.25);

const ocrLikeDpeDoc=[{
 name:'ANDRE_DPE_ET_ERNT_B25.pdf',quality:'partial',pages:18,weakPages:3,
 text:`[PAGE 5 | OCR]
Diagnostic de performance énergétique
logement extrêmement performant
Consommation énergie primaire 106 kWh/m²/an
Émissions de gaz à effet de serre 3 kg CO2/m²/an
Estimation des coûts annuels d'énergie entre 890 € et 1 240 € par an
Appartement T4 — Superficie Carrez : 83,44 m² — Etage : 2`
}];
const ocrFacts=extractDeterministicFacts(ocrLikeDpeDoc);
assert.equal(ocrFacts.dpe,'B','Le DPE graphique OCRisé doit être recalculé B à partir de 106/3');
assert.equal(ocrFacts.energy_consumption_kwh_m2,106);
assert.equal(ocrFacts.ghg_kgco2_m2,3);
const correctedDpe=applyDeterministicFacts({property:{surface_m2:83.44,rooms:4,dpe:'A'},copro_metrics:{}},ocrLikeDpeDoc);
assert.equal(correctedDpe.property.dpe,'B','Un DPE IA erroné doit être écrasé par les valeurs OCR vérifiables');
const unverifiedDpe=applyDeterministicFacts({property:{surface_m2:83.44,rooms:4,dpe:'A'},copro_metrics:{}},[
 {name:'diagnostics.pdf',quality:'partial',pages:4,weakPages:2,text:'Diagnostic de performance énergétique illisible. Appartement T4. Superficie Carrez : 83,44 m².'}
]);
assert.equal(unverifiedDpe.property.dpe,null,'Un DPE non vérifiable ne doit pas conserver une classe devinée par le modèle');

const strongAccountsWithoutMetricsDocs=[
 {name:'PV_AG_2026.pdf',quality:'ok',pages:8,weakPages:0,text:('PROCÈS-VERBAL ASSEMBLÉE GÉNÉRALE approbation comptes budget résolution '.repeat(500))},
 {name:'FICHE_SYNTHESE_COPRO.pdf',quality:'ok',pages:3,weakPages:0,text:('Fiche synthétique copropriété comptes budget syndic '.repeat(600))},
 ...ocrLikeDpeDoc
];
const noFinanceScore=deterministicScores({
 risk_flags:{},property:{surface_m2:83.44,rooms:4,dpe:'B',diagnostics:['DPE B','Électricité']},
 copro_metrics:{lot_annual_charges:1976.66},market:{estimate_low:180000,estimate_high:220000,confidence:'bonne',dvf_reference:{sample_count:20,dispersion_ratio:1.2}}
},strongAccountsWithoutMetricsDocs,{officialCount:5});
assert.equal(noFinanceScore.copro,null,'Une fiche comptes sans métriques financières collectives extraites ne doit pas produire de score copropriété');

const withheld={scores:{property:82,copro:95,market:null,documentation:67,confidence:59,overall:null},meta:{score_withheld:true}};
hardenScores(withheld);
assert.equal(withheld.scores.overall,null,'Un score global retenu doit rester N/C et ne jamais devenir 0');
assert.equal(withheld.scores.market,null);

const incompleteRealLike=deterministicScores({
 risk_flags:{},
 property:{surface_m2:83.44,rooms:4,dpe:'',diagnostics:['Électricité : aucune anomalie','Termites : absence']},
 copro_metrics:{lot_annual_charges:1976.66},
 copro:{litigation:[]},
 works:{voted:['Travail cité dans carnet'],recent_completed:[]},
 market:{estimate_low:null,estimate_high:null}
},partialAgDocs,{officialCount:0});
assert.equal(incompleteRealLike.property,null,'Sans étiquette DPE vérifiée, le score bien doit rester N/C');
assert.equal(incompleteRealLike.copro,null,'Des travaux seuls ne justifient pas un score copropriété');
assert.equal(incompleteRealLike.market,null);
assert.equal(incompleteRealLike.overall,null);

const analysis=normalizeAnalysis({property:{surface_m2:83.44,title:'Appartement T4'},market:{comparables:[{type:'DVF',price:1}]},risk_flags:{electrical_anomalies:false},evidence:[{claim:'x',status:'FACT',source:''}]});
assert.equal(analysis.evidence[0].status,'UNKNOWN','Un fait sans source ne doit pas rester FACT');
const staticCsv=`id_mutation,date_mutation,numero_disposition,nature_mutation,valeur_fonciere,adresse_numero,adresse_suffixe,adresse_nom_voie,adresse_code_voie,code_postal,code_commune,nom_commune,code_departement,ancien_code_commune,ancien_nom_commune,id_parcelle,ancien_id_parcelle,numero_volume,lot1_numero,lot1_surface_carrez,lot2_numero,lot2_surface_carrez,lot3_numero,lot3_surface_carrez,lot4_numero,lot4_surface_carrez,lot5_numero,lot5_surface_carrez,nombre_lots,code_type_local,type_local,surface_reelle_bati,nombre_pieces_principales,code_nature_culture,nature_culture,code_nature_culture_speciale,nature_culture_speciale,surface_terrain,longitude,latitude
2025-1,2025-06-01,000001,Vente,205000,20,,CHEMIN DE TEST,,31200,31555,Toulouse,31,,,,,,"10",83.44,,,,,,,,,1,2,Appartement,83,4,,,,,,1.456500,43.642700
2025-1,2025-06-01,000001,Vente,205000,20,,CHEMIN DE TEST,,31200,31555,Toulouse,31,,,,,,"11",,,,,,,,,,1,3,Dépendance,,0,,,,,,1.456500,43.642700
2025-2,2025-05-01,000001,Vente,310000,4,,RUE LOIN,,31200,31555,Toulouse,31,,,,,,,,,,,,,,,,,1,2,Appartement,85,4,,,,,,1.500000,43.700000
`;
const staticRows=parseStaticDvfCsv(staticCsv,{lat:43.642529,lon:1.456254,maxDistanceM:1200});
assert.equal(staticRows.length,1,'Le fallback DVF doit garder uniquement les logements proches et exclure les dépendances');
assert.equal(staticRows[0].codtypbien,'121');
assert.ok(staticRows[0].distance_m<100,'La distance DVF doit être calculée');
assert.ok(String(staticRows[0].source).includes('data.gouv.fr'),'La source du fallback doit rester explicite');

const candidates=[
 {valeurfonc:'205000',sbati:'82',libtypbien:'UN APPARTEMENT',codtypbien:'121',datemut:'2026-01-10'},
 {valeurfonc:'214000',sbati:'85',libtypbien:'UN APPARTEMENT',codtypbien:'121',datemut:'2025-11-03'},
 {valeurfonc:'198000',sbati:'80',libtypbien:'UN APPARTEMENT',codtypbien:'121',datemut:'2025-06-20'},
 {valeurfonc:'550000',sbati:'180',libtypbien:'UNE MAISON',codtypbien:'111',datemut:'2026-02-01'}
];
const comps=selectOfficialComparables(candidates,analysis.property);
assert.equal(comps.length,3,'Les comparables doivent respecter le type et une surface proche');
assert.ok(comps.every(c=>c.type==='DVF'&&c.source.includes('Cerema')),'Les DVF affichées doivent venir de la source officielle');
const market=applyOfficialMarketData({
 property:{surface_m2:83.44,title:'Appartement T4',asking_price:300000},
 market:{estimate_low:300000,estimate_high:400000,offer_low:280000,offer_high:290000,analysis:'Fourchette IA contradictoire'}
},candidates);
assert.equal(market.market.comparables.length,3,'Les comparables IA non vérifiés doivent être remplacés par les DVF officielles');
assert.ok(market.market.estimate_low&&market.market.estimate_high,'Une fourchette DVF doit pouvoir être calculée');
assert.equal(market.market.estimate_low,market.market.dvf_reference.low,'La borne basse affichée doit venir du calcul DVF déterministe');
assert.equal(market.market.estimate_high,market.market.dvf_reference.high,'La borne haute affichée doit venir du calcul DVF déterministe');
assert.equal(market.market.offer_low,null,'Aucun montant d’offre automatique ne doit survivre au recalage DVF');
assert.equal(market.market.offer_high,null,'Aucun montant d’offre automatique ne doit survivre au recalage DVF');
assert.ok(market.market.analysis.includes('ventes DVF'),'Le commentaire marché doit être recalculé à partir des ventes vérifiées');
assert.ok(!market.market.analysis.includes('contradictoire'),'Le commentaire IA contradictoire doit être écrasé');

const bimodalPms=[1844,1950,1948,2182,2451,2513,2531,2557,2699,3295,3518,3560,2400,2600,2300];
const bimodalCandidates=bimodalPms.map((pm,i)=>({
 valeurfonc:Math.round(pm*83),sbati:83,libtypbien:'APPARTEMENT',codtypbien:'121',datemut:`2025-${String((i%12)+1).padStart(2,'0')}-15`,
 distance_m:50+i*30,rooms:4,id_mutation:`b-${i}`,source:'data.gouv.fr — DVF Etalab',address:`${i+1} RUE TEST`
}));
const robustMarket=applyOfficialMarketData({property:{surface_m2:83.44,rooms:4,title:'Appartement T4'},market:{}},bimodalCandidates);
assert.equal(robustMarket.market.dvf_reference.sample_count,15,'Le marché doit utiliser un échantillon élargi, pas seulement cinq ventes');
assert.ok(robustMarket.market.estimate_high/robustMarket.market.estimate_low<1.4,'Une dispersion bimodale ne doit pas créer une fourchette inutilisable');
assert.ok(robustMarket.market.estimate_high<250000,'Les ventes hautes doivent rester du contexte et ne pas étirer la borne centrale');
assert.equal(robustMarket.market.confidence,'moyenne','Une forte dispersion doit abaisser la confiance marché');
const noAskingMarketScore=deterministicScores({
 risk_flags:{},property:{surface_m2:83.44,rooms:4,dpe:'B',diagnostics:['DPE B','Électricité']},
 copro_metrics:{annual_budget:100000,collective_arrears:3000},
 market:robustMarket.market
},[...fakeDocs],{officialCount:5});
assert.equal(noAskingMarketScore.market,null,'Sans prix affiché à comparer, le marché ne doit pas recevoir de score');

const mixedUpload=partitionUploadDocuments([
 {index:0,name:'diagnostics.pdf',text:'Diagnostic exploitable. '.repeat(20),quality:'ok',pages:3},
 {index:1,name:'plan.pdf',text:'x',quality:'failed',pages:1}
]);
assert.equal(mixedUpload.accepted.length,1,'Un PDF illisible ne doit pas bloquer les autres documents du lot');
assert.equal(mixedUpload.rejected.length,1,'Le PDF illisible doit être signalé séparément');
assert.equal(mixedUpload.accepted[0].name,'diagnostics.pdf');
assert.equal(mixedUpload.rejected[0].name,'plan.pdf');
assert.equal(mixedUpload.rejected[0].accepted,false);

const readableGraphicalPlan=partitionUploadDocuments([{
  index:0,name:'PLAN_APT_B12.pdf',text:'[DOCUMENT GRAPHIQUE] T3 62,3 m2',quality:'partial',pages:1,weakPages:1,
  documentKind:'graphical',extractedChars:24
}]);
assert.equal(readableGraphicalPlan.accepted.length,1,'Un plan avec un peu de texte OCR réellement détecté doit rester exploitable comme référence graphique');
assert.equal(readableGraphicalPlan.accepted[0].documentKind,'graphical');
assert.equal(readableGraphicalPlan.accepted[0].quality,'partial');

const unreadableGraphicalPlan=partitionUploadDocuments([{
  index:0,name:'PLAN_APT_B12.pdf',text:'x',quality:'failed',pages:1,weakPages:1,
  documentKind:'graphical',extractedChars:1
}]);
assert.equal(unreadableGraphicalPlan.accepted.length,0,'Un plan sans texte réellement détecté ne doit pas être déclaré exploitable');
assert.equal(unreadableGraphicalPlan.rejected.length,1);

console.log('ReVisite reliability tests: OK');

const compact=prepareDocs(many,{maxTotal:180000,maxDoc:30000});
assert.ok(compact.reduce((s,d)=>s+d.chars_transmitted,0)<=180000,'Le mode compact doit réduire fortement le contexte');
