# Developer Portal

Zudoku portal for the **Dynode** Zuplo gateway. The API reference is generated
from `config/routes.oas.json`.

## Service summary

| Area | Endpoints |
| --- | --- |
| Weather (Sweden) | `GET /weather/sweden`, `POST /weather/sweden/reset` |
| Weather (Norway) | `GET /weather/norway`, `POST /weather/norway/reset` |
| Weather (Poland) | `GET /weather/poland`, `POST /weather/poland/reset` |
| Flights (Norway) | `GET /flights/norway`, `POST /flights/norway/reset` |

### Data sources

| Route family | Upstream | Secret |
| --- | --- | --- |
| `/weather/*` | OpenWeather current weather | `OPENWEATHER_API_KEY` |
| `/flights/norway` | Avinor public XmlFeed + airport names | None |

### Player datasets

Country files in `modules/players/`:

- `sweden.ts`, `norway.ts`, `poland.ts` — country-specific players
- `test.ts` — demo/QA players merged into **every** country lookup

Norway flights players support multi-gate values (`Gate` field) and optional
`IATA`. Norway data can be regenerated from `NorwayPlayers.csv` using
`scripts/update-norway-from-csv.mjs`.

### Flights lookup modes

1. **Direct** — `gates` (+ optional `iata`, default `OSL`)
2. **Player** — `player`, `resource_id`, or legacy `com.broadsign.suite.bsp.resource_id`

Modes are mutually exclusive.

### Signage sample

Linked from the portal nav: `/samples/v1/index.html` (source in `samples/v1/`
and `docs/public/samples/v1/`). Loads live `/flights/norway` using query
parameters from the page URL.

## Portal pages

- [Service Overview](./pages/introduction.mdx)
- [Quick Reference](./pages/markdown.mdx)
- [API Reference](/api) (from OpenAPI)

## Related repo docs

- [README.md](../README.md) — local dev and architecture
- [REQUIREMENTS.md](../REQUIREMENTS.md) — functional requirements
- [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) — hosting, caches, upstreams

## Local development

From the repository root:

```bash
npm install
npm run docs
```

Or from this directory:

```bash
npm run dev
```

Gateway (separate terminal): `npm run dev` from repo root → `:9000`.
