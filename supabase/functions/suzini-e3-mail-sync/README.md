# Synchronisation des paiements — étape 3

Dans Club → Inscription, ouvrir « Synchronisation SumUp ». Un administrateur renseigne le libellé exact de l’article de la boutique et un mot de passe d’appareil Infomaniak dédié à contact@julyanabt.fr, puis autorise la lecture. Ne jamais enregistrer ce mot de passe dans Git ou dans une conversation. Il est stocké dans Supabase Vault et accessible seulement au traitement serveur.

Le cron appelle le traitement toutes les cinq minutes. La boîte INBOX est ouverte en lecture seule. Seuls les nouveaux mails depuis l’activation sont concernés. Le bouton Synchroniser permet une lecture immédiate. Suspendre arrête le cron sans supprimer l’historique.

Le rapprochement automatique exige une confirmation « Nouvelle commande », l’expéditeur SumUp, un résultat DKIM SumUp validé par le serveur de réception Infomaniak, l’article configuré, une unité à 10 €, et un nom correspondant à un seul joueur. Les mises en page ou preuves d’authenticité non reconnues restent à vérifier. Les paiements groupés de 20 €, les homonymes et les joueurs déjà payés nécessitent une attribution dans le Club. Un achat effectué au nom d’un tiers peut nécessiter une correction manuelle. Les annulations et remboursements se corrigent manuellement dans le Club.

La référence de commande empêche le double traitement. Les mails sans l’article configuré sont ignorés. Les messages ne sont ni supprimés ni marqués lus. Aucun accès au compte SumUp n’est utilisé.

Tests : `node tests/mail-parser.test.mjs`. Exécuter `tests/mail-sync.sql` via une session SQL administrative : les données de test sont annulées par ROLLBACK. La connexion IMAP et les en-têtes réels doivent encore être vérifiés après configuration du mot de passe dédié.
