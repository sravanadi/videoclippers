import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOCAL_WHISPER_URL =
  process.env.LOCAL_WHISPER_URL?.replace(/\/$/, "") || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${LOCAL_WHISPER_URL}/export-gpu/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { available: false, error: "Backend status unavailable" },
        { status: 503 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { available: false, error: "Cannot reach backend GPU server" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get("file") as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: "Missing video file" },
        { status: 400 }
      );
    }

    const endpoint = `${LOCAL_WHISPER_URL}/export-gpu`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(600000), // 10 minutes timeout
      });
    } catch (fetchErr) {
      return NextResponse.json(
        {
          error: "Local GPU export server is unreachable.",
          detail: `Could not connect to ${endpoint}.`,
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "GPU export server error", detail: errorText },
        { status: response.status }
      );
    }

    // Stream the binary MP4 response directly to client
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    } else {
      headers.set("Content-Disposition", 'attachment; filename="exported_clip.mp4"');
    }
    const hwEncoder = response.headers.get("X-Hardware-Encoder");
    if (hwEncoder) {
      headers.set("X-Hardware-Encoder", hwEncoder);
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[GPU Export API Route]", error);
    return NextResponse.json(
      {
        error: "Server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
