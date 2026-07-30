import {
  applyConfiguredResponseFilter,
  getEndpointNameFromPath,
} from "./response-filter";

export type ResponseFormatOptions = {
  pathname: string;
  format: string | null;
  filter: string | null;
  showDebug: boolean;
  payload: Record<string, unknown>;
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFormatParam(format: string | null): {
  returnJson: boolean;
  error?: Response;
} {
  const normalized = format?.toLowerCase() ?? null;
  const returnJson = normalized === "json";

  if (normalized && !returnJson) {
    return {
      returnJson: false,
      error: new Response(
        "Invalid format query parameter. The only supported value is format=json.",
        {
          status: 400,
        },
      ),
    };
  }

  return { returnJson };
}

export function buildFormattedResponse(options: ResponseFormatOptions) {
  const {
    pathname,
    format,
    filter,
    showDebug,
    payload,
    status = 200,
    statusText,
    headers: incomingHeaders,
  } = options;

  const { returnJson, error } = parseFormatParam(format);
  if (error) {
    return error;
  }

  const shouldApplyFilter = filter?.toLowerCase() !== "false";
  const endpointName = getEndpointNameFromPath(pathname);
  const sourcePayload = shouldApplyFilter
    ? applyConfiguredResponseFilter(endpointName, payload)
    : structuredClone(payload);
  const responsePayload: Record<string, unknown> = isRecord(sourcePayload)
    ? sourcePayload
    : {};

  // Timestamp is always present regardless of show/hide config.
  if (payload.timestamp !== undefined) {
    responsePayload.timestamp = payload.timestamp;
  }

  // Debug visibility is controlled only by the debug query parameter.
  if (showDebug && payload.debug !== undefined) {
    responsePayload.debug = payload.debug;
  } else {
    delete responsePayload.debug;
  }

  const responseBody = returnJson
    ? JSON.stringify(responsePayload)
    : `data = ${JSON.stringify(responsePayload)};`;

  const headers = new Headers(incomingHeaders);
  headers.set(
    "content-type",
    returnJson
      ? "application/json; charset=utf-8"
      : "application/javascript; charset=utf-8",
  );
  headers.delete("content-length");

  return new Response(responseBody, {
    status,
    statusText,
    headers,
  });
}

export function buildStandardErrorResponse(options: {
  format: string | null;
  error: string;
  message: string;
  status?: number;
}) {
  const { format, error, message, status = 400 } = options;
  const { returnJson, error: formatError } = parseFormatParam(format);
  if (formatError) {
    return formatError;
  }

  const payload = { error, message };
  const body = returnJson
    ? JSON.stringify(payload)
    : `data = ${JSON.stringify(payload)};`;

  return new Response(body, {
    status,
    headers: {
      "content-type": returnJson
        ? "application/json; charset=utf-8"
        : "application/javascript; charset=utf-8",
    },
  });
}
