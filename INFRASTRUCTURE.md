# Infrastructure

How Dynode is hosted, configured, and connected to upstreams. For feature
requirements see [REQUIREMENTS.md](REQUIREMENTS.md); for day-to-day usage see
[README.md](README.md).

## 1. Platform

| Item | Value |
| --- | --- |
| Product | Dynode (`package.json` name: `dynode`) |
| Host | **Zuplo** managed edge |
| Project config | `zuplo.jsonc` (`version: 1`, `compatibilityDate: 2025-02-06`) |
| Runtime | TypeScript modules on Zuplo / Workers-like edge |
| Package | `zuplo` ^6 |
| Default project type | Managed edge (no `projectType` override in `zuplo.jsonc`) |

Deploy model: Git-connected Zuplo project (or portal/CLI deploy). There is **no**
in-repo Dockerfile or GitHub Actions deploy pipeline.

**Deployed gateway (example):** `https://dynode-main-8eca196.zuplo.app`

## 2. Environments

| Environment | Secrets / config | Entry |
| --- | --- | --- |
| Local | `.env` (from `env.example`); optional `.env.zuplo` from `zuplo link` | `npm run dev` → `:9000`, editor `:9100` |
| Deployed | Zuplo portal environment variables | Project URL (e.g. `*.zuplo.app`) |

Do not commit `.env` / `.env.zuplo` (see `.gitignore`).

### Required secrets

| Name | Used by | Notes |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | Weather handlers | Mandatory for `/weather/*` |

Flights use public Avinor HTTP feeds — **no** Avinor API key.

## 3. Request pipeline

```text
Client
  → OpenAPI route (config/routes.oas.json)
  → Inbound policies (config/policies.json)
       1. custom normalize cache key
       2. caching-inbound (TTL below)
  → Handler module (modules/*)
  → Upstream (OpenWeather or Avinor)
  → Response format + optional field filter
```

### Cache namespaces and TTLs

| Route family | Normalize policy | Cache policy | TTL | Version bump |
| --- | --- | --- | --- | --- |
| Weather Sweden | `weather-sweden-normalize-cache-key` | `weather-sweden-cache-inbound` | 3600s | `POST /weather/sweden/reset` |
| Weather Norway | `weather-norway-normalize-cache-key` | `weather-norway-cache-inbound` | 3600s | `POST /weather/norway/reset` |
| Weather Poland | `weather-poland-normalize-cache-key` | `weather-poland-cache-inbound` | 3600s | `POST /weather/poland/reset` |
| Flights Norway | `flights-normalize-cache-key` | `flights-cache-inbound` | 180s | `POST /flights/norway/reset` |

Only HTTP **200** responses are cached. Cache invalidation bumps a `ZoneCache`
version key included in the normalized request URL.

Flights cache keys normalize direct lookups to canonical `gates`, `iata`, and
`direction` values (player ids are resolved to gates/iata before caching).

## 4. Upstream dependencies

| Service | Protocol | Auth | Purpose |
| --- | --- | --- | --- |
| OpenWeather | HTTPS JSON | Query `appid` | Current weather |
| Avinor XmlFeed `asrv.avinor.no/XmlFeed/v1.0` | HTTPS XML | None | Flights by airport |
| Avinor airportNames `asrv.avinor.no/airportNames/v1.0` | HTTPS XML | None | IATA → city/name (`airportName`) |

Avinor parameter names are **case-sensitive**. Responses are
`Content-Type: application/xml;charset=iso-8859-1` with XML decl
`encoding="ISO-8859-1"`. The gateway decodes with `TextDecoder("iso-8859-1")`
before parsing so Norwegian characters (æ/ø/å) stay intact, then returns UTF-8
JSON/JS to clients.

For `direction=AD`, the gateway fetches arrivals and departures separately and
merges the results.

Gateway enriches flights in-process and caches airport-name maps in memory
(process/isolate lifetime, ~24h TTL logic). Avinor asks consumers to refresh
flight feeds about **every 3 minutes** and to cache on their side; reference
data (airport/airline names, statuses) need not be polled more than daily.

## 5. Data plane (players)

| Asset | Role |
| --- | --- |
| `modules/players/sweden.ts` | Sweden weather players |
| `modules/players/norway.ts` | Norway weather + flights players |
| `modules/players/poland.ts` | Poland weather players |
| `modules/players/test.ts` | Shared QA players merged into all country lookups |
| `modules/players/types.ts` | Types, `parseGates`, `createCountryPlayerLookup` |
| `modules/players/NorwayPlayers.csv` | Source CSV for Norway flight players |
| `scripts/update-norway-from-csv.mjs` | Regenerate `norway.ts` from CSV |

Player records ship **inside the edge bundle** (editable in Zuplo editor / Git).
They are not loaded from an external DB.

## 6. Client / CMS integration

| Component | Hosting | Data path |
| --- | --- | --- |
| Signage sample `samples/v1/` | Docs portal `/samples/v1/` | Live `/flights/norway` (JS `data = {...};` via script tag) |
| Live gateway | Zuplo edge | Queried by sync jobs (manual or automated download) |

Gateway routes use `corsPolicy: "none"`. The v1 sample loads the default JS
response (`data = {...};`) with a dynamic script tag so it works cross-origin
without CORS.

Supported flights query modes from signage URLs:

- Player: `player`, `resource_id`, or legacy `com.broadsign.suite.bsp.resource_id`
- Direct: `gates` (+ optional `iata`; legacy alias `gate`)

## 7. Developer portal

| Item | Detail |
| --- | --- |
| Tooling | Zudoku (`docs/` workspace) |
| Config | `docs/zudoku.config.tsx` |
| OpenAPI input | `../config/routes.oas.json` |
| Pages | `introduction.mdx`, `markdown.mdx` |
| Local | `npm run docs` |

## 8. Local tooling

| Command / file | Purpose |
| --- | --- |
| `npm run dev` | Gateway + editor (docs disabled) |
| `npm run docs` | Docs portal |
| `npm run test` | `zuplo test` |
| `start-dev.ps1` | Free ports 9000/9100 then start dev (Windows) |
| `.vscode/launch.json` | Debug via Zuplo CLI |
| `node scripts/update-norway-from-csv.mjs` | Regenerate Norway player dataset |

## 9. Scaling / future countries

Current pattern per country:

1. Add `modules/players/{country}.ts`.
2. Wire weather factory modules + policies + routes (`/weather/{country}`).
3. Add flights only when a country provider exists (Norway = Avinor today).

A future provider registry (country → weather/flights provider) is optional; not
required until a third country or second flights provider appears.

## 10. Operational checklist

1. Connect Git repo to Zuplo project.
2. Set `OPENWEATHER_API_KEY` in each deployed environment.
3. Deploy / push; verify `/weather/norway`, `/weather/poland`, and `/flights/norway` with a test player.
4. For signage demo: open `/samples/v1/index.html?resource_id=759244535` or
   `?gates=D9&iata=OSL` in the docs portal.
5. Optionally publish the Zudoku portal from `docs/`.
6. After updating `NorwayPlayers.csv`, run `node scripts/update-norway-from-csv.mjs` and deploy.
