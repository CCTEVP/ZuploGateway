import fs from "node:fs";

const playersDir = new URL("../modules/players/", import.meta.url);
const csvPath = new URL("poland.csv", playersDir);
const tsPath = new URL("poland.ts", playersDir);

const CSV_HEADERS = [
  "PlayerID",
  "PanelID",
  "DisplayUnitID",
  "Latitude",
  "Longitude",
  "City",
  "NameStreet",
  "Address",
  "Country",
];

/** Legacy export column names in the previous poland.csv. */
const LEGACY_COLUMNS = {
  playerId: "Broadsign Player ID",
  panelId: "Panel ID",
  displayUnitId: "Broadsign Display Unit ID",
  latitude: "Latitude",
  longitude: "Longitude",
  city: "City",
  nameStreet: "Name/Street",
  address: "Address 1",
};

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0);

  const rawHeader = parseCsvLine(lines[0]).map((value) =>
    value.replace(/^\uFEFF/, "").trim(),
  );
  const headerIndex = Object.fromEntries(
    rawHeader.map((name, index) => [name, index]),
  );

  const get = (row, key) => row[headerIndex[key]]?.trim() ?? "";

  const rows = lines.slice(1).map(parseCsvLine).map((row) => ({
    PlayerID: get(row, LEGACY_COLUMNS.playerId) || get(row, "PlayerID"),
    PanelID:
      get(row, LEGACY_COLUMNS.panelId) ||
      get(row, "PanelID") ||
      get(row, "PanelsID"),
    DisplayUnitID:
      get(row, LEGACY_COLUMNS.displayUnitId) || get(row, "DisplayUnitID"),
    Latitude: get(row, LEGACY_COLUMNS.latitude) || get(row, "Latitude"),
    Longitude: get(row, LEGACY_COLUMNS.longitude) || get(row, "Longitude"),
    City:
      get(row, LEGACY_COLUMNS.city) ||
      get(row, "City") ||
      get(row, "Municipality"),
    NameStreet: get(row, LEGACY_COLUMNS.nameStreet) || get(row, "NameStreet"),
    Address: get(row, LEGACY_COLUMNS.address) || get(row, "Address"),
    Country: get(row, "Country") || "Poland",
  }));

  return rows.filter((row) => row.PlayerID);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(rows) {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      CSV_HEADERS.map((header) => escapeCsv(row[header])).join(","),
    ),
  ];
  fs.writeFileSync(csvPath, `${lines.join("\n")}\n`, "utf8");
}

function toNumber(value, field, playerId) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} for PlayerID ${playerId}: ${value}`);
  }
  return parsed;
}

function formatRecord(record) {
  const lines = ["  {", `    PlayerID: ${record.PlayerID},`];

  if (record.DisplayUnitID != null) {
    lines.push(`    DisplayUnitID: ${record.DisplayUnitID},`);
  }
  if (record.PanelID != null) {
    lines.push(`    PanelID: ${record.PanelID},`);
  }

  lines.push(`    Latitude: ${record.Latitude},`);
  lines.push(`    Longitude: ${record.Longitude},`);
  lines.push(`    Country: ${JSON.stringify(record.Country)},`);

  if (record.City) {
    lines.push(`    City: ${JSON.stringify(record.City)},`);
  }
  if (record.NameStreet) {
    lines.push(`    NameStreet: ${JSON.stringify(record.NameStreet)},`);
  }
  if (record.Address) {
    lines.push(`    Address: ${JSON.stringify(record.Address)},`);
  }

  lines.push("  }");
  return lines.join("\n");
}

const parsedRows = parseCsv(fs.readFileSync(csvPath, "utf8"));
writeCsv(parsedRows);

const seen = new Set();
const records = [];

for (const row of parsedRows) {
  const playerId = toNumber(row.PlayerID, "PlayerID", row.PlayerID);
  if (seen.has(playerId)) {
    continue;
  }
  seen.add(playerId);

  records.push({
    PlayerID: playerId,
    PanelID: row.PanelID
      ? toNumber(row.PanelID, "PanelID", playerId)
      : undefined,
    DisplayUnitID: row.DisplayUnitID
      ? toNumber(row.DisplayUnitID, "DisplayUnitID", playerId)
      : undefined,
    Latitude: toNumber(row.Latitude, "Latitude", playerId),
    Longitude: toNumber(row.Longitude, "Longitude", playerId),
    Country: row.Country || "Poland",
    City: row.City || undefined,
    NameStreet: row.NameStreet || undefined,
    Address: row.Address || undefined,
  });
}

const body = records.map(formatRecord).join(",\n");
const output = `import {
  createCountryPlayerLookup,
  type PlayerSourceRecord,
} from "./types";
import { testPlayerRecords } from "./test";

const playerRecords: PlayerSourceRecord[] = [
${body},
];

export const polandPlayers = createCountryPlayerLookup(
  playerRecords,
  testPlayerRecords,
);
`;

fs.writeFileSync(tsPath, output);
console.log(
  `Normalized ${parsedRows.length} CSV rows; wrote ${records.length} unique players to poland.ts`,
);
