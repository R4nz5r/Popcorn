import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Room } from "@/lib/models/Room";
import { generateRoomCode } from "@/lib/code-generator";

// In-memory sliding window rate limiter: max 15 room creations per IP per 60 seconds
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 60 seconds
  const maxRequests = 15;

  // Prune map periodically to prevent memory leaks
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count += 1;
  return false;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many room creation requests. Please wait a minute and try again." },
        { status: 429 }
      );
    }

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
