import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Feedback, FeedbackCategory } from "@/lib/models/Feedback";

// In-memory sliding window rate limiter: max 5 submissions per IP per 60 seconds
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;

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

const CATEGORY_CONFIG: Record<
  FeedbackCategory,
  { title: string; color: number; icon: string }
> = {
  bug: { title: "Bug / Glitch Reported", color: 0xef4444, icon: "🐞" },
  sync: { title: "Playback / Sync Issue", color: 0xf97316, icon: "⏱️" },
  audio: { title: "Voice / Audio Issue", color: 0xf59e0b, icon: "🎙️" },
  feature: { title: "Feature Suggestion", color: 0x10b981, icon: "💡" },
  other: { title: "User Feedback", color: 0x6b7280, icon: "💬" },
};

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please wait a minute." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { category, message, email, roomCode, videoId, userAgent, screenResolution } =
      body;

    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (!trimmedMessage || trimmedMessage.length < 3) {
      return NextResponse.json(
        { error: "Message must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 2000) {
      return NextResponse.json(
        { error: "Message is too long (maximum 2000 characters)." },
        { status: 400 }
      );
    }

    const validCategory: FeedbackCategory =
      category in CATEGORY_CONFIG ? category : "bug";

    const cleanEmail =
      typeof email === "string" && email.trim() ? email.trim().slice(0, 200) : undefined;
    const cleanRoomCode =
      typeof roomCode === "string" && roomCode.trim()
        ? roomCode.trim().toUpperCase().slice(0, 20)
        : undefined;
    const cleanVideoId =
      typeof videoId === "string" && videoId.trim()
        ? videoId.trim().slice(0, 30)
        : undefined;
    const cleanUserAgent =
      typeof userAgent === "string" && userAgent.trim()
        ? userAgent.trim().slice(0, 250)
        : req.headers.get("user-agent")?.slice(0, 250) || undefined;
    const cleanScreen =
      typeof screenResolution === "string" && screenResolution.trim()
        ? screenResolution.trim().slice(0, 50)
        : undefined;

    // 1. Save to MongoDB
    await connectToDatabase();
    const feedbackDoc = await Feedback.create({
      category: validCategory,
      message: trimmedMessage,
      email: cleanEmail,
      roomCode: cleanRoomCode,
      videoId: cleanVideoId,
      userAgent: cleanUserAgent,
      screenResolution: cleanScreen,
    });

    // 2. Dispatch to Discord Webhook if configured
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      const config = CATEGORY_CONFIG[validCategory];

      const fields = [
        {
          name: "Category",
          value: `${config.icon} ${validCategory.toUpperCase()}`,
          inline: true,
        },
        {
          name: "Room Code",
          value: cleanRoomCode ? `\`${cleanRoomCode}\`` : "*(None / Landing)*",
          inline: true,
        },
        {
          name: "User Contact",
          value: cleanEmail ? `\`${cleanEmail}\`` : "*(Anonymous)*",
          inline: true,
        },
      ];

      if (cleanVideoId) {
        fields.push({
          name: "YouTube Video",
          value: `[Watch on YouTube](https://youtu.be/${cleanVideoId}) (\`${cleanVideoId}\`)`,
          inline: true,
        });
      }

      if (cleanScreen || cleanUserAgent) {
        fields.push({
          name: "Client Info",
          value: `${cleanScreen ? `Screen: \`${cleanScreen}\`\n` : ""}${
            cleanUserAgent ? `User Agent: \`${cleanUserAgent.slice(0, 100)}...\`` : ""
          }`,
          inline: false,
        });
      }

      const discordPayload = {
        username: "Popcorn Feedback",
        avatar_url: "https://raw.githubusercontent.com/R4nz5r/Popcorn/main/public/icon.svg",
        embeds: [
          {
            title: `${config.icon} ${config.title}`,
            description: trimmedMessage,
            color: config.color,
            fields,
            footer: {
              text: `Popcorn ID: ${feedbackDoc._id} • ${new Date().toUTCString()}`,
            },
          },
        ],
      };

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
        });
      } catch (webhookErr) {
        console.error("[Discord Webhook Error]:", webhookErr);
        // MongoDB save succeeded, so we still treat the report as captured
      }
    }

    return NextResponse.json({
      success: true,
      id: feedbackDoc._id,
    });
  } catch (error: unknown) {
    console.error("[Feedback API Error]:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again later." },
      { status: 500 }
    );
  }
}
