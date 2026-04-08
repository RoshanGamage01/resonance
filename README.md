# Resonance

Real-time guitar tuner in the browser (React + TypeScript + Vite). Uses the Web Audio API `AnalyserNode` FFT for pitch detection.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. Use **localhost** or **HTTPS** so the microphone works.

```bash
npm run build
```

Outputs to `dist/`.

## GitHub Pages

The repo includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): on every push to `main` it builds with `VITE_BASE=/` (correct for the [custom domain](https://resonance.roshangamage.me/) via [`public/CNAME`](public/CNAME)) and deploys to GitHub Pages.

### One-time setup (required)

If the deploy job fails with **404** / “Ensure GitHub Pages has been enabled”, the site is not wired to Actions yet:

1. Open **https://github.com/RoshanGamage01/resonance/settings/pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Save if GitHub shows a save control, then **re-run the failed workflow** (Actions → workflow run → Re-run all jobs).

### URLs

- **Custom domain:** https://resonance.roshangamage.me/ (HTTPS works for the microphone API).
- If you need the **github.io project URL** (`…/resonance/`) instead, set `VITE_BASE` in the workflow to `/resonance/` and drop or change `public/CNAME` so paths match how you host.
