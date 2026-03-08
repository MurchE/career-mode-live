# CLAUDE.md — Career Mode Live

## What This Is

Hackathon submission for the **Gemini Live Agent Challenge** (deadline March 16, 2026).
Category: **Creative Storyteller**.

Multi-agent voice career coaching panel: 3 AI personas (Chad, Dr. Reeves, Viktor) simultaneously listen, respond, debate each other, and provoke the user into discovering their authentic career narrative. Uses the "flat mirror" technique — AI generates a deliberately bad career summary, then uses the user's emotional pushback as the real coaching signal.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12 / FastAPI / uv |
| Frontend | Next.js 14 / TypeScript / TailwindCSS |
| AI | Google GenAI SDK (`google-genai`) / Gemini 2.5 Flash |
| Voice Input | Web Speech API (browser-native) |
| Voice Output | Google Cloud Text-to-Speech (Neural2, 3 distinct voices) |
| Google Cloud | Cloud TTS + Cloud Run (deployment) |
| Deploy | Docker / Cloud Run / Firebase Hosting |

## Running Locally

```bash
./run.sh
# or manually:
cd backend && uv run uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

Requires `GEMINI_API_KEY` in `backend/.env`.
Optional: `GOOGLE_APPLICATION_CREDENTIALS` for Cloud TTS (falls back to browser SpeechSynthesis).

## Architecture

- Backend orchestrates 3 coaches in sequence (each sees prior coaches' responses)
- Frontend renders responses with staggered animation (800ms) for panel discussion feel
- Voice input via Web Speech API, TTS via Google Cloud (3 distinct voices per coach)
- RPG character sheet generated from resume analysis (heuristic, no AI call)
- Narrative synthesis extracts career throughline after 2+ coaching rounds
- Thinking budget disabled on Gemini 2.5 Flash for fast, conversational responses

## Coaching Phases

1. **Flat Mirror** — deliberately generic career summary displayed as formal card
2. **Provocation** — panel probes user's pushback from 3 angles
3. **Free Discussion** — deep dive coaching conversation
4. **Synthesis** — explicit user-triggered throughline extraction (the payoff)

## Conventions

- Python: `uv` for deps, 3.12
- Frontend: Next.js App Router, Tailwind, Zustand for state
- API key: `GEMINI_API_KEY` env var (backend only)
- Dark theme: #0D1117 bg, #C9D1D9 text, #58A6FF accent
- Coach colors: Chad=#FF7B72, Reeves=#BC8CFF, Viktor=#79C0FF
- Synthesis/throughline color: #F0883E
