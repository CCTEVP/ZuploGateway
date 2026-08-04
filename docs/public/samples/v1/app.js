(function () {
  const DEFAULT_API = "https://dynode-main-8eca196.zuplo.app";
  const STATUS_LABELS = {
    A: "Arrived",
    C: "Cancelled",
    D: "Departed",
    E: "New time",
    N: "New info",
  };

  const params = new URLSearchParams(window.location.search);
  const apiBase = (params.get("api") || DEFAULT_API).replace(/\/$/, "");
  const direction = (params.get("direction") || "D").trim().toUpperCase();
  const refreshSeconds = Math.max(
    15,
    Number(params.get("refresh") || 180) || 180,
  );

  const gateEl = document.getElementById("gate");
  const iataEl = document.getElementById("iata");
  const contentEl = document.getElementById("content");
  const clockEl = document.getElementById("clock");
  const eyebrowEl = document.getElementById("eyebrow");
  const headlineEl = document.getElementById("headline");

  function getPlayerQuery() {
    const resourceId = params
      .get("com.broadsign.suite.bsp.resource_id")
      ?.trim();
    if (resourceId) {
      return {
        key: "com.broadsign.suite.bsp.resource_id",
        value: resourceId,
      };
    }

    const player = params.get("player")?.trim();
    if (player) {
      return { key: "player", value: player };
    }

    return null;
  }

  function setDirectionLabels(dir) {
    if (dir === "A") {
      document.title = "Next Arrival";
      eyebrowEl.textContent = "Arrivals";
      headlineEl.textContent = "Next arrival";
      return;
    }

    document.title = "Next Departure";
    eyebrowEl.textContent = "Departures";
    headlineEl.textContent = "Next departure";
  }

  function tickClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function formatTime(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Oslo",
    });
  }

  function etaLabel(flight) {
    const code = flight.status && flight.status.code;
    const statusTime = flight.status && flight.status.time;
    if (!statusTime) return null;
    if (code === "A") {
      return { label: "Arrived", time: formatTime(statusTime) };
    }
    if (code === "E" || flight.delayed === "Y") {
      return { label: "ETA", time: formatTime(statusTime) };
    }
    return { label: "Updated", time: formatTime(statusTime) };
  }

  function statusClass(code, delayed) {
    if (code === "C") return "is-cancelled";
    if (code === "E" || delayed === "Y") return "is-new-time";
    return "";
  }

  function statusLabel(flight) {
    const code = flight.status && flight.status.code;
    if (flight.delayed === "Y" && code !== "C") {
      return code === "E" ? "Delayed · New time" : "Delayed";
    }
    return STATUS_LABELS[code] || code || "Scheduled";
  }

  function pickNextFlight(flights) {
    const now = Date.now();
    const sorted = (flights || [])
      .filter((flight) => flight.scheduleTime)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.scheduleTime).getTime() -
          new Date(b.scheduleTime).getTime(),
      );

    const upcoming = sorted.find(
      (flight) =>
        new Date(flight.scheduleTime).getTime() >= now - 15 * 60 * 1000,
    );
    return upcoming || sorted[sorted.length - 1] || null;
  }

  function renderError(message) {
    contentEl.innerHTML = `<p class="error">${message}</p>`;
  }

  function renderFlight(payload) {
    const resolvedDirection = (
      direction ||
      payload.direction ||
      "D"
    ).toUpperCase();

    setDirectionLabels(resolvedDirection);

    gateEl.textContent = payload.gate || "—";
    iataEl.textContent = payload.iata || payload.airportCode || "—";

    if (payload.error) {
      renderError(payload.message || payload.error);
      return;
    }

    const next = pickNextFlight(payload.flights);
    if (!next) {
      contentEl.innerHTML = `<p class="empty">No upcoming ${
        resolvedDirection === "D" ? "departures" : "arrivals"
      } for this gate.</p>`;
      return;
    }

    const status = statusLabel(next);
    const klass = statusClass(next.status && next.status.code, next.delayed);
    const eta = etaLabel(next);
    const placeLabel = resolvedDirection === "D" ? "To" : "From";
    const city = next.airportName || next.airport || "—";
    const cityCode = next.airportName && next.airport ? next.airport : "";
    const secondaryLabel = resolvedDirection === "D" ? "Gate" : "Belt";
    const secondaryValue =
      resolvedDirection === "D"
        ? next.gate || payload.gate || "—"
        : next.beltNumber || "—";

    contentEl.innerHTML = `
      <div class="flight-id">${next.flightId || "—"}</div>
      <div>
        <div class="meta-label">${placeLabel}</div>
        <div class="city">${city}</div>
        ${cityCode ? `<div class="city-code">${cityCode}</div>` : ""}
      </div>
      <dl class="detail-grid">
        <div class="detail">
          <dt>Scheduled</dt>
          <dd>${formatTime(next.scheduleTime)}</dd>
        </div>
        <div class="detail">
          <dt>${eta ? eta.label : resolvedDirection === "D" ? "ETD" : "ETA"}</dt>
          <dd>${eta ? eta.time : formatTime(next.scheduleTime)}</dd>
        </div>
        <div class="detail">
          <dt>Airline</dt>
          <dd>${next.airline || "—"}</dd>
        </div>
        <div class="detail">
          <dt>${secondaryLabel}</dt>
          <dd>${secondaryValue}</dd>
        </div>
      </dl>
      <div class="status ${klass}">${status}</div>
    `;
  }

  function loadFlights() {
    const playerQuery = getPlayerQuery();
    if (!playerQuery) {
      renderError(
        "Missing player id. Add ?player=… or ?com.broadsign.suite.bsp.resource_id=… to the URL.",
      );
      return;
    }

    // Default JS response from Zuplo (data = {...};) — works without CORS preflight.
    const requestUrl = new URL(`${apiBase}/flights/norway`);
    requestUrl.searchParams.set(playerQuery.key, playerQuery.value);
    requestUrl.searchParams.set("direction", direction);

    const previous = window.data;
    window.data = undefined;

    const script = document.createElement("script");
    script.src = requestUrl.toString();
    script.async = true;
    script.onload = function () {
      const payload = window.data;
      window.data = previous;
      script.remove();
      if (!payload) {
        renderError("Empty response from gateway.");
        return;
      }
      renderFlight(payload);
    };
    script.onerror = function () {
      script.remove();
      window.data = previous;
      renderError("Could not load flight data from the gateway.");
    };
    document.head.appendChild(script);
  }

  setDirectionLabels(direction);
  tickClock();
  setInterval(tickClock, 1000);
  loadFlights();
  setInterval(loadFlights, refreshSeconds * 1000);
})();
