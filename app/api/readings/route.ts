import { hasValidDeviceKey, readDistanceCm } from "@/lib/device-request";
import { appendSheetLog } from "@/lib/sheet-log";

export const runtime = "nodejs";

// Periodic distance log from the ESP32. Awaited (unlike the alert log) so the
// device sees a failed write in its serial output.
export async function POST(request: Request) {
  if (!hasValidDeviceKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const distanceCm = await readDistanceCm(request);

  if (distanceCm === null) {
    return Response.json(
      { error: "distanceCm must be a number between 0 and 500" },
      { status: 422 },
    );
  }

  const logged = await appendSheetLog({ type: "reading", distanceCm });

  if (!logged) {
    return Response.json({ error: "Failed to write the sheet log" }, { status: 502 });
  }

  return Response.json({ logged: true });
}
