# Mendonca Technical Services — Website

Futuristic 3D marketing website for **Mendonca Technical Services LLC** (www.mendtechservices.com).

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

## Deploy (GitHub Pages)

1. Create a new GitHub repository (e.g. `mts-website`).
2. Push the **contents of this `website/` folder** to it (index.html at repo root).
3. Repo → Settings → Pages → Deploy from branch → `main` / root.
4. The included `CNAME` file already declares `www.mendtechservices.com` — GitHub Pages
   picks it up automatically. At your DNS provider, create a CNAME record pointing
   `www` → `<username>.github.io`, then enable "Enforce HTTPS" in the Pages settings.

Also works as a drag-and-drop deploy on Netlify or Vercel (no configuration needed).
