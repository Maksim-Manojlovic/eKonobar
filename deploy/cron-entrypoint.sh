#!/bin/sh
# Cron sidecar: generates root crontab with CRON_SECRET baked in, runs crond in foreground.
# Uses busybox wget (POST via --post-data=) — no extra packages needed.
set -e

cat > /etc/crontabs/root <<EOF
# publish embargoed reviews every 10 minutes
*/10 * * * * wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" --post-data= http://app:3000/api/cron/publish-reviews
# retry failed WhatsApp/SMS hourly
0 * * * * wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" --post-data= http://app:3000/api/cron/retry-notifications
# renew expiring subscriptions daily at 03:00
0 3 * * * wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" --post-data= http://app:3000/api/cron/renew-subscriptions
EOF

echo "[cron] crontab installed, starting crond"
exec crond -f -l 8
