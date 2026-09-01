# SKANAROUND — Deploy to an Azure Ubuntu VM

Target: `https://skanaround.bytenetdigital.com`, served directly from an Azure
Linux VM. No WSL, no port proxy, no Cloudflare Tunnel — Caddy gets real
Let's Encrypt certificates because the VM has public inbound ports.

```text
Internet :80/:443
   -> Caddy (TLS via Let's Encrypt)      /etc/caddy/Caddyfile
      -> node .output/server/index.mjs   127.0.0.1:3000
         (systemd unit "skanaround")
```

## 1. Create the VM

Azure Portal → **Virtual machines → Create**:

| Setting | Value |
| --- | --- |
| Image | Ubuntu Server 24.04 LTS x64 |
| Size | `Standard_B2s` (app only) or `Standard_B4ms` (app + self-hosted backend) |
| Disk | 64 GB Premium SSD |
| Authentication | SSH public key |
| Inbound ports | SSH (22), HTTP (80), HTTPS (443) |

If you skipped the inbound ports at creation: VM → **Networking → Network
settings → Add inbound port rule**, once for TCP 80 and once for TCP 443,
Source `Any`, Action `Allow`.

Give the VM a **static public IP**: VM → Networking → the IP resource →
Configuration → Assignment **Static**. Otherwise the IP changes on deallocation
and DNS breaks.

## 2. DNS

At your registrar (or Cloudflare, DNS-only / grey cloud):

```text
skanaround.bytenetdigital.com      A -> <VM public IP>
api.skanaround.bytenetdigital.com  A -> <VM public IP>   # only if self-hosting the backend
```

Delete any leftover `A` records pointing at `185.158.133.1` (Lovable) or the
old Cloud PC address. Verify:

```bash
dig +short skanaround.bytenetdigital.com @1.1.1.1
```

## 3. One-time setup on the VM

```bash
ssh azureuser@<VM public IP>

sudo apt update && sudo apt install -y git
sudo bash <(curl -fsSL https://raw.githubusercontent.com/abladefelix/spark-proximity-talk/main/deploy/wsl/setup.sh) \
  https://github.com/abladefelix/spark-proximity-talk.git main /srv/skanaround
```

(The script lives under `deploy/wsl/` for historical reasons; it is plain Ubuntu
and skips the WSL-specific step automatically.)

It installs Node 22, Bun and Caddy, clones to `/srv/skanaround`, builds, and
enables the `skanaround` + `caddy` systemd services.

Server-only secrets go in `/etc/skanaround.env` (mode 600, never in the repo):

```bash
sudo nano /etc/skanaround.env      # SUPABASE_SERVICE_ROLE_KEY=...
sudo systemctl restart skanaround
```

## 4. Verify

```bash
systemctl status skanaround --no-pager
curl -I http://127.0.0.1:3000/
curl -I https://skanaround.bytenetdigital.com/
```

Certificates are issued within ~30s of the first HTTPS request. If Caddy is
stuck on the Let's Encrypt **staging** CA from earlier attempts:

```bash
sudo rm -rf /var/lib/caddy/.local/share/caddy/certificates/acme-staging-v02*
sudo systemctl restart caddy
```

Ubuntu's firewall is off by default on Azure images. If you enabled `ufw`:

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

## 5. Automatic deploys from GitHub

`.github/workflows/deploy-azure-ubuntu.yml` SSHes into the VM on every push to
`main` and runs `deploy/wsl/deploy.sh`. Add these repo secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VM public IP or hostname |
| `VPS_USER` | `azureuser` (or your SSH user) |
| `VPS_SSH_KEY` | Private key whose public half is in `~/.ssh/authorized_keys` on the VM |

The deploy user needs passwordless `systemctl restart skanaround`:

```bash
echo "$USER ALL=(ALL) NOPASSWD: /bin/systemctl restart skanaround, /bin/journalctl -u skanaround *" \
  | sudo tee /etc/sudoers.d/skanaround
```

Manual deploy at any time:

```bash
bash /srv/skanaround/deploy/wsl/deploy.sh main /srv/skanaround
```

## 6. Operations

| Task | Command |
| --- | --- |
| Status | `systemctl status skanaround` |
| Logs | `journalctl -u skanaround -f` |
| Restart | `sudo systemctl restart skanaround` |
| Caddy logs | `journalctl -u caddy -f` |
| Rollback | `cd /srv/skanaround && git checkout <sha> && bun install && bun run build && sudo systemctl restart skanaround` |

## 7. Backend

To move the database, auth, storage and realtime onto the same VM, continue
with `docs/SELF_HOST_BACKEND.md` — it applies unchanged here (Docker runs
natively, no WSL caveats).

## 8. After the domain change

- Auth URL configuration: Site URL `https://skanaround.bytenetdigital.com`,
  redirect allow-list `https://skanaround.bytenetdigital.com/**`.
- Paystack webhook → `https://skanaround.bytenetdigital.com/api/public/paystack/webhook`
- RevenueCat webhook → `https://skanaround.bytenetdigital.com/api/public/revenuecat/webhook`
- Native apps: `bun run build && npx cap sync`, then ship a new build.
