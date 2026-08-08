import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const WARNING_DISTANCE_CM = 5;

const DEFAULT_MESSAGE_TEMPLATE = "Peringatan : Tempat Sampah Hampir Penuh";

// Lets the wording be edited from the Vercel dashboard instead of a code change.
// Unknown placeholders are left untouched so a typo is visible in the message
// rather than silently turning into an empty string.
function buildMessage(distanceCm: number): string {
  const template = process.env.FONNTE_MESSAGE?.trim() || DEFAULT_MESSAGE_TEMPLATE;

  const values: Record<string, string> = {
    distanceCm: distanceCm.toFixed(1),
    thresholdCm: String(WARNING_DISTANCE_CM),
    time: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
  };

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
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

  const token = process.env.FONNTE_TOKEN;
  const target = process.env.FONNTE_TARGET;

  if (!token || !target) {
    console.error("FONNTE_TOKEN or FONNTE_TARGET is not configured");
    return Response.json(
      { error: "Notification service is not configured" },
      { status: 500 },
    );
  }

  const formData = new FormData();
  formData.set("target", target);
  formData.set("message", buildMessage(distanceCm));
  formData.set("countryCode", process.env.FONNTE_COUNTRY_CODE ?? "62");

  try {
    const fonnteResponse = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: formData,
      cache: "no-store",
    });

    const result: unknown = await fonnteResponse.json().catch(() => null);
    const fonnteRejected =
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      result.status === false;

    if (!fonnteResponse.ok || fonnteRejected) {
      console.error("Fonnte rejected the notification", {
        status: fonnteResponse.status,
        result,
      });

      return Response.json(
        { error: "Failed to send notification" },
        { status: 502 },
      );
    }

    return Response.json({ sent: true });
  } catch (error) {
    console.error("Could not reach Fonnte", error);
    return Response.json(
      { error: "Notification service is unavailable" },
      { status: 502 },
    );
  }
}
