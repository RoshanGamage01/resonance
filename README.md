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

### One-time setup (required)

If the deploy job fails with **404** / “Ensure GitHub Pages has been enabled”, the site is not wired to Actions yet:

1. Open **https://github.com/RoshanGamage01/resonance/settings/pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Save if GitHub shows a save control, then **re-run the failed workflow** (Actions → workflow run → Re-run all jobs).

After a successful deploy, the app is at **https://roshangamage01.github.io/resonance/** (HTTPS is fine for the microphone API).

If you rename the repository, change `VITE_BASE` in the workflow to `/new-repo-name/`.
