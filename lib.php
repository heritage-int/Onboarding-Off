<?php
// Heritage Int — plateforme : base de données, sécurité, règles de calcul communes
declare(strict_types=1);
require __DIR__ . '/config.php';

const DATA_DIR = __DIR__ . '/data';
const DB_FILE = DATA_DIR . '/heritage.sqlite';

/* ---------------- Réponses ---------------- */
function out($data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400): void { out(['error' => $msg], $code); }
function body(): array { $j = json_decode(file_get_contents('php://input', false, null, 0, 600000) ?: '[]', true); return is_array($j) ? $j : []; }
function now(): string { return gmdate('Y-m-d H:i:s'); }
function jdec(?string $s, $def = []) { $v = $s ? json_decode($s, true) : null; return $v ?? $def; }
function jenc($v): string { return json_encode($v, JSON_UNESCAPED_UNICODE); }

/** Nettoie récursivement les données envoyées par le navigateur. */
function clean($v, int $depth = 0) {
  if ($depth > 8) return null;
  if (is_array($v)) { $o = []; $n = 0; foreach ($v as $k => $x) { if ($n++ > 400) break; $o[is_int($k) ? $k : mb_substr((string)$k, 0, 80)] = clean($x, $depth + 1); } return $o; }
  if (is_string($v)) return mb_substr($v, 0, 4000);
  if (is_int($v) || is_float($v) || is_bool($v) || $v === null) return $v;
  return null;
}

/* ---------------- Base de données ---------------- */
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0750, true);
  if (!file_exists(DATA_DIR . '/.htaccess')) @file_put_contents(DATA_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
  $pdo = new PDO('sqlite:' . DB_FILE);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  migrate($pdo);
  return $pdo;
}
function q(string $sql, array $p = []): PDOStatement { $s = db()->prepare($sql); $s->execute($p); return $s; }
function one(string $sql, array $p = []) { return q($sql, $p)->fetch() ?: null; }
function all(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }

function migrate(PDO $pdo): void {
  $pdo->exec("
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('admin','pro','client')),
    login TEXT NOT NULL UNIQUE, email TEXT, name TEXT, pass TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, last_login TEXT);
  CREATE TABLE IF NOT EXISTS pros(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE, company TEXT NOT NULL, activity TEXT, profile TEXT, catalogue TEXT, settings TEXT,
    plan TEXT NOT NULL DEFAULT 'pro', plan_status TEXT NOT NULL DEFAULT 'trial', trial_end TEXT, plan_since TEXT,
    free INTEGER NOT NULL DEFAULT 0, stripe_customer TEXT, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, pro_id INTEGER NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE, data TEXT NOT NULL,
    total_eur REAL NOT NULL DEFAULT 0, devise TEXT, total_devise REAL, statut TEXT NOT NULL DEFAULT 'Nouveau',
    lu INTEGER NOT NULL DEFAULT 0, lu_at TEXT, message_pro TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS req_pro ON requests(pro_id); CREATE INDEX IF NOT EXISTS req_client ON requests(client_id);
  CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, pro_id INTEGER NOT NULL REFERENCES pros(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY, pro_id INTEGER REFERENCES pros(id) ON DELETE SET NULL,
    amount REAL NOT NULL, kind TEXT NOT NULL, label TEXT, source TEXT NOT NULL, ref TEXT UNIQUE, paid_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS attempts(key TEXT NOT NULL, at INTEGER NOT NULL);
  ");
  seed($pdo);
}

/* ---------------- Réglages par défaut ---------------- */
function default_settings(): array {
  return [
    'plans' => [
      'essentiel' => ['nom' => 'Essentiel', 'prix' => 29, 'desc' => '1 activité, page client, alertes e-mail', 'lien' => ''],
      'pro' => ['nom' => 'Pro', 'prix' => 59, 'desc' => 'Activités et pays illimités, suivi client, export', 'lien' => ''],
      'signature' => ['nom' => 'Signature', 'prix' => 99, 'desc' => 'Votre domaine, plusieurs utilisateurs, accompagnement', 'lien' => ''],
    ],
    'mise_en_place' => 290,
    'charges' => [['nom' => 'Hébergement et base de données', 'montant' => 45], ['nom' => 'Nom de domaine et e-mails', 'montant' => 5]],
    'rates' => ['EUR' => 1, 'CNY' => 7.7, 'QAR' => 3.95, 'USD' => 1.08, 'AED' => 3.97, 'GBP' => 0.85, 'CHF' => 0.94],
  ];
}
function setting(string $k) { $r = one('SELECT v FROM settings WHERE k = ?', [$k]); return $r ? jdec($r['v']) : (default_settings()[$k] ?? null); }
function set_setting(string $k, $v): void { q('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [$k, jenc($v)]); }

/* ---------------- Catalogues de départ ---------------- */
function default_countries(): array { return [['code' => 'fr', 'nom' => 'France', 'devise' => 'EUR'], ['code' => 'cn', 'nom' => 'Chine', 'devise' => 'CNY'], ['code' => 'qa', 'nom' => 'Qatar', 'devise' => 'QAR']]; }
function uid(): string { return substr(bin2hex(random_bytes(6)), 0, 10); }
function f(string $nom, string $desc, int $eur, array $taches = [], string $calc = 'forfait'): array {
  return ['id' => uid(), 'nom' => $nom, 'desc' => $desc, 'calc' => $calc, 'taches' => $taches, 'prix' => ['fr' => $eur, 'cn' => $eur, 'qa' => $eur]];
}
function svc(string $nom, string $desc, array $formules, string $mode = 'formules'): array { return ['id' => uid(), 'nom' => $nom, 'desc' => $desc, 'mode' => $mode, 'formules' => $formules]; }
function preset_catalogue(string $activity): array {
  switch ($activity) {
    case 'heritage': return [
      svc('Event Design', 'Lancements, soirées privées, événements de marque et réceptions.', [
        f('Moodboard Express', '1 planche, palette, 10 références', 450, ['Délai : 3 jours', '1 série de modifications']),
        f('Concept créatif', 'Note de concept, 2 planches, liste de matières', 1200, ['Délai : 7 jours', '2 séries de modifications']),
        f('Dossier technique', "Plans d'implantation, listes, fiches prestataires (PDF)", 1800, ['Délai : 10 jours', '2 séries de modifications']),
        f('Direction artistique', 'Suivi à distance de la réalisation', 3500, ['Durée : 4 semaines', '2 séries de modifications'])]),
      svc('Wedding Design', 'Conception artistique de mariages et cérémonies.', [
        f('Moodboard Express', '1 planche, palette, 10 références', 450, ['Délai : 3 jours', '1 série de modifications']),
        f('Concept créatif', 'Concept, 2 planches, liste de matières', 1200, ['Délai : 7 jours', '2 séries de modifications']),
        f('Conception complète', 'Concept, plans, dossier technique, suivi', 6500, ['Durée : 6 semaines', '3 séries de modifications'])]),
      svc('Gastronomic Experiences', 'Menus, arts de la table et scénographie culinaire.', [
        f('Expérience gastronomique', 'Concept de menu, arts de la table, scénographie', 1500, ['Délai : 10 jours', '2 séries de modifications'])])];
    case 'planner': return [
      svc('Wedding planning', 'Organisation et coordination de mariages.', [
        f('Coordination du jour J', 'Prise en main 2 mois avant, présence le jour J', 1500), f('Organisation partielle', 'À partir de 6 mois avant', 3200), f('Organisation complète', 'De la recherche du lieu au jour J', 5800)]),
      svc('Options', 'À ajouter à votre formule.', [f('Répétition de la cérémonie', 'La veille, 2 h', 350), f('Coordinateur supplémentaire', 'Par invité au-delà de 120', 4, [], 'parPers')], 'options')];
    case 'traiteur': return [
      svc('Menu', 'Prix par convive.', [f('Cocktail dînatoire', '12 pièces par personne', 38, [], 'parPers'), f('Dîner 3 temps', 'Entrée, plat, dessert', 55, [], 'parPers'), f('Dîner gastronomique', '5 temps, accords', 95, [], 'parPers')]),
      svc('Service', 'Équipe et matériel.', [f('Service à table', 'Personnel de salle, par convive', 18, [], 'parPers'), f('Vaisselle et verrerie', 'Par convive', 6, [], 'parPers'), f('Fiche technique', 'Recettes, grammages, déroulé', 180)], 'options')];
    case 'lieu': return [
      svc('Location', 'Accès au lieu.', [f('Journée', 'De 10 h à 4 h', 4500), f('Week-end', 'Du vendredi au dimanche', 9000), f('Soirée', 'De 18 h à 2 h', 2800)]),
      svc('Options', '', [f('Brunch du lendemain', 'Par invité', 28, [], 'parPers'), f('Mobilier extérieur', 'Tables, chaises, mange-debout', 800)], 'options')];
    case 'agence': return [
      svc('Conception', 'Concept, scénographie, production.', [f('Concept et scénographie', 'Dossier créatif', 2500), f('Conception + coordination', 'Partenaires et pilotage', 5200), f('Clés en main', 'Production et pilotage jour J', 12000)]),
      svc('Production', '', [f('Son et lumière', 'Régie technique', 1800), f('Restauration', 'Cocktail par invité', 45, [], 'parPers')], 'options')];
    default: return [svc('Mes prestations', 'Décrivez votre activité.', [f('Formule 1', 'À personnaliser', 0)])];
  }
}
function default_pro_settings(): array {
  return ['countries' => default_countries(), 'coefRenf' => 1.2, 'coefEtude' => 1.4, 'seuil' => 250,
    'contraintes' => ['Lieu sans cuisine équipée', 'Plusieurs sites ou lieux', 'Matériel ou décor à importer', 'Événement en extérieur', 'Régimes alimentaires stricts']];
}

function seed(PDO $pdo): void {
  $has = $pdo->prepare('SELECT id FROM users WHERE login = ?');
  if (ADMIN_PASS_HASH) { $has->execute([strtolower(ADMIN_LOGIN)]); if (!$has->fetch())
    $pdo->prepare('INSERT INTO users(role,login,email,name,pass,created_at) VALUES(\'admin\',?,?,?,?,?)')->execute([strtolower(ADMIN_LOGIN), ADMIN_NOTIFY_EMAIL, 'Administratrice Heritage Int', ADMIN_PASS_HASH, now()]); }
  if (OWNER_PRO_PASS_HASH) { $has->execute([strtolower(OWNER_PRO_LOGIN)]); if (!$has->fetch()) {
    $pdo->prepare('INSERT INTO users(role,login,email,name,pass,created_at) VALUES(\'pro\',?,?,?,?,?)')->execute([strtolower(OWNER_PRO_LOGIN), OWNER_PRO_EMAIL, 'Heritage Int', OWNER_PRO_PASS_HASH, now()]);
    $id = (int)$pdo->lastInsertId();
    $profile = ['couleur' => '#1f1b16', 'accent' => '#8a6d3b', 'titre' => "L'art de recevoir, entre deux mondes", 'intro' => 'Event design, wedding design et expériences gastronomiques conçus à distance depuis la France.', 'contact' => OWNER_PRO_EMAIL, 'merci' => 'Merci ! Nous revenons vers vous sous 2 jours ouvrés.'];
    $pdo->prepare('INSERT INTO pros(user_id,slug,company,activity,profile,catalogue,settings,plan,plan_status,free,plan_since,created_at) VALUES(?,?,?,?,?,?,?,\'signature\',\'free\',1,?,?)')
      ->execute([$id, OWNER_PRO_SLUG, 'Heritage Int', 'heritage', jenc($profile), jenc(preset_catalogue('heritage')), jenc(default_pro_settings()), now(), now()]);
  } }
}

/* ---------------- Sessions, sécurité ---------------- */
function start_session(): void {
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
  session_name('heritage_session'); session_start();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
function me(): ?array {
  if (empty($_SESSION['uid'])) return null;
  $u = one('SELECT id, role, login, email, name, active FROM users WHERE id = ?', [$_SESSION['uid']]);
  if (!$u || !$u['active']) { $_SESSION = []; return null; }
  return $u;
}
function need(string ...$roles): array { $u = me(); if (!$u) fail('Connectez-vous pour continuer.', 401); if ($roles && !in_array($u['role'], $roles, true)) fail('Accès refusé.', 403); return $u; }
function my_pro(array $u): array { $p = one('SELECT * FROM pros WHERE user_id = ?', [$u['id']]); if (!$p) fail('Espace professionnel introuvable.', 404); return $p; }
function too_many(string $key, int $max, int $window): bool {
  $k = hash('sha256', $key . ($_SERVER['REMOTE_ADDR'] ?? '')); $t = time();
  q('DELETE FROM attempts WHERE at < ?', [$t - 86400]);
  $n = (int)one('SELECT COUNT(*) n FROM attempts WHERE key = ? AND at > ?', [$k, $t - $window])['n'];
  if ($n >= $max) return true; q('INSERT INTO attempts(key,at) VALUES(?,?)', [$k, $t]); return false;
}
function pro_is_open(array $p): bool {
  if ($p['free'] || $p['plan_status'] === 'active') return true;
  return $p['plan_status'] === 'trial' && $p['trial_end'] && $p['trial_end'] >= gmdate('Y-m-d');
}

/* ---------------- Calcul de l'estimation (identique au navigateur) ---------------- */
function estimate(array $pro, array $d): array {
  $st = jdec($pro['settings'], default_pro_settings()); $cat = jdec($pro['catalogue']);
  $countries = $st['countries'] ?? default_countries(); $country = $countries[0];
  foreach ($countries as $c) if (($c['code'] ?? '') === ($d['pays'] ?? '')) $country = $c;
  $code = $country['code']; $inv = max(0, (int)($d['invites'] ?? 0)); $lines = [];
  foreach ($cat as $s) {
    $sel = $d['choix'][$s['id']] ?? null; $ids = is_array($sel) ? $sel : ($sel ? [$sel] : []);
    foreach ($s['formules'] as $fo) if (in_array($fo['id'], $ids, true)) {
      $pu = (float)($fo['prix'][$code] ?? 0); $qty = ($fo['calc'] ?? 'forfait') === 'parPers' ? $inv : 1;
      $lines[] = ['t' => $s['nom'] . ' — ' . $fo['nom'], 'm' => $pu * $qty, 'qty' => $qty, 'pu' => $pu, 'calc' => $fo['calc'] ?? 'forfait', 'taches' => $fo['taches'] ?? []];
    }
  }
  $pts = 0; $why = [];
  if (!empty($d['date'])) { $m = (strtotime($d['date']) - time()) / 2629800; if ($m < 3) { $pts += 2; $why[] = 'délai de moins de 3 mois'; } elseif ($m < 6) { $pts += 1; $why[] = 'délai de 3 à 6 mois'; } }
  if ($inv > (int)($st['seuil'] ?? 250)) { $pts++; $why[] = 'grand nombre d\'invités'; }
  $nc = count($d['contraintes'] ?? []); if ($nc >= 3) { $pts += 2; $why[] = "$nc contraintes"; } elseif ($nc) { $pts++; $why[] = $nc > 1 ? "$nc contraintes" : '1 contrainte'; }
  $k = $pts >= 2 ? 'etu' : ($pts === 1 ? 'ren' : 'std');
  $mult = $k === 'etu' ? (float)($st['coefEtude'] ?? 1.4) : ($k === 'ren' ? (float)($st['coefRenf'] ?? 1.2) : 1.0);
  $base = array_sum(array_column($lines, 'm')); $total = $base * $mult;
  $rates = setting('rates'); $cur = $country['devise'] ?? 'EUR'; $rate = (float)($rates[$cur] ?? 1);
  return ['lines' => $lines, 'base' => $base, 'mult' => $mult, 'faisabilite' => $k, 'why' => $why, 'total_eur' => round($total, 2),
    'devise' => $cur, 'total_devise' => $cur === 'EUR' ? round($total, 2) : round($total * $rate / 10) * 10, 'pays' => $country['nom']];
}
/** Score d'intérêt et catégorie, pour le tri du professionnel. */
function score(array $r): array {
  $d = jdec($r['data']); $s = 0;
  $s += ['devis' => 20, 'full' => 30][$d['intent'] ?? ''] ?? 0;
  $s += ['rapide' => 20, 'tard' => 10][$d['recontact'] ?? ''] ?? 0;
  $t = (float)$r['total_eur']; $s += $t >= 6000 ? 15 : ($t >= 3000 ? 10 : ($t >= 1000 ? 5 : 0));
  if (!empty($d['date'])) { $s += 5; $m = (strtotime($d['date']) - time()) / 2629800; if ($m > 0 && $m <= 12) $s += 5; }
  if ((int)($d['invites'] ?? 0) > 0) $s += 5;
  if (($d['decideur'] ?? '') === 'oui') $s += 5;
  $s = min(100, $s);
  $cat = (($d['recontact'] ?? '') === 'non' || $s < 30) ? 'info' : ($s < 60 ? 'devis' : 'full');
  return [$s, $cat];
}

/* ---------------- E-mails ---------------- */
function send_mail(?string $to, string $subject, string $text): void {
  if (!$to || !MAIL_FROM) return;
  $h = "Content-Type: text/plain; charset=UTF-8\r\nFrom: Heritage Int <" . MAIL_FROM . ">\r\n";
  @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $text, $h);
}