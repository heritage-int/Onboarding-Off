<?php
// Heritage Int — API de la plateforme (clients, professionnels, administration)
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
start_session();
$a = $_GET['a'] ?? '';
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($post && !in_array($a, ['me'], true)) {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  // Hôtes acceptés : l'hôte direct et celui transmis par un proxy (ex. GitHub Codespaces)
  $hosts = array_filter([explode(':', $_SERVER['HTTP_HOST'] ?? '')[0], explode(':', explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '')[0])[0]]);
  if ($origin && !in_array(parse_url($origin, PHP_URL_HOST), $hosts, true)) fail('Origine refusée.', 403);
  if (!hash_equals($_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF'] ?? ''))) fail('Session expirée : rechargez la page.', 419);
}
$b = $post ? body() : [];
$STATUTS = ['Nouveau', 'Contacté', 'Rendez-vous fixé', 'Devis envoyé', 'Signé', 'Sans suite'];

function pro_public(array $p): array {
  return ['id' => (int)$p['id'], 'slug' => $p['slug'], 'company' => $p['company'], 'profile' => jdec($p['profile']),
    'catalogue' => jdec($p['catalogue']), 'settings' => jdec($p['settings'], default_pro_settings()), 'open' => pro_is_open($p)];
}
function pro_account(array $p): array {
  $plans = setting('plans');
  return pro_public($p) + ['activity' => $p['activity'], 'plan' => $p['plan'], 'plan_status' => $p['plan_status'], 'trial_end' => $p['trial_end'],
    'free' => (bool)$p['free'], 'plan_info' => $plans[$p['plan']] ?? null];
}
function req_row(array $r, bool $forPro): array {
  $o = ['id' => (int)$r['id'], 'code' => $r['code'], 'data' => jdec($r['data']), 'total_eur' => (float)$r['total_eur'], 'devise' => $r['devise'],
    'total_devise' => (float)$r['total_devise'], 'statut' => $r['statut'], 'lu' => (bool)$r['lu'], 'lu_at' => $r['lu_at'],
    'message_pro' => $r['message_pro'], 'created_at' => $r['created_at']];
  if ($forPro) { [$o['score'], $o['cat']] = score($r); $o['client'] = ['name' => $r['client_name'] ?? '', 'email' => $r['client_email'] ?? '']; }
  else { $o['company'] = $r['company'] ?? ''; $o['slug'] = $r['slug'] ?? ''; }
  return $o;
}
function slugify(string $s): string { $s = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s), '-')); return $s ?: 'pro'; }

switch ($a) {
/* ================= Public ================= */
case 'me':
  $u = me(); $o = ['csrf' => $_SESSION['csrf'], 'user' => $u, 'plans' => setting('plans'), 'trial_days' => TRIAL_DAYS];
  if ($u && $u['role'] === 'pro') $o['pro'] = pro_account(my_pro($u));
  out($o);

case 'register':
  if (too_many('register', 8, 3600)) fail('Trop d\'inscriptions depuis cette connexion. Réessayez dans une heure.', 429);
  $role = $b['role'] ?? ''; if (!in_array($role, ['client', 'pro'], true)) fail('Type de compte inconnu.');
  $email = strtolower(trim((string)($b['email'] ?? ''))); $pass = (string)($b['password'] ?? ''); $name = trim((string)($b['name'] ?? ''));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Adresse e-mail invalide.');
  if (mb_strlen($pass) < 10) fail('Le mot de passe doit contenir au moins 10 caractères.');
  if ($name === '') fail('Indiquez votre nom.');
  if (one('SELECT id FROM users WHERE login = ?', [$email])) fail('Un compte existe déjà avec cette adresse. Connectez-vous.');
  db()->beginTransaction();
  q('INSERT INTO users(role,login,email,name,pass,created_at) VALUES(?,?,?,?,?,?)', [$role, $email, $email, mb_substr($name, 0, 120), password_hash($pass, PASSWORD_DEFAULT), now()]);
  $uid = (int)db()->lastInsertId();
  if ($role === 'pro') {
    $company = trim((string)($b['company'] ?? '')); if ($company === '') { db()->rollBack(); fail('Indiquez le nom de votre entreprise.'); }
    $activity = in_array($b['activity'] ?? '', ['planner', 'traiteur', 'lieu', 'agence', 'autre'], true) ? $b['activity'] : 'autre';
    $plan = array_key_exists($b['plan'] ?? '', setting('plans')) ? $b['plan'] : 'pro';
    $slug = slugify($company); $base = $slug; $n = 2; while (one('SELECT id FROM pros WHERE slug = ?', [$slug])) $slug = $base . '-' . $n++;
    $profile = ['couleur' => '#1f1b16', 'accent' => '#8a6d3b', 'titre' => 'Estimez votre événement', 'intro' => 'Quelques questions, et vous obtenez tout de suite une estimation dans votre devise.', 'contact' => $email, 'merci' => 'Merci ! Nous revenons vers vous rapidement.'];
    q('INSERT INTO pros(user_id,slug,company,activity,profile,catalogue,settings,plan,plan_status,trial_end,created_at) VALUES(?,?,?,?,?,?,?,?,\'trial\',?,?)',
      [$uid, $slug, mb_substr($company, 0, 120), $activity, jenc($profile), jenc(preset_catalogue($activity)), jenc(default_pro_settings()), $plan, gmdate('Y-m-d', time() + TRIAL_DAYS * 86400), now()]);
    send_mail(ADMIN_NOTIFY_EMAIL, 'Nouveau professionnel inscrit : ' . $company, "Entreprise : $company\nContact : $name <$email>\nFormule choisie : $plan\nActivité : $activity\n");
  }
  db()->commit();
  session_regenerate_id(true); $_SESSION['uid'] = $uid; q('UPDATE users SET last_login = ? WHERE id = ?', [now(), $uid]);
  out(['ok' => true]);

case 'login':
  if (too_many('login', 10, 900)) fail('Trop de tentatives. Patientez 15 minutes.', 429);
  usleep(300000);
  $u = one('SELECT * FROM users WHERE login = ?', [strtolower(trim((string)($b['login'] ?? '')))]);
  if (!$u || !password_verify((string)($b['password'] ?? ''), $u['pass'])) fail('Identifiant ou mot de passe incorrect.', 401);
  if (!$u['active']) fail('Ce compte est désactivé. Contactez Heritage Int.', 403);
  session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id']; q('UPDATE users SET last_login = ? WHERE id = ?', [now(), $u['id']]);
  out(['ok' => true, 'role' => $u['role']]);

case 'logout':
  $_SESSION = []; session_destroy(); out(['ok' => true]);

case 'change_password':
  $u = need();
  $row = one('SELECT pass FROM users WHERE id = ?', [$u['id']]);
  if (!password_verify((string)($b['old'] ?? ''), $row['pass'])) fail('Mot de passe actuel incorrect.');
  if (mb_strlen((string)($b['new'] ?? '')) < 10) fail('Le nouveau mot de passe doit contenir au moins 10 caractères.');
  q('UPDATE users SET pass = ? WHERE id = ?', [password_hash((string)$b['new'], PASSWORD_DEFAULT), $u['id']]); out(['ok' => true]);

case 'pro_page':
  $p = one('SELECT * FROM pros WHERE slug = ?', [(string)($_GET['slug'] ?? '')]);
  if (!$p) fail('Cette page n\'existe pas.', 404);
  out(['pro' => pro_public($p), 'rates' => setting('rates')]);

/* ================= Client ================= */
case 'submit':
  $u = need('client');
  if (too_many('submit' . $u['id'], 10, 3600)) fail('Trop de demandes envoyées. Réessayez plus tard.', 429);
  $p = one('SELECT * FROM pros WHERE slug = ?', [(string)($b['slug'] ?? '')]);
  if (!$p) fail('Professionnel introuvable.', 404);
  if (!pro_is_open($p)) fail('Ce professionnel ne reçoit pas de demandes pour le moment.', 403);
  $d = clean($b['data'] ?? []); if (!is_array($d)) fail('Demande invalide.');
  $d['nom'] = $d['nom'] ?? $u['name']; $e = estimate($p, $d); $d['estimation'] = $e;
  if (!$e['lines']) fail('Choisissez au moins une prestation.');
  $code = strtoupper(bin2hex(random_bytes(4)));
  q('INSERT INTO requests(pro_id,client_id,code,data,total_eur,devise,total_devise,created_at) VALUES(?,?,?,?,?,?,?,?)',
    [$p['id'], $u['id'], $code, jenc($d), $e['total_eur'], $e['devise'], $e['total_devise'], now()]);
  $pu = one('SELECT email FROM users WHERE id = ?', [$p['user_id']]);
  send_mail($pu['email'] ?? null, 'Nouvelle demande : ' . ($d['nom'] ?? ''), "Nouvelle demande de " . ($d['nom'] ?? '') . "\nEstimation : " . $e['total_devise'] . ' ' . $e['devise'] . "\nRappel souhaité : " . ($d['recontact'] ?? '-') . "\n\nTableau de bord : " . SITE_URL . "/#/pro\n");
  out(['ok' => true, 'code' => $code]);

case 'my_requests':
  $u = need('client');
  out(['requests' => array_map(fn($r) => req_row($r, false), all('SELECT r.*, p.company, p.slug FROM requests r JOIN pros p ON p.id = r.pro_id WHERE r.client_id = ? ORDER BY r.id DESC', [$u['id']]))]);

/* ================= Professionnel ================= */
case 'pro_requests':
  $u = need('pro'); $p = my_pro($u);
  out(['requests' => array_map(fn($r) => req_row($r, true), all('SELECT r.*, u.name client_name, u.email client_email FROM requests r JOIN users u ON u.id = r.client_id WHERE r.pro_id = ? ORDER BY r.id DESC', [$p['id']]))]);

case 'pro_update_request':
  $u = need('pro'); $p = my_pro($u);
  $r = one('SELECT * FROM requests WHERE id = ? AND pro_id = ?', [(int)($b['id'] ?? 0), $p['id']]); if (!$r) fail('Demande introuvable.', 404);
  $set = []; $par = [];
  if (isset($b['statut'])) { if (!in_array($b['statut'], $STATUTS, true)) fail('Statut inconnu.'); $set[] = 'statut = ?'; $par[] = $b['statut']; }
  if (isset($b['message_pro'])) { $set[] = 'message_pro = ?'; $par[] = mb_substr((string)$b['message_pro'], 0, 3000); }
  if (!empty($b['lu']) || isset($b['statut']) || isset($b['message_pro'])) { $set[] = 'lu = 1'; if (!$r['lu_at']) { $set[] = 'lu_at = ?'; $par[] = now(); } }
  if ($set) { $par[] = $r['id']; q('UPDATE requests SET ' . implode(', ', $set) . ' WHERE id = ?', $par); }
  out(['ok' => true]);

case 'pro_delete_request':
  $u = need('pro'); $p = my_pro($u);
  q('DELETE FROM requests WHERE id = ? AND pro_id = ?', [(int)($b['id'] ?? 0), $p['id']]); out(['ok' => true]);

case 'pro_save':
  $u = need('pro'); $p = my_pro($u);
  $company = trim((string)($b['company'] ?? $p['company'])); if ($company === '') fail('Le nom de l\'entreprise est obligatoire.');
  $slug = slugify((string)($b['slug'] ?? $p['slug']));
  if ($slug !== $p['slug'] && one('SELECT id FROM pros WHERE slug = ? AND id != ?', [$slug, $p['id']])) fail('Cette adresse de page est déjà prise.');
  $cat = clean($b['catalogue'] ?? jdec($p['catalogue'])); $st = clean($b['settings'] ?? jdec($p['settings'])); $pr = clean($b['profile'] ?? jdec($p['profile']));
  if (!is_array($cat) || !is_array($st) || !is_array($pr)) fail('Données invalides.');
  if (empty($st['countries'])) fail('Gardez au moins un pays.');
  q('UPDATE pros SET company = ?, slug = ?, catalogue = ?, settings = ?, profile = ? WHERE id = ?', [mb_substr($company, 0, 120), $slug, jenc($cat), jenc($st), jenc($pr), $p['id']]);
  out(['ok' => true, 'slug' => $slug]);

case 'pro_choose_plan':
  $u = need('pro'); $p = my_pro($u); $plans = setting('plans'); $plan = (string)($b['plan'] ?? '');
  if (!isset($plans[$plan])) fail('Formule inconnue.');
  if ($p['free']) fail('Votre compte est gratuit et complet : aucun abonnement à payer.');
  q('UPDATE pros SET plan = ? WHERE id = ?', [$plan, $p['id']]);
  $link = $plans[$plan]['lien'] ?? '';
  if ($link) $link .= (str_contains($link, '?') ? '&' : '?') . 'client_reference_id=pro_' . $p['id'] . '&prefilled_email=' . rawurlencode((string)$u['email']);
  out(['ok' => true, 'payment_link' => $link]);

case 'pro_review':
  $u = need('pro'); $p = my_pro($u); $rating = (int)($b['rating'] ?? 0);
  if ($rating < 1 || $rating > 5) fail('Choisissez une note de 1 à 5.');
  q('INSERT INTO reviews(pro_id,rating,comment,created_at) VALUES(?,?,?,?)', [$p['id'], $rating, mb_substr(trim((string)($b['comment'] ?? '')), 0, 2000), now()]);
  out(['ok' => true]);

/* ================= Administration 360 ================= */
case 'admin_overview':
  need('admin');
  $today = gmdate('Y-m-d'); $month = gmdate('Y-m'); $year = gmdate('Y');
  $sum = fn(string $like) => (float)one('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE paid_at LIKE ?', [$like . '%'])['s'];
  $plans = setting('plans'); $charges = array_sum(array_map(fn($c) => (float)$c['montant'], setting('charges')));
  $pros = all('SELECT plan, plan_status, free, trial_end FROM pros');
  $mrr = 0; $active = 0; $trial = 0; $free = 0; $suspended = 0;
  foreach ($pros as $p) {
    if ($p['free']) { $free++; continue; }
    if ($p['plan_status'] === 'active') { $active++; $mrr += (float)($plans[$p['plan']]['prix'] ?? 0); }
    elseif ($p['plan_status'] === 'trial' && $p['trial_end'] >= $today) $trial++;
    else $suspended++;
  }
  $series = [];
  for ($i = 11; $i >= 0; $i--) { $m = gmdate('Y-m', strtotime("first day of -$i month")); $series[] = ['mois' => $m, 'ca' => $sum($m), 'charges' => $charges]; }
  $byPlan = []; foreach ($plans as $k => $pl) $byPlan[$k] = ['nom' => $pl['nom'], 'prix' => $pl['prix'], 'actifs' => (int)one('SELECT COUNT(*) n FROM pros WHERE plan = ? AND plan_status = \'active\' AND free = 0', [$k])['n']];
  $avg = one('SELECT AVG(rating) a, COUNT(*) n FROM reviews');
  out(['ca_jour' => $sum($today), 'ca_mois' => $sum($month), 'ca_annee' => $sum($year), 'ca_total' => (float)one('SELECT COALESCE(SUM(amount),0) s FROM payments')['s'],
    'mrr' => $mrr, 'arr' => $mrr * 12, 'charges_mois' => $charges, 'benefice_mois' => $sum($month) - $charges,
    'pros' => ['actifs' => $active, 'essai' => $trial, 'gratuits' => $free, 'inactifs' => $suspended, 'total' => count($pros)],
    'clients' => (int)one('SELECT COUNT(*) n FROM users WHERE role = \'client\'')['n'], 'demandes' => (int)one('SELECT COUNT(*) n FROM requests')['n'],
    'demandes_mois' => (int)one('SELECT COUNT(*) n FROM requests WHERE created_at LIKE ?', [$month . '%'])['n'],
    'avis' => ['moyenne' => $avg['a'] ? round((float)$avg['a'], 1) : null, 'nombre' => (int)$avg['n']],
    'series' => $series, 'par_formule' => $byPlan]);

case 'admin_pros':
  need('admin');
  $rows = all('SELECT p.*, u.name, u.email, u.last_login, u.active,
      (SELECT COUNT(*) FROM requests r WHERE r.pro_id = p.id) demandes,
      (SELECT ROUND(AVG(rating),1) FROM reviews v WHERE v.pro_id = p.id) note,
      (SELECT COALESCE(SUM(amount),0) FROM payments y WHERE y.pro_id = p.id) paye
    FROM pros p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC');
  out(['pros' => array_map(fn($r) => ['id' => (int)$r['id'], 'company' => $r['company'], 'slug' => $r['slug'], 'activity' => $r['activity'], 'name' => $r['name'], 'email' => $r['email'],
    'plan' => $r['plan'], 'plan_status' => $r['plan_status'], 'trial_end' => $r['trial_end'], 'free' => (bool)$r['free'], 'active' => (bool)$r['active'], 'open' => pro_is_open($r),
    'demandes' => (int)$r['demandes'], 'note' => $r['note'] !== null ? (float)$r['note'] : null, 'paye' => (float)$r['paye'], 'created_at' => $r['created_at'], 'last_login' => $r['last_login']], $rows)]);

case 'admin_update_pro':
  need('admin'); $p = one('SELECT * FROM pros WHERE id = ?', [(int)($b['id'] ?? 0)]); if (!$p) fail('Professionnel introuvable.', 404);
  if (isset($b['plan']) && array_key_exists($b['plan'], setting('plans'))) q('UPDATE pros SET plan = ? WHERE id = ?', [$b['plan'], $p['id']]);
  if (isset($b['plan_status']) && in_array($b['plan_status'], ['trial', 'active', 'suspended', 'cancelled'], true)) q('UPDATE pros SET plan_status = ?, plan_since = CASE WHEN ? = \'active\' THEN ? ELSE plan_since END WHERE id = ?', [$b['plan_status'], $b['plan_status'], now(), $p['id']]);
  if (isset($b['free'])) q('UPDATE pros SET free = ? WHERE id = ?', [$b['free'] ? 1 : 0, $p['id']]);
  if (isset($b['trial_end']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$b['trial_end'])) q('UPDATE pros SET trial_end = ? WHERE id = ?', [$b['trial_end'], $p['id']]);
  if (isset($b['active'])) q('UPDATE users SET active = ? WHERE id = ?', [$b['active'] ? 1 : 0, $p['user_id']]);
  out(['ok' => true]);

case 'admin_payments':
  need('admin');
  out(['payments' => all('SELECT y.*, p.company FROM payments y LEFT JOIN pros p ON p.id = y.pro_id ORDER BY y.paid_at DESC, y.id DESC LIMIT 500')]);

case 'admin_add_payment':
  need('admin'); $amount = (float)($b['amount'] ?? 0); if ($amount == 0.0) fail('Indiquez un montant.');
  $kind = in_array($b['kind'] ?? '', ['abonnement', 'mise_en_place', 'autre'], true) ? $b['kind'] : 'autre';
  $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($b['date'] ?? '')) ? $b['date'] . ' 12:00:00' : now();
  $pro = (int)($b['pro_id'] ?? 0) ?: null; if ($pro && !one('SELECT id FROM pros WHERE id = ?', [$pro])) fail('Professionnel introuvable.');
  q('INSERT INTO payments(pro_id,amount,kind,label,source,paid_at) VALUES(?,?,?,?,\'manuel\',?)', [$pro, round($amount, 2), $kind, mb_substr((string)($b['label'] ?? ''), 0, 200), $date]);
  out(['ok' => true]);

case 'admin_delete_payment':
  need('admin'); q('DELETE FROM payments WHERE id = ? AND source = \'manuel\'', [(int)($b['id'] ?? 0)]); out(['ok' => true]);

case 'admin_reviews':
  need('admin');
  out(['reviews' => all('SELECT v.*, p.company FROM reviews v JOIN pros p ON p.id = v.pro_id ORDER BY v.id DESC LIMIT 500')]);

case 'admin_settings':
  need('admin'); out(['plans' => setting('plans'), 'charges' => setting('charges'), 'rates' => setting('rates'), 'mise_en_place' => setting('mise_en_place')]);

case 'admin_save_settings':
  need('admin'); $s = clean($b);
  if (isset($s['plans']) && is_array($s['plans'])) { $pl = []; foreach (default_settings()['plans'] as $k => $d) { $x = $s['plans'][$k] ?? $d;
    $lien = (string)($x['lien'] ?? ''); if ($lien && !preg_match('#^https://(buy\.stripe\.com|checkout\.stripe\.com)/#', $lien)) fail('Le lien de paiement doit être un lien Stripe (https://buy.stripe.com/…).');
    $pl[$k] = ['nom' => (string)($x['nom'] ?? $d['nom']), 'prix' => (float)($x['prix'] ?? $d['prix']), 'desc' => (string)($x['desc'] ?? $d['desc']), 'lien' => $lien]; } set_setting('plans', $pl); }
  if (isset($s['charges']) && is_array($s['charges'])) set_setting('charges', array_values(array_map(fn($c) => ['nom' => (string)($c['nom'] ?? ''), 'montant' => (float)($c['montant'] ?? 0)], $s['charges'])));
  if (isset($s['rates']) && is_array($s['rates'])) set_setting('rates', array_map('floatval', $s['rates']) + ['EUR' => 1]);
  if (isset($s['mise_en_place'])) set_setting('mise_en_place', (float)$s['mise_en_place']);
  out(['ok' => true]);

default: fail('Action inconnue.', 404);
}