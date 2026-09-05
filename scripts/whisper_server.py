import os
import sys

# Ensure project venv packages are in sys.path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
venv_site_packages = os.path.join(base_dir, "venv", "lib", f"python{sys.version_info.major}.{sys.version_info.minor}", "site-packages")
if os.path.exists(venv_site_packages) and venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)

import tempfile
import logging
import subprocess
import shutil
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
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

    has_cuda = False
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            has_cuda = True
    except Exception:
        pass

    if not has_cuda:
        try:
            import torch
            if torch.cuda.is_available():
                has_cuda = True
        except Exception:
            pass

    if has_cuda:
        model_device = "cuda"
        # ponytail: float16 delivers maximum speed on RTX 3050; fallback to int8_float16 if OOM occurs
        model_compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "float16")
        logger.info(f"NVIDIA GPU CUDA detected! Using {model_device} with {model_compute_type} acceleration for Whisper inference.")
    else:
        model_device = "cpu"
        model_compute_type = "int8"
        logger.info("CUDA not available. Using CPU with int8 quantization for Whisper inference.")

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

def check_nvenc_available() -> bool:
    try:
        res = subprocess.run(
            ["ffmpeg", "-f", "lavfi", "-i", "testsrc=duration=1:size=320x240:rate=1", "-c:v", "h264_nvenc", "-f", "null", "-"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5
        )
        return res.returncode == 0
    except Exception:
        return False

def remove_temp_file(path: str):
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass

@app.get("/export-gpu/status")
async def export_gpu_status():
    has_nvenc = check_nvenc_available()
    return {
        "status": "ok",
        "nvenc_available": has_nvenc,
        "device": model_device,
        "recommended_encoder": "h264_nvenc" if has_nvenc else "libx264"
    }

@app.post("/export-gpu")
async def export_video_gpu(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    start_time: float = Form(0.0),
    end_time: Optional[float] = Form(None),
    aspect_ratio: str = Form("9:16"),
    resolution: str = Form("1080p"),
    color_preset: str = Form("none"),
    brightness: float = Form(0.0),
    contrast: float = Form(1.0),
    saturation: float = Form(1.0),
    temperature: float = Form(0.0),
    tint: float = Form(0.0),
    sharpen: float = Form(0.0),
    noise_reduction: float = Form(0.0),
    quality_increase: float = Form(0.0),
    subtitles_srt: Optional[str] = Form(None),
    clip_title: Optional[str] = Form("clip")
):
    if not file:
        raise HTTPException(status_code=400, detail="No video file provided.")

    logger.info(f"Received GPU export request: {file.filename}, start={start_time}, end={end_time}, ratio={aspect_ratio}, res={resolution}, color={color_preset}, sharpen={sharpen}, nr={noise_reduction}, qi={quality_increase}")

    # Save uploaded input video
    in_suffix = os.path.splitext(file.filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=in_suffix) as in_tmp:
        shutil.copyfileobj(file.file, in_tmp)
        in_path = in_tmp.name

    out_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    out_path = out_tmp.name
    out_tmp.close()

    srt_path = None
    if subtitles_srt and subtitles_srt.strip():
        with tempfile.NamedTemporaryFile(delete=False, suffix=".srt", mode="w", encoding="utf-8") as srt_tmp:
            srt_tmp.write(subtitles_srt)
            srt_path = srt_tmp.name

    try:
        # Determine target resolution
        is_4k = resolution.lower() == "4k"
        if aspect_ratio == "16:9":
            w, h = (3840, 2160) if is_4k else (1920, 1080)
            bitrate = "28M" if is_4k else "14M"
        elif aspect_ratio == "1:1":
            w, h = (2160, 2160) if is_4k else (1080, 1080)
            bitrate = "22M" if is_4k else "12M"
        elif aspect_ratio == "4:5":
            w, h = (2160, 2700) if is_4k else (1080, 1350)
            bitrate = "22M" if is_4k else "12M"
        else: # 9:16 default
            w, h = (2160, 3840) if is_4k else (1080, 1920)
            bitrate = "28M" if is_4k else "14M"

        # Build video filter graph
        filters = []
        # Aspect ratio framing: scale to fill and crop to exact dimensions
        filters.append(f"scale=w={w}:h={h}:force_original_aspect_ratio=increase,crop={w}:{h}")

        # Noise reduction (hqdn3d)
        if noise_reduction > 0.01:
            luma_sp = max(1.0, round(noise_reduction * 8.0, 1))
            chroma_sp = max(1.0, round(noise_reduction * 6.0, 1))
            filters.append(f"hqdn3d={luma_sp}:{chroma_sp}:3:3")

        # Color grading & tone curve
        preset_clean = color_preset.lower().strip()
        if preset_clean in ("cinematic", "auto_4k_cinematic"):
            filters.append("eq=contrast=1.16:saturation=1.12:brightness=0.01,colorchannelmixer=rr=1.04:bb=0.96")
        elif preset_clean in ("vibrant", "vibrant_gaming"):
            filters.append("eq=contrast=1.18:saturation=1.25:brightness=0.03,colorchannelmixer=rr=1.02:gg=1.02:bb=0.98")
        elif preset_clean == "cyberpunk":
            filters.append("eq=contrast=1.25:saturation=1.35:brightness=-0.02,colorchannelmixer=rr=0.92:gg=0.95:bb=1.2")
        elif preset_clean in ("warm_sunset", "warm_film"):
            filters.append("eq=contrast=1.12:saturation=1.15:brightness=0.02,colorchannelmixer=rr=1.12:gg=1.02:bb=0.88")
        elif preset_clean in ("natural_studio", "studio"):
            filters.append("eq=contrast=1.08:saturation=1.05:brightness=0.0")
        elif preset_clean == "contrast":
            filters.append("eq=contrast=1.3:saturation=1.15:brightness=-0.02")
        elif contrast != 1.0 or brightness != 0.0 or saturation != 1.0 or temperature != 0.0:
            c = max(0.5, min(2.0, contrast))
            b = max(-0.5, min(0.5, brightness))
            s = max(0.0, min(3.0, saturation))
            eq_filter = f"eq=contrast={c}:brightness={b}:saturation={s}"
            if temperature != 0.0:
                rr = round(max(0.7, min(1.3, 1.0 + temperature * 0.2)), 2)
                bb = round(max(0.7, min(1.3, 1.0 - temperature * 0.2)), 2)
                eq_filter += f",colorchannelmixer=rr={rr}:bb={bb}"
            filters.append(eq_filter)

        # Detail sharpening & quality increase (unsharp filter)
        effective_sharpen = sharpen + (quality_increase * 0.5)
        if effective_sharpen > 0.01:
            la = round(min(2.5, effective_sharpen * 1.8), 2)
            ca = round(la * 0.5, 2)
            filters.append(f"unsharp=5:5:{la}:5:5:{ca}")

        # Subtitles filter if provided
        if srt_path:
            escaped_srt = srt_path.replace("\\", "/").replace(":", "\\:")
            filters.append(f"subtitles='{escaped_srt}':force_style='FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Alignment=2,MarginV=40'")

        filter_graph = ",".join(filters)

        # Build FFmpeg command
        cmd = ["ffmpeg", "-y"]

        # Timestamp cutting
        if start_time > 0:
            cmd.extend(["-ss", str(start_time)])
        if end_time is not None and end_time > start_time:
            duration = end_time - start_time
            cmd.extend(["-t", str(duration)])

        cmd.extend(["-i", in_path])
        cmd.extend(["-vf", filter_graph])

        has_nvenc = check_nvenc_available()
        if has_nvenc:
            logger.info("Using NVIDIA NVENC hardware encoder (h264_nvenc) on RTX 3050")
            cmd.extend([
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-cq", "19",
                "-b:v", bitrate,
                "-profile:v", "high",
                "-pix_fmt", "yuv420p"
            ])
        else:
            logger.info("NVENC not available in container; using multi-core libx264 fast encoder")
            cmd.extend([
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "19",
                "-pix_fmt", "yuv420p"
            ])

        cmd.extend([
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            out_path
        ])

        logger.info(f"Running FFmpeg: {' '.join(cmd)}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"FFmpeg export failed: {result.stderr[-400:]}")

        logger.info(f"GPU export succeeded! Output size: {os.path.getsize(out_path)} bytes")

        # Cleanup input and srt now
        remove_temp_file(in_path)
        if srt_path:
            remove_temp_file(srt_path)

        # Output cleanup on response completion
        background_tasks.add_task(remove_temp_file, out_path)

        clean_filename = f"{clip_title or 'exported_clip'}_{resolution}.mp4"
        return FileResponse(
            out_path,
            media_type="video/mp4",
            filename=clean_filename,
            headers={
                "Content-Disposition": f'attachment; filename="{clean_filename}"',
                "X-Hardware-Encoder": "NVIDIA-RTX3050-NVENC" if has_nvenc else "CPU-libx264"
            }
        )

    except HTTPException:
        remove_temp_file(in_path)
        if srt_path:
            remove_temp_file(srt_path)
        remove_temp_file(out_path)
        raise
    except Exception as e:
        remove_temp_file(in_path)
        if srt_path:
            remove_temp_file(srt_path)
        remove_temp_file(out_path)
        logger.error(f"Failed GPU export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"Starting Local Whisper Server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)
