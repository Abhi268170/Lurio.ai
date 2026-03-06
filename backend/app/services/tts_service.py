import asyncio
import os
import re
import tempfile
import httpx
from pydub import AudioSegment
import edge_tts

from app.core.config import settings

# ElevenLabs voice IDs - natural, expressive voices
VOICE_A_EL = "ZQe5CZNOzWyzPSCn5a3c"  # "James" - deep, resonant male voice
VOICE_B_EL = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" - natural, engaging female

# Edge TTS voice names - high quality free alternatives
VOICE_A_EDGE = "en-US-ChristopherNeural"
VOICE_B_EDGE = "en-US-AvaNeural"

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"
PODCASTS_DIR = "/app/podcasts"


def ensure_podcasts_dir():
    """Create the podcasts directory if it doesn't exist."""
    os.makedirs(PODCASTS_DIR, exist_ok=True)


async def synthesize_speech_elevenlabs(text: str, voice_id: str) -> bytes:
    """Generate audio using ElevenLabs API."""
    api_key = settings.ELEVENLABS_API_KEY
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY is not configured")

    url = f"{ELEVENLABS_API_URL}/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.4,
            "use_speaker_boost": True,
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            print(f"DEBUG: ElevenLabs error {response.status_code}: {response.text}")
            response.raise_for_status()
        return response.content


async def synthesize_speech_edge(text: str, voice_name: str, output_path: str):
    """Generate audio using Edge TTS (Free)."""
    communicate = edge_tts.Communicate(text, voice_name)
    await communicate.save(output_path)


async def assemble_podcast(script: list, output_path: str) -> str:
    """Generate audio for each dialog turn and concatenate into a final MP3."""
    ensure_podcasts_dir()
    temp_files = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, turn in enumerate(script):
            temp_path = os.path.join(tmpdir, f"turn_{i:03d}.mp3")
            text = turn["text"]
            speaker = turn["speaker"]

            success = False
            # Try ElevenLabs first if key is present
            if settings.ELEVENLABS_API_KEY:
                try:
                    voice_id = VOICE_A_EL if speaker == "A" else VOICE_B_EL
                    audio_content = await synthesize_speech_elevenlabs(text, voice_id)
                    with open(temp_path, "wb") as f:
                        f.write(audio_content)
                    print(f"  Generated turn {i+1}/{len(script)} ({speaker}) via ElevenLabs")
                    success = True
                    await asyncio.sleep(0.3) # Small delay for EL
                except Exception as e:
                    print(f"  ElevenLabs failed for turn {i}, falling back to Edge TTS: {e}")

            # Fallback to Edge TTS
            if not success:
                try:
                    voice_name = VOICE_A_EDGE if speaker == "A" else VOICE_B_EDGE
                    await synthesize_speech_edge(text, voice_name, temp_path)
                    print(f"  Generated turn {i+1}/{len(script)} ({speaker}) via Edge TTS (Free)")
                    success = True
                except Exception as e:
                    print(f"  Critical: Edge TTS also failed for turn {i}: {e}")

            if success:
                temp_files.append(temp_path)

        if not temp_files:
            raise RuntimeError("No audio segments were generated")

        # Concatenate all audio segments
        print(f"Assembling {len(temp_files)} audio segments...")
        combined = AudioSegment.empty()
        pause = AudioSegment.silent(duration=350) 

        for j, temp_path in enumerate(temp_files):
            segment = AudioSegment.from_mp3(temp_path)
            combined += segment
            if j < len(temp_files) - 1:
                combined += pause

        # Export final podcast
        combined.export(output_path, format="mp3", bitrate="192k")
        print(f"Podcast saved to {output_path} ({len(combined) / 1000:.1f}s)")

    return output_path


def get_podcast_path(course_id: int) -> str:
    """Get the expected file path for a course's podcast."""
    return os.path.join(PODCASTS_DIR, f"course_{course_id}.mp3")


def get_module_audio_path(module_id: int) -> str:
    """Get the expected file path for a module's TTS audio."""
    return os.path.join(PODCASTS_DIR, f"module_{module_id}.mp3")


def _strip_markdown(text: str) -> str:
    """Strip Markdown formatting so TTS reads clean prose."""
    text = re.sub(r'#{1,6}\s+', '', text)               # headings
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)        # bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)             # italic
    text = re.sub(r'`{1,3}[^`\n]*`{1,3}', '', text)     # inline/block code
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)      # links
    text = re.sub(r'^[-*+]\s+', '', text, flags=re.MULTILINE)   # bullets
    text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)   # numbered lists
    text = re.sub(r'\n{3,}', '\n\n', text)               # excess blank lines
    return text.strip()


async def synthesize_module_audio(content: str, output_path: str) -> str:
    """
    Generate TTS audio for a module using a single narrator voice.
    Tries ElevenLabs first; falls back to Edge TTS if unavailable.
    """
    ensure_podcasts_dir()
    clean_text = _strip_markdown(content)

    if settings.ELEVENLABS_API_KEY:
        try:
            audio_content = await synthesize_speech_elevenlabs(clean_text, VOICE_A_EL)
            with open(output_path, "wb") as f:
                f.write(audio_content)
            print(f"Module audio saved to {output_path} via ElevenLabs")
            return output_path
        except Exception as e:
            print(f"ElevenLabs failed for module audio, falling back to Edge TTS: {e}")

    await synthesize_speech_edge(clean_text, VOICE_A_EDGE, output_path)
    print(f"Module audio saved to {output_path} via Edge TTS")
    return output_path
