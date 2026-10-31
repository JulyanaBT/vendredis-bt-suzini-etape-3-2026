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

### Règlement bilingue et vérification FFT (31 octobre 2026)

Infos comprend désormais l’onglet Règlement : résumé et version complète en français / portugais du Brésil, sur le modèle des sélecteurs du TSCK. Le contenu éditorial est dans `assets/js/regulations-content.js` (22 sections par langue). Les règles retenues sont le format 3 hors finales (deux manches à 4 jeux, tie-break à 4–4) et le format 4 pour les finales (deux manches à 6 jeux, tie-break à 6–6), avec point décisif et super tie-break à 10 points en cas d’égalité à une manche partout.

La comparaison aux règlements FFT 2027, articles 209–214 et 224–232 et règles du jeu, ainsi qu’au guide FFT de juin 2026 toujours référencé sur la page fédérale, a révélé des points à régler avant validation sportive : minimum 4 paires par épreuve homologuée ; poids minimum 120 ; clôture générale à J−10 et encadrement d’un complément jusqu’au 4 novembre ; repos d’au moins 30 min en format 3 et 1 h en format 4 ; guide demandant 3 matchs programmés par paire alors que TS1 n’en aurait que deux à 7 ; finale format 4 à traiter pour la formule poule unique. Classements d’octobre à actualiser ou confirmer selon publication applicable.

Le document reste un projet explicitement signalé en attendant ces validations. Les horaires à cadence fixe de la première simulation ne sont plus présentés publiquement comme des convocations : le programme conserve l’ordre et les terrains à titre indicatif, avec horaires à confirmer. Le moteur de simulation n’est pas encore un planning homologué intégrant les durées réelles et tous les repos réglementaires.

Décision validée : minimum quatre équipes par tableau. À moins de quatre à la clôture, annulation de l’épreuve concernée, sans formule amicale à trois. Validation et tirage Club bloqués sous ce minimum.

Décision du JA Jules PARISIS : à sept équipes, maintien de l’exemption de TS1 avec deux matchs, trois pour les six autres paires. La réserve relative au minimum de trois matchs du guide FFT reste documentée dans le règlement complet ; cette validation locale ne vaut pas dérogation fédérale.

Décision du JA : tous les matchs de poule, y compris TS1–TS2 en poule unique et la poule de classement 5–7, restent au format 3. Le format 4 ne concerne que la finale d’une phase finale distincte.

Repos confirmé : 30 minutes minimum pour une même paire entre matchs au format 3, distinctes des 5 minutes de rotation du terrain. Le règlement mentionne une réduction seulement dans les cas expressément permis par les textes FFT, avec accord des deux équipes et validation du JA ; pas de dérogation générale fondée sur le seul accord des joueurs.

Décision du JA : clôture générale locale le 4 novembre à minuit, heure de Guyane, soit le 5 novembre 2026 à 00:00:00−03:00 (03:00 UTC). Aucune nouvelle inscription ensuite, même pour compléter le tableau. Le délai fédéral J−10 reste signalé comme réserve, sans présenter cette décision locale comme une dérogation fédérale.
