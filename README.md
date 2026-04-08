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

The repo includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): on every push to `main` it builds with `VITE_BASE=/resonance/` and deploys to GitHub Pages.

1. In the repo on GitHub: **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions** (once).
2. After the workflow runs, the site is at **https://roshangamage01.github.io/resonance/** (mic requires HTTPS, which GitHub Pages provides).

If you rename the repository, change `VITE_BASE` in the workflow to `/new-repo-name/`.
