<?php
// ============================================================
//  RÉGLAGES DE LA PLATEFORME HERITAGE INT
//  Copiez ce fichier en config.php puis remplissez-le.
//  Les mots de passe ne sont jamais écrits en clair : on stocke leur empreinte.
//  Pour créer une empreinte : hPanel > Avancé > PHP, ou en ligne de commande :
//     php -r 'echo password_hash("VotreMotDePasse", PASSWORD_DEFAULT);'
// ============================================================

// Compte administrateur (vue 360 : professionnels, abonnements, CA, rentabilité)
const ADMIN_LOGIN = 'admin';
const ADMIN_PASS_HASH = '';

// Compte professionnel secondaire, gratuit et complet (vos propres clients)
const OWNER_PRO_LOGIN = 'heritage';
const OWNER_PRO_EMAIL = 'contact@heritageint.fr';
const OWNER_PRO_PASS_HASH = '';
const OWNER_PRO_SLUG = 'heritage-int';

// Adresse publique de la plateforme, sans / final (liens dans les e-mail)
const SITE_URL = 'https://heritageint.fr/app';

// Alertes e-mail : expéditeur (une adresse de VOTRE domaine) et copie admin
const MAIL_FROM = 'contact@heritageint.fr';
const ADMIN_NOTIFY_EMAIL = 'contact@heritageint.fr';

// Essai gratuit pour les nouveaux professionnels (jours)
const TRIAL_DAYS = 14;

// Stripe (facultatif) : secret du webhook, fourni par Stripe > Développeurs > Webhooks
const STRIPE_WEBHOOK_SECRET = '';