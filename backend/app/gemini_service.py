"""Gemini AI service with lazy client initialization.

Uses the google-genai SDK (NOT google-generativeai — that's the old one).
"""

import os
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


# Default model — Gemini 2.0 Flash for speed
MODEL = "gemini-2.0-flash"


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
    )
    if system_instruction:
        config.system_instruction = system_instruction

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
    )

    return response.text or ""


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
