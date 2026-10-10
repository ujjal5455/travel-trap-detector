import { readDeviceId } from "@/lib/server/device";
import { countVotes, getReportDevice, insertVote } from "@/lib/server/repo";
import type { VoteResponse } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";

/** "Me too": one vote per device per report, enforced by the report_votes primary key. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const deviceId = readDeviceId(request);
  if (!deviceId) return Response.json({ error: "Missing or invalid device ID. Reload the page and try again." }, { status: 400 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return Response.json({ error: "Unknown report." }, { status: 404 });

  try {
    const owner = await getReportDevice(id);
    if (owner === null) return Response.json({ error: "Unknown report." }, { status: 404 });
    if (owner === deviceId) return Response.json({ error: "You can't confirm your own report." }, { status: 403 });

    const result = await insertVote(id, deviceId);
    if (result === "duplicate") {
      return Response.json({ error: "You've already said this happened to you too." }, { status: 409 });
    }
    return Response.json({ votes: await countVotes(id) } satisfies VoteResponse, { status: 201 });
  } catch (err) {
    console.error("POST /api/reports/[id]/vote failed:", err);
    return Response.json({ error: "Something went wrong on our side. Please try again in a moment." }, { status: 503 });
  }
}
