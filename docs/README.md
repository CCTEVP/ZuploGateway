# Developer Portal

Zudoku portal for the Dynode Zuplo gateway. API reference is generated from
`config/routes.oas.json`.

## Service summary

| Area | Endpoints |
| --- | --- |
| Weather (Sweden) | `GET /weather/sweden`, `POST /weather/sweden/reset` |
| Weather (Norway) | `GET /weather/norway`, `POST /weather/norway/reset` |
| Flights (Norway) | `GET /flights/norway`, `POST /flights/norway/reset` |

Players live in `modules/players/` (`sweden`, `norway`, plus shared `test`
merged into every country). Flights use Avinor; weather uses OpenWeather
(`OPENWEATHER_API_KEY`).

Signage sample: `samples/v1/` (loads local
`bsp/sync/bmonorway/flightsdata.js`, not the live API).

See the root [README.md](../README.md), [REQUIREMENTS.md](../REQUIREMENTS.md),
[INFRASTRUCTURE.md](../INFRASTRUCTURE.md), and portal pages:

- [Service Overview](./pages/introduction.mdx)
- [Quick Reference](./pages/markdown.mdx)

## Local Development

1. From the repository root:

   ```bash
   npm install
   npm run docs
   ```

2. Or run only the portal from `docs/`:

   ```bash
   npm run dev
   ```
