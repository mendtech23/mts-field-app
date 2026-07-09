# Install MTS Field Ops

## Live App (HTTPS, For Phone Install)

The app is deployed and live at:

```text
https://mendtech23.github.io/mts-field-app/
```

On any phone: open that link in Chrome > browser menu > `Install app` (or `Add to Home screen`). `MTS Ops` appears with the MTS icon, and GPS check-ins and offline mode work because the link is HTTPS.

To publish app updates: commit and push to the `main` branch of `github.com/mendtech23/mts-field-app` — GitHub Pages redeploys in about a minute and installed phones pick up the new version on next open.

## What Is Included

- Mobile-first MTS Field Ops PWA.
- Owner, Admin, HR, 2 Supervisors, workers, and driver profiles.
- Owner-only approval: new team members (any role, permanent or temporary) stay locked until the Owner approves them.
- Jobs and sub-jobs.
- Worker accept/reject confirmation.
- Worker issues to supervisor.
- Photo (auto-compressed), time, material, transport, and GPS check-ins.
- WhatsApp buttons for supervisor, driver, workers, assignment messages, and owner approval requests.
- Slack alerts connected to `#mts-field-updates` with channel ID `C0BFZLRJ8AX` — visible to supervisory level and above only.
- Zoho-ready sync queue with backend send (`/api/zoho/sync` on the relay).
- Local relay server that stores Slack alerts and Zoho events, and forwards them when webhooks are configured.

## Run On This Windows Computer

1. Open PowerShell.
2. Go to this folder:

```powershell
cd "C:\Users\LENOVO\OneDrive\Dokumente\MTS Planning\mts-field-app"
```

3. Start the app (opens your browser automatically; add `-NoBrowser` to skip):

```powershell
.\start-mts-app.ps1
```

4. Open (if the browser did not open by itself):

```text
http://localhost:5178/index.html
```

5. Stop everything when finished:

```powershell
.\stop-mts-app.ps1
```

The start script is safe to run twice: if the app or relay is already running, it reuses it instead of starting a duplicate.

## Install On This PC (App Window, Own Icon)

1. Open `http://localhost:5178/index.html` in Chrome or Edge.
2. Click the install icon in the address bar (a small screen with a down arrow), or browser menu > `Install MTS Field Ops`.
3. `MTS Ops` now opens in its own window with the MTS icon, from the Start menu like a normal program.

## Use On Phones (Same Wi-Fi)

1. Start the app on the PC. The start script prints a `Phone (same Wi-Fi)` address like `http://192.168.x.x:5178/index.html`.
2. Open that address in Chrome on the phone (phone and PC must be on the same Wi-Fi).
3. Browser menu > `Add to Home screen` gives a quick-launch icon.

Limits over plain Wi-Fi (no HTTPS): GPS check-in and offline mode are blocked by the browser, and it installs as a shortcut, not a full app. Fine for daily testing.

If the phone cannot reach the address, allow Python through Windows Firewall (private networks) when Windows asks, or run once as admin:

```powershell
netsh advfirewall firewall add rule name="MTS Field Ops" dir=in action=allow protocol=TCP localport=5178
```

## Real Phone Install (Recommended For The Team)

For the full app experience on phones (home-screen install, GPS check-ins, offline screens), the app must be served over HTTPS:

1. Host this folder on any static HTTPS host (Netlify, Cloudflare Pages, GitHub Pages, or your own domain).
2. Deploy `relay-server.js` on a small server (Render, Railway, a VPS) and put its URL in the app's Slack and Zoho settings.
3. On the phone, open the HTTPS link in Chrome > menu > `Install app`. `MTS Ops` appears on the home screen with the MTS icon.

## Important: Data Is Per Device (Prototype)

This prototype stores data in each device's browser. A job created on the PC does not appear on a worker's phone automatically. That is expected at this stage — multi-device shared data arrives with the Phase 2 backend/database (see `PRODUCTION_PLAN.md`). For now, run the operation from one main device, or use each device independently for testing.

## Slack

The Slack workspace channel is already created:

- Channel: `#mts-field-updates`
- Channel ID: `C0BFZLRJ8AX`

The Slack tab is visible to Owner, Admin, HR, and Supervisors only. Set the relay URL in the app to:

```text
http://localhost:8787/api/slack/alerts
```

For real Slack posting, start the relay with `SLACK_WEBHOOK_URL` set on the server. The webhook stays server-side, never in the worker app.

## Zoho

The Zoho tab (supervisory level and above) queues every field event. Set the backend sync URL to:

```text
http://localhost:8787/api/zoho/sync
```

The relay stores every event in `relay-data/zoho-sync.jsonl`. To push events into Zoho automatically, create a Zoho Flow webhook trigger and start the relay with `ZOHO_FLOW_WEBHOOK_URL` set to that webhook.

## Production Checklist

- Host app on HTTPS.
- Deploy `relay-server.js` on a backend server.
- Add real Slack webhook (`SLACK_WEBHOOK_URL`) and Zoho Flow webhook (`ZOHO_FLOW_WEBHOOK_URL`) on the server.
- Add login/authentication.
- Add database (shared data across devices).
- Connect Zoho API.
- Configure actual worker phone numbers.
