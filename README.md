# ⛳ ParSense

A golf companion web app — AI caddie, live scorecard, course finder, and golf-specific weather. Built as a progressive web app: no backend, no accounts, installable on your phone, and it keeps working on the course when you lose signal.

**Live:** [parsense-golf.netlify.app](https://parsense-golf.netlify.app)

---

## Features

### Profile
Your golfer profile drives personalization across the whole app — name, home town, handicap bracket, typical 18-hole score, and your driver / 7-iron carry distances. Click the avatar to generate a new randomized golf scene (sunsets, night skies with stars, bunkers, tree lines, and a golfer character with varied hair, skin tones, and outfits).

### AI Coach
- **Chat caddie** — answers on slicing, hooking, putting, chipping, bunkers, course management, and pre-shot routine, personalized with your name and round history.
- **Shot Planner** — enter the distance to the pin plus wind and elevation, and it calculates what the shot *plays like* and picks the club from your bag. Pulls wind speed and temperature from the latest weather lookup automatically.

### Course Selection
- Finds real golf courses near your home town (or your exact GPS location) using OpenStreetMap data.
- Shows address, distance, and — where verified — par, hole count, and yardage.
- Links straight to each course's real booking page and its rules/info page.
- Sort by closest, shorter courses first, or longer courses first.

### Scoreboard
A live hole-by-hole scorecard. Editable par per hole to match the real card, color-coded results (birdie / bogey / double), OUT and IN subtotals, and a running **Thru / Strokes / To Par** summary. Auto-saves every tap, so you can close the app mid-round and pick up where you left off.

### Round Archive
Saved rounds with computed stats — rounds played, average score, best score, average to par, and average putts.

### Weather
Live conditions from Open-Meteo with a golf-specific verdict (wind affecting club selection, rain, cold killing carry distance, lightning warnings), plus an interactive precipitation radar centered on your location.

---

## Tech

Plain HTML, CSS, and JavaScript — no framework, no build step, no bundler. Open `index.html` and it runs.

| Concern | Approach |
|---|---|
| Data storage | `localStorage` — per device, nothing leaves the browser |
| Weather | [Open-Meteo](https://open-meteo.com/) (free, no API key) |
| Radar | [Windy.com](https://www.windy.com/) embed |
| Course data | [OpenStreetMap](https://www.openstreetmap.org/) via the Overpass API |
| Geocoding | Open-Meteo geocoding |
| Offline | Service worker caching the app shell |

No API keys are required, and no server is needed.

---

## Running locally

Open `index.html` directly, or serve it (needed for the service worker and geolocation):

```bash
python -m http.server 5173
```

Then visit `http://localhost:5173`.

---

## Project structure

```
index.html      markup for all six tabs
style.css       styling, theming, light/dark palettes
app.js          all application logic
sw.js           service worker (offline support)
manifest.json   PWA manifest
icon-192.png    app icons
icon-512.png
```

---

## Privacy

**What stays on your device:** profiles, rounds, scores, and your avatar live in your browser's `localStorage`. There is no backend, no account, and no analytics. Each person who opens the app gets their own independent copy, and nobody can see anyone else's data.

**What leaves your device:** ParSense talks to third-party services to answer requests, and those requests necessarily include your IP address plus:

| Service | What it receives | Why |
|---|---|---|
| Open-Meteo | The town you type, then its coordinates | Weather conditions and geocoding |
| Overpass / OpenStreetMap | Coordinates of your home town, or your GPS position if you use "Use my exact location" | Finding nearby courses |
| Windy.com | Coordinates, via an embedded iframe | Precipitation radar |
| Google | Course name, only when you click a fallback search link | Finding tee times / rules |

The Windy radar is a third-party embed and may set its own cookies. If you deploy this for others, that is worth disclosing to them — it's the one component that could carry tracking you don't control.

---

## Security

- **No backend, no accounts, no API keys** — there is no server to breach, no credentials to steal, and no secrets in the source.
- **No third-party JavaScript** — zero npm dependencies, so no supply-chain exposure.
- **Output escaping** — all third-party data (OpenStreetMap tags are world-editable) is escaped for both text and HTML attributes before rendering.
- **Link validation** — only `http(s)` URLs are rendered as links; `javascript:` and `data:` URLs are dropped.
- **Content Security Policy** — `_headers` ships a strict CSP that permits scripts only from the app's own origin and network calls only to the specific weather/course APIs it uses, plus `nosniff`, `frame-ancestors 'none'`, a locked-down `Permissions-Policy`, and a sandboxed radar iframe.

If you find a security issue, please open an issue on this repository.

## Known limitations

- The coach is **rule-based keyword matching**, not a large language model.
- Par and yardage are only shown for courses that have been manually verified; OpenStreetMap carries no par data.
- Course hours are rarely published to OpenStreetMap, so most courses show "Hours not listed" rather than a guessed time.
- Course length is used as a rough proxy for difficulty — slope and course ratings aren't available in any free dataset.
- Data does not sync between devices or browsers.
