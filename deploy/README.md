# Deployment runbook — single Azure VM

Lift-and-shift of the existing stack (Postgres + Kafka in containers, Spring Boot
backend, React frontend served by nginx) onto one Ubuntu VM with a domain and TLS.

Account-level steps (Azure VM, Name.com domain) are performed by you. No secrets
are committed: all runtime secrets live in `.env`, which is gitignored.

## Architecture

```
Internet ──443/80──▶ nginx (web container) ──▶ /api, /ws ──▶ backend:8080 (Spring Boot)
                          └── static React build            └── postgres:5432, kafka:9092 (internal only)
```

Only 22 (restricted), 80 and 443 are exposed. Postgres (5432) and Kafka (9092)
are **not** published to the host.

## Prerequisites

- Azure for Students subscription (`az login` works).
- A domain from the GitHub Student Pack (Name.com), e.g. `syncboard.me`.
- `docker-compose.prod.yml`, the Dockerfiles and nginx config from this repo.

## 1. Provision the VM (Standard_B2als_v2, 4 GB)

```bash
az login
az group create --name collaborative-canvas-rg --location eastus

az vm create \
  --resource-group collaborative-canvas-rg \
  --name canvas-vm \
  --image Ubuntu2204 \
  --size Standard_B2als_v2 \
  --admin-username azureuser \
  --public-ip-sku Standard \
  --generate-ssh-keys

az vm show -d -g collaborative-canvas-rg -n canvas-vm --query publicIps -o tsv
```

> The B-series `…t_v2` sizes (e.g. `Standard_B2ats_v2`) are 1 GB — too small for Kafka +
> Postgres + the JVM. Use a 4 GB size or larger. `--public-ip-sku Standard` gives a
> **static** public IP so DNS keeps working across deallocate/start.

### Network security group — only 22/80/443

```bash
NSG=canvas-vmNSG
RG=collaborative-canvas-rg

az network nsg rule create -g $RG --nsg-name $NSG -n allow-http  --priority 300 --destination-port-ranges 80  --protocol Tcp --access Allow
az network nsg rule create -g $RG --nsg-name $NSG -n allow-https --priority 301 --destination-port-ranges 443 --protocol Tcp --access Allow

# Restrict SSH to your own IP (recommended).
az network nsg rule update -g $RG --nsg-name $NSG -n default-allow-ssh --source-address-prefixes <YOUR_PUBLIC_IP>/32
```

Do **not** open 5432 or 9092.

## 2. Install Docker on the VM

```bash
ssh azureuser@<VM_PUBLIC_IP>

sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Ensure Compose >= 2.24 (needed for the `!reset` merge tag): `docker compose version`.

## 3. Clone the repo

The repo is public, so HTTPS clone needs no credentials. (If it becomes private,
use a deploy key or a PAT — never commit it.)

```bash
git clone https://github.com/Kaddux/collaborative-canvas.git
cd collaborative-canvas/collaborative-canvas
```

## 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in `POSTGRES_PASSWORD`, `WEBSOCKET_ALLOWED_ORIGINS` (e.g.
`https://syncboard.me`), `DOMAIN`, `LETSENCRYPT_EMAIL`.

## 5. Bring up the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

The `web` container starts with a temporary self-signed certificate so nginx can
bind :443 before Let's Encrypt has issued the real one.

## 6. DNS

At Name.com, create an `A` record for your domain pointing at `<VM_PUBLIC_IP>`
(optionally a `www` CNAME). Wait for propagation: `dig +short syncboard.me`.

## 7. TLS via Let's Encrypt

```bash
set -a; . ./.env; set +a   # loads $DOMAIN and $LETSENCRYPT_EMAIL

# The certbot service's entrypoint is the renewal loop, so override it for this one-off
# issuance (otherwise the loop runs and `certonly` is ignored).
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm \
  --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec web nginx -s reload
```

The `certbot` service renews every 12h. After a renewal, reload nginx:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec web nginx -s reload
```

## 8. Verification

```bash
# all services up
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# TLS + app
curl -I https://$DOMAIN
```

From a machine **outside** the VM (ports should be closed except 22/80/443):

```bash
nmap -p 5432,9092,80,443 <VM_PUBLIC_IP>
# or
nc -vz <VM_PUBLIC_IP> 5432   # expected: connection refused / timeout
```

In a browser at `https://<domain>`:
- DevTools → Network shows the WebSocket as `wss://<domain>/ws/canvas/...` (not `ws://`).
- Open two tabs, create a canvas, draw/move/resize objects, refresh — state persists.

## Operations

```bash
# logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# deploy an update
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

## Cost & lifecycle

- The VM (`Standard_B2als_v2`) is ~$18/month; the $100 student credit covers roughly
  5+ months of 24/7 runtime (longer if you deallocate when idle).
- Deallocate to stop compute billing (the static public IP and disk remain):
  `az vm deallocate -g collaborative-canvas-rg -n canvas-vm` (restart with `az vm start …`).
- Set a Cost Management budget alert (e.g. $80) so you are warned before the credit runs out.

## Notes / limitations

- The base `docker-compose.yml` is unchanged and still used for local development
  (host-local backend at `localhost:9092` / `:5432`). The prod override is what
  removes public ports and repoints Kafka to `kafka:9092`.
- Postgres/Kafka data persist in named Docker volumes; deleting the volumes wipes state.
- This is a single-instance deployment: rooms, sequence numbers and undo/redo history
  are in-memory and lost on backend restart.
