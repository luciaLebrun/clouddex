# Clouddex ☁️ — a Pokedex for clouds

Take a photo of the sky and the app identifies the **cloud genus** on-device,
then lets you **collect all 10 WMO cloud types** like a Pokedex. It's a
Progressive Web App: installable to a phone's home screen, works offline, no
account, no backend, no API keys — **free for everyone**.

## How it works

- **React + Vite + TypeScript** PWA (`vite-plugin-pwa`).
- **TensorFlow.js** runs an image classifier **in the browser** — the photo
  never leaves the device.
- The model is a drop-in asset in `public/model/`. Until you add one, the app
  runs in clearly-labelled **demo mode** so the whole flow is testable.
- See `training/README.md` for the two ways to produce the model (Google
  Teachable Machine — no code; or a Python/Keras pipeline) using the free
  **CCSN** cloud dataset.

## Run it

```bash
npm install
npm run dev          # open the printed localhost URL
npm run host         # serve on your LAN to test on a real phone
npm run build        # production build (PWA assets generated)
npm run preview      # preview the production build
```

### Try on a phone
`npm run host`, then open the `http://<your-ip>:5173` URL on your phone (same
Wi-Fi). Tap **Scan the sky**, take a photo. For installability + offline you
need HTTPS — use a free preview deploy (below) or `vite preview` over a tunnel.

## Deploy (free)

Any static host works — Vercel, Netlify, GitHub Pages, Cloudflare Pages.
Build command `npm run build`, output dir `dist`. All free tiers.

## Project map

| Path | What |
| --- | --- |
| `src/components/CameraCapture.tsx` | Photo capture (rear camera) |
| `src/components/ResultCard.tsx` | Prediction + top-3 + low-confidence state |
| `src/components/Clouddex.tsx` | Collection grid (locked/unlocked) |
| `src/ml/preprocess.ts` | **Shared** 224×224 / [-1,1] preprocessing |
| `src/ml/model.ts` | Loads + warms up the TF.js model (demo fallback) |
| `src/ml/predict.ts` | Inference → top-k predictions |
| `src/data/genera.ts` | The 10 genera (+ contrail) metadata & labels |
| `src/store/collection.ts` | Local persistence of caught genera |
| `training/` | Model training + export pipeline (not shipped) |

## Status

This is a **proof of concept**. Accuracy on subtle high clouds (cirrus family)
is inherently limited; more training data is the main lever. Future ideas:
live camera preview, geolocation/weather context, an optional cloud-LLM
fallback for low-confidence shots, and Capacitor native builds.
