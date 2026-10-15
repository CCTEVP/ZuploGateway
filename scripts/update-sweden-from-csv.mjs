import fs from "node:fs";

const playersDir = new URL("../modules/players/", import.meta.url);
const csvPath = new URL("sweden.csv", playersDir);
const tsPath = new URL("sweden.ts", playersDir);

/**
 * CSV column → PlayerSourceRecord field.
 * "Alternate Name/Street" (site code) has no matching field and is dropped.
 */
const COLUMNS = [
  ["Broadsign Player ID", "PlayerID", "number"],
  ["Broadsign Display Unit ID", "DisplayUnitID", "number"],
  ["Frame ID", "FrameID", "number"],
  ["Panels ID", "PanelID", "number"],
  ["Latitude", "Latitude", "number"],
  ["Longitude", "Longitude", "number"],
  ["Country", "Country", "string"],
  ["Municipality", "City", "string"],
  ["Name/Street", "NameStreet", "string"],
  ["Address 1", "Address", "string"],
];

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

const lines = fs
  .readFileSync(csvPath, "utf8")
  .replace(/^﻿/, "")
  .replace(/\r\n?/g, "\n")
  .split("\n")
  .filter((line) => line.trim().length > 0);

const header = parseCsvLine(lines[0]).map((name) => name.trim());
const columnIndex = COLUMNS.map(([csvName]) => {
  const index = header.indexOf(csvName);
  if (index === -1) {
    throw new Error(`Missing CSV column: ${csvName}`);
  }
  return index;
});

// One record per CSV row (one row per frame/panel), matching the previous
// sweden.ts convention. Player lookup resolves to the first row per PlayerID.
const records = lines.slice(1).map((line, rowIndex) => {
  const cells = parseCsvLine(line);
  const fields = [];

  COLUMNS.forEach(([csvName, field, type], i) => {
    const raw = (cells[columnIndex[i]] ?? "").trim();
    if (!raw) {
      return;
    }
    if (type === "number") {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(
          `Row ${rowIndex + 2}: "${csvName}" is not a number (${raw})`,
        );
      }
      fields.push(`    ${field}: ${raw},`);
    } else {
      fields.push(`    ${field}: ${JSON.stringify(raw)},`);
    }
  });

  return ["  {", ...fields, "  }"].join("\n");
});

const output = `import {
  createCountryPlayerLookup,
  type PlayerSourceRecord,
} from "./types";
import { testPlayerRecords } from "./test";

const playerRecords: PlayerSourceRecord[] = [
${records.join(",\n")},
];

export const swedenPlayers = createCountryPlayerLookup(
  playerRecords,
  testPlayerRecords,
);
`;

fs.writeFileSync(tsPath, output);
console.log(`Wrote ${records.length} records to sweden.ts`);
