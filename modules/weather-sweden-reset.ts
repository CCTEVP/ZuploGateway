import { createWeatherReset } from "./weather-handler";
import { WEATHER_SWEDEN_CACHE_NAMESPACE } from "./weather-sweden-normalize-cache-key";

export default createWeatherReset(
  WEATHER_SWEDEN_CACHE_NAMESPACE,
  "weather-sweden",
);
