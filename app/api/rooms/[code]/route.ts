import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { sanitizeRoomCode } from "@/lib/code-generator";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const sanitizedCode = sanitizeRoomCode(code);

    if (!sanitizedCode) {
      return NextResponse.json(
        { error: "Invalid room code" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const room = await Room.findOne({ code: sanitizedCode }).lean();

    if (!room || room.status === "closed") {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      room: {
        code: room.code,
        hostId: room.hostId,
        participants: room.participants || [],
        participantIds: room.participants || [],
        status: room.status,
        activeVideo: room.activeVideo,
        createdAt: room.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[GET /api/rooms/[code]] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const sanitizedCode = sanitizeRoomCode(code);

    if (!sanitizedCode) {
      return NextResponse.json(
        { error: "Invalid room code" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { video, newHostId } = body;

    await connectToDatabase();

    const room = await Room.findOne({ code: sanitizedCode });
    if (!room || room.status === "closed") {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    if (newHostId && typeof newHostId === "string" && newHostId.trim()) {
      room.hostId = newHostId.trim();
      if (!room.participants.includes(room.hostId)) {
        room.participants.push(room.hostId);
      }
      await room.save();
    }


    if (video?.videoId) {
      room.activeVideo = {
        type: "youtube",
        videoId: video.videoId,
        duration: video.duration || 0,
      };
      await room.save();
    }

    return NextResponse.json({
      success: true,
      room: {
        code: room.code,
        hostId: room.hostId,
        activeVideo: room.activeVideo,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[PATCH /api/rooms/[code]] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
