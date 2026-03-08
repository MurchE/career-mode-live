"""Gemini AI service with lazy client initialization.

Uses the google-genai SDK (NOT google-generativeai — that's the old one).
Supports text, JSON, interleaved text+image, and native TTS generation.
"""

import base64
import io
import os
import wave

from google import genai
from google.genai import types

_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Lazy-initialize the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "No GEMINI_API_KEY or GOOGLE_API_KEY environment variable set. "
                "Get a key at https://aistudio.google.com/apikey"
            )
        _client = genai.Client(api_key=api_key)
    return _client


# Models
MODEL = "gemini-2.5-flash"  # Text coaching
MODEL_IMAGE = "gemini-2.5-flash-image"  # Interleaved text + image
MODEL_TTS = "gemini-2.5-flash-preview-tts"  # Native TTS

# Coach voice mapping — Gemini native TTS voices
COACH_TTS_VOICES = {
    "chad": "Enceladus",    # Breathy, casual energy
    "reeves": "Kore",       # Firm, measured authority
    "viktor": "Puck",       # Upbeat, precise
}


async def generate(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 300,
) -> str:
    """Generate a response from Gemini.

    Uses the synchronous generate_content under the hood (the SDK handles
    async via threading). For streaming responses see generate_stream.
    """
    client = get_client()

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )
    if system_instruction:
        config.system_instruction = system_instruction

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
    )

    return response.text or ""


async def generate_json(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 500,
) -> str:
    """Generate a JSON response from Gemini using JSON mode.

    Uses response_mime_type to force valid JSON output.
    """
    client = get_client()

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
        response_mime_type="application/json",
    )
    if system_instruction:
        config.system_instruction = system_instruction

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
    )

    return response.text or "{}"


async def generate_with_history(
    messages: list[dict],
    system_instruction: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 300,
) -> str:
    """Generate a response with conversation history.

    messages: list of {"role": "user"|"model", "content": str}
    """
    client = get_client()

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )
    if system_instruction:
        config.system_instruction = system_instruction

    # Convert to Gemini content format
    contents = []
    for msg in messages:
        role = msg["role"]
        if role == "assistant":
            role = "model"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part(text=msg["content"])],
            )
        )

    response = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=config,
    )

    return response.text or ""


async def generate_interleaved(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = 0.7,
) -> list[dict]:
    """Generate interleaved text + image response from Gemini.

    Uses gemini-2.5-flash-image with response_modalities=['TEXT', 'IMAGE']
    to produce mixed-media output in a single API call. This is the core
    "Creative Storyteller" capability — Gemini natively weaves text and
    generated visuals in one coherent output stream.

    Returns list of parts: [{"type": "text", "content": "..."}, {"type": "image", "data": "base64...", "mime_type": "..."}]
    """
    client = get_client()

    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        temperature=temperature,
    )
    if system_instruction:
        config.system_instruction = system_instruction

    response = client.models.generate_content(
        model=MODEL_IMAGE,
        contents=prompt,
        config=config,
    )

    parts = []
    for part in response.candidates[0].content.parts:
        if part.text is not None:
            parts.append({"type": "text", "content": part.text})
        elif part.inline_data is not None:
            img_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
            parts.append({
                "type": "image",
                "data": img_b64,
                "mime_type": part.inline_data.mime_type,
            })

    return parts


async def generate_speech(
    text: str,
    voice_name: str = "Kore",
) -> bytes:
    """Generate speech audio from text using Gemini native TTS.

    Returns WAV audio bytes. Uses Gemini's native TTS model with
    distinct voice personalities per coach.
    """
    client = get_client()

    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name,
                )
            )
        ),
    )

    response = client.models.generate_content(
        model=MODEL_TTS,
        contents=text,
        config=config,
    )

    pcm_data = response.candidates[0].content.parts[0].inline_data.data

    # Convert raw PCM to WAV
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm_data)

    return buf.getvalue()
