# ── Build stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Serve stage ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# openssl is used by the entrypoint to generate a bootstrap self-signed cert
# so nginx can start before Let's Encrypt has issued the real certificate.
RUN apk add --no-cache openssl

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/10-selfsigned-cert.sh /docker-entrypoint.d/10-selfsigned-cert.sh
RUN chmod +x /docker-entrypoint.d/10-selfsigned-cert.sh

# Only ${DOMAIN} is substituted into the nginx template; nginx runtime
# variables ($host, $http_upgrade, ...) must be left untouched.
ENV NGINX_ENVSUBST_FILTER=DOMAIN

EXPOSE 80 443
