import fs from "node:fs";

const playersDir = new URL("../modules/players/", import.meta.url);
const csvPath = new URL("poland.csv", playersDir);
const tsPath = new URL("poland.ts", playersDir);

/**
 * CSV column → PlayerSourceRecord field.
 * "Panel Alt ID", "Name", "Location Sub Type" and "Address2" have no matching
 * field and are dropped.
 */
const COLUMNS = {
  playerId: "Broadsign Player ID",
  displayUnitId: "Broadsign Display Unit ID",
  panelId: "Panel ID",
  latitude: "Latitude",
  longitude: "Longitude",
  city: "City",
  address: "Address1",
};

/**
 * Optional column: ODT planner stop IDs for /transit/poland, separated by
 * commas or semicolons (see scripts/suggest-poland-stops.mjs).
 */
const STOPS_COLUMN = "Stops";

const COUNTRY = "Poland";

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

function toNumber(raw, column, rowNumber) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) {
    throw new Error(`Row ${rowNumber}: "${column}" is not a number (${raw})`);
  }
  return raw;
}

const lines = fs
  .readFileSync(csvPath, "utf8")
  .replace(/^﻿/, "")
  .replace(/\r\n?/g, "\n")
  .split("\n")
  .filter((line) => line.trim().length > 0);

const header = parseCsvLine(lines[0]).map((name) => name.trim());
const index = Object.fromEntries(
  Object.entries(COLUMNS).map(([key, column]) => {
    const position = header.indexOf(column);
    if (position === -1) {
      throw new Error(`Missing CSV column: ${column}`);
    }
    return [key, position];
  }),
);

const stopsIndex = header.indexOf(STOPS_COLUMN);

// One record per CSV row (one row per panel). Player lookup resolves to the
// first row per PlayerID.
const records = [];
let skippedNoPlayer = 0;

lines.slice(1).forEach((line, i) => {
  const rowNumber = i + 2;
  const cells = parseCsvLine(line).map((cell) => cell.trim());
  const playerId = cells[index.playerId];

  // Panels without an assigned Broadsign player cannot be looked up.
  if (!playerId || playerId === "0") {
    skippedNoPlayer++;
    return;
  }

  const fields = [
    `    PlayerID: ${toNumber(playerId, COLUMNS.playerId, rowNumber)},`,
    `    DisplayUnitID: ${toNumber(cells[index.displayUnitId], COLUMNS.displayUnitId, rowNumber)},`,
    `    PanelID: ${toNumber(cells[index.panelId], COLUMNS.panelId, rowNumber)},`,
    `    Latitude: ${toNumber(cells[index.latitude], COLUMNS.latitude, rowNumber)},`,
    `    Longitude: ${toNumber(cells[index.longitude], COLUMNS.longitude, rowNumber)},`,
    `    Country: ${JSON.stringify(COUNTRY)},`,
  ];
  if (cells[index.city]) {
    fields.push(`    City: ${JSON.stringify(cells[index.city])},`);
  }
  if (cells[index.address]) {
    fields.push(`    Address: ${JSON.stringify(cells[index.address])},`);
  }
  const stops = stopsIndex === -1 ? [] : (cells[stopsIndex] ?? "")
    .split(/[,;\s]+/)
    .filter(Boolean);
  if (stops.length) {
    fields.push(`    Stops: ${JSON.stringify(stops)},`);
  }

  records.push(["  {", ...fields, "  }"].join("\n"));
});

const output = `import { createCountryPlayerLookup, type PlayerSourceRecord } from "./types";
import { testPlayerRecords } from "./test";

const playerRecords: PlayerSourceRecord[] = [
${records.join(",\n")},
];

export const polandPlayers = createCountryPlayerLookup(
  playerRecords,
  testPlayerRecords,
);
`;

fs.writeFileSync(tsPath, output);
console.log(`Wrote ${records.length} records to poland.ts`);
console.log(`Skipped ${skippedNoPlayer} rows without a Broadsign Player ID`);
