# Heritage Int — plateforme d'estimation et de suivi des demandes

Plateforme publique pour les professionnels de l'événement (wedding planners, traiteurs, lieux de réception, agences).
Chaque professionnel crée son compte, choisit un abonnement et obtient sa page client. Ses clients estiment leur projet
dans leur devise, créent leur compte et suivent leur demande. Heritage Int administre l'ensemble.

## Les trois espaces

| Espace | Qui | Ce qu'il voit |
|---|---|---|
| **Client** | Toute personne qui crée un compte client | Ses demandes uniquement : estimation, statut, messages du professionnel |
| **Professionnel** | Toute entreprise inscrite (essai gratuit puis abonnement) | Les demandes de **ses** clients uniquement, son catalogue et ses prix, sa page, son abonnement, son avis |
| **Administration 360** | Heritage Int (compte `admin`) | Tous les professionnels, leur formule et leur statut, leurs avis, les encaissements, le CA du jour, du mois et de l'année, le revenu récurrent, les charges et le résultat |

Un **compte professionnel offert** (`heritage`) permet à Heritage Int de gérer ses propres clients, avec un accès complet et gratuit.

Le cloisonnement est contrôlé côté serveur : un professionnel ne peut ni lire ni modifier la demande d'un autre, un client ne voit que les siennes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `assets/app.js`, `assets/app.css` | L'application (une seule page, tous les espaces) |
| `api.php` | Comptes, demandes, catalogues, abonnements, administration |
| `lib.php` | Base de données SQLite, sécurité, calcul des estimations |
| `stripe-webhook.php` | Réception des paiements Stripe (abonnements) |
| `config.example.php` | Modèle de réglages à copier en `config.php` |
| `.htaccess`, `data/.htaccess` | Protection des réglages et de la base de données |

## Installation (Hostinger ou tout hébergement PHP 8 avec SQLite)

1. Copiez `config.example.php` en `config.php`.
2. Créez l'empreinte de chaque mot de passe et collez-la dans `ADMIN_PASS_HASH` et `OWNER_PRO_PASS_HASH` :
	`php -r 'echo password_hash("VotreMotDePasse", PASSWORD_DEFAULT);'`
3. Envoyez le dossier dans `public_html/app/` (tous les fichiers, y compris les `.htaccess`).
4. Ouvrez `https://heritageint.fr/app/` : la base de données se crée toute seule avec les deux comptes de départ.
5. Vérifiez que `https://heritageint.fr/app/config.php` et `https://heritageint.fr/app/data/heritage.sqlite` affichent « Accès interdit ».

Page client de Heritage Int : `https://heritageint.fr/app/?p=heritage-int`

## Déploiement automatique GitHub → Hostinger

Le fichier `.github/workflows/deploy-hostinger.yml` met la plateforme en ligne à chaque envoi sur `main` :
il crée `config.php` à partir des secrets, envoie les fichiers par FTP dans `public_html/app/`, puis vérifie que
la plateforme répond et que `config.php` et la base de données sont protégés.

Secrets à créer dans **Settings → Secrets and variables → Actions** :

| Secret | Où le trouver |
|---|---|
| `FTP_SERVER` | hPanel → Fichiers → Comptes FTP (adresse du serveur FTP) |
| `FTP_USERNAME` | hPanel → Fichiers → Comptes FTP |
| `FTP_PASSWORD` | Mot de passe du compte FTP (modifiable dans hPanel) |
| `ADMIN_PASS_HASH` | Empreinte du mot de passe admin (commence par `$2y$`) |
| `OWNER_PRO_PASS_HASH` | Empreinte du mot de passe du compte `heritage` |
| `STRIPE_WEBHOOK_SECRET` | Facultatif : Stripe → Développeurs → Webhooks |

Variables facultatives (onglet **Variables**) : `FTP_DIR` (défaut `public_html/app/`), `SITE_URL` (défaut `https://heritageint.fr/app`).
Le déploiement n'efface jamais la base de données (`data/*.sqlite`) déjà présente sur Hostinger.

## Tester sur GitHub avant Hostinger (Codespaces)

1. Sur la page du dépôt : **Code → Codespaces → Create codespace on main**.
2. Dans le terminal : `bash demarrer-codespace.sh`, puis saisissez les deux mots de passe (ils ne sont pas affichés).
3. Onglet **PORTS** → lien du port **8080** : la plateforme s'ouvre. Le test reste privé et s'arrête avec le Codespace.

## Paiement des abonnements (Stripe)

1. Dans Stripe, créez un produit récurrent mensuel par formule (Essentiel, Pro, Signature) et un **lien de paiement** pour chacun.
2. Collez les liens dans **Administration 360 → Abonnements et charges**.
3. Dans Stripe → Développeurs → Webhooks, ajoutez `https://heritageint.fr/app/stripe-webhook.php` avec les événements
	`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`,
	puis collez le secret `whsec_…` dans `config.php` (`STRIPE_WEBHOOK_SECRET`).

Chaque paiement Stripe active l'abonnement du professionnel et s'ajoute automatiquement au chiffre d'affaires.
Les virements et frais de mise en place s'ajoutent à la main dans **Paiements et CA**.

## Sécurité

- Mots de passe stockés uniquement sous forme d'empreinte (`password_hash`), 10 caractères minimum pour les nouveaux comptes.
- Protection contre les envois d'un autre site (jeton CSRF), limitation des tentatives de connexion et d'inscription.
- `config.php` et la base `data/*.sqlite` sont exclus de GitHub par `.gitignore`. Gardez le dépôt **privé**.
- Sauvegardez régulièrement `data/heritage.sqlite` (téléchargement depuis le gestionnaire de fichiers).
- GitHub Pages ne fait pas fonctionner PHP : hébergez la plateforme chez un hébergeur PHP.