import { createWeatherNormalizeCacheKey } from "./weather-handler";
import { swedenPlayers } from "./players/sweden";

export const WEATHER_SWEDEN_CACHE_NAMESPACE = "weather-sweden-cache";

export default createWeatherNormalizeCacheKey(
  swedenPlayers,
  WEATHER_SWEDEN_CACHE_NAMESPACE,
);
