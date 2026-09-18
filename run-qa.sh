#!/bin/bash
# Corre o QA de personagens contra o staging.
# Se o .env ainda nao tiver chave secreta, le-a da area de transferencia.
# Uso: ~/alter-pop-theme-2.0/run-qa.sh
set -u
cd "$(dirname "$0")"

CURRENT="$(grep '^SHOPIFY_CLIENT_SECRET=' .env 2>/dev/null | cut -d= -f2-)"

case "${CURRENT:-}" in
  shpss_*)
    echo "Chave ja gravada no .env. Nao mexo na area de transferencia."
    ;;
  *)
    SECRET="$(pbpaste)"
    if [ -z "$SECRET" ]; then
      echo "A area de transferencia esta vazia. Copia a chave secreta primeiro."
      exit 1
    fi
    case "$SECRET" in
      shpss_*) ;;
      *) echo "O que esta copiado nao parece uma chave secreta da Shopify (deve comecar por shpss_)."
         echo "Copia outra vez no Dev Dashboard, no botao do meio por baixo de 'Chave secreta'."
         exit 1 ;;
    esac
    case "$SECRET" in
      *[[:space:]]*) echo "O que esta copiado tem espacos ou varias linhas. Nao e a chave."
                     exit 1 ;;
    esac
    grep -v '^SHOPIFY_CLIENT_SECRET=' .env > .env.tmp
    printf 'SHOPIFY_CLIENT_SECRET=%s\n' "$SECRET" >> .env.tmp
    mv .env.tmp .env
    chmod 600 .env
    echo "Chave gravada no .env (${#SECRET} caracteres)."
    ;;
esac
echo

node scripts/qa-characters.mjs --host staging > qa-staging.log 2>&1
STATUS=$?
echo "exit=$STATUS" >> qa-staging.log
echo "QA terminado (exit=$STATUS). Ultimas linhas:"
echo
tail -6 qa-staging.log
