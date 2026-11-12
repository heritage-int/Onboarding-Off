<?php
// Crée config.php à partir de config.example.php et des secrets GitHub (utilisé par le déploiement automatique).
$src = file_get_contents(__DIR__ . '/../config.example.php');
$map = [
  'ADMIN_PASS_HASH' => getenv('ADMIN_PASS_HASH'), 'OWNER_PRO_PASS_HASH' => getenv('OWNER_PRO_PASS_HASH'),
  'STRIPE_WEBHOOK_SECRET' => getenv('STRIPE_WEBHOOK_SECRET'), 'SITE_URL' => getenv('SITE_URL'),
];
foreach (['ADMIN_PASS_HASH', 'OWNER_PRO_PASS_HASH'] as $k) {
  if (!preg_match('/^\$2y\$\d{2}\$[.\/A-Za-z0-9]{53}$/', (string)$map[$k])) { fwrite(STDERR, "Secret $k manquant ou invalide : collez l'empreinte complète (commence par \$2y\$).\n"); exit(1); }
}
foreach ($map as $k => $v) {
  if ($v === false || $v === '') continue;
  $src = preg_replace_callback("/const $k = '[^']*';/", fn() => "const $k = " . var_export($v, true) . ';', $src, 1, $n);
  if ($n !== 1) { fwrite(STDERR, "Réglage $k introuvable dans config.example.php\n"); exit(1); }
}
file_put_contents(__DIR__ . '/../config.php', $src);
echo "config.php créé.\n";