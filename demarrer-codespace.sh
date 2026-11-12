#!/usr/bin/env bash
# Heritage Int — lance la plateforme dans GitHub Codespaces pour la tester avant Hostinger.
# Utilisation, dans le terminal du Codespace :  bash demarrer-codespace.sh
set -e
command -v php >/dev/null || { echo "PHP absent : sudo apt-get update && sudo apt-get install -y php-cli php-sqlite3"; exit 1; }
php -m | grep -qi pdo_sqlite || { echo "Installation de SQLite pour PHP…"; sudo apt-get update -qq && sudo apt-get install -y -qq php-sqlite3; }
if [ ! -f config.php ]; then
  read -r -s -p "Mot de passe du compte admin : " A; echo
  read -r -s -p "Mot de passe du compte heritage : " B; echo
  HA=$(php -r 'echo password_hash($argv[1], PASSWORD_DEFAULT);' "$A")
  HB=$(php -r 'echo password_hash($argv[1], PASSWORD_DEFAULT);' "$B")
  sed -e "s|const ADMIN_PASS_HASH = '';|const ADMIN_PASS_HASH = '$HA';|" \
      -e "s|const OWNER_PRO_PASS_HASH = '';|const OWNER_PRO_PASS_HASH = '$HB';|" config.example.php > config.php
  echo "config.php créé (il reste dans le Codespace, jamais envoyé sur GitHub)."
fi
echo "Plateforme lancée. Ouvrez l'onglet PORTS, puis le lien du port 8080 (icône globe)."
echo "Pour arrêter : Ctrl + C"
php -S 0.0.0.0:8080