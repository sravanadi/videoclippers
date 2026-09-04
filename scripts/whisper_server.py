import os
import sys

# Ensure project venv packages are in sys.path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
venv_site_packages = os.path.join(base_dir, "venv", "lib", f"python{sys.version_info.major}.{sys.version_info.minor}", "site-packages")
if os.path.exists(venv_site_packages) and venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)

import tempfile
import logging
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("whisper_server")

app = FastAPI(title="Local WhisperX/Faster-Whisper Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model_instance = None
model_device = "cpu"
model_compute_type = "int8"

def load_whisper_model():
    global model_instance, model_device, model_compute_type
    if model_instance is not None:
        return model_instance

    try:
        import torch
        if torch.cuda.is_available():
            model_device = "cuda"
            model_compute_type = "float16"
            logger.info("CUDA detected. Using GPU for Whisper inference.")
        else:
            model_device = "cpu"
            model_compute_type = "int8"
            logger.info("CUDA not available. Using CPU with int8 quantization for Whisper inference.")
    except Exception as e:
        logger.warning(f"PyTorch CUDA check failed: {e}. Defaulting to CPU.")
        model_device = "cpu"
        model_compute_type = "int8"

    try:
        from faster_whisper import WhisperModel
        model_name = os.environ.get("WHISPER_MODEL", "small")
        logger.info(f"Loading Faster-Whisper model '{model_name}' on {model_device} ({model_compute_type})...")
        model_instance = WhisperModel(model_name, device=model_device, compute_type=model_compute_type)
        logger.info("Whisper model loaded successfully!")
        return model_instance
    except Exception as e:
        logger.error(f"Failed to load Faster-Whisper model: {e}")
        raise e

@app.on_event("startup")
async def startup_event():
    try:
        load_whisper_model()
    except Exception as e:
        logger.warning(f"Model pre-loading deferred: {e}")

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "device": model_device,
        "compute_type": model_compute_type,
        "model_loaded": model_instance is not None
    }

@app.post("/transcribe")
@app.post("/v1/audio/transcriptions")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
    response_format: Optional[str] = Form("json"),
    language: Optional[str] = Form(None),
    enable_diarization: Optional[bool] = Form(True)
):
    if not file:
        raise HTTPException(status_code=400, detail="No audio file uploaded.")

    logger.info(f"Received transcription request for file: {file.filename}")

    # Save uploaded file to temp file
    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        whisper = load_whisper_model()
        logger.info("Running transcription with word timestamps...")
        
        segments, info = whisper.transcribe(
            tmp_path,
            word_timestamps=True,
            language=language if language and language != "auto" else None,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        full_transcript = []
        words_list: List[Dict[str, Any]] = []
        segment_list: List[Dict[str, Any]] = []

        current_speaker = "SPEAKER_00"

        for segment in segments:
            seg_text = segment.text.strip()
            full_transcript.append(seg_text)
            segment_list.append({
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": seg_text
            })
            
            # Simple heuristic for speaker diarization if not using pyannote
            # Pause > 1.5s toggles speaker ID if multi-speaker heuristic enabled
            last_end = words_list[-1]["end"] if words_list else 0.0

            if segment.words:
                for w in segment.words:
                    word_text = w.word.strip()
                    if not word_text:
                        continue
                    
                    start_time = round(float(w.start), 3)
                    end_time = round(float(w.end), 3)
                    
                    if enable_diarization and last_end > 0 and (start_time - last_end) > 1.5:
                        current_speaker = "SPEAKER_01" if current_speaker == "SPEAKER_00" else "SPEAKER_00"

                    words_list.append({
                        "text": word_text,
                        "start": start_time,
                        "end": end_time,
                        "speaker_id": current_speaker,
                        "confidence": round(float(w.probability), 3) if hasattr(w, "probability") else 0.95
                    })
                    last_end = end_time

        combined_text = " ".join(full_transcript).strip()
        logger.info(f"Transcription complete. Extracted {len(words_list)} words.")

        return {
            "transcript": combined_text,
            "text": combined_text,
            "language": info.language if hasattr(info, "language") else "en",
            "rawResponse": {
                "text": combined_text,
                "words": words_list,
                "segments": segment_list
            }
        }

    except Exception as e:
        logger.error(f"Error during transcription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"Starting Local Whisper Server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)
