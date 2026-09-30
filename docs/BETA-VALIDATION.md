# ReVisite — validation de la bêta, 30 septembre 2026

Version de test : https://deploy-preview-10--revisite-demo.netlify.app/

## Contrôles de publication

- `npm run build` : tests de fiabilité et génération du site.
- Lecture des pages scannées sans ancienne limite de 10 pages.
- DPE : lecture de l'étiquette mesurée, exclusion des mentions générales F/G, réserve explicite si le document indique une absence de numéro ADEME et sa non-validité.
- Une absence de pièce ne devient pas un défaut pénalisant du bien.
- Les rapports partagés sont conservés indépendamment des déploiements, y compris les réponses réutilisées du cache.
- Un texte dépassant la limite de 480 000 caractères est signalé comme partiel.
- Rapport synthétique : trois thèmes, trois actions au maximum, détails dépliables.

## Test de référence

Le PDF scanné de 74 pages fourni par le porteur du projet a été lu par le code d'extraction : 74 pages OCR, aucune page faible, 135 101 caractères utiles. Les données personnelles et le document ne sont pas inclus dans le dépôt.

Parcours navigateur terminé : import, OCR des 74 pages, analyse en un appel sans mode dégradé, génération et ouverture du rapport partagé. Une page pauvre en texte est signalée par l’OCR du navigateur ; 136 704 caractères ont été transmis sans coupe. La classe graphique n’a pas été reconnue avec certitude dans ce parcours : elle reste à confirmer ; les valeurs 143/25 et la non-validité sont reconnues.

Valeurs retrouvées lors du contrôle local : classe affichée C, consommation 143, émissions 25 ; le document porte aussi une réserve de validité. Cette réserve doit être visible et empêcher la note du logement. La surface habitable ne doit pas être rebaptisée Carrez.

## Campagne de tests utilisateurs

Pour chaque dossier, conserver le lien du rapport et relever :

1. Pièces envoyées et éventuels refus/lectures partielles.
2. Prix, surface et nature de la surface, DPE et date : comparaison avec les pièces.
3. Charges annuelles, décisions d'AG, travaux votés : montant collectif ou montant du lot clairement distingué.
4. Trois points à retenir compris sans explication orale.
5. Ouverture du lien partagé dans un autre navigateur et lisibilité sur téléphone.

Noter un échec avec le nom du document, la page, le résultat attendu et le résultat obtenu. Une erreur sur prix, DPE, surface, travaux ou leur attribution bloque l'élargissement de la campagne.

## Limites de cette livraison

- Bêta pour une campagne progressive ; pas de certification de charge simultanée.
- Jusqu'à 30 fichiers et 100 Mo par dossier ; laisser l'onglet ouvert pendant l'OCR.
- Les quotas par défaut du code sont 50 analyses/jour au total et 10 par adresse IP, configurables sur Netlify. Ce sont des protections de bêta, pas une garantie de débit.
- Les synthèses intermédiaires de documents très longs sont couvertes par les tests automatiques ; elles ne garantissent pas la restitution de chaque détail.
- Le nouveau test du DDT ne vaut pas relecture des neuf autres pièces de l'ancien rapport.
- Les anciens rapports ne sont pas régénérés par une mise à jour du site : relancer une analyse pour bénéficier de la nouvelle extraction.
