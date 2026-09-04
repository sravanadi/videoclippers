import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOCAL_WHISPER_URL =
  process.env.LOCAL_WHISPER_URL?.replace(/\/$/, "") || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Missing audio file" },
        { status: 400 }
      );
    }

    const localFormData = new FormData();
    localFormData.append("file", audioFile);
    localFormData.append("response_format", "json");
    localFormData.append("enable_diarization", "true");

    const endpoint = `${LOCAL_WHISPER_URL}/transcribe`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        body: localFormData,
        signal: AbortSignal.timeout(600000), // 10 minutes timeout
      });
    } catch (fetchErr) {
      return NextResponse.json(
        {
          error: "Local Whisper server is not reachable.",
          detail: `Could not connect to ${endpoint}. Please ensure the local server is running by executing 'bash scripts/start_whisper_server.sh'.`,
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Local Whisper server error", detail: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Local Transcribe API Route]", error);
    return NextResponse.json(
      {
        error: "Server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
