# TND-OPC deployment quick reference

Use this file for the normal deployment commands and locations. Replace `user@your-server` with the deployment SSH user and host.

## Important paths

| Purpose | Path |
| --- | --- |
| Server installation root | `~/james-system` |
| Web repository / run `setup.sh` here | `~/james-system/james-newsystem` |
| API repository | `~/james-system/api` |
| Database backups copied to server | `~/james-system/backups/` |
| Production web files served by Nginx | `/var/www/james-newsystem/web/` |
| Production PHP API files | `/var/www/james-newsystem/api/` |
| Production realtime service files | `/var/www/james-newsystem/realtime/` |
| Nginx site configuration | `/etc/nginx/sites-available/james-newsystem` |
| Production web ports | `80` and legacy tunnel port `8080` |
| API log (non-production preview mode) | `~/james-system/logs/api.log` |
| Realtime log (non-production preview mode) | `~/james-system/logs/realtime.log` |

## Normal production update (does not replace database data)

Run on the server:

```bash
cd ~/james-system/james-newsystem
./setup.sh -productionupdate
```

`-productionupdate` explicitly pulls `origin main` for both repositories, applies migrations, rebuilds the frontend, refreshes Nginx/systemd configuration, installs clean realtime dependencies, then restarts and verifies PHP-FPM, Nginx, and realtime. It deliberately does **not** restore a database dump.

## First production deployment or database restore

> Warning: restoring a dump replaces the database contained in that dump.

1. Copy the database backup from the Mac to the server:

```bash
scp /Users/melsonleanbacuen/james-system/backups/topnotch_migrate_full_20260830_223810.sql.gz \
  user@your-server:~/james-system/backups/
```

2. On the server, run production setup:

```bash
cd ~/james-system/james-newsystem
git pull origin main
./setup.sh -production
```

`setup.sh -production` automatically restores the newest `.sql` or `.sql.gz` in `~/james-system/backups/`. To select an exact file instead, pass `DB_DUMP_PATH`:

```bash
DB_DUMP_PATH=~/james-system/backups/topnotch_migrate_full_20260830_223810.sql.gz ./setup.sh -production
```

After it finishes, start/reload production services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nginx php8.3-fpm james-realtime james-production.target
sudo systemctl restart php8.3-fpm nginx james-realtime
```

## Verify deployment

```bash
sudo systemctl status nginx php8.3-fpm james-realtime --no-pager
curl -fsS http://127.0.0.1/api/v1/health
curl -I http://127.0.0.1:80/james-newsystem/
curl -I http://127.0.0.1:8080/james-newsystem/
curl -fsS http://127.0.0.1:8082/health
```

Expected: all three services are `active (running)` and API/realtime health endpoints return successfully.

## If Nginx cannot start on port 80

Check the process first:

```bash
sudo ss -ltnp '( sport = :80 )'
sudo apachectl -S
```

This server previously had only Apache’s Ubuntu default site on port 80. If Apache is still only serving `/var/www/html`, release the port for Nginx:

```bash
sudo systemctl disable --now apache2
sudo systemctl restart nginx
```

Do **not** disable Apache if `apachectl -S` shows another live website you still need.

## If realtime/chat is failing

View the error:

```bash
sudo journalctl -u james-realtime -n 100 --no-pager -l
```

Then run the normal production update above. It stops realtime before replacing files and performs a clean production dependency install, which fixes incomplete `socket.io` installs.

## Setup modes

| Command | Use it for |
| --- | --- |
| `./setup.sh update` | Local/preview update on ports 8080/8081; not the Nginx production deployment. |
| `./setup.sh -production` | First production setup or intentional restore from a database dump. |
| `./setup.sh -productionupdate` | Normal production code update; keeps existing database records. |
| `./setup.sh status` | Checks the local/preview stack status. |

## Tunnel requirement

Pangolin may continue forwarding to `127.0.0.1:8080`; Nginx serves the same production app on both ports `80` and `8080`. Use the public tunnel URL only through the Nginx app path, normally:

```text
https://your-tunnel-host/james-newsystem/
```

The frontend uses same-origin `/api/v1` requests. Browser requests must never point at `127.0.0.1:8081` or `localhost` when using a tunnel.
