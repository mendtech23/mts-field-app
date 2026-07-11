# Mendonca Technical Services — Website

Futuristic 3D marketing website for **Mendonca Technical Services LLC** (www.mendtechservices.com).

**Live now:** https://mendtech23.github.io/mts-field-app/website/ — the site deploys automatically with the field app repo. Every push to `main` republishes it in about a minute.

- **Stack:** Pure static HTML/CSS/JS — no build step, no dependencies to install.
- **3D:** Three.js (CDN) — glowing golden wireframe villa, ember particle shaders, scroll-driven cinematic camera.
- **Motion:** GSAP + ScrollTrigger (CDN) for section reveals and counters, Lenis for smooth scrolling.
- **Design:** Gold-on-near-black luxury palette, glassmorphism cards, HUD-style monospace labels.

## Files

| File | Purpose |
|---|---|
| `index.html` | All content & markup (services, AMC plans, process, contact) |
| `css/style.css` | Full design system |
| `js/main.js` | Three.js scene + GSAP/Lenis choreography |

## Editing content

- **Services / AMC plan features / copy:** edit `index.html` directly — plain HTML.
- **Stats numbers:** the `data-count` attributes in the `#stats` section.
- **Phone / WhatsApp:** search for `971522338499` in `index.html` and `js/main.js`.
- **Colors:** CSS variables at the top of `css/style.css` (`--gold`, `--bg`, …).
- **Camera path / particles:** `camPathPos` keyframes and `buildEmbers`/`buildDust` counts in `js/main.js`.

## Run locally

No server tooling installed? Use the bundled PowerShell server from the repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve-website.ps1 -Port 4173
# then open http://localhost:4173
```

## Deploy status

The site is **already live** at https://mendtech23.github.io/mts-field-app/website/ because this folder ships inside the `mts-field-app` repo, and that repo publishes `main` to GitHub Pages. No extra deploy step is needed — commit to `main` and the site updates.

## Connect the custom domain (www.mendtechservices.com)

The `CNAME` file in this folder does nothing while the site lives in a subfolder — GitHub Pages only reads a `CNAME` at the published root. To put the site on the real domain:

1. Create a new GitHub repository (e.g. `mts-website`).
2. Push the **contents of this `website/` folder** to it (`index.html` at repo root — the `CNAME` file is then at the root, where Pages reads it).
3. Repo → Settings → Pages → Deploy from branch → `main` / root.
4. At your DNS provider, create a CNAME record pointing `www` → `mendtech23.github.io`, then enable "Enforce HTTPS" in the Pages settings.

Also works as a drag-and-drop deploy on Netlify or Vercel (no configuration needed).

## Finish the Zoho CRM lead connection

The contact form is already wired to post leads into Zoho CRM. It currently falls back to WhatsApp because two webform tokens are placeholders. To switch it on:

1. In Zoho CRM: **Setup → Developer Space → Webforms → Leads → Create Form**.
2. Add these fields to the form: **Last Name**, **Phone**, **Email**, **Description**. Optionally add **Lead Source** as a hidden field set to `Website`.
3. Save the form and open its **embed code**. In the embed HTML, find the two hidden inputs named `xnQsjsdp` and `xmIwtLD` and copy their `value` strings.
4. In `js/main.js`, find the `ZOHO_WEBFORM` block and replace `PASTE_XNQSJSDP_TOKEN` and `PASTE_XMIWTLD_TOKEN` with those two values.
5. Commit and push to `main`. After the Pages redeploy (~1 minute), the form button changes to "Send Request" and submissions create Leads in Zoho CRM.
6. Test it: submit the live form once, then check **Leads** in Zoho CRM for the new entry.

Until the tokens are pasted, the form keeps opening WhatsApp with the enquiry pre-filled, so no lead is lost either way.
