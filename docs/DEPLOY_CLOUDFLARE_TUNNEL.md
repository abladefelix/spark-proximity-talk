# SKANAROUND — publishing without public inbound ports (Cloudflare Tunnel)

Use this path when the host has **no reachable public IP**: a Windows 365 Cloud
PC (`CPC-…` hostname), a home/office connection, NAT, or a locked-down
corporate firewall. Symptoms are exactly this: the app answers on
`127.0.0.1:3000`, Caddy runs, but Let's Encrypt reports
`Timeout during connect (likely firewall problem)` and an external port check
shows 80/443 closed.

A Cloudflare Tunnel solves it by dialling **outbound** from the machine to
Cloudflare. Cloudflare terminates TLS at its edge and forwards requests down
that existing connection — no inbound ports, no port proxy, no Let's Encrypt.

```text
Browser -> Cloudflare edge (TLS)  ~~outbound tunnel~~>  cloudflared in WSL
                                                        -> node app  127.0.0.1:3000
                                                        -> backend   127.0.0.1:8000
```

## 1. Move the domain onto Cloudflare

1. Sign up / log in at `dash.cloudflare.com`.
2. **Add a site** → `bytenetdigital.com` → Free plan.
3. Cloudflare lists two nameservers. Set them at your current registrar,
   replacing the existing ones.
4. Wait until the dashboard shows the zone as **Active** (usually minutes).

Delete any leftover `A` records for `skanaround` and `api.skanaround` — the
tunnel creates its own records in step 2.

## 2. Create the tunnel

In **Ubuntu (WSL)**:

```bash
cd /srv/skanaround && git pull
sudo bash deploy/wsl/cloudflare-tunnel.sh
```

The script installs `cloudflared`, opens a browser login (authorise the
`bytenetdigital.com` zone), creates the tunnel, writes
`/etc/cloudflared/config.yml`, creates the DNS records, and installs a systemd
service that starts with WSL.

Custom names/domains:

```bash
sudo bash deploy/wsl/cloudflare-tunnel.sh skanaround \
  skanaround.bytenetdigital.com api.skanaround.bytenetdigital.com
```

## 3. Verify

```bash
systemctl status cloudflared --no-pager
curl -I https://skanaround.bytenetdigital.com/
```

You should get `HTTP/2 200`. Test from a phone on mobile data too.

## 4. Clean up the old path

Caddy and the Windows port proxy are no longer used for public traffic:

```bash
sudo systemctl disable --now caddy
```

In **PowerShell (Admin)**:

```powershell
netsh interface portproxy reset
schtasks /Delete /TN "WSL PortProxy" /F
```

Keep the `skanaround` systemd service — the tunnel talks to it on port 3000.

## Operations

| Task | Command (in WSL) |
| --- | --- |
| Tunnel status | `systemctl status cloudflared` |
| Tunnel logs | `journalctl -u cloudflared -f` |
| Restart tunnel | `sudo systemctl restart cloudflared` |
| Edit routes | `sudo nano /etc/cloudflared/config.yml` then restart |
| List tunnels | `cloudflared tunnel list` |

App deploys are unchanged: `bash deploy/wsl/deploy.sh main /srv/skanaround`.

## Caveats

- Cloudflare proxies all traffic, so the origin IP is hidden — that's the point,
  but it also means server-side code sees Cloudflare IPs. Real client IPs
  arrive in the `CF-Connecting-IP` header.
- A Cloud PC hibernates or reboots on Microsoft's schedule; when it does, the
  site goes down until WSL and the services come back. For real uptime, move to
  a small always-on Linux VPS and follow `docs/DEPLOY_WINDOWS_VPS.md`
  (or just run the app directly on it) — the tunnel works there too.
- Free-plan Cloudflare has a 100 MB request body limit; the app's uploads are
  well under it.
