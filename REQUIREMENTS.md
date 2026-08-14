# Requirements

Product and technical requirements for **Dynode** (Zuplo gateway for
players). Operational how-to lives in [README.md](README.md); deployment detail
in [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## 1. Goals

- Expose edge APIs that resolve **player IDs** (or explicit coords /
  gates) to **weather** and **flight** data suitable for digital signage.
- Keep country-specific player data maintainable in-repo (and in the Zuplo
  editor).
- Prefer short, cacheable responses (JS or JSON) for players / CMS sync jobs.

## 2. Functional requirements

### 2.1 Player identity

| ID | Requirement |
| --- | --- |
| P-1 | Accept player id via `player` or `resource_id`. |
| P-2 | Player datasets are **country-scoped** (`sweden`, `norway`, …). |
| P-3 | Shared **test/demo** players (`modules/players/test.ts`) are merged into every country lookup. |
| P-4 | Flights players may include optional `Gate` and `IATA`. |
| P-5 | Weather players resolve to latitude/longitude. |

### 2.2 Weather

| ID | Requirement |
| --- | --- |
| W-1 | Country routes: `/weather/sweden`, `/weather/norway` (extensible per country). |
| W-2 | Resolve location from `latlon` **or** player id. |
| W-3 | Round coordinates to 3 decimal places before upstream call. |
| W-4 | Upstream: OpenWeather current weather (`units=metric`). |
| W-5 | Require `OPENWEATHER_API_KEY`; fail closed if missing. |
| W-6 | Default response filter (temp, weather main, wind, rain, coord); bypass with `filter=false`. |
| W-7 | Default body `data = {...};`; `format=json` for JSON. |
| W-8 | `debug=true` includes masked upstream URL and matched player when applicable. |
| W-9 | Cache successful HTTP 200 responses for **3600s**; reset via `POST /weather/{country}/reset`. |

### 2.3 Flights (Norway)

| ID | Requirement |
| --- | --- |
| F-1 | Route: `/flights/norway` (Avinor provider). |
| F-2 | `gate` and `player` are mutually exclusive. |
| F-3 | Player without `Gate` → standard error `player_has_no_gate`. |
| F-4 | Default airport `OSL` when IATA not on player / query. |
| F-5 | Default `direction=AD` (arrivals + departures); overridable with `A` or `D`. |
| F-6 | Upstream: public Avinor XmlFeed + airportNames enrichment (`airportName`). |
| F-7 | Filter flights to the resolved gate. |
| F-8 | Include Avinor attribution in the payload. |
| F-9 | Cache successful HTTP 200 for **180s** (aligned with Avinor’s ~3 minute refresh guidance); reset via `POST /flights/norway/reset`. |
| F-10 | Same `format` / `filter` / `debug` conventions as weather. |

### 2.4 Sample signage client

| ID | Requirement |
| --- | --- |
| S-1 | Portrait **1080×1920** HTML sample under `samples/v1/`. |
| S-2 | Split assets: HTML, CSS, JS. |
| S-3 | Call `/flights/norway` at runtime; read `player` or `resource_id` from the page URL and append to the request. |
| S-4 | Display next departure/arrival from that local payload (city, schedule, ETA/ETD, status). |

## 3. Non-functional requirements

| ID | Requirement |
| --- | --- |
| N-1 | Runtime: Zuplo **managed edge** (Workers-compatible TypeScript). |
| N-2 | No DOM XML parser dependency for Avinor; use Workers-safe parsing. |
| N-3 | Secrets only via Zuplo environment / local `.env` (never commit secrets). |
| N-4 | CORS: routes currently use `corsPolicy: none` (signage sync is offline-file based). |
| N-5 | OpenAPI (`routes.oas.json`) remains the contract for the developer portal. |
| N-6 | Respect Avinor terms: attribution; avoid client hammering (gateway cache). |

## 4. Out of scope (current)

- Flights providers for countries other than Norway.
- In-repo CI/CD or custom deploy scripts (Git → Zuplo portal deploy).
- Live browser fetch from the sample to Zuplo (CORS / CMS sync uses downloaded JS).
- Authentication / API keys on gateway routes (unless added later in Zuplo).

## 5. Acceptance checks

- [ ] `/weather/sweden` and `/weather/norway` resolve country + test players.
- [ ] `/flights/norway?player=<test id>` returns gate-filtered departures for OSL demo gates.
- [ ] `gate` + `player` together returns `gate_and_player_conflict`.
- [ ] Weather without `OPENWEATHER_API_KEY` fails with configuration error.
- [ ] `samples/v1` loads live flight data when `player` or `resource_id` is on the URL.
