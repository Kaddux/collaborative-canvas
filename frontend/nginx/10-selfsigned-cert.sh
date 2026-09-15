#!/bin/sh
# Generates a temporary self-signed certificate on first boot so nginx can bind
# :443 before Let's Encrypt has issued the real certificate. Certbot later
# replaces these files in the shared volume; reload nginx afterwards.
set -e

: "${DOMAIN:?DOMAIN must be set}"

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

if [ ! -f "${CERT_DIR}/fullchain.pem" ]; then
    echo "[bootstrap] No certificate for ${DOMAIN} yet; generating a temporary self-signed one."
    mkdir -p "${CERT_DIR}"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "${CERT_DIR}/privkey.pem" \
        -out "${CERT_DIR}/fullchain.pem" \
        -subj "/CN=${DOMAIN}"
fi
