import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const WARNING_DISTANCE_CM = 5;

const DEFAULT_MESSAGE_TEMPLATE = "Peringatan : Tempat Sampah Hampir Penuh";

// Lets the wording be edited from the Vercel dashboard instead of a code change.
// Unknown placeholders are left untouched so a typo is visible in the message
// rather than silently turning into an empty string.
function buildMessage(distanceCm: number): string {
  const template = process.env.ALERT_MESSAGE?.trim() || DEFAULT_MESSAGE_TEMPLATE;

  const values: Record<string, string> = {
    distanceCm: distanceCm.toFixed(1),
    thresholdCm: String(WARNING_DISTANCE_CM),
    time: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
  };

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

// WAHA expects a chat ID such as 628123456789@c.us (or ...@g.us for groups).
// Local numbers like 08123456789 are converted using the country code.
function toChatId(target: string, countryCode: string): string {
  if (target.includes("@")) {
    return target;
  }

  let digits = target.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = countryCode + digits.slice(1);
  }

  return `${digits}@c.us`;
}

function hasValidDeviceKey(request: Request): boolean {
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

export async function POST(request: Request) {
  if (!hasValidDeviceKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const distanceCm =
    typeof body === "object" && body !== null && "distanceCm" in body
      ? Number(body.distanceCm)
      : Number.NaN;

  if (!Number.isFinite(distanceCm) || distanceCm < 0 || distanceCm > 500) {
    return Response.json(
      { error: "distanceCm must be a number between 0 and 500" },
      { status: 422 },
    );
  }

  if (distanceCm >= WARNING_DISTANCE_CM) {
    return Response.json({ sent: false, reason: "Distance is not below 5 cm" });
  }

  const baseUrl = process.env.WAHA_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.WAHA_API_KEY;
  const target = process.env.WAHA_TARGET?.trim();

  if (!baseUrl || !apiKey || !target) {
    console.error("WAHA_BASE_URL, WAHA_API_KEY or WAHA_TARGET is not configured");
    return Response.json(
      { error: "Notification service is not configured" },
      { status: 500 },
    );
  }

  try {
    const wahaResponse = await fetch(`${baseUrl}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        session: process.env.WAHA_SESSION?.trim() || "default",
        chatId: toChatId(target, process.env.WAHA_COUNTRY_CODE ?? "62"),
        text: buildMessage(distanceCm),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!wahaResponse.ok) {
      const result = await wahaResponse.text().catch(() => null);
      console.error("WAHA rejected the notification", {
        status: wahaResponse.status,
        result,
      });

      return Response.json(
        { error: "Failed to send notification" },
        { status: 502 },
      );
    }

    return Response.json({ sent: true });
  } catch (error) {
    console.error("Could not reach WAHA", error);
    return Response.json(
      { error: "Notification service is unavailable" },
      { status: 502 },
    );
  }
}
