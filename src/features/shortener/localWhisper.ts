import type { TranscriptionResult } from "./types";

export const transcribeWithLocalWhisper = async (
  audioBlob: Blob
): Promise<TranscriptionResult> => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "extracted-audio.mp4");

  const response = await fetch("/api/transcribe-local", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.detail || error.error || "Local Whisper transcription request failed."
    );
  }

  const result = await response.json();
  return { transcript: result.transcript, rawResponse: result.rawResponse };
};
