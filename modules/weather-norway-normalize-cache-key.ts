import { createWeatherNormalizeCacheKey } from "./weather-handler";
import { norwayPlayers } from "./players/norway";

export const WEATHER_NORWAY_CACHE_NAMESPACE = "weather-norway-cache";

export default createWeatherNormalizeCacheKey(
  norwayPlayers,
  WEATHER_NORWAY_CACHE_NAMESPACE,
);
