export type PlayerLocationSourceRecord = {
  BroadsignPlayerID: number;
  DisplayUnitsID: number;
  BroadsignDisplayUnitID: number;
  FrameID: number;
  PanelsID: number;
  IDSFaceID: number;
  Latitude: number;
  Longitude: number;
  Country: string;
  Municipality: string;
  NameStreet: string;
  Address: string;
};

export type PlayerLocationRecord = {
  playerId: string;
  latitude: number;
  longitude: number;
};

const playerLocationRecords: PlayerLocationSourceRecord[] = [
  {
    BroadsignPlayerID: 616575581,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903922,
    FrameID: 561903926,
    PanelsID: 151905,
    IDSFaceID: 42053,
    Latitude: 56.67625994,
    Longitude: 12.85745516,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Lilla torg",
    Address: "Lilla torg",
  },
  {
    BroadsignPlayerID: 245531480,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903945,
    FrameID: 561903948,
    PanelsID: 151906,
    IDSFaceID: 38926,
    Latitude: 56.6748874,
    Longitude: 12.85971525,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Hamngatan 27",
    Address: "Hamngatan 27",
  },
  {
    BroadsignPlayerID: 245531480,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903945,
    FrameID: 561903949,
    PanelsID: 151907,
    IDSFaceID: 38927,
    Latitude: 56.67488926,
    Longitude: 12.85971514,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Hamngatan 27",
    Address: "Hamngatan 27",
  },
  {
    BroadsignPlayerID: 245531594,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903969,
    FrameID: 561903973,
    PanelsID: 151908,
    IDSFaceID: 38928,
    Latitude: 56.67413672,
    Longitude: 12.85664749,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Köpmansgatan - Stora torg",
    Address: "Köpmansgatan - Stora torg",
  },
  {
    BroadsignPlayerID: 245531594,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903969,
    FrameID: 561903974,
    PanelsID: 151909,
    IDSFaceID: 38929,
    Latitude: 56.67413922,
    Longitude: 12.85664975,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Köpmansgatan - Stora torg",
    Address: "Köpmansgatan - Stora torg",
  },
  {
    BroadsignPlayerID: 244497949,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903893,
    FrameID: 561903896,
    PanelsID: 151902,
    IDSFaceID: 38930,
    Latitude: 56.66504742,
    Longitude: 12.87847848,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Högskolan i Halmstad",
    Address: "Kristian IV:s väg 3",
  },
  {
    BroadsignPlayerID: 244497949,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903893,
    FrameID: 561903897,
    PanelsID: 151903,
    IDSFaceID: 38931,
    Latitude: 56.66504904,
    Longitude: 12.87847644,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Högskolan i Halmstad",
    Address: "Kristian IV:s väg 3",
  },
  {
    BroadsignPlayerID: 616575581,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903922,
    FrameID: 561903925,
    PanelsID: 151904,
    IDSFaceID: 42055,
    Latitude: 56.67625994,
    Longitude: 12.85745516,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Lilla torg",
    Address: "Lilla torg",
  },
  {
    BroadsignPlayerID: 228528353,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 228527931,
    FrameID: 367983619,
    PanelsID: 130813,
    IDSFaceID: 4680,
    Latitude: 56.67249483,
    Longitude: 12.85756173,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Rådhusgatan 4/Storgatan",
    Address: "Rådhusgatan 4",
  },
  {
    BroadsignPlayerID: 228528353,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 228527931,
    FrameID: 228527933,
    PanelsID: 130812,
    IDSFaceID: 4679,
    Latitude: 56.67249483,
    Longitude: 12.85756173,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Rådhusgatan 4/Storgatan",
    Address: "Rådhusgatan 4",
  },
  {
    BroadsignPlayerID: 582309742,
    DisplayUnitsID: 254,
    BroadsignDisplayUnitID: 561903987,
    FrameID: 561903991,
    PanelsID: 151910,
    IDSFaceID: 38932,
    Latitude: 56.67249483,
    Longitude: 12.85756173,
    Country: "Sweden",
    Municipality: "Halmstad",
    NameStreet: "Rådhusgatan 4/Storgatan",
    Address: "Rådhusgatan 4",
  },
];

export function findPlayerLocationSourceRecord(playerId: string) {
  return playerLocationRecords.find(
    (item) => String(item.BroadsignPlayerID) === playerId,
  );
}

export function findPlayerLocation(playerId: string) {
  const record = findPlayerLocationSourceRecord(playerId);

  if (!record) {
    return undefined;
  }

  return {
    playerId: String(record.BroadsignPlayerID),
    latitude: record.Latitude,
    longitude: record.Longitude,
  };
}
