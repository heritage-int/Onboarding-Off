<?php
// Heritage Int — réception des paiements Stripe (abonnements des professionnels)
// Dans Stripe > Développeurs > Webhooks, ajoutez l'adresse https://VOTRE-DOMAINE/app/stripe-webhook.php
// avec les événements : checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted
// puis copiez le « secret de signature » (whsec_…) dans config.php > STRIPE_WEBHOOK_SECRET.
declare(strict_types=1);
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8');

if (!STRIPE_WEBHOOK_SECRET) fail('Webhook non configuré.', 503);
$payload = file_get_contents('php://input') ?: '';
$sig = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
$t = null; $v1 = [];
foreach (explode(',', $sig) as $part) { [$k, $v] = array_pad(explode('=', trim($part), 2), 2, ''); if ($k === 't') $t = (int)$v; if ($k === 'v1') $v1[] = $v; }
$expected = hash_hmac('sha256', $t . '.' . $payload, STRIPE_WEBHOOK_SECRET);
$valid = false; foreach ($v1 as $s) if (hash_equals($expected, $s)) $valid = true;
if (!$t || !$valid || abs(time() - $t) > 300) fail('Signature invalide.', 400);

$ev = json_decode($payload, true); $o = $ev['data']['object'] ?? [];
$pro_by_customer = fn($c) => $c ? one('SELECT * FROM pros WHERE stripe_customer = ?', [$c]) : null;
$record = function (?array $pro, int $cents, string $ref, string $kind, string $label) {
  if ($cents <= 0 || one('SELECT id FROM payments WHERE ref = ?', [$ref])) return;
  q('INSERT INTO payments(pro_id,amount,kind,label,source,ref,paid_at) VALUES(?,?,?,?,\'stripe\',?,?)', [$pro['id'] ?? null, $cents / 100, $kind, $label, $ref, now()]);
};

switch ($ev['type'] ?? '') {
  case 'checkout.session.completed':
    $ref = (string)($o['client_reference_id'] ?? '');
    $pro = preg_match('/^pro_(\d+)$/', $ref, $m) ? one('SELECT * FROM pros WHERE id = ?', [(int)$m[1]]) : null;
    if ($pro) {
      q('UPDATE pros SET plan_status = \'active\', plan_since = ?, stripe_customer = COALESCE(?, stripe_customer) WHERE id = ?', [now(), $o['customer'] ?? null, $pro['id']]);
      // Paiement unique (ex. mise en place) : enregistré ici. Les abonnements sont enregistrés par invoice.paid.
      if (($o['mode'] ?? '') === 'payment') $record($pro, (int)($o['amount_total'] ?? 0), (string)$o['id'], 'mise_en_place', 'Paiement Stripe');
    }
    break;
  case 'invoice.paid':
    $pro = $pro_by_customer($o['customer'] ?? null);
    if ($pro) q('UPDATE pros SET plan_status = \'active\' WHERE id = ?', [$pro['id']]);
    $record($pro, (int)($o['amount_paid'] ?? 0), (string)$o['id'], 'abonnement', 'Abonnement ' . strtoupper((string)($o['currency'] ?? '')));
    break;
  case 'invoice.payment_failed':
    if ($pro = $pro_by_customer($o['customer'] ?? null)) q('UPDATE pros SET plan_status = \'suspended\' WHERE id = ?', [$pro['id']]);
    break;
  case 'customer.subscription.deleted':
    if ($pro = $pro_by_customer($o['customer'] ?? null)) q('UPDATE pros SET plan_status = \'cancelled\' WHERE id = ?', [$pro['id']]);
    break;
}
out(['received' => true]);