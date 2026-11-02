# AFC Entity Radar — deploy on Netlify with accounts, free tier and payments

How it works:
- **Anonymous visitors:** 5 checks per day, counted per connection by a daily-rotating hash of the IP address.
- **Free account:** 30 checks per month, plus 10 per referred sign-up.
- **Pro and Team:** paid monthly through Stripe, and include the commercial-use licence.

The sanctions-list matching runs **on the server**, so the limits cannot be bypassed in the browser.

## 1. Supabase (accounts and database) — free tier
1. Create a project at supabase.com. Choose an **EU region** for GDPR.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and click **Run**.
3. Go to **Authentication → URL Configuration**. Set **Site URL** to your Netlify or custom domain, and add `https://YOUR-DOMAIN/**` to the redirect URLs.
4. Under **Authentication → Providers → Email**, keep "Confirm email" on.
5. Optional, recommended: under **Authentication → Attack Protection**, enable **CAPTCHA (Cloudflare Turnstile)** with your Turnstile secret key.
6. Copy the **Project URL**, the **anon public key** and the **service_role key** from **Project Settings → API**.

## 2. Stripe (payments)
1. Create two products with monthly prices, **Pro** and **Team**, and copy their **price IDs** (`price_...`).
2. Go to **Developers → Webhooks → Add endpoint**, use `https://YOUR-DOMAIN/api/stripe-webhook`, and select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy the signing secret (`whsec_...`).
3. Under **Settings → Billing → Customer portal**, turn on the portal so users can cancel and download invoices.

## 3. Cloudflare Turnstile (bot protection on sign-up) — free
Create a widget for your domain, then copy the site key and the secret key. The secret key goes into Supabase (step 1.5).

## 4. Netlify environment variables
**Secret, server-side only.** Never put these in front-end code. Mark them "secret" in Netlify.

| Variable | What |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `APP_SECRET` | Random string of 48+ characters (for example `openssl rand -hex 32`) |
| `ADMIN_TOKEN` | Another random string; protects the list refresh |
| `STRIPE_SECRET_KEY` | `sk_live_...` (use `sk_test_...` while testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM` | `price_...` |

**Public** (shown to browsers):

| Variable | What |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | From Supabase. The build refuses a service-role key here. |
| `TURNSTILE_SITE_KEY` | Turnstile site key |
| `SITE_URL` | `https://your-domain` |
| `CONTACT_EMAIL`, `CONTROLLER_NAME` | Shown on the privacy page and security.txt |
| `PRO_PRICE`, `TEAM_PRICE` | For example `€49`, `€199` |
| `GOOGLE_VERIFICATION` | Search Console HTML-tag code |
| `BUILD_HOOK_URL` | A Netlify build hook, used for a daily rebuild of the SEO pages |

**Optional limits:** `ANON_DAILY_LIMIT` (5), `FREE_MONTHLY_LIMIT` (30), `PRO_MONTHLY_LIMIT` (2000), `TEAM_MONTHLY_LIMIT` (10000).

## 5. Deploy and load the lists the first time
1. Push this folder to GitHub and link it to the Netlify site.
2. After the first deploy, load the screening lists once (afterwards they refresh every 6 hours automatically):
   ```
   curl -X POST https://YOUR-DOMAIN/.netlify/functions/refresh-lists-background -H "x-admin-token: YOUR_ADMIN_TOKEN"
   ```
3. After about 2 minutes, `https://YOUR-DOMAIN/api/stats` should return the list counts.

## 6. SEO
Follow the same steps as for Cyber Attack Radar: Search Console, submit `/sitemap.xml`, then request indexing for `/`, `/country-risk/`, `/sanctions-lists/`, `/pricing/` and `/faq/`.

The `/country-risk/` and `/sanctions-lists/` pages are pre-rendered and keyword-rich ("FATF grey list", "EU high-risk countries", "OFAC", "sanctions screening"). They are the pages most likely to bring in search traffic.

## Security built in
- **Server-side enforcement:** list matching and quotas run in functions, and the counter is atomic in Postgres.
- **Rate limits:** Netlify rate limits on `/api/screen` (20 per minute per IP) and `/api/network` (30 per minute).
- **Database lockdown:** Row Level Security on every table. Browsers can read only their own profile, cannot write to it and cannot see usage. Plans change only through the verified Stripe webhook.
- **Stripe webhook:** HMAC-SHA256 signature verification with constant-time comparison and a 5-minute replay window.
- **Sessions:** Supabase Auth with PKCE, email confirmation, a minimum 10-character password and Turnstile CAPTCHA. Tokens are verified server-side on every call.
- **Request checks:** same-origin enforcement on all POST APIs (CSRF protection), strict input validation, request size limits and generic error messages.
- **Network-check tickets:** HMAC-signed, valid for 15 minutes, so `/api/network` cannot be abused for free screening.
- **Privacy by design:** screened names are never stored or logged, IP addresses are hashed with a daily-rotating key, and users can delete their own account (GDPR erasure).
- **Headers:** a strict CSP (only whitelisted data sources, no inline scripts), HSTS with preload, frame denial, nosniff, Referrer-Policy, Permissions-Policy and COOP/CORP.
- **Secrets:** they stay in Netlify env vars, and the build refuses to publish a service-role key.

## Before charging money
OpenSanctions data is free for **non-commercial** use only (CC BY-NC 4.0). Paid plans need a commercial licence from OpenSanctions. Get it before taking payments, or use the paid plans only for the features you own. ICIJ (ODbL) and Wikipedia (CC BY-SA) need attribution, which the site provides; Wikidata (CC0) has no conditions.
