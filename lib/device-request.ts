import { timingSafeEqual } from "node:crypto";

export function hasValidDeviceKey(request: Request): boolean {
  const configuredKey = process.env.DEVICE_API_KEY;
  const providedKey = request.headers.get("x-device-key");

  if (!configuredKey || !providedKey) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredKey);
  const providedBuffer = Buffer.from(providedKey);

  return (
    configuredBuffer.length === providedBuffer.length &&
    timingSafeEqual(configuredBuffer, providedBuffer)
  );
}

// Returns the distance from a `{ "distanceCm": number }` body, or null when
// the body is missing, malformed, or outside the sensor's range.
export async function readDistanceCm(request: Request): Promise<number | null> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return null;
  }

  const distanceCm =
    typeof body === "object" && body !== null && "distanceCm" in body
      ? Number(body.distanceCm)
      : Number.NaN;

  return Number.isFinite(distanceCm) && distanceCm >= 0 && distanceCm <= 500
    ? distanceCm
    : null;
}
