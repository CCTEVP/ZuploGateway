## Zuplo API

This is a Zuplo API that was created with
[`create-zuplo-api`](https://zuplo.com/docs).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:9000](http://localhost:9000) with your browser to see the
result.

If you also want the docs server locally, run:

```bash
npm run docs
```

If port `9000` or `9100` is already in use, you can start the gateway with the
PowerShell launcher, which closes the previous listeners before starting npm:

```powershell
.\start-dev.ps1
```

Player lookup data for the weather route is stored directly in
`config/player-location-data.json` and is imported by the runtime without any
sync or generation step. The file is a flat list of player-to-coordinate rows
so it stays easy to edit directly locally or in the Zuplo editor.

The `/weather/` endpoint also supports an optional `debug=true|false` query
parameter. When `debug=true`, the response includes a `debug` object with an
`original` field containing the upstream OpenWeather URL, but with the `appid`
value masked with `*` characters before it is returned. Otherwise the `debug`
object is omitted.

You can start editing the API by modifying `config/routes.oas.json`. The dev
server will automatically reload the API with your changes.

## Learn More

To learn more about Zuplo, you can visit the
[Zuplo documentation](https://zuplo.com/docs).

To connect with the community join [Discord](https://discord.zuplo.com).
