# Deploy — Oracle Cloud Always Free VPS

Stack: Docker Compose — Next.js app + PostgreSQL 15 + Redis 7 + Caddy (auto-HTTPS) + cron sidecar.
Same files work on any VPS (Hetzner, DigitalOcean...) — only steps 1–3 are Oracle-specific.

## 1. Create the instance

1. Sign up at cloud.oracle.com (credit card required for identity, not charged).
2. Compute → Instances → Create:
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM) — 4 OCPU / 24 GB RAM fits Always Free.
   - Image: **Ubuntu 24.04** (aarch64).
   - If "Out of capacity": try another availability domain, a smaller shape (2 OCPU / 12 GB is plenty), or retry later — capacity frees up daily.
3. Add your SSH public key. Note the public IP after provisioning.

## 2. Open ports 80/443 (two firewalls!)

**VCN security list** (Oracle console): Networking → VCN → Security List → Add ingress rules:
- Source `0.0.0.0/0`, TCP, destination port `80`
- Source `0.0.0.0/0`, TCP, destination port `443`

**Instance iptables** (Oracle Ubuntu images ship with restrictive rules — this step is mandatory, the VCN rule alone is not enough):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. DNS

Add an `A` record for your domain → instance public IP. Do this before first start so Caddy can issue the Let's Encrypt certificate (it retries automatically if DNS lags).

## 4. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in for the group to apply
```

## 5. Get the code + configure

```bash
sudo mkdir -p /opt/ekonobar && sudo chown $USER /opt/ekonobar
git clone <REPO_URL> /opt/ekonobar/app
cd /opt/ekonobar/app

cp .env.production.example .env.production
nano .env.production
```

Fill in `.env.production`:
- `DOMAIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` — your domain
- `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `CRON_SECRET`, `MONRI_TOKEN_ENCRYPTION_KEY` — `openssl rand -hex 32` each
- VAPID keys — `npx web-push generate-vapid-keys` (run anywhere)
- SMTP, Cloudinary, Mapbox, Monri credentials
- WhatsApp / Infobip / Sentry optional — providers are no-ops when empty

Do **not** set `DATABASE_URL`, `REDIS_URL`, `TRUST_PROXY` — compose sets them to in-network values.

## 6. Build + start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

First build on ARM takes several minutes. The app container runs `prisma migrate deploy` on every start (idempotent), then boots the server.

Check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
# expect: "[entrypoint] prisma migrate deploy..." then Next.js ready
```

Visit `https://<DOMAIN>` — Caddy should already have a certificate.

## 7. External services

- **Monri dashboard** → callback URL: `https://<DOMAIN>/api/payments/monri/callback`
- **Google/Facebook OAuth** → add `https://<DOMAIN>/api/auth/callback/google` (and `/facebook`) to redirect URIs
- Cron jobs run automatically from the `cron` compose service (publish-reviews every 10 min, retry-notifications hourly, renew-subscriptions daily 03:00) — nothing external needed.

## 8. Backups

```bash
chmod +x deploy/backup.sh
crontab -e
# add:
0 4 * * * /opt/ekonobar/app/deploy/backup.sh >> /var/log/ekonobar-backup.log 2>&1
```

Nightly `pg_dump` gzip to `/opt/ekonobar/backups`, 14-day retention. Periodically copy a backup off the server (Oracle can reclaim idle Always Free instances).

Restore:

```bash
gunzip -c /opt/ekonobar/backups/ekonobar-YYYY-MM-DD.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U postgres ekonobar
```

## 9. Updating the app

```bash
cd /opt/ekonobar/app
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Migrations apply automatically on container start.

## Schema migration workflow (important)

The dev workflow used `db:push` (no migration history). The baseline migration
`prisma/migrations/0_init/migration.sql` was **regenerated from the current schema on 2026-07-10**
— a fresh production DB gets the full current schema via `migrate deploy`.

From now on, schema changes must create real migrations or prod won't receive them:

```bash
npm run db:migrate        # prisma migrate dev --name <change> — creates a migration file
git add prisma/migrations # commit it
```

`db:push` remains fine for local experiments, but any change that must reach production needs a committed migration.

## Notes

- Keep instance activity up — Oracle reclaims Always Free instances with sustained <20% CPU/network/memory use over 7 days (the running stack + cron traffic normally clears this, but don't leave it idle for months).
- Seeding demo data in prod: not wired (seed uses tsx, a dev dependency). Register accounts through the UI instead.
- `NEXT_PUBLIC_*` values are baked at **build** time — changing them in `.env.production` requires a rebuild (`up -d --build`), not just a restart.
