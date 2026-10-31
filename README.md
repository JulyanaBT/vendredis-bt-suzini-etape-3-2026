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

### Programme des doubles (étape 3)

Chaque tableau accepte au maximum 8 équipes. Un verrou sur l’événement protège les inscriptions concurrentes, y compris les changements d’épreuve dans le Club. Le Club valide séparément le format hommes et dames dans Programme, une fois les inscriptions closes (ou après la date limite). Tout changement d’effectif ou réouverture avant tirage annule la validation.

Tirage disponible à partir du 5 novembre 2026 à 14 h en Guyane (17 h UTC). Il enregistre un tirage avec placement des têtes de série : poule unique à 3–5, 3+3 à 6 ; à 7 et 8, ordre des quarts dans draw_order. TS1 et TS2 sont les deux meilleurs totaux des classements individuels (plus faible = meilleur), avec tirage au sort pour départager les totaux égaux. Tous les classements doivent être renseignés. À 3–5, TS1/TS2 jouent le dernier match ; à 6, poules séparées ; à 7–8, TS2 en haut (première position), TS1 en bas (dernière position). À 7, TS1 est exemptée de quart. Un seul tirage par tableau ; les équipes du tableau sont ensuite verrouillées. Le programme public affiche les formats et les repères avant tirage, puis les noms d’équipes tirées. Les rencontres finales restent exprimées par leurs qualifications jusqu’aux résultats des poules.

Terrains repris d’Octobre Rose : hommes sur 🐝 Manon Queen Bee (jaune), dames sur 🌶️ Lisa de los pimentos (corail). Créneaux prévisionnels de 30 minutes à partir de 18 h en Guyane : 25 minutes de match et 5 minutes de transition. Le dernier match se termine 25 minutes après son départ, sans transition ajoutée en fin de tournoi. À 7 équipes : 10 matchs, fin à 22 h 55 ; à 8 équipes : 12 matchs, fin à 23 h 55, sur un terrain par tableau. Dès qu’un tableau est terminé, son terrain est réaffecté à l’autre. Le planning respecte les dépendances des matchs et évite de programmer une équipe deux fois dans le même créneau. Les règles de départage, le format des matchs et la saisie des résultats restent à définir.

Vérifications : `node tests/tournament-format.test.mjs` ; `tests/programme.sql` (session SQL administrative, transaction annulée en fin de test).
