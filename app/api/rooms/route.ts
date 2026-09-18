import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { generateRoomCode } from "@/lib/code-generator";

export async function POST(request: NextRequest) {
  try {
    let hostId: string | undefined;

    try {
      const body = await request.json();
      if (body && typeof body.hostId === "string" && body.hostId.trim()) {
        hostId = body.hostId.trim();
      }
    } catch {
      // Body is optional
    }

    if (!hostId) {
      hostId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    await connectToDatabase();

    // Generate unique room code (with collision retry)
    let code = "";
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      code = generateRoomCode();
      const existing = await Room.findOne({ code }).lean();
      if (!existing) {
        break;
      }
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate a unique room code. Please try again." },
        { status: 500 }
      );
    }

    const newRoom = await Room.create({
      code,
      hostId,
      participants: [hostId],
      status: "active",
    });

    return NextResponse.json(
      {
        success: true,
        roomCode: newRoom.code,
        room: {
          code: newRoom.code,
          hostId: newRoom.hostId,
          status: newRoom.status,
          createdAt: newRoom.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[POST /api/rooms] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
