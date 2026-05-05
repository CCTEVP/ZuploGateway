const responseFilterConfig = {
  weather: {
    show: ["coord", "main.temp", "weather[0].main", "wind.speed", "rain.1hr"],
    hide: [],
  },
};

type PathPart = string | number;

type EndpointResponseFilter = {
  show?: string[];
  hide?: string[];
};

type ResponseFilterConfig = Record<string, EndpointResponseFilter>;

const filters = responseFilterConfig as ResponseFilterConfig;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePath(path: string): PathPart[] {
  const parts: PathPart[] = [];
  const regex = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      parts.push(match[1]);
    } else if (match[2]) {
      parts.push(Number(match[2]));
    }
  }

  return parts;
}

function getByPath(source: unknown, path: string): unknown {
  const parts = parsePath(path);
  let current: unknown = source;

  for (const part of parts) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = parsePath(path);

  if (parts.length === 0) {
    return;
  }

  let current: unknown = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return;
      }

      if (current[part] === undefined) {
        current[part] = typeof nextPart === "number" ? [] : {};
      }

      current = current[part];
      continue;
    }

    if (!isRecord(current)) {
      return;
    }

    if (current[part] === undefined) {
      current[part] = typeof nextPart === "number" ? [] : {};
    }

    current = current[part];
  }

  const lastPart = parts[parts.length - 1];

  if (typeof lastPart === "number") {
    if (!Array.isArray(current)) {
      return;
    }
    current[lastPart] = value;
    return;
  }

  if (!isRecord(current)) {
    return;
  }

  current[lastPart] = value;
}

function removeByPath(target: Record<string, unknown>, path: string) {
  const parts = parsePath(path);

  if (parts.length === 0) {
    return;
  }

  let current: unknown = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return;
      }
      current = current[part];
      continue;
    }

    if (!isRecord(current)) {
      return;
    }

    current = current[part];
  }

  const lastPart = parts[parts.length - 1];

  if (typeof lastPart === "number") {
    if (!Array.isArray(current)) {
      return;
    }
    if (lastPart >= 0 && lastPart < current.length) {
      current.splice(lastPart, 1);
    }
    return;
  }

  if (!isRecord(current)) {
    return;
  }

  delete current[lastPart];
}

export function getEndpointNameFromPath(pathname: string): string | undefined {
  const [firstSegment] = pathname.split("/").filter(Boolean);
  return firstSegment;
}

export function applyConfiguredResponseFilter(
  endpointName: string | undefined,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (!endpointName) {
    return payload;
  }

  const filter = filters[endpointName];

  if (!filter) {
    return payload;
  }

  const show = (filter.show ?? []).filter(Boolean);
  const hide = (filter.hide ?? []).filter(Boolean);

  let result: Record<string, unknown>;

  if (show.length > 0) {
    result = {};
    for (const path of show) {
      const value = getByPath(payload, path);
      if (value !== undefined) {
        setByPath(result, path, structuredClone(value));
      }
    }
  } else {
    result = structuredClone(payload);
  }

  for (const path of hide) {
    removeByPath(result, path);
  }

  return result;
}
