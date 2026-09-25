export type SheetLogType = "reading" | "alert";

export interface SheetLogEntry {
  type: SheetLogType;
  distanceCm: number;
  note?: string;
}

export function jakartaTime(date = new Date()): string {
  return date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

// Needs BIN_DEPTH_CM (sensor to bin floor). Left blank in the sheet otherwise.
function fillPercent(distanceCm: number): number | null {
  const depthCm = Number(process.env.BIN_DEPTH_CM);

  if (!Number.isFinite(depthCm) || depthCm <= 0) {
    return null;
  }

  const percent = ((depthCm - distanceCm) / depthCm) * 100;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

// Appends one row through the Google Apps Script web app in
// `google-apps-script/Code.gs`. Returns false instead of throwing so a
// logging outage never blocks the WhatsApp alert.
export async function appendSheetLog(entry: SheetLogEntry): Promise<boolean> {
  const url = process.env.SHEETS_WEBHOOK_URL?.trim();
  const secret = process.env.SHEETS_WEBHOOK_SECRET;

  if (!url || !secret) {
    console.warn("SHEETS_WEBHOOK_URL or SHEETS_WEBHOOK_SECRET is not configured");
    return false;
  }

  try {
    // Apps Script answers the POST with a redirect; fetch follows it to read
    // the script's JSON output.
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        time: jakartaTime(),
        type: entry.type,
        distanceCm: Number(entry.distanceCm.toFixed(1)),
        fillPercent: fillPercent(entry.distanceCm),
        note: entry.note ?? "",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const result: unknown = await response.json().catch(() => null);
    const accepted =
      typeof result === "object" &&
      result !== null &&
      "ok" in result &&
      result.ok === true;

    if (!response.ok || !accepted) {
      console.error("Sheet log was rejected", { status: response.status, result });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Could not reach the sheet log", error);
    return false;
  }
}
