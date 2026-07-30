(function () {
  const STATUS_LABELS = {
    A: "Arrived",
    C: "Cancelled",
    D: "Departed",
    E: "New time",
    N: "New info",
  };

  const params = new URLSearchParams(window.location.search);
  const directionOverride = params.get("direction")?.trim().toUpperCase();

  const gateEl = document.getElementById("gate");
  const iataEl = document.getElementById("iata");
  const contentEl = document.getElementById("content");
  const clockEl = document.getElementById("clock");
  const eyebrowEl = document.getElementById("eyebrow");
  const headlineEl = document.getElementById("headline");

  function setDirectionLabels(direction) {
    if (direction === "A") {
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
    const direction = (
      directionOverride ||
      payload.direction ||
      "D"
    ).toUpperCase();

    setDirectionLabels(direction);

    gateEl.textContent = payload.gate || "—";
    iataEl.textContent = payload.iata || payload.airportCode || "—";

    if (payload.error) {
      renderError(payload.message || payload.error);
      return;
    }

    const next = pickNextFlight(payload.flights);
    if (!next) {
      contentEl.innerHTML = `<p class="empty">No upcoming ${
        direction === "D" ? "departures" : "arrivals"
      } for this gate.</p>`;
      return;
    }

    const status = statusLabel(next);
    const klass = statusClass(next.status && next.status.code, next.delayed);
    const eta = etaLabel(next);
    const placeLabel = direction === "D" ? "To" : "From";
    const city = next.airportName || next.airport || "—";
    const cityCode = next.airportName && next.airport ? next.airport : "";
    const secondaryLabel = direction === "D" ? "Gate" : "Belt";
    const secondaryValue =
      direction === "D"
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
          <dt>${eta ? eta.label : direction === "D" ? "ETD" : "ETA"}</dt>
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
    // Expected shape from Zuplo JS download:
    //   data = { gate, iata, direction, flights, ... };
    const payload = typeof data !== "undefined" ? data : window.data;

    if (!payload) {
      renderError(
        "Missing flight data. Expected ./../../bsp/sync/bmonorway/flightsdata.js to define data = {...};",
      );
      return;
    }

    renderFlight(payload);
  }

  tickClock();
  setInterval(tickClock, 1000);
  loadFlights();
})();
