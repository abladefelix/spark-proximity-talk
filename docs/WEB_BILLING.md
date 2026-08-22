# Website checkout (Paystack) — off-app Pro purchases

The mobile apps sell Pro **only** through Apple In-App Purchase and Google Play
Billing (via RevenueCat). This document covers the separate website page at
`/upgrade`, which lets members in Ghana pay with mobile money or a local card.

> **Store rule:** the iOS and Android builds must never link to, mention, or hint
> at `/upgrade`. Promote it on WhatsApp, SMS, social or your website only.
> Linking it inside the apps risks rejection.

## How money becomes Pro

Payment is granted **automatically**. There is no admin approval step.

```text
member opens /upgrade  →  signs in  →  picks monthly / yearly
      →  Paystack hosted checkout (MoMo or card)
      →  payment succeeds
           ├── browser redirects back to /upgrade?reference=...
           │      the page calls verify → Pro unlocked immediately
           └── Paystack calls the webhook /api/public/paystack/webhook
                  signature checked → Pro unlocked (covers closed tabs)
```

Both paths run the same grant code, and it is idempotent: the payment reference
is stored in `payments`, so a webhook retry never extends a membership twice.

What the grant does:

- upserts a row in `payments` (reference, amount, currency, plan, raw payload)
- upserts `subscriptions` with `status = active`, `source = web`, and
  `expires_at` extended by 30 days (monthly) or 365 days (yearly), stacking on
  any remaining time
- Pro feature gates read that subscription, so features unlock on next load

Admins do **not** need to approve anything. Admin → Billing → *Recent payments*
lists transactions for reference, and *Members* lets an admin grant or revoke a
membership manually if a payment ever needs fixing.

## Admin settings (Admin → Billing)

| Setting | Purpose |
| --- | --- |
| Public website address | Base domain used for payment redirects and webhook URLs |
| Website checkout active | Turns `/upgrade` on and off |
| Paystack public key | `pk_live_...` / `pk_test_...` |
| Paystack secret key | `sk_live_...` — server only, never sent to browsers |
| Currency code | e.g. `GHS` |
| Monthly / Yearly price | Smallest unit — `5000` means GH₵50.00 |
| Paystack webhook URL | Read-only, copy into Paystack |

## Changing the domain later

1. Point the new domain at the site.
2. Admin → Billing → **Website address** → enter `https://newdomain.com` → Save.
3. Copy the refreshed **Paystack webhook URL** into Paystack → Settings → API
   Keys & Webhooks.
4. Copy the **RevenueCat webhook URL** (same section, editable) into
   RevenueCat → Integrations → Webhooks.

Nothing else needs a code change. Payment redirects (`callback_url`) are built
server-side from this setting, so members always land back on the current
domain. Leave the field blank to fall back to whatever address the site is
served from.

## Testing

- Use Paystack test keys and a test MoMo/card, keep *Website checkout active* on.
- Confirm the redirect back unlocks Pro, then check the row appears under
  *Recent payments*.
- Re-send the webhook from the Paystack dashboard and confirm the expiry date
  does **not** move a second time.
