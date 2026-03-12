"""Career Mode Live — Multi-Agent Voice Career Coaching Panel.

FastAPI backend for the Gemini Live Agent Challenge hackathon submission.
Orchestrates 3 AI coaching personas (Chad, Dr. Reeves, Viktor) that
listen, respond, debate, and provoke the user in a panel format.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from app.coaching_panel import run_panel, run_flat_mirror, run_provocation, run_narrative_synthesis, run_career_storyboard, extract_star_elements
from app.skill_analyzer import analyze_skills_from_text
from app.resume_parser import parse_resume_text
from app.gemini_service import get_client


# ---------------------------------------------------------------------------
# Lifespan — warm up Gemini client on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify API key is set
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        print("WARNING: No GEMINI_API_KEY or GOOGLE_API_KEY set. AI calls will fail.")
    else:
        print(f"Gemini API key configured (length {len(key)})")
    yield


app = FastAPI(
    title="Career Mode Live",
    description="Multi-agent voice career coaching panel powered by Gemini",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://career-mode-live.web.app",
        "https://career-mode-live.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    version: str


class PanelRequest(BaseModel):
    user_input: str
    conversation_history: list[dict] = []
    character_sheet: Optional[dict] = None
    coaching_phase: str = "free_discussion"  # flat_mirror | provocation | free_discussion


class CoachResponse(BaseModel):
    coach_id: str
    coach_name: str
    response: str
    color: str


class PanelResponse(BaseModel):
    responses: list[CoachResponse]
    phase: str
    suggested_phase: Optional[str] = None


class FlatMirrorRequest(BaseModel):
    resume_text: str


class FlatMirrorResponse(BaseModel):
    flat_mirror: str
    character_sheet: dict


class OnboardingRequest(BaseModel):
    resume_text: Optional[str] = None
    name: Optional[str] = None
    title: Optional[str] = None
    years_experience: Optional[int] = None
    background: Optional[str] = None


class OnboardingResponse(BaseModel):
    character_sheet: dict
    flat_mirror: str
    parsed_data: dict


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", version="0.1.0")


@app.post("/api/onboard", response_model=OnboardingResponse)
async def onboard_user(req: OnboardingRequest):
    """Process user onboarding — parse resume or manual input, generate character sheet + flat mirror."""
    # Build raw text from whatever we have
    parts = []
    if req.resume_text:
        parts.append(req.resume_text)
    if req.name:
        parts.append(f"Name: {req.name}")
    if req.title:
        parts.append(f"Title: {req.title}")
    if req.years_experience:
        parts.append(f"Years of experience: {req.years_experience}")
    if req.background:
        parts.append(f"Background: {req.background}")

    raw_text = "\n".join(parts) if parts else "No information provided."

    # Parse resume data
    parsed = parse_resume_text(raw_text)
    if req.name:
        parsed["name"] = req.name
    if req.title:
        parsed["title"] = req.title
    if req.years_experience:
        parsed["years_experience"] = req.years_experience

    # Analyze skills
    character_sheet = analyze_skills_from_text(parsed)

    # Generate flat mirror via Gemini
    flat_mirror = await run_flat_mirror(raw_text)

    return OnboardingResponse(
        character_sheet=character_sheet,
        flat_mirror=flat_mirror,
        parsed_data=parsed,
    )


@app.post("/api/coaching/panel", response_model=PanelResponse)
async def coaching_panel(req: PanelRequest):
    """Run the 3-coach panel on user input.

    Each coach sees what the previous coaches said, creating a
    building-on-each-other debate dynamic.
    """
    try:
        if req.coaching_phase == "provocation":
            responses = await run_provocation(
                user_input=req.user_input,
                conversation_history=req.conversation_history,
                character_sheet=req.character_sheet,
            )
        else:
            responses = await run_panel(
                user_input=req.user_input,
                conversation_history=req.conversation_history,
                character_sheet=req.character_sheet,
            )

        coach_responses = [
            CoachResponse(
                coach_id=r["coach_id"],
                coach_name=r["coach_name"],
                response=r["response"],
                color=r["color"],
            )
            for r in responses
        ]

        # Suggest next phase based on conversation length
        history_len = len(req.conversation_history)
        suggested = None
        if history_len == 0:
            suggested = "provocation"
        elif history_len < 4:
            suggested = "provocation"
        else:
            suggested = "free_discussion"

        return PanelResponse(
            responses=coach_responses,
            phase=req.coaching_phase,
            suggested_phase=suggested,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/skills/analyze")
async def analyze_skills(req: OnboardingRequest):
    """Analyze skills from resume text and return character sheet."""
    raw_text = req.resume_text or req.background or ""
    parsed = parse_resume_text(raw_text)
    if req.name:
        parsed["name"] = req.name
    if req.title:
        parsed["title"] = req.title
    if req.years_experience:
        parsed["years_experience"] = req.years_experience

    return analyze_skills_from_text(parsed)


# ---------------------------------------------------------------------------
# Narrative Synthesis — the payoff moment
# ---------------------------------------------------------------------------

class NarrativeRequest(BaseModel):
    conversation_history: list[dict]
    character_sheet: Optional[dict] = None


class NarrativeResponse(BaseModel):
    throughline: str
    evidence: list[str]
    reframe: str
    positioning_statement: str


@app.post("/api/coaching/synthesize", response_model=NarrativeResponse)
async def synthesize_narrative(req: NarrativeRequest):
    """Synthesize the career throughline from conversation history.

    Call this after 3+ rounds of coaching to generate the "aha" moment —
    the career narrative that the user couldn't have written themselves.
    """
    try:
        result = await run_narrative_synthesis(
            conversation_history=req.conversation_history,
            character_sheet=req.character_sheet,
        )
        return NarrativeResponse(
            throughline=result.get("throughline", ""),
            evidence=result.get("evidence", []),
            reframe=result.get("reframe", ""),
            positioning_statement=result.get("positioning_statement", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Text-to-Speech — Gemini native TTS with distinct voices per coach
# ---------------------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str
    coach_id: str = "viktor"  # chad | reeves | viktor


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Convert coach response to speech using Gemini native TTS.

    Each coach gets a distinct Gemini voice — Chad (Enceladus/breathy),
    Reeves (Kore/firm), Viktor (Puck/upbeat). This uses Gemini's native
    audio generation, not a separate Cloud TTS service.
    """
    from fastapi.responses import Response
    from app.gemini_service import generate_speech, COACH_TTS_VOICES

    try:
        voice = COACH_TTS_VOICES.get(req.coach_id, "Kore")
        wav_bytes = await generate_speech(text=req.text, voice_name=voice)

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": f"inline; filename={req.coach_id}_response.wav"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")


# ---------------------------------------------------------------------------
# STAR Element Extraction — Live Whiteboard
# ---------------------------------------------------------------------------

class StarExtractionRequest(BaseModel):
    user_input: str
    conversation_history: list[dict] = []
    existing_elements: list[dict] = []


class StarElementResponse(BaseModel):
    category: str
    content: str
    coach_id: str = ""
    coach_name: str = ""


class StarExtractionResponse(BaseModel):
    elements: list[StarElementResponse]


@app.post("/api/coaching/extract-star", response_model=StarExtractionResponse)
async def extract_star(req: StarExtractionRequest):
    """Extract STAR framework elements from the coaching conversation.

    Called after each coaching round to populate the live whiteboard.
    Returns only NEW elements not already present in existing_elements.
    """
    try:
        elements = await extract_star_elements(
            user_input=req.user_input,
            conversation_history=req.conversation_history,
            existing_elements=req.existing_elements,
        )
        return StarExtractionResponse(
            elements=[StarElementResponse(**el) for el in elements]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STAR extraction error: {str(e)}")


# ---------------------------------------------------------------------------
# Career Storyboard — interleaved text + image generation (Creative Storyteller)
# ---------------------------------------------------------------------------

class StoryboardRequest(BaseModel):
    narrative: dict  # from /api/coaching/synthesize
    conversation_history: list[dict]
    character_sheet: Optional[dict] = None


class StoryboardPart(BaseModel):
    type: str  # "text" or "image"
    content: Optional[str] = None  # for text
    data: Optional[str] = None  # base64 for images
    mime_type: Optional[str] = None  # for images


class StoryboardResponse(BaseModel):
    parts: list[StoryboardPart]


# ---------------------------------------------------------------------------
# Collaborative Whiteboard — AI Canvas Analysis (DrawTogether)
# ---------------------------------------------------------------------------

class WhiteboardAnalyzeRequest(BaseModel):
    image_base64: str
    canvas_width: int = 1200
    canvas_height: int = 800
    context: str = "career_coaching"
    existing_shapes: int = 0


@app.post("/api/whiteboard/analyze")
async def whiteboard_analyze(req: WhiteboardAnalyzeRequest):
    """Analyze canvas screenshot and return AI drawing commands.

    The AI sees what the user has drawn, understands it, and responds
    with structured drawing commands (circles, arrows, text, highlights)
    that the frontend renders with hand-drawn animated strokes.
    """
    from app.whiteboard_service import analyze_canvas

    try:
        result = await analyze_canvas(
            image_base64=req.image_base64,
            canvas_width=req.canvas_width,
            canvas_height=req.canvas_height,
            context=req.context,
            existing_shapes=req.existing_shapes,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whiteboard analysis error: {str(e)}")


# ---------------------------------------------------------------------------
# Gemini Live API Key — for DrawTogether client-side WebSocket
# ---------------------------------------------------------------------------

@app.get("/api/live/config")
async def live_config():
    """Return Gemini API key for client-side Live API WebSocket.

    In production this would use short-lived tokens or a WebSocket proxy.
    For the hackathon demo, we expose the key through the backend so it's
    not hardcoded in the frontend bundle.
    """
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="No Gemini API key configured")
    return {
        "api_key": key,
        "model": "models/gemini-2.0-flash-live-001",
        "voices": ["Kore", "Puck", "Charon", "Fenrir", "Aoede"],
    }


@app.post("/api/coaching/storyboard", response_model=StoryboardResponse)
async def generate_storyboard(req: StoryboardRequest):
    """Generate a visual career storyboard with interleaved text and images.

    This is the core Creative Storyteller capability — Gemini produces
    text narrative and AI-generated illustrations in a single output stream.
    Uses gemini-2.5-flash-image with response_modalities=['TEXT', 'IMAGE'].
    """
    try:
        parts = await run_career_storyboard(
            narrative=req.narrative,
            conversation_history=req.conversation_history,
            character_sheet=req.character_sheet,
        )
        return StoryboardResponse(
            parts=[StoryboardPart(**p) for p in parts]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storyboard error: {str(e)}")
