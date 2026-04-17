import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext,
) {
  const url = new URL(request.url);
  
  // Extract the coordinates from the path
  const pathParts = url.pathname.split('/');
  const coords = pathParts[pathParts.length - 1]; 
  
  const cleanCoords = coords.includes('=') ? coords.split('=')[1] : coords;
  const [rawLat, rawLon] = cleanCoords.split(',');

  // Round to 3 decimal places
  const lat = parseFloat(rawLat).toFixed(3);
  const lon = parseFloat(rawLon).toFixed(3);

  // Rewrite the URL to the destination (Todo API for testing)
  const newUrl = new URL("https://todo.zuplo.io/todos");

  return new ZuploRequest(newUrl, request);
}