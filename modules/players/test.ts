import { createPlayerLookup, type PlayerSourceRecord } from "./types";

/**
 * Shared demo/QA players available on every country endpoint.
 * Prefer this over copying the same player IDs into each country file.
 */
export const testPlayerRecords: PlayerSourceRecord[] = [
  {
    PlayerID: 759244535,
    DisplayUnitsID: 255,
    DisplayUnitID: 561903924,
    FrameID: 561903926,
    PanelsID: 151905,
    IDSFaceID: 42053,
    Latitude: 40.4332154,
    Longitude: -3.5558364,
    Country: "Spain",
    Municipality: "Coslada",
    NameStreet: "Fuentemar",
    Address: "Fuentemar 21",
    Gate: "D9",
    IATA: "OSL",
  },
  {
    PlayerID: 582309742,
    DisplayUnitsID: 254,
    DisplayUnitID: 561903922,
    FrameID: 561903926,
    PanelsID: 151905,
    IDSFaceID: 42053,
    Latitude: 40.4332154,
    Longitude: -3.5558364,
    Country: "Spain",
    Municipality: "Coslada",
    NameStreet: "Fuentemar",
    Address: "Fuentemar 21",
    Gate: "D1",
    IATA: "OSL",
  },
];

export const testPlayers = createPlayerLookup(testPlayerRecords);
