AvantOffre — Bêta exploitable

Fonctions prévues dans cette bêta :
- URL d'annonce immobilière
- adresse exacte du bien pour l'analyse micro-secteur
- dépôt de plusieurs PDF non classés
- extraction du texte PDF dans le navigateur
- analyse Bien / Prix / Copropriété
- recherche web du micro-secteur via le moteur IA, avec priorité aux ventes DVF/DVF+ officielles
- séparation faits / inférences / inconnues
- travaux votés / PPPT / ASL distingués
- scoring déterministe Bien / Copropriété / Couverture documentaire
- rendement brut si prix et loyer sont identifiés
- questions à vérifier avant l'offre

Déploiement :
- frontend statique + fonction Netlify asynchrone /api/analyze-background et suivi /api/analyze-status
- secret requis sur Netlify : OPENAI_API_KEY
- modèle par défaut : gpt-5.6-luna

Limite connue bêta :
- les PDF purement scannés sans couche texte peuvent être partiellement illisibles.

Dernière relance de déploiement : après passage au plan Netlify Personal.
