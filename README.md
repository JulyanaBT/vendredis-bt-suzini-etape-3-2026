# Les Vendredis du BT Suzini — Étape 3

Version de préparation du tournoi du vendredi 6 novembre 2026 au TC Suzini.
Double dames et double hommes, BT250. Début à 18 h. 10 € par joueur (20 € par équipe). Clôture des inscriptions le 4 novembre 2026.

Architecture reprise du dépôt JulyanaBT/tsck-open-juin-2026. Actualisation en mode application et logo Suzini repris de la version locale Octobre Rose. Les autres améliorations métier d’Octobre Rose restent à sélectionner et porter.

## Prévisualisation

`python3 -m http.server 8893 --bind 127.0.0.1`

Ouvrir http://127.0.0.1:8893.

## État fonctionnel

Navigation publique, sélection de l’épreuve, contenu de présentation et manifeste d’application disponibles. Les 26 pages de l’architecture TSCK sont conservées. Firebase est retiré. Le module Supabase utilise le projet existant et un nouvel événement 20261106-0000-4000-8000-000000000003. Les équipes BT250 sont dans une table distincte, protégée par RLS ; les RPC publics ne révèlent ni licence ni téléphone. Les inscriptions démarrent fermées. Le formulaire ne nécessite pas de compte joueur.

Appliquer supabase/migrations/001_etape3.sql au projet existant une seule fois. Ne pas rejouer les migrations Octobre Rose. Les accès organisateurs, le tirage, la programmation et les résultats restent à porter vers Supabase. Ajouter le contact organisateur et confirmer les détails de restauration. Hébergement GitHub Pages depuis la branche main, dossier racine.
