/** Weather location source: coordinates (default) or city name from player. */
export const WEATHER_SOURCE_QUERY_PARAM = "source";

export type WeatherSource = "latlon" | "city";

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  poland: "PL",
  sweden: "SE",
  norway: "NO",
  spain: "ES",
};

export function normalizeWeatherSource(
  value: string | null | undefined,
): WeatherSource | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "latlon";
  }
  if (normalized === "latlon" || normalized === "city") {
    return normalized;
  }
  return undefined;
}

export function isValidWeatherSource(
  value: string | null | undefined,
): boolean {
  return normalizeWeatherSource(value) !== undefined;
}

/** Map a full country name (or ISO code) to an OpenWeather ISO 3166 code. */
export function toOpenWeatherCountryCode(
  country: string | undefined,
): string | undefined {
  if (!country) {
    return undefined;
  }

  const trimmed = country.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return COUNTRY_NAME_TO_ISO[trimmed.toLowerCase()];
}

/** Build OpenWeather `q` value: `City` or `City,CC`. */
export function buildOpenWeatherCityQuery(
  city: string,
  country?: string,
): string {
  const countryCode = toOpenWeatherCountryCode(country);
  return countryCode ? `${city},${countryCode}` : city;
}
