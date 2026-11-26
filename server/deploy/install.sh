#!/usr/bin/env bash
# Run on the server after `git pull`:  bash /var/www/fime/server/deploy/install.sh
# Safe to repeat. It never overwrites server/.env and does not touch nginx.
set -euo pipefail
cd /var/www/fime/server

[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt

if [ ! -f .env ]; then
    cp .env.example .env
    echo "TRUST_PROXY=true" >> .env
    echo "Created server/.env: add GROQ_API_KEY to it."
fi
chown root:www-data .env
chmod 640 .env

install -m 644 deploy/fime-assistant.service /etc/systemd/system/fime-assistant.service
systemctl daemon-reload
systemctl enable --quiet fime-assistant
systemctl restart fime-assistant

for _ in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:8190/health; then
        echo
        echo "fime-assistant is running."
        exit 0
    fi
    sleep 1
done
echo "The service did not become healthy:" >&2
journalctl -u fime-assistant -n 30 --no-pager >&2
exit 1
